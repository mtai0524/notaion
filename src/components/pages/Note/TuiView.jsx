import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { format, addDays, addMonths, subMonths, startOfMonth, startOfWeek, isSameDay, isSameMonth } from 'date-fns';
import { wordStats, CHECKBOX_RE, toggleChecklistLine, notesToMarkdown, unsavedPromptAction } from './noteUtils';
import { mobileActionContext, swipePanelTarget } from './tuiMobile';
import {
  DEFAULT_SIZES, FOCUS_SHARES, loadSizes, saveSizes, applyDelta, sizesFromDrag, focusSizes, STEP, BIG_STEP,
} from './tuiResize';
import { CALLOUT_KINDS } from './noteFormat';
import { vimTextareaKey, continueListOnEnter } from './vimTextarea';
import Telescope from './Telescope';
import OptionsPopup from './OptionsPopup';
import {
  DEFAULT_TEXT, LOOK_FIELDS, TEXT_FIELDS, OPTION_TABS, defaultsFor, loadAppearance, saveAppearance, stepAppearance,
  appearanceStyle, textStyle, nextTextPanel,
} from './appearance';

// Options tabs whose rows are appearance fields (adjusted with ←/→).
const FIELD_TABS = { look: LOOK_FIELDS, text: TEXT_FIELDS };
import LineGutter from './LineGutter';
import Spinner from './Spinner';
import NotionEditor from './NotionEditor';
import './TuiView.scss';

// Notion-style "/" block menu for the body editor.
const SLASH_ITEMS = [
  { key: 'todo', label: 'To-do', hint: '- [ ]', snippet: '- [ ] ' },
  { key: 'h1', label: 'Heading 1', hint: '#', snippet: '# ' },
  { key: 'h2', label: 'Heading 2', hint: '##', snippet: '## ' },
  { key: 'h3', label: 'Heading 3', hint: '###', snippet: '### ' },
  { key: 'bullet', label: 'Bullet list', hint: '-', snippet: '- ' },
  { key: 'numbered', label: 'Numbered list', hint: '1.', snippet: '1. ' },
  { key: 'quote', label: 'Quote', hint: '>', snippet: '> ' },
  { key: 'toggle', label: 'Toggle list', hint: '> [>]', snippet: '> [>] Toggle\n    ', caret: 6 },
  { key: 'callout', label: 'Callout', hint: '> [!note]', snippet: '> [!note] ', caret: 10 },
  { key: 'info', label: 'Callout · info', hint: 'ℹ️', snippet: '> [!info] ', caret: 10 },
  { key: 'warning', label: 'Callout · warning', hint: '⚠️', snippet: '> [!warning] ', caret: 13 },
  { key: 'success', label: 'Callout · success', hint: '✅', snippet: '> [!success] ', caret: 13 },
  { key: 'danger', label: 'Callout · danger', hint: '🔥', snippet: '> [!danger] ', caret: 12 },
  { key: 'code', label: 'Code block', hint: '```', snippet: '```\n\n```', caret: 4 },
  { key: 'divider', label: 'Divider', hint: '---', snippet: '---\n' },
  { key: 'time', label: 'Time stamp', hint: 'HH:mm', snippet: null },
];

/**
 * Multi-panel TUI for Daily Notes, modelled on clin-rs (a ratatui note app):
 * three bordered panels — FOLDERS (category filter) · NOTES (list) · PREVIEW —
 * a tasteful editor palette (Catppuccin Mocha), Tab-to-cycle focus and vim keys.
 * Fully keyboard-driven; no "hacker" CRT styling.
 *
 * Focus cycles folders → notes → preview (Tab / h / l).
 * Within a panel: j/k move, Enter acts. See `?` for the full keymap.
 */
const PANELS = ['folders', 'notes', 'preview'];

const SORTS = [
  { key: 'created', label: 'created' },
  { key: 'title', label: 'title' },
  { key: 'updated', label: 'updated' },
];

const NOTE_FORMAT_KEY = 'daily-note-format';       // 'notion' | 'md'
const NVIM_KEY = 'daily-note-nvim';                // 'on' | 'off'
const FOCUS_EXPAND_KEY = 'daily-note-focus-expand'; // true | false
const FOCUS_SHARE_KEY = 'daily-note-focus-share';   // 50 | 60 | 70 (% for the focused panel)
const VIM_LINENO_KEY = 'daily-note-vim-lineno';   // 'on' | 'off'
const AUTOLIST_KEY = 'daily-note-autolist';        // Enter tự nối bullet/checkbox
const TAG_RE = /#([\p{L}0-9_-]{2,30})/gu;

const lsGet = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
};
const lsSet = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota — ignore */ }
};

/* Host-provided I/O (the web app and the desktop app each pass their own):
   onUploadFiles(files) → [{ originalName, cloudUrl, contentType }],
   onExportAll(format, { onProgress }) → summary string, onDownload(filename, text).
   newNoteSignal: bump it to open a new note (desktop quick capture). */
const TuiView = ({ notes, onAdd, onUpdate, onDelete, onDuplicate, onMoveToDate, onChangeDate, dateLabel, categories,
  allNotes, markedDates, onRestore, onGoToDate, loading, syncStatus,
  fullscreenOn, onToggleFullscreen, onUploadFiles, onExportAll, onDownload, newNoteSignal }) => {
  const [focus, setFocus] = useState('notes');
  const [folderIndex, setFolderIndex] = useState(0);
  const [noteIndex, setNoteIndex] = useState(0);
  const [mode, setMode] = useState('normal'); // normal | title | body | search | delete | help | category | move
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [pendingSelect, setPendingSelect] = useState(null); // id of a just-created note to select
  const [uploading, setUploading] = useState(false);
  const [slash, setSlash] = useState(null); // { start, filter, sel } — "/" menu in body editor
  const [collapsedToggles, setCollapsedToggles] = useState({}); // { 'noteId:lineIdx': true } — folded toggles
  const [noteFormat, setNoteFormat] = useState(() => lsGet(NOTE_FORMAT_KEY, 'notion')); // 'notion' | 'md'
  const [nvim, setNvim] = useState(() => lsGet(NVIM_KEY, 'off') === 'on'); // modal editing in the editor
  // Bàn phím ảo không có Esc — NORMAL mode là bẫy kẹt trên điện thoại. Chỉ tắt
  // nvim khi đang ở đúng layout mobile (≤768px + coarse pointer); màn desktop
  // trên laptop cảm ứng vẫn giữ nvim. Theo dõi change (resize / DevTools
  // emulation) thay vì đo một lần — đo một lần sẽ kẹt giá trị sai cả phiên.
  const [touchUi, setTouchUi] = useState(() =>
    window.matchMedia?.('(max-width: 768px) and (pointer: coarse)')?.matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 768px) and (pointer: coarse)');
    if (!mq?.addEventListener) return undefined;
    const onChange = (e) => setTouchUi(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const nvimOn = nvim && !touchUi;
  const [mdVim, setMdVim] = useState('normal'); // nvim mode for the markdown textarea: 'normal' | 'insert'
  const [vimLineNo, setVimLineNo] = useState(() => lsGet(VIM_LINENO_KEY, 'off') === 'on'); // nvim line numbers
  const [autoList, setAutoList] = useState(() => lsGet(AUTOLIST_KEY, 'on') === 'on'); // Enter continues lists
  const mdVimPending = useRef(null);            // 'g' | 'd' waiting for the 2nd key
  const vimStateRef = useRef({ register: null, undo: [], redo: [], anchor: null, count: '' }); // persistent vim state
  const [unsavedPrompt, setUnsavedPrompt] = useState(false); // "save changes?" confirm on exit
  const lineNoRef = useRef(null);               // nvim line-number gutter (scroll-synced)
  const [edCmd, setEdCmd] = useState(null);     // nvim Ex command-line in the editor (null = closed)
  const [showTele, setShowTele] = useState(false); // Telescope finder open
  const leaderRef = useRef(false);              // Space leader pending (list NORMAL)
  const [showCheatsheet, setShowCheatsheet] = useState(false); // markdown syntax hint panel
  const [livePreview, setLivePreview] = useState(false); // split editor + live rendered preview
  const [sortBy, setSortBy] = useState('created'); // created | title | status | updated
  const [showOptions, setShowOptions] = useState(false); // options popup (T)
  const [optTab, setOptTab] = useState('editor'); // active options tab
  const [optSel, setOptSel] = useState(-1); // keyboard row selection in the options tab; -1 = none
  const [appearance, setAppearance] = useState(loadAppearance); // APPEARANCE + per-panel TEXT settings
  const [textPanel, setTextPanel] = useState('notes'); // panel the TEXT tab is editing
  const [sizes, setSizes] = useState(loadSizes); // [folders, notes, preview] — % of .tui-body
  const [focusExpand, setFocusExpand] = useState(() => lsGet(FOCUS_EXPAND_KEY, false)); // widen the focused panel
  const [focusShare, setFocusShare] = useState(() => lsGet(FOCUS_SHARE_KEY, 60));
  const [zoomed, setZoomed] = useState(false); // focused panel fills the TUI (z); not persisted

  // Bề rộng thôi, KHÔNG dùng touchUi: touchUi cần cả pointer:coarse, nên cửa
  // sổ desktop hẹp <768px sẽ lọt qua trong khi CSS mobile đã áp — inline
  // flex khi đó sẽ đè lên layout mobile và phá nó.
  const [narrow, setNarrow] = useState(() =>
    window.matchMedia?.('(max-width: 768px)')?.matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 768px)');
    if (!mq?.addEventListener) return undefined;
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Chỉ ba-panel-desktop mới nhận inline flex; mobile để CSS lo.
  const sizingOn = !narrow;
  // Zoom (z) shows only the focused panel; phones already show one panel at a time.
  const zoomOn = zoomed && sizingOn;
  // Focus expand and zoom drive the widths themselves, so manual resizing pauses meanwhile.
  const resizeOn = sizingOn && !focusExpand && !zoomOn;
  const shownSizes = focusExpand ? focusSizes(focus, focusShare) : sizes;
  /* `%` tính theo TOÀN BỘ chiều rộng .tui-body, nhưng hai khe gap cũng ăn chỗ —
     cộng lại thành 100% + 2*gap và panel cuối bị đẩy tràn ra ngoài (mất viền
     phải). Trừ đi phần gap tương ứng tỉ lệ từng panel: tổng khớp đúng khung mà
     tỉ lệ giữ nguyên. Dùng var(--tui-gap) do .tui-body đặt nên chỉ có MỘT nơi
     khai báo khe — đổi trong SCSS là JS tự theo. */
  // Each panel carries its own TEXT variables; desktop also sets its width.
  const panelStyle = (i) => {
    const text = textStyle(appearance.text[PANELS[i]]);
    if (!sizingOn) return text;
    if (zoomOn) return { ...text, flex: '1 1 100%' };
    return { ...text, flex: `0 0 calc(${shownSizes[i]}% - var(--tui-gap) * 2 * ${shownSizes[i]} / 100)` };
  };
  const panelClass = (panel) => `${focus === panel ? 'focused' : ''} ${appearance.text[panel].textColor ? 'has-text-color' : ''}`;

  // ⛶ on a panel title: zoom that panel, or restore if it is already zoomed.
  const toggleZoom = (panel = focus) => {
    if (zoomOn && panel === focus) { setZoomed(false); return; }
    setFocus(panel);
    setZoomed(true);
  };
  const zoomButton = (panel) => (
    <button type="button" className="tui-zoom-btn" title={zoomOn && focus === panel ? 'Restore (z)' : 'Zoom panel (z)'}
            aria-label="Zoom panel" onClick={(e) => { e.stopPropagation(); toggleZoom(panel); }}>⛶</button>
  );

  const bodyRef = useRef(null);
  // Biên đang kéo (0 | 1 | null) — đọc đồng bộ trong pointermove nên vẫn cần
  // ref (state cập nhật không kịp trong cùng sự kiện). `dragging` (state) chỉ
  // dùng để React re-render và gắn class `tui-dragging` — mutate ref không
  // trigger render nên riêng nó không đủ để đổi className kịp lúc.
  const dragRef = useRef(null); // boundary đang kéo: 0 | 1 | null
  const [dragging, setDragging] = useState(false);

  /* Kéo một đường biên. Cập nhật liên tục theo con trỏ (không snap về bước 2%
     như bàn phím) — kéo chuột mà snap vào lưới thì thấy rít. */
  const dragMove = (clientX) => {
    const el = bodyRef.current;
    if (!el || dragRef.current === null) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    setSizes((s) => sizesFromDrag(s, dragRef.current, (clientX - r.left) / r.width));
  };

  const startDrag = (boundary, e) => {
    if (!resizeOn) return;
    dragRef.current = boundary;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const endDrag = (e) => {
    if (dragRef.current === null) return;
    dragRef.current = null;
    setDragging(false);
    // Có thể capture đã mất rồi (vd. sau khi effect bên dưới dọn dẹp state
    // giữa chừng drag) — releasePointerCapture ném lỗi nếu element không giữ
    // capture, nên kiểm tra trước khi gọi.
    const target = e?.currentTarget;
    if (target?.hasPointerCapture?.(e.pointerId)) {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // Capture đã bị trình duyệt thu hồi giữa hai lệnh gọi ở trên — bỏ qua.
      }
    }
  };

  // Debounce: kéo chuột bắn setSizes mỗi frame, không đập vào storage từng lần.
  useEffect(() => {
    const t = setTimeout(() => saveSizes(sizes), 300);
    return () => clearTimeout(t);
  }, [sizes]);

  // Cửa sổ co xuống mobile (hoặc bật focus expand) giữa lúc đang RESIZE → không còn biên
  // nào để chỉnh, thoát về NORMAL kẻo kẹt trong mode vô nghĩa.
  // Cùng lúc, nếu đang giữ chuột kéo splitter mà resizeOn tắt giữa chừng thì
  // {resizeOn && (...)} unmount luôn element đang giữ pointer capture — nó
  // biến mất khỏi DOM nên pointerup không bao giờ bắn tới, endDrag không
  // chạy. Dọn dragRef/dragging thủ công ở đây để .tui-body không kẹt class
  // tui-dragging và không còn resize theo di chuột khi không giữ nút nào.
  useEffect(() => {
    if (!resizeOn) {
      if (mode === 'resize') setMode('normal');
      dragRef.current = null;
      setDragging(false);
    }
  }, [resizeOn, mode]);
  const [tagFilter, setTagFilter] = useState(null); // '#tag' filter (lowercase, no #)
  const [cmd, setCmd] = useState(''); // ":" command line buffer
  const [count, setCount] = useState(''); // vim count prefix
  const [flash, setFlash] = useState(null); // transient status-bar message
  const [showCal, setShowCal] = useState(false); // keyboard-driven calendar (c)
  const [sheetOpen, setSheetOpen] = useState(null); // mobile action sheet: null | 'tools' | 'note'
  const [calCursor, setCalCursor] = useState(() => new Date()); // day highlighted in the calendar
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const undoRef = useRef([]); // undo stack (max 50)
  const redoRef = useRef([]);
  const flashTimerRef = useRef(null);
  // While true, the textarea's onBlur must NOT commit/close the editor —
  // opening the file dialog blurs the textarea, and we want to come back to it.
  const suppressBlurRef = useRef(false);
  const lpRef = useRef(null); // long-press trên note row: { timer, x, y, fired }

  const flashMsg = (msg) => {
    setFlash(msg);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), 3000);
  };

  const catOf = (n) => n?.customCategory || n?.category || 'MEMO';
  const catList = useMemo(() => (categories && categories.length ? categories : ['MEMO']), [categories]);

  // #tags harvested from titles + bodies of the day's notes.
  const dayTags = useMemo(() => {
    const m = {};
    notes.forEach((n) => {
      const found = new Set(
        [...String(n.title || '').matchAll(TAG_RE), ...String(n.content || '').matchAll(TAG_RE)]
          .map((x) => x[1].toLowerCase()),
      );
      found.forEach((t) => { m[t] = (m[t] || 0) + 1; });
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 24);
  }, [notes]);

  // FOLDERS = "ALL" + each category.
  const folders = useMemo(() => {
    const counts = {};
    notes.forEach((n) => { const c = catOf(n); counts[c] = (counts[c] || 0) + 1; });
    return [
      { key: 'ALL', label: 'ALL', count: notes.length },
      ...catList.map((c) => ({ key: c, label: c, count: counts[c] || 0 })),
    ];
  }, [notes, catList]);

  const activeFolder = folders[Math.min(folderIndex, folders.length - 1)] || folders[0];

  const hasTag = (n, tag) => {
    const probe = `${n.title || ''}\n${n.content || ''}`.toLowerCase();
    return probe.includes(`#${tag}`);
  };

  const list = useMemo(() => {
    let l = notes;
    if (activeFolder && activeFolder.key !== 'ALL') l = l.filter((n) => catOf(n) === activeFolder.key);
    if (tagFilter) l = l.filter((n) => hasTag(n, tagFilter));
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((n) => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q));
    }
    const cmp = {
      title: (a, b) => (a.title || '').localeCompare(b.title || ''),
      updated: (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
      created: (a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')),
    }[sortBy] || (() => 0);
    return [...l].sort(cmp);
  }, [notes, activeFolder, query, sortBy, tagFilter]);

  useEffect(() => { setNoteIndex((i) => Math.max(0, Math.min(i, list.length - 1))); }, [list.length]);
  useEffect(() => { rootRef.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    if (mode === 'title' || mode === 'body' || mode === 'search' || mode === 'command') {
      // Entering the md body with nvim on starts in NORMAL (like nvim opening a file).
      if (mode === 'body' && noteFormat === 'md' && nvimOn) { setMdVim('normal'); mdVimPending.current = null; }
      // Notion body has no textarea input — keep focus on the TUI root so
      // Esc / Ctrl+Enter (save/cancel) work; clicking a block takes over editing.
      // With nvim on the editor container owns the modal keys instead: it
      // focuses itself on mount, so don't yank focus back here (that made
      // NORMAL→INSERT impossible).
      if (mode === 'body' && noteFormat === 'notion') {
        if (!nvimOn) requestAnimationFrame(() => rootRef.current?.focus({ preventScroll: true }));
      } else {
        // preventScroll: the command/search input lives in the bottom status bar;
        // a plain focus() would scroll the page down to it and clip the top.
        requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      }
    } else {
      // Leaving an edit mode unmounts the focused input, which would drop DOM
      // focus (and all shortcuts) — hand it back to the TUI root.
      requestAnimationFrame(() => rootRef.current?.focus({ preventScroll: true }));
    }
  }, [mode]);

  // Closing an overlay unmounts whatever was DOM-focused inside it, dropping
  // focus to <body> and killing every shortcut — hand focus back to the TUI
  // root, unless an editor input owns it.
  useEffect(() => {
    if (showOptions) return;
    if (mode === 'title' || mode === 'body' || mode === 'search' || mode === 'command') return;
    requestAnimationFrame(() => rootRef.current?.focus({ preventScroll: true }));
  }, [showOptions]);

  const current = list[noteIndex] || null;

  // Once the freshly created note lands in the list, select it and open the
  // title editor — mirrors "n" in clin-rs.
  useEffect(() => {
    if (!pendingSelect) return;
    const idx = list.findIndex((n) => n.id === pendingSelect);
    if (idx >= 0) {
      setNoteIndex(idx);
      setDraft('');
      setMode('title');
      setPendingSelect(null);
    }
  }, [list, pendingSelect]);

  const moveFocus = (dir) => {
    const i = PANELS.indexOf(focus);
    setFocus(PANELS[(i + dir + PANELS.length) % PANELS.length]);
  };

  const editTitle = () => { if (current) { setDraft(current.title || ''); setMode('title'); } };
  const editBody = () => { if (current) { setFocus('preview'); setDraft(current.content || ''); setMode('body'); } };

  const goToday = () => {
    const [y, m, d] = dateLabel.split('-').map(Number);
    const cur = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    cur.setHours(0, 0, 0, 0);
    const delta = Math.round((today - cur) / 86400000);
    if (delta !== 0) onChangeDate(delta);
  };

  /* ── Undo / redo — every TUI mutation goes through these wrappers ── */
  const pushUndo = (entry) => {
    undoRef.current.push(entry);
    if (undoRef.current.length > 50) undoRef.current.shift();
    redoRef.current = [];
  };

  // Update with undo capture: remembers the previous values of exactly the
  // keys being changed.
  const doUpdate = (id, updates) => {
    const n = notes.find((x) => x.id === id);
    if (n) {
      const prev = {};
      Object.keys(updates).forEach((k) => { prev[k] = n[k]; });
      pushUndo({ type: 'update', id, prev, next: updates });
    }
    onUpdate(id, updates);
  };

  const doDelete = (n) => {
    if (!n) return;
    pushUndo({ type: 'delete', note: { ...n } });
    onDelete(n.id, true);
  };

  const undo = () => {
    const e = undoRef.current.pop();
    if (!e) { flashMsg('nothing to undo'); return; }
    redoRef.current.push(e);
    if (e.type === 'update') { onUpdate(e.id, e.prev); flashMsg('undo: edit'); }
    else if (e.type === 'delete') {
      if (onRestore) {
        onRestore(e.note);
        flashMsg(`undo: restored "${e.note.title || 'untitled'}"`);
      } else flashMsg('undo: cannot restore (no handler)');
    } else if (e.type === 'add') { onDelete(e.note.id, true); flashMsg('undo: create'); }
  };

  const redo = () => {
    const e = redoRef.current.pop();
    if (!e) { flashMsg('nothing to redo'); return; }
    undoRef.current.push(e);
    if (e.type === 'update') { onUpdate(e.id, e.next); flashMsg('redo: edit'); }
    else if (e.type === 'delete') { onDelete(e.note.id, true); flashMsg('redo: delete'); }
    else if (e.type === 'add') { if (onRestore) onRestore(e.note); flashMsg('redo: create'); }
  };

  // New notes inherit the active folder's category, so "n" inside TASK
  // creates a TASK note and it stays visible in the current filter.
  const createNote = (template) => {
    setFocus('notes');
    setQuery('');
    const cat = activeFolder && activeFolder.key !== 'ALL' ? activeFolder.key : null;
    return Promise.resolve(onAdd(template, cat ? { category: cat, customCategory: cat } : {})).then((created) => {
      if (created?.id) {
        pushUndo({ type: 'add', note: { ...created } });
        setPendingSelect(created.id);
      }
      return created;
    });
  };

  // Desktop quick capture bumps newNoteSignal (from its global shortcut).
  const lastNoteSignal = useRef(newNoteSignal);
  useEffect(() => {
    if (!newNoteSignal || newNoteSignal === lastNoteSignal.current) return;
    lastNoteSignal.current = newNoteSignal;
    createNote('blank');
  }, [newNoteSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollPreview = (dy) => previewRef.current?.scrollBy({ top: dy });

  /* ── Sort ── */
  const cycleSort = () => setSortBy((s) => SORTS[(SORTS.findIndex(x => x.key === s) + 1) % SORTS.length].key);

  /* Long-press (~500ms, không rê quá 10px) trên một note row mở action sheet
     cho đúng note đó. Tap thường vẫn drill vào preview như cũ. */
  const lpStart = (i, e) => {
    const t = e.touches?.[0];
    if (!t) return;
    lpRef.current = {
      x: t.clientX, y: t.clientY, fired: false,
      timer: setTimeout(() => {
        if (!lpRef.current) return;
        lpRef.current.fired = true;
        setNoteIndex(i);
        setSheetOpen('note');
      }, 500),
    };
  };
  const lpMove = (e) => {
    const s = lpRef.current;
    const t = e.touches?.[0];
    if (!s || !t) return;
    if (Math.abs(t.clientX - s.x) > 10 || Math.abs(t.clientY - s.y) > 10) {
      clearTimeout(s.timer);
      lpRef.current = null;
    }
  };
  const lpEnd = () => { if (lpRef.current) clearTimeout(lpRef.current.timer); };

  /* Vuốt ngang trên vùng panel → chuyển FOLDERS ↔ NOTES ↔ PREVIEW.
     Không kích hoạt khi đang soạn (xung đột chọn text / cuộn textarea). */
  const swipeRef = useRef(null); // { x, y } — điểm touchstart trên .tui-body
  const bodySwipeStart = (e) => {
    const t = e.touches?.[0];
    swipeRef.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const bodySwipeEnd = (e) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s || mode === 'body' || mode === 'title') return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const target = swipePanelTarget(focus, t.clientX - s.x, t.clientY - s.y);
    if (target) setFocus(target);
  };

  // Bàn phím ảo mobile: visualViewport.height = phần màn hình còn thấy được.
  // Đặt vào --tui-vvh để CSS co editor + giữ thanh action nổi trên bàn phím.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const apply = () => rootRef.current?.style.setProperty('--tui-vvh', `${vv.height}px`);
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
    };
  }, []);

  // Select a note once it shows up in the list (after a filter reset or a day jump).
  const [pendingJump, setPendingJump] = useState(null);
  useEffect(() => {
    if (!pendingJump) return;
    const idx = list.findIndex((n) => n.id === pendingJump);
    if (idx >= 0) { setNoteIndex(idx); setPendingJump(null); }
  }, [list, pendingJump]);

  // Note editing format: 'notion' (visual block editor) vs 'md' (raw markdown).
  const toggleNoteFormat = () => setNoteFormat((f) => {
    const n = f === 'notion' ? 'md' : 'notion';
    lsSet(NOTE_FORMAT_KEY, n);
    flashMsg(`note format: ${n === 'notion' ? 'Notion (blocks)' : 'Markdown (raw)'}`);
    return n;
  });

  const setNvimMode = (on) => { setNvim(on); lsSet(NVIM_KEY, on ? 'on' : 'off'); flashMsg(`nvim mode: ${on ? 'on' : 'off'}`); };
  const toggleNvim = () => setNvimMode(!nvim);
  const setLineNo = (on) => { setVimLineNo(on); lsSet(VIM_LINENO_KEY, on ? 'on' : 'off'); flashMsg(`nvim line numbers: ${on ? 'on' : 'off'}`); };
  const toggleLineNo = () => setLineNo(!vimLineNo);
  const toggleAutoList = () => setAutoList((v) => {
    lsSet(AUTOLIST_KEY, !v ? 'on' : 'off');
    flashMsg(`auto-continue lists: ${!v ? 'on' : 'off'}`);
    return !v;
  });

  const toggleFocusExpand = () => {
    const next = !focusExpand;
    setFocusExpand(next);
    lsSet(FOCUS_EXPAND_KEY, next);
    flashMsg(`focus expand: ${next ? 'on' : 'off'}`);
  };
  const cycleFocusShare = () => {
    const next = FOCUS_SHARES[(FOCUS_SHARES.indexOf(focusShare) + 1) % FOCUS_SHARES.length];
    setFocusShare(next);
    lsSet(FOCUS_SHARE_KEY, next);
    flashMsg(`focus size: ${next}%`);
  };

  const updateAppearance = (patch) => {
    if (!patch) return;
    const next = { ...appearance, ...patch };
    setAppearance(next);
    if (!saveAppearance(next)) flashMsg('could not save — browser storage is full');
  };
  const resetLook = () => {
    updateAppearance(defaultsFor(LOOK_FIELDS));
    flashMsg('appearance reset to default');
  };
  const updateText = (patch) => {
    if (!patch) return;
    updateAppearance({ text: { ...appearance.text, [textPanel]: { ...appearance.text[textPanel], ...patch } } });
  };
  const resetText = () => {
    updateAppearance({ text: { ...appearance.text, [textPanel]: { ...DEFAULT_TEXT } } });
    flashMsg(`${textPanel} text reset to default`);
  };

  // Options rows per tab: { label, value, on, run }. Rebuilt every render
  // so each `run` closes over fresh state.
  const optionRows = {
    editor: [
      { label: 'note format — Notion (blocks) / Markdown (raw)', value: noteFormat, on: noteFormat === 'notion',
        run: toggleNoteFormat },
      { label: 'nvim mode — modal editing in the editor', value: nvim ? 'on' : 'off', on: nvim,
        run: toggleNvim },
      { label: 'nvim line numbers — gutter on the left', value: vimLineNo ? 'on' : 'off', on: vimLineNo,
        run: toggleLineNo },
      { label: 'auto-continue lists — Enter continues bullets/checkboxes', value: autoList ? 'on' : 'off', on: autoList,
        run: toggleAutoList },
      { label: 'live preview — edit and rendered markdown side by side', value: livePreview ? 'on' : 'off', on: livePreview,
        run: () => setLivePreview((v) => !v) },
      { label: 'markdown cheatsheet — syntax reference', value: showCheatsheet ? 'on' : 'off', on: showCheatsheet,
        run: () => setShowCheatsheet((v) => !v) },
    ],
    view: [
      { label: 'sort — note ordering', value: sortBy, on: true,
        run: cycleSort },
      ...(onToggleFullscreen ? [{ label: 'fullscreen — hide header and toolbar', value: fullscreenOn ? 'on' : 'off',
        on: !!fullscreenOn, run: onToggleFullscreen }] : []),
      { label: 'focus expand — widen the focused panel, shrink the others', value: focusExpand ? 'on' : 'off', on: focusExpand,
        run: toggleFocusExpand },
      { label: 'focus size — width of the focused panel', value: `${focusShare}%`, on: false,
        run: cycleFocusShare },
    ],
  };

  // No row is selected on open / tab switch, so a stray ←/→ can't change a
  // value; j/k (or clicking a row) picks one first. The TEXT tab starts on
  // the panel you were in.
  const openOptions = () => { setOptSel(-1); setTextPanel(focus); setShowOptions(true); };
  const switchOptTab = (key) => { setOptTab(key); setOptSel(-1); };

  // Keyboard for the options popup. h/l/Tab switch tabs, j/k move; the
  // APPEARANCE and TEXT tabs adjust values with ←/→ instead of toggling rows.
  const handleOptionsKey = (e) => {
    const k = e.key;
    const keys = OPTION_TABS.map((t) => t.key);
    const fields = FIELD_TABS[optTab];
    const isLook = !!fields;
    const rows = fields || optionRows[optTab];
    if (k === 'Escape' || k === 'T' || k === 'q') setShowOptions(false);
    else if (k === 'Tab' || k === 'h' || k === 'l' || (!isLook && (k === 'ArrowLeft' || k === 'ArrowRight'))) {
      const dir = (k === 'h' || k === 'ArrowLeft' || (k === 'Tab' && e.shiftKey)) ? -1 : 1;
      switchOptTab(keys[(keys.indexOf(optTab) + dir + keys.length) % keys.length]);
    } else if (k === 'j' || k === 'ArrowDown') setOptSel((i) => Math.min(i + 1, rows.length - 1));
    else if (k === 'k' || k === 'ArrowUp') setOptSel((i) => Math.max(i - 1, 0));
    else if (k === 'A') updateAppearance(stepAppearance(appearance, 'accent', 1));
    else if (isLook && optSel >= 0 && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      const dir = k === 'ArrowRight' ? 1 : -1;
      const field = fields[optSel];
      if (optTab === 'look') updateAppearance(stepAppearance(appearance, field, dir));
      else if (field === 'panel') setTextPanel((panel) => nextTextPanel(panel, dir));
      else updateText(stepAppearance(appearance.text[textPanel], field, dir));
    } else if (isLook && k === 'Enter' && fields[optSel] === 'reset') {
      if (optTab === 'look') resetLook(); else resetText();
    }
    else if (!isLook && (k === 'Enter' || k === ' ')) rows[optSel]?.run();
    else if (!isLook && /^[1-9]$/.test(k) && +k <= rows.length) { setOptSel(+k - 1); rows[+k - 1].run(); }
    else return;
    e.preventDefault();
  };

  /* ── Jump to an absolute date via the day-delta prop ── */
  const gotoDate = (dStr) => {
    const delta = Math.round((new Date(`${dStr}T00:00:00`) - new Date(`${dateLabel}T00:00:00`)) / 86400000);
    if (Number.isFinite(delta) && delta !== 0) onChangeDate(delta);
  };

  /* ── Export: current day as Markdown ── */
  const exportDay = (toClipboard) => {
    const md = notesToMarkdown(dateLabel, list.length ? list : notes);
    if (toClipboard) {
      navigator.clipboard?.writeText(md)
        .then(() => flashMsg('markdown copied to clipboard'))
        .catch(() => flashMsg('clipboard blocked — use :export'));
    } else {
      Promise.resolve(onDownload(`daily-note-${dateLabel}.md`, md))
        .then(() => flashMsg(`exported daily-note-${dateLabel}.md`))
        .catch((err) => { console.error('[TUI-EXPORT-ERROR]', err); flashMsg(`export failed — ${err.message}`); });
    }
  };
  // Every day, not just the viewed one: 'md' | 'json' | 'zip' (zip also downloads images/files).
  const exportAllDataAsync = async (fileFormat) => {
    flashMsg(fileFormat === 'zip' ? 'exporting… downloading files' : 'exporting…');
    try {
      const summary = await onExportAll(fileFormat, {
        onProgress: (p) => { if (p.phase === 'files' && p.total > 0) flashMsg(`exporting… files ${p.done}/${p.total}`); },
      });
      flashMsg(summary);
    } catch (err) {
      console.error('[TUI-EXPORT-ERROR]', err);
      flashMsg(`export failed — ${err.message}`);
    }
  };

  /* ── ":" command line ── */
  const execCommand = (raw) => {
    const [name, ...args] = raw.trim().split(/\s+/);
    const arg = args[0];
    switch ((name || '').toLowerCase()) {
      case 'export':
        if (arg === 'all' || arg === 'md') exportAllDataAsync('md');
        else if (arg === 'json') exportAllDataAsync('json');
        else if (arg === 'zip') exportAllDataAsync('zip');
        else exportDay(arg === 'clip');
        break;
      case 'cal':
      case 'calendar': setShowCal(true); return; // keep mode; the overlay owns keys
      case 'tag':
        if (!arg || arg === 'off') { setTagFilter(null); flashMsg('tag filter off'); }
        else { setTagFilter(arg.replace(/^#/, '').toLowerCase()); flashMsg(`filter: #${arg.replace(/^#/, '')}`); }
        break;
      case 'sort':
        if (SORTS.some((s) => s.key === arg)) setSortBy(arg);
        else flashMsg(`usage: :sort ${SORTS.map((s) => s.key).join(' | ')}`);
        break;
      case 'goto':
        if (arg === 'today') goToday();
        else if (/^\d{4}-\d{2}-\d{2}$/.test(arg || '')) gotoDate(arg);
        else flashMsg('usage: :goto yyyy-mm-dd | today');
        break;
      case 'nvim':
        if (arg === 'off') setNvimMode(false);
        else if (arg === 'on') setNvimMode(true);
        else toggleNvim();
        break;
      case 'set':
        // :set number / :set nonumber (vim-style)
        if (arg === 'number' || arg === 'nu') setLineNo(true);
        else if (arg === 'nonumber' || arg === 'nonu') setLineNo(false);
        else flashMsg('usage: :set number | nonumber');
        break;
      case 'number': case 'nu': toggleLineNo(); break;
      case 'help': setMode('help'); return; // keep mode change
      case '': break;
      default: flashMsg(`unknown command :${name} — try :help`);
    }
    setMode('normal');
    setCmd('');
  };

  const commit = () => {
    if (mode !== 'title' && mode !== 'body') return;
    if (current) doUpdate(current.id, mode === 'title' ? { title: draft } : { content: draft });
    setMode('normal');
    setDraft('');
    setSlash(null);
  };

  /* ── Vim Ex commands in the editor (nvim NORMAL ":") ── */
  const saveBody = () => { if (current) doUpdate(current.id, { content: draft }); };
  const quitBody = () => { setMode('normal'); setDraft(''); setSlash(null); };
  const bodyDirty = () => !!current && draft !== (current.content || '');

  // "Save changes?" confirm shown when exiting the editor with unsaved changes.
  // y = save & exit · n = discard & exit · Esc/c = keep editing.
  useEffect(() => {
    if (!unsavedPrompt) return undefined;
    // Take focus out of the textarea: an IME composing there would swallow
    // y/n and type them into the note. suppressBlurRef keeps the blur from
    // committing; refocusing the textarea (Keep) clears it again.
    suppressBlurRef.current = true;
    rootRef.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      const action = unsavedPromptAction(e);
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      setUnsavedPrompt(false);
      if (action === 'keep') { requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true })); return; }
      if (action === 'save') saveBody();
      setMode('normal'); setDraft(''); setSlash(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      suppressBlurRef.current = false; // prompt closed (keys or buttons) — blur commits again
    };
  }, [unsavedPrompt]); // eslint-disable-line react-hooks/exhaustive-deps
  const execEditorEx = (raw) => {
    const c = (raw || '').trim();
    setEdCmd(null);
    suppressBlurRef.current = false;
    switch (c) {
      case 'w': case 'wa': saveBody(); flashMsg('written'); break;
      case 'wq': case 'x': case 'wqa': case 'xa': saveBody(); quitBody(); break;
      case 'q': case 'qa':
        if (bodyDirty()) flashMsg('E37: no write since last change (add ! to override)');
        else quitBody();
        break;
      case 'q!': case 'qa!': quitBody(); break;
      case 'e!': if (current) setDraft(current.content || ''); flashMsg('reloaded'); break;
      case 'noh': case 'nohlsearch': setQuery(''); flashMsg('search cleared'); break;
      case '': break;
      default: flashMsg(`not an editor command: :${c}`);
    }
  };

  /* ── "/" block menu (Notion-style) ── */
  const slashMatches = slash
    ? SLASH_ITEMS.filter((it) => it.key.startsWith(slash.filter) || it.label.toLowerCase().includes(slash.filter))
    : [];

  const applySlash = (item) => {
    if (!slash) return;
    const base = item.key === 'time' ? `${new Date().toTimeString().slice(0, 5)} ` : item.snippet;
    // Markdown blocks only work at a line start — when triggered mid-line,
    // break to a new line first (time stamp is inline, no break needed).
    const atLineStart = slash.start === 0 || draft[slash.start - 1] === '\n';
    const prefix = item.key !== 'time' && !atLineStart ? '\n' : '';
    const snippet = prefix + base;
    const head = draft.slice(0, slash.start);
    const tail = draft.slice(slash.start + 1 + slash.filter.length);
    const caret = slash.start + prefix.length + (item.caret ?? base.length);
    setDraft(head + snippet + tail);
    setSlash(null);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) { el.focus(); el.setSelectionRange(caret, caret); }
    });
  };

  /* ── Formatting toolbar (for users who don't know markdown) ── */

  // Wrap the current selection in `mark` (e.g. **bold**). If nothing is
  // selected, insert the marks and place the caret between them.
  const wrapSelection = (mark, placeholder = '') => {
    const el = inputRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const sel = draft.slice(s, e) || placeholder;
    const next = draft.slice(0, s) + mark + sel + mark + draft.slice(e);
    setDraft(next);
    const caretStart = s + mark.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caretStart, caretStart + sel.length);
    });
  };

  // Prefix the current line with `prefix` (e.g. "# ", "- ", "> ").
  const prefixLine = (prefix) => {
    const el = inputRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const lineStart = draft.lastIndexOf('\n', pos - 1) + 1;
    const next = draft.slice(0, lineStart) + prefix + draft.slice(lineStart);
    setDraft(next);
    const caret = pos + prefix.length;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  };

  // Insert a markdown link at the caret: [text](url).
  const insertLink = () => {
    const el = inputRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const text = draft.slice(s, e) || 'text';
    const snippet = `[${text}](url)`;
    setDraft(draft.slice(0, s) + snippet + draft.slice(e));
    // select the "url" placeholder so the user can type over it
    const urlStart = s + text.length + 3;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(urlStart, urlStart + 3); });
  };

  const FORMAT_BTNS = [
    { key: 'b', label: 'B', title: 'Bold (**text**)', run: () => wrapSelection('**', 'bold'), style: { fontWeight: 800 } },
    { key: 'i', label: 'I', title: 'Italic (*text*)', run: () => wrapSelection('*', 'italic'), style: { fontStyle: 'italic' } },
    { key: 's', label: 'S', title: 'Strikethrough (~~text~~)', run: () => wrapSelection('~~', 'text'), style: { textDecoration: 'line-through' } },
    { key: 'code', label: '</>', title: 'Inline code (`code`)', run: () => wrapSelection('`', 'code') },
    { key: 'h', label: 'H', title: 'Heading (# )', run: () => prefixLine('# ') },
    { key: 'ul', label: '•', title: 'Bullet list (- )', run: () => prefixLine('- ') },
    { key: 'todo', label: '☑', title: 'Checklist (- [ ] )', run: () => prefixLine('- [ ] ') },
    { key: 'quote', label: '❝', title: 'Quote (> )', run: () => prefixLine('> ') },
    { key: 'callout', label: '💡', title: 'Callout (> [!note] )', run: () => prefixLine('> [!note] ') },
    { key: 'toggle', label: '▸', title: 'Toggle (> [>] )', run: () => prefixLine('> [>] ') },
    { key: 'link', label: '🔗', title: 'Link ([text](url))', run: insertLink },
  ];

  // Render inline markdown (**bold**, *italic*, `code`, ~~strike~~) within one
  // line of text into React nodes. Deliberately small — enough that non-md
  // users see their formatting take effect without a full parser.
  // Click a [[wiki-link]]: same-day target → select it; another day → jump
  // there and select once loaded.
  const openWikiLink = (title) => {
    const t = title.trim().toLowerCase();
    const sameDay = notes.find((n) => (n.title || '').trim().toLowerCase() === t);
    if (sameDay) {
      setFolderIndex(0); setQuery(''); setTagFilter(null);
      setPendingJump(sameDay.id); setFocus('notes');
      return;
    }
    const other = (allNotes || []).find((n) => !n.isDeleted && (n.title || '').trim().toLowerCase() === t);
    if (other?.date) { gotoDate(other.date); setPendingJump(other.id); }
    else flashMsg(`[[${title}]] — no note with that title`);
  };

  const renderInline = (text, keyBase) => {
    const parts = [];
    const re = /(\[\[([^\]]+)\]\]|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|~~([^~]+)~~|#([\p{L}0-9_-]{2,30}))/gu;
    let last = 0;
    let m;
    let idx = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      if (m[2] !== undefined) {
        const wiki = m[2]; // capture — `m` mutates each iteration
        parts.push(
          <span key={`${keyBase}-${idx}`} className="tui-wikilink" title="Open linked note"
                onClick={(ev) => { ev.stopPropagation(); openWikiLink(wiki); }}>
            {wiki}
          </span>,
        );
      } else if (m[3] !== undefined) parts.push(<strong key={`${keyBase}-${idx}`}>{m[3]}</strong>);
      else if (m[4] !== undefined) parts.push(<em key={`${keyBase}-${idx}`}>{m[4]}</em>);
      else if (m[5] !== undefined) parts.push(<code key={`${keyBase}-${idx}`} className="tui-inline-code">{m[5]}</code>);
      else if (m[6] !== undefined) parts.push(<del key={`${keyBase}-${idx}`}>{m[6]}</del>);
      else if (m[7] !== undefined) {
        const raw = m[7];
        const tag = raw.toLowerCase();
        parts.push(
          <span key={`${keyBase}-${idx}`} className={`tui-tag-inline ${tagFilter === tag ? 'on' : ''}`}
                title="Filter by tag" onClick={(ev) => { ev.stopPropagation(); setTagFilter(tagFilter === tag ? null : tag); }}>
            #{raw}
          </span>,
        );
      }
      last = m.index + m[0].length;
      idx += 1;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length ? parts : text;
  };

  // Render a note's markdown body into JSX rows: checklists, images, file
  // links, headings, quotes, bullets — plus inline formatting. `interactive`
  // enables the click-to-toggle checkboxes (only makes sense on the saved note).
  // Render a single non-block line (checkbox, image, link, heading, quote,
  // bullet, hr, plain). Used for both top-level lines and callout/toggle bodies.
  const renderLine = (ln, li, interactive) => {
    const chk = ln.match(CHECKBOX_RE);
    if (chk) {
      const checked = !!chk[2].trim();
      return (
        <div key={li} className={`tui-check-line ${checked ? 'checked' : ''}`}
             title={interactive ? 'Click to toggle' : undefined}
             onClick={interactive ? (e) => {
               e.stopPropagation();
               const next = toggleChecklistLine(current.content, li);
               if (next !== null) doUpdate(current.id, { content: next });
             } : undefined}>
          <span className="tui-check-box">{checked ? '[x]' : '[ ]'}</span>
          <span className="tui-check-text">{renderInline(chk[4], li)}</span>
        </div>
      );
    }
    const img = ln.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (img) {
      return (
        <a key={li} href={img[2]} target="_blank" rel="noopener noreferrer"
           className="tui-pv-img" onClick={(e) => e.stopPropagation()}>
          <img src={img[2]} alt={img[1]} loading="lazy" />
        </a>
      );
    }
    const link = ln.match(/^\[([^\]]+)\]\(([^)]+)\)\s*$/);
    if (link) {
      return (
        <a key={li} href={link[2]} target="_blank" rel="noopener noreferrer"
           className="tui-pv-file" onClick={(e) => e.stopPropagation()}>{link[1]}</a>
      );
    }
    const heading = ln.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const lvl = heading[1].length;
      return <div key={li} className={`tui-pv-h tui-pv-h${lvl}`}>{renderInline(heading[2], li)}</div>;
    }
    if (/^[-*]\s+/.test(ln)) return <div key={li} className="tui-pv-bullet">{renderInline(ln.replace(/^[-*]\s+/, ''), li)}</div>;
    if (/^---+$/.test(ln.trim())) return <hr key={li} className="tui-pv-hr" />;
    return <div key={li} className="tui-pv-line">{ln ? renderInline(ln, li) : ' '}</div>;
  };

  const renderMarkdown = (text, interactive) => {
    if (!text) return <span className="tui-pv-empty">— empty —  (press i or click to edit)</span>;
    const lines = text.split('\n');
    const out = [];
    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li];

      // Toggle block: "> [>] title" + following indented (4-space) child lines.
      const tog = ln.match(/^>\s?\[>\]\s?(.*)$/);
      if (tog) {
        const start = li;
        const children = [];
        while (li + 1 < lines.length && /^\s{2,}\S/.test(lines[li + 1])) {
          li++;
          children.push([lines[li].replace(/^\s{2,}/, ''), li]);
        }
        const tkey = `${current?.id}:${start}`;
        const collapsed = !!collapsedToggles[tkey];
        out.push(
          <div key={start} className={`tui-pv-toggle ${collapsed ? 'collapsed' : ''}`}>
            <div className="tui-pv-toggle-head"
                 onClick={(e) => { e.stopPropagation(); setCollapsedToggles((m) => ({ ...m, [tkey]: !m[tkey] })); }}>
              <span className="tui-pv-toggle-caret">▸</span>
              <span className="tui-pv-toggle-title">{renderInline(tog[1] || 'Toggle', start)}</span>
            </div>
            {!collapsed && children.length > 0 && (
              <div className="tui-pv-toggle-body">
                {children.map(([c, ci]) => renderLine(c, ci, interactive))}
              </div>
            )}
          </div>,
        );
        continue;
      }

      // Callout block: "> [!kind] text" + following "> " continuation lines.
      const call = ln.match(/^>\s?\[!(\w+)\]\s?(.*)$/);
      if (call) {
        const kind = CALLOUT_KINDS[call[1].toLowerCase()] ? call[1].toLowerCase() : 'note';
        const bodyLines = [[call[2], li]];
        while (li + 1 < lines.length && /^>\s?(?!\[)/.test(lines[li + 1])) {
          li++;
          bodyLines.push([lines[li].replace(/^>\s?/, ''), li]);
        }
        out.push(
          <div key={call.index ?? li} className={`tui-pv-callout kind-${kind}`}>
            <span className="tui-pv-callout-icon">{CALLOUT_KINDS[kind].icon}</span>
            <div className="tui-pv-callout-body">
              {bodyLines.map(([c, ci]) => (
                <div key={ci} className="tui-pv-callout-line">{c ? renderInline(c, ci) : ' '}</div>
              ))}
            </div>
          </div>,
        );
        continue;
      }

      // Plain quote (no [!]/[>] marker).
      if (/^>\s?/.test(ln)) {
        out.push(<div key={li} className="tui-pv-quote">{renderInline(ln.replace(/^>\s?/, ''), li)}</div>);
        continue;
      }

      out.push(renderLine(ln, li, interactive));
    }
    return out;
  };

  // Track the caret: "/" after start-of-line or whitespace opens the menu
  // (Notion-style — works mid-line too); typing filters it. A "/" glued to a
  // word or another "/" (URLs like https://…) does NOT trigger it.
  const handleBodyChange = (e) => {
    // In nvim NORMAL/VISUAL, block all text mutation (IME/paste bypass keydown
    // preventDefault) — snap the textarea back to the current draft.
    if (nvimOn && noteFormat === 'md' && mode === 'body' && mdVim !== 'insert') {
      const el = e.target;
      const p = el.selectionStart;
      requestAnimationFrame(() => { if (el) { el.value = draft; el.setSelectionRange(p, p); } });
      return;
    }
    const val = e.target.value;
    setDraft(val);
    const m = val.slice(0, e.target.selectionStart).match(/(?:^|[\s\n])\/([a-zA-Z0-9-]*)$/);
    if (m) setSlash({ start: e.target.selectionStart - m[1].length - 1, filter: m[1].toLowerCase(), sel: 0 });
    else setSlash(null);
  };

  // Upload files → append markdown image/file links to the note body.
  // Shared by paste and the "attach" button. Because the upload is async and
  // the editor may close before it resolves, we write straight to the note via
  // onUpdate (source of truth), and also sync the live draft if still editing.
  const uploadFiles = async (files) => {
    const list = Array.from(files || []).filter((f) => f && f.size > 0);
    if (!list.length || !current) return;
    setUploading(true);
    try {
      const uploaded = await onUploadFiles(list);
      const md = (uploaded || []).map((f) => {
        const isImg = (f.contentType || '').startsWith('image/');
        return isImg ? `![${f.originalName}](${f.cloudUrl})` : `[📎 ${f.originalName}](${f.cloudUrl})`;
      }).filter(Boolean).join('\n');
      if (!md) return;
      const append = (prev) => (prev && !prev.endsWith('\n') ? `${prev}\n` : prev) + `${md}\n`;
      if (mode === 'body') {
        // editing: grow the draft (commit will persist it)
        setDraft((prev) => append(prev));
        requestAnimationFrame(() => inputRef.current?.focus());
      } else {
        // editor already closed: persist directly onto the note
        doUpdate(current.id, { content: append(current.content || '') });
      }
    } catch (err) {
      console.error('[TUI-UPLOAD-ERROR]', err);
      // eslint-disable-next-line no-alert
      alert('Upload failed — please try again.');
    } finally {
      setUploading(false);
      suppressBlurRef.current = false;
    }
  };

  const handleEditorPaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.kind === 'file') { const f = item.getAsFile(); if (f) files.push(f); }
    }
    if (!files.length) return;
    e.preventDefault();
    uploadFiles(files);
  };

  // Clicking anywhere outside an open editor must not strand the TUI in an
  // edit mode with no focused input (all shortcuts would go dead) — commit
  // the draft on blur instead.
  const onInputBlur = () => {
    if (suppressBlurRef.current) return; // file dialog / attach — stay in edit mode
    if (mode === 'search') setMode('normal');
    else commit();
  };

  const setCategory = (cat) => {
    if (current && cat) doUpdate(current.id, { category: cat, customCategory: cat });
  };

  const cycleCategory = (dir = 1) => {
    if (!current) return;
    const next = catList[(catList.indexOf(catOf(current)) + dir + catList.length) % catList.length];
    setCategory(next);
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    // Notion-mode body has no textarea to own Esc/Ctrl+Enter, so handle the
    // save/cancel keys here; block-internal keys (typing, Enter) are handled by
    // the contentEditable blocks and never reach this far.
    if (mode === 'body' && noteFormat === 'notion') {
      // With nvim on, Esc belongs to the editor first: its capture handler
      // flips INSERT→NORMAL and calls preventDefault. The event still bubbles
      // here, so consuming it again would exit the note on the very same
      // press — honour defaultPrevented and let the next Esc do the exit.
      if (e.key === 'Escape' && nvimOn && e.defaultPrevented) return;
      if (e.key === 'Escape') { e.preventDefault(); commit(); return; }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(); return; }
      return;
    }
    if (mode === 'title' || mode === 'body' || mode === 'search') return; // inputs handle their own keys

    if (mode === 'help') { setMode('normal'); e.preventDefault(); return; }
    if (mode === 'command') return; // the ":" input handles its own keys

    if (showOptions) { handleOptionsKey(e); return; }

    // Calendar overlay owns the keyboard: arrows/hjkl move the cursor day,
    // [ / ] page months, t jumps to today, Enter/Space picks, Esc/c/q close.
    if (showCal) {
      const move = (days) => setCalCursor((d) => addDays(d, days));
      if (e.key === 'ArrowLeft' || e.key === 'h') move(-1);
      else if (e.key === 'ArrowRight' || e.key === 'l') move(1);
      else if (e.key === 'ArrowUp' || e.key === 'k') move(-7);
      else if (e.key === 'ArrowDown' || e.key === 'j') move(7);
      else if (e.key === '[') setCalCursor((d) => subMonths(d, 1));
      else if (e.key === ']') setCalCursor((d) => addMonths(d, 1));
      else if (e.key === 't') setCalCursor(new Date());
      else if (e.key === 'Enter' || e.key === ' ') { onGoToDate?.(calCursor); setShowCal(false); }
      else if (e.key === 'Escape' || e.key === 'c' || e.key === 'q') setShowCal(false);
      e.preventDefault();
      return;
    }

    if (mode === 'delete') {
      // y/Enter confirms; n/Esc/anything else cancels.
      if ((e.key === 'y' || e.key === 'Y' || e.key === 'Enter') && current) doDelete(current);
      setMode('normal');
      e.preventDefault();
      return;
    }

    if (mode === 'category') {
      const idx = parseInt(e.key, 10);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= catList.length) setCategory(catList[idx - 1]);
      setMode('normal');
      e.preventDefault();
      return;
    }

    // Move mode: pick a target day for the current note.
    if (mode === 'move') {
      const map = { '1': 0, '2': 1, '3': -1, '7': 7 };
      if (e.key in map && current) onMoveToDate?.(current.id, map[e.key]);
      setMode('normal');
      e.preventDefault();
      return;
    }

    const k = e.key;

    // Ctrl/Cmd chords belong to the browser: copy, cut, paste, select-all,
    // find, reload… Without this, Ctrl+C matched `case 'c'` and popped the
    // calendar (swallowing the copy), Ctrl+A hijacked select-all into
    // "select all notes", etc. Our only own chord is Ctrl+d / Ctrl+u
    // (half-page scroll in the preview) — let just those through.
    if (e.ctrlKey || e.metaKey) {
      const ownChord = focus === 'preview' && (k === 'd' || k === 'u');
      if (!ownChord) return;
    }

    // RESIZE mode nuốt hẳn phím NORMAL: h/l/L/1/2/3 ở đây mang nghĩa resize
    // dù chúng đã có nghĩa khác ở NORMAL (vd L = focus preview, dòng ~1709).
    if (mode === 'resize') {
      e.preventDefault();
      if (k === 'Escape' || k === 'Enter') { setMode('normal'); return; }
      if (k === '=') { setSizes([...DEFAULT_SIZES]); return; }
      if (k === '1') { setFocus('folders'); return; }
      if (k === '2') { setFocus('notes'); return; }
      if (k === '3') { setFocus('preview'); return; }
      const dir = (k === 'l' || k === 'L' || k === 'ArrowRight') ? 1
        : (k === 'h' || k === 'H' || k === 'ArrowLeft') ? -1 : 0;
      if (dir) setSizes((s) => applyDelta(s, focus, dir * (k === 'H' || k === 'L' ? BIG_STEP : STEP)));
      return;
    }

    // Alt+h/l resize panel đang focus (kiểu Hyprland; Super bị compositor
    // nuốt nên không dùng được trong trình duyệt). PHẢI đứng trước switch(k):
    // guard trên chỉ chặn Ctrl/Meta, nên Alt+h/l sẽ rơi xuống case 'h'/'l'
    // (nhảy focus, dòng ~1708/1729) và chuyển panel thay vì resize.
    if (e.altKey && resizeOn) {
      // Shift capitalizes e.key (Alt+Shift+l arrives as 'L'), so match both cases.
      const dir = (k === 'l' || k === 'L' || k === 'ArrowRight') ? 1 : (k === 'h' || k === 'H' || k === 'ArrowLeft') ? -1 : 0;
      if (dir) {
        setSizes((s) => applyDelta(s, focus, dir * (e.shiftKey ? BIG_STEP : STEP)));
        e.preventDefault();
        return;
      }
    }

    // Vim count prefix. 1/2/3 stay panel switches when no count is pending —
    // start a count with 0 or 4-9 (e.g. 5j; 02j for "2j").
    if (/^\d$/.test(k) && (count !== '' || k === '0' || k >= '4')) {
      setCount((c) => (c + k).slice(0, 4));
      e.preventDefault();
      return;
    }
    const rep = Math.max(1, parseInt(count || '1', 10));
    const consumeCount = () => { if (count) setCount(''); };

    // (Telescope open keys — Ctrl+p, Space-leader — are handled in the root's
    //  onKeyDownCapture so child buttons/browser don't swallow them.)

    switch (k) {
      case 'Tab': moveFocus(e.shiftKey ? -1 : 1); e.preventDefault(); return;
      case '1': setFocus('folders'); e.preventDefault(); return;
      case '2': setFocus('notes'); e.preventDefault(); return;
      case '3': setFocus('preview'); e.preventDefault(); return;
      case 'z': if (sizingOn) toggleZoom(); e.preventDefault(); return;
      case 'R':
        if (resizeOn) setMode('resize');
        else if (zoomOn) flashMsg('a panel is zoomed — press z to restore, then resize');
        else if (focusExpand) flashMsg('focus expand is on — turn it off in Options → VIEW to resize panels');
        e.preventDefault();
        return;
      case '?': setMode('help'); e.preventDefault(); return;
      case '/': setMode('search'); e.preventDefault(); return;
      case ':': setCmd(''); setMode('command'); e.preventDefault(); return;
      case '[': onChangeDate(-rep); consumeCount(); e.preventDefault(); return;
      case ']': onChangeDate(rep); consumeCount(); e.preventDefault(); return;
      case 't': goToday(); e.preventDefault(); return;
      case 'f': setFolderIndex((i) => (i + 1) % folders.length); e.preventDefault(); return;
      case 'F': setFolderIndex((i) => (i - 1 + folders.length) % folders.length); e.preventDefault(); return;
      case 'n': createNote('blank'); e.preventDefault(); return;
      case 'N': createNote('todo'); e.preventDefault(); return;
      case 'm': if (current) setMode('category'); e.preventDefault(); return;
      case 'M': if (current) setMode('move'); e.preventDefault(); return;
      case 'S': cycleSort(); e.preventDefault(); return;
      case 'y': if (current) onDuplicate?.({ ...current }); e.preventDefault(); return;
      case 'T': openOptions(); e.preventDefault(); return;
      case 'c': setCalCursor(new Date(`${dateLabel}T00:00:00`)); setShowCal(true); e.preventDefault(); return;
      case 'u': if (!e.ctrlKey) { undo(); e.preventDefault(); return; } break;
      case 'U': redo(); e.preventDefault(); return;
      case 'Escape':
        if (count) setCount('');
        else if (zoomOn) setZoomed(false);
        else if (tagFilter) setTagFilter(null);
        else if (query) setQuery('');
        else setFocus('notes');
        e.preventDefault();
        return;
      default: break;
    }

    if (focus === 'folders') {
      if (k === 'j' || k === 'ArrowDown') setFolderIndex((i) => Math.min(i + rep, folders.length - 1));
      else if (k === 'k' || k === 'ArrowUp') setFolderIndex((i) => Math.max(i - rep, 0));
      else if (k === 'g') setFolderIndex(0);
      else if (k === 'G') setFolderIndex(folders.length - 1);
      else if (k === 'Enter' || k === 'l' || k === 'ArrowRight') setFocus('notes');
      else return;
      consumeCount();
      e.preventDefault();
      return;
    }

    if (focus === 'notes') {
      switch (k) {
        case 'j': case 'ArrowDown': setNoteIndex((i) => Math.min(i + rep, list.length - 1)); consumeCount(); break;
        case 'k': case 'ArrowUp': setNoteIndex((i) => Math.max(i - rep, 0)); consumeCount(); break;
        case 'g': setNoteIndex(0); break;
        case 'G': setNoteIndex(Math.max(0, list.length - 1)); break;
        case 'h': case 'ArrowLeft': setFocus('folders'); break;
        case 'l': case 'L': case 'ArrowRight': setFocus('preview'); break;
        case 'Enter': case 'e': editTitle(); break;
        case 'i': editBody(); break;
        case 'C': cycleCategory(1); break;
        case 'd': if (current) setMode('delete'); break;
        default: return;
      }
      e.preventDefault();
      return;
    }

    if (focus === 'preview') {
      switch (k) {
        case 'i': case 'Enter': editBody(); break;
        case 'e': editTitle(); break;
        case 'h': case 'ArrowLeft': setFocus('notes'); break;
        case 'j': case 'ArrowDown': scrollPreview(48); break;
        case 'k': case 'ArrowUp': scrollPreview(-48); break;
        case 'g': previewRef.current?.scrollTo({ top: 0 }); break;
        case 'G': previewRef.current?.scrollTo({ top: previewRef.current.scrollHeight }); break;
        case 'C': cycleCategory(1); break;
        case 'd':
          if (e.ctrlKey) scrollPreview((previewRef.current?.clientHeight || 400) / 2);
          else if (current) setMode('delete');
          break;
        case 'u':
          if (e.ctrlKey) scrollPreview(-(previewRef.current?.clientHeight || 400) / 2);
          else return;
          break;
        default: return;
      }
      e.preventDefault();
    }
  };

  // Nvim modal editing over the markdown textarea. Returns true if the key was
  // consumed by vim (caller should stop). Only active when nvim is on and we're
  // editing the md body.
  const handleMdVim = (e) => {
    if (!nvimOn || noteFormat !== 'md' || mode !== 'body') return false;
    const el = inputRef.current;
    if (!el) return false;
    // In NORMAL, Escape/Ctrl+Enter fall through to the normal exit/save flow.
    if (mdVim === 'normal' && (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey)))) return false;
    // NORMAL ":" opens the Ex command-line.
    if (mdVim === 'normal' && e.key === ':') { e.preventDefault(); suppressBlurRef.current = true; setEdCmd(''); return true; }
    // Seed text/pos live from the DOM (mouse may have moved the caret); carry the
    // persistent bits (register/undo/redo/anchor/count) from the ref.
    const vs = vimStateRef.current;
    const state = {
      text: draft, pos: el.selectionStart ?? draft.length, mode: mdVim, pending: mdVimPending.current,
      register: vs.register, undo: vs.undo, redo: vs.redo, anchor: vs.anchor, count: vs.count,
    };
    const next = vimTextareaKey(state, e);
    if (next === null) return false;       // INSERT typing → let the textarea handle it
    if (next.noop) { mdVimPending.current = null; vs.count = ''; e.preventDefault(); return true; } // swallow unmapped NORMAL keys
    e.preventDefault();
    mdVimPending.current = next.pending || null;
    // persist the vim buffers
    vs.register = next.register ?? vs.register;
    vs.undo = next.undo ?? vs.undo;
    vs.redo = next.redo ?? vs.redo;
    vs.anchor = next.anchor ?? null;
    vs.count = next.count || '';
    if (next.mode !== mdVim) setMdVim(next.mode);
    if (next.text !== draft) setDraft(next.text);
    // apply caret (or selection, in visual) after the value updates
    const p = next.pos;
    const isVisual = next.mode === 'visual' || next.mode === 'vline';
    const a = next.anchor;
    requestAnimationFrame(() => {
      const t = inputRef.current;
      if (!t) return;
      t.focus();
      if (isVisual && a != null) {
        const lo = Math.min(a, p); const hi = Math.max(a, p) + 1; // inclusive
        t.setSelectionRange(lo, Math.min(hi, t.value.length));
      } else {
        t.setSelectionRange(p, p);
      }
      scrollCaretIntoView(t, p);
    });
    return true;
  };

  // setSelectionRange moves the caret but never scrolls the textarea, so vim
  // motions (G, gg, j/k off-screen) leave the caret out of view. Scroll so the
  // caret's line is visible.
  const scrollCaretIntoView = (t, pos) => {
    const cs = window.getComputedStyle(t);
    let lineH = parseFloat(cs.lineHeight);
    if (!Number.isFinite(lineH) || lineH <= 0) lineH = (parseFloat(cs.fontSize) || 14) * 1.5;
    const padTop = parseFloat(cs.paddingTop) || 0;
    const line = t.value.slice(0, pos).split('\n').length - 1;   // 0-based caret line
    const caretTop = padTop + line * lineH;
    const viewTop = t.scrollTop;
    const viewBottom = viewTop + t.clientHeight;
    if (caretTop < viewTop) t.scrollTop = caretTop - lineH;                 // above view → scroll up
    else if (caretTop + lineH > viewBottom) t.scrollTop = caretTop - t.clientHeight + lineH * 2; // below → scroll down
  };

  const onInputKeyDown = (e) => {
    e.stopPropagation();
    if (handleMdVim(e)) return;
    // The "/" menu captures navigation keys while open. Compute matches from
    // the current filter so the closure always sees the live list; use a
    // functional setSlash so rapid presses don't stomp on each other.
    if (mode === 'body' && slash) {
      const matches = SLASH_ITEMS.filter(
        (it) => it.key.startsWith(slash.filter) || it.label.toLowerCase().includes(slash.filter)
      );
      if (matches.length > 0) {
        const len = matches.length;
        if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
          e.preventDefault();
          setSlash((s) => (s ? { ...s, sel: ((s.sel ?? 0) + 1) % len } : s));
          return;
        }
        if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
          e.preventDefault();
          setSlash((s) => (s ? { ...s, sel: ((s.sel ?? 0) - 1 + len) % len } : s));
          return;
        }
        if (e.key === 'Enter') { e.preventDefault(); applySlash(matches[Math.min(slash.sel ?? 0, len - 1)]); return; }
        if (e.key === 'Escape') { e.preventDefault(); setSlash(null); return; }
      }
    }
    // Enter khi đang gõ trên dòng danh sách → tự nối bullet/checkbox/số thứ tự
    // (Enter trên mục rỗng thì kết thúc danh sách). Chỉ khi thật sự đang gõ:
    // nvim tắt hoặc đang INSERT — NORMAL không sửa text.
    if (e.key === 'Enter' && mode === 'body' && !slash && autoList && !(e.ctrlKey || e.metaKey)
        && (!nvimOn || mdVim === 'insert')) {
      const el = e.target;
      if (el.selectionStart === el.selectionEnd) {
        const r = continueListOnEnter(el.value, el.selectionStart);
        if (r) {
          e.preventDefault();
          // Ghi thẳng vào DOM trước khi setDraft: phím kế tiếp (gõ nhanh) phải
          // thấy ngay text + caret mới — đặt caret qua rAF sẽ race với typing.
          el.value = r.text;
          el.setSelectionRange(r.pos, r.pos);
          setDraft(r.text);
          scrollCaretIntoView(el, r.pos);
          return;
        }
      }
    }
    // body edit is multi-line: Ctrl+Enter saves, Enter inserts newline.
    if (e.key === 'Enter' && (mode === 'title' || mode === 'search' || (mode === 'body' && (e.ctrlKey || e.metaKey)))) {
      e.preventDefault();
      if (mode === 'search') setMode('normal');
      else commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (mode === 'search') { setQuery(''); setMode('normal'); }
      else if (mode === 'body' && bodyDirty()) { setUnsavedPrompt(true); } // ask before discarding
      else { setMode('normal'); setDraft(''); }
    }
  };

  const filtered = list.length !== notes.length;

  // Condensed keymap — the essentials, grouped to fit one screen (no scroll).
  const helpSections = [
    {
      title: 'MOVE',
      rows: [
        ['1 / 2 / 3', 'folders · notes · preview'],
        ['Tab · h / l', 'cycle · panel left / right'],
        ['j / k · g / G', 'move · first / last'],
        ['f / F', 'folder filter next / prev'],
        ['Esc', 'clear search / back to notes'],
      ],
    },
    {
      title: 'EDIT',
      rows: [
        ['n / N', 'new note / todo'],
        ['Enter / e', 'edit title'],
        ['i', 'edit body · Ctrl+Enter saves'],
        ['y · d→y', 'duplicate · delete'],
        ['u / U', 'undo / redo'],
      ],
    },
    {
      title: 'ORGANIZE',
      rows: [
        [`m → 1-${catList.length}`, 'set category'],
        ['C', 'cycle category'],
        ['M → 1/2/3/7', 'move to day'],
        ['S', 'sort order'],
        ['T', 'options (format · nvim · preview)'],
      ],
    },
    {
      title: 'RESIZE PANEL',
      rows: [
        ['Alt+h / Alt+l', 'shrink / grow focused panel (2%)'],
        ['Alt+Shift+h/l', 'bigger step (8%)'],
        ['R', 'RESIZE mode — h/l · H/L · 1/2/3'],
        ['= (in RESIZE)', 'back to default sizes'],
        ['drag gap · Alt+drag', 'mouse resize · anywhere'],
        ['z · ⛶', 'zoom focused panel · z / Esc restore'],
      ],
    },
    {
      title: 'DATE & FIND',
      rows: [
        ['[ / ]', 'prev / next day (5] = +5)'],
        ['t', 'today'],
        ['c', 'calendar — arrows · Enter · Esc'],
        ['/', 'search this day'],
        ['Ctrl+p', 'Telescope finder (Space f in nvim)'],
      ],
    },
    {
      title: 'TEXT & CMD',
      rows: [
        ['#tag · [[link]]', 'chip filter · wiki-link'],
        ['/', 'block menu (in body)'],
        [':export | clip', 'this day as markdown'],
        [':export all | json | zip', 'every day · backup · + files'],
        [':goto yyyy-mm-dd', 'jump to a day'],
      ],
    },
  ];
  if (nvimOn) {
    helpSections.push({
      title: 'NVIM · modes & motion',
      rows: [
        ['i a A · o O', 'insert · open line below/above'],
        ['h j k l · ←↓↑→', 'move · e / w / b words · 0 / $ line'],
        ['gg / G', 'first / last · 3j 5w count prefix'],
        ['v / V', 'visual char / line → d y c'],
        ['Esc', 'back to NORMAL'],
      ],
    });
    helpSections.push({
      title: 'NVIM · edit',
      rows: [
        ['x · r{c} · ~', 'del char · replace · flip case'],
        ['dd cc yy', 'delete / change / yank line'],
        ['dw de d$ D', 'delete word / to word-end / to EOL'],
        ['cw C', 'change word / to EOL (→ insert)'],
        ['yy yw · p / P', 'yank · paste after / before'],
        ['u · Ctrl+r', 'undo · redo'],
        [': :w :wq :q!', 'save · save-quit · force-quit'],
        [':set number · Ctrl+p', 'line numbers · Telescope'],
      ],
    });
    helpSections.push({
      title: 'NVIM · markdown',
      rows: [
        ['gx', 'toggle checkbox · turn line into a task'],
        ['gs b · gs c', 'bold / code the word under cursor (toggle)'],
        ['o / O on a list line', 'new line keeps the bullet / box / number'],
        ['Enter (typing)', 'continues the list · Enter on empty item ends it'],
      ],
    });
  }
  const hints = {
    normal: '1/2/3:panel  j/k:move  i:body  u:undo  z:zoom  R:resize  c:calendar  T:options  :cmd  ?:help',
    category: '',
    move: '',
    title: '── EDIT TITLE ──  Enter:save  Esc:cancel',
    body: '── EDIT BODY ──  Ctrl+Enter:save  Esc:cancel  /:blocks  paste:attach file',
    delete: '',
    help: 'press any key to close',
    search: '',
    command: '',
    resize: '── RESIZE ──  h/l:±2%  H/L:±8%  1/2/3:panel  =:reset  Esc:done',
  };

  // Telescope finder sources (built here so every action helper is in scope).
  const teleSources = (() => {
    const noteItems = (allNotes || []).filter((n) => !n.isDeleted);
    const cmdItems = [
      { id: 'export', label: 'export markdown', run: () => exportDay(false) },
      { id: 'export-all', label: 'export all days (.md)', run: () => exportAllDataAsync('md') },
      { id: 'export-json', label: 'backup all (.json)', run: () => exportAllDataAsync('json') },
      { id: 'export-zip', label: 'export all + files (.zip)', run: () => exportAllDataAsync('zip') },
      { id: 'calendar', label: 'calendar', run: () => setShowCal(true) },
      { id: 'options', label: 'options popup', run: openOptions },
      { id: 'format', label: 'toggle Notion / Markdown', run: toggleNoteFormat },
      { id: 'nvim', label: 'toggle nvim mode', run: toggleNvim },
      { id: 'number', label: 'toggle line numbers', run: toggleLineNo },
      { id: 'today', label: 'go to today', run: goToday },
    ];
    const dateItems = Object.entries(markedDates || {})
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([d, n]) => ({ id: d, label: `${d} · ${n} note${n > 1 ? 's' : ''}`, date: d }));
    // Clean, single-line label for a note: title, else a stripped content
    // snippet (markdown noise removed, whitespace collapsed).
    const noteName = (n) => {
      const raw = (n.title && n.title.trim())
        || (n.content || '')
          .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
          .replace(/[#>*_`~-]/g, ' ')           // md punctuation
          .replace(/\s+/g, ' ')
          .trim();
      const s = (raw || 'untitled').slice(0, 70);
      return s;
    };
    return [
      { key: 'notes', label: 'Notes', items: noteItems, getKey: (n) => n.id,
        getName: noteName,
        getMeta: (n) => n.date || '',
        getLabel: (n) => `${n.title || ''} ${n.content || ''}`,
        getPreview: (n) => {
          const body = (n.content || '')
            .replace(/!\[([^\]]*)\]\([^)]*\)/g, '🖼 $1') // collapse images to a marker
            .slice(0, 900);
          return `${n.title || 'untitled'}\n${n.date || ''}\n${'─'.repeat(28)}\n${body}`;
        },
        onPick: (n) => { if (n.date && n.date !== dateLabel) gotoDate(n.date); setPendingJump(n.id); setFocus('notes'); } },
      { key: 'commands', label: 'Commands', items: cmdItems, getKey: (c) => c.id,
        getName: (c) => c.label, getLabel: (c) => c.label, getPreview: (c) => `Run: ${c.label}`, onPick: (c) => c.run() },
      { key: 'dates', label: 'Dates', items: dateItems, getKey: (d) => d.id,
        getName: (d) => d.label, getLabel: (d) => d.label, getPreview: (d) => d.label, onPick: (d) => gotoDate(d.date) },
    ];
  })();

  return (
    <div className={`tui ${appearance.accent ? 'has-accent' : ''} ${appearance.bgImage ? 'has-bg' : ''}`}
         style={appearanceStyle(appearance)} tabIndex={0} ref={rootRef} onKeyDown={handleKeyDown}
         onKeyDownCapture={(e) => {
           // Telescope open keys must be caught at CAPTURE phase: focus often sits
           // on a child <button> (note row / folder), which would swallow Space
           // (button click) and the browser swallows Ctrl+p (print) before the
           // bubbling handler sees them. Only in list context (not editing).
           if (mode === 'title' || mode === 'body' || mode === 'search' || mode === 'command') return;
           if (e.target.tagName === 'INPUT') return; // e.g. the background URL field in Options
           // stopPropagation so these keys don't ALSO reach the bubbling
           // handleKeyDown (where 'f' would cycle the folder → jumps to SYSTEM).
           if (e.key === 'p' && e.ctrlKey) { e.preventDefault(); e.stopPropagation(); setShowTele(true); return; }
           if (nvimOn && e.key === ' ') { e.preventDefault(); e.stopPropagation(); leaderRef.current = true; return; }
           if (nvimOn && leaderRef.current && e.key === 'f') { e.preventDefault(); e.stopPropagation(); leaderRef.current = false; setShowTele(true); return; }
           if (nvimOn && leaderRef.current) leaderRef.current = false; // any other key clears the leader
         }}
         onClick={(e) => {
           // Don't steal focus from an editable target — inputs, textareas, a
           // contentEditable block, or the Notion editor container itself
           // (it's tabIndex-focusable and owns the nvim keys; stealing focus
           // from it makes NORMAL→INSERT impossible). Otherwise clicking a
           // block yanks focus back to the root and the caret never lands.
           const t = e.target;
           const editable = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable
             || t.closest?.('[contenteditable="true"]') || t.closest?.('.notion-editor');
           if (!editable) rootRef.current?.focus({ preventScroll: true });
         }}>
      {/* Mobile: one panel at a time — this switcher only renders under 768px (CSS) */}
      <div className="tui-mobile-nav">
        <button type="button" className={focus === 'folders' ? 'on' : ''}
                onClick={() => setFocus('folders')}>◧ FOLDERS</button>
        <button type="button" className={focus === 'notes' ? 'on' : ''}
                onClick={() => setFocus('notes')}>☰ NOTES{list.length ? ` · ${list.length}` : ''}</button>
        <button type="button" className={focus === 'preview' ? 'on' : ''}
                onClick={() => setFocus('preview')}>◨ PREVIEW</button>
      </div>
      <div className={`tui-body ${dragging ? 'tui-dragging' : ''} ${focusExpand && sizingOn ? 'tui-focus-expand' : ''} ${zoomOn ? 'tui-zoomed' : ''}`} ref={bodyRef}
           onTouchStart={bodySwipeStart} onTouchEnd={bodySwipeEnd}
           onPointerDown={(e) => {
             // Alt+kéo ở bất kỳ đâu (kiểu Hyprland): điểm bắt đầu quyết định
             // biên nào bị kéo — trong FOLDERS thì biên trái, còn lại biên phải.
             if (!e.altKey || !resizeOn || e.button !== 0) return;
             const inFolders = e.target.closest?.('.tui-folders');
             startDrag(inFolders ? 0 : 1, e);
           }}
           onPointerMove={(e) => dragMove(e.clientX)}
           onPointerUp={endDrag}
           onPointerCancel={endDrag}
           onLostPointerCapture={endDrag}>
        {/* FOLDERS */}
        <div className={`tui-panel tui-folders ${panelClass('folders')}`} style={panelStyle(0)}>
          <span className="tui-panel-title"><kbd>1</kbd>FOLDERS{zoomButton('folders')}</span>
          <div className="tui-scroll">
            {folders.map((f, i) => (
              <div key={f.key} className={`tui-folder ${i === folderIndex ? 'sel' : ''} ${f.key === 'ALL' ? 'all' : ''}`}
                   onClick={() => { setFolderIndex(i); setFocus('notes'); }}>
                <span className="tui-folder-name">{f.label}</span>
                <span className={`tui-folder-count ${f.count === 0 ? 'zero' : ''}`}>{f.count}</span>
              </div>
            ))}

            {dayTags.length > 0 && (
              <div className="tui-tags">
                <div className="tui-side-h">TAGS</div>
                {dayTags.map(([tag, n]) => (
                  <button key={tag} type="button"
                          className={`tui-tag-chip ${tagFilter === tag ? 'on' : ''}`}
                          title={tagFilter === tag ? 'Clear tag filter' : `Filter #${tag}`}
                          onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>
                    #{tag}<span className="n">{n}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {resizeOn && (
          <div className="tui-resizer" role="separator" aria-orientation="vertical"
               aria-label="Resize folders panel"
               onPointerDown={(e) => { e.stopPropagation(); startDrag(0, e); }}
               onPointerMove={(e) => dragMove(e.clientX)}
               onPointerUp={endDrag} onPointerCancel={endDrag}
               onLostPointerCapture={endDrag} />
        )}

        {/* NOTES */}
        <div className={`tui-panel tui-notes ${panelClass('notes')}`} style={panelStyle(1)}>
          <span className="tui-panel-title">
            <kbd>2</kbd>NOTES{zoomButton('notes')}
            {loading && <Spinner label="loading" className="tui-title-spinner" />}
            {tagFilter && (
              <button type="button" className="tui-tagfilter-chip" title="Clear tag filter (Esc)"
                      onMouseDown={(e) => { e.preventDefault(); setTagFilter(null); }}>
                #{tagFilter} ×
              </button>
            )}
          </span>
          <div className="tui-scroll">
            {list.length === 0 ? (
              <div className="tui-empty">{query ? 'no matches' : 'no entries — press n / tap + New'}</div>
            ) : (
              list.map((n, i) => {
                const sel = i === noteIndex;
                const pendingDelete = mode === 'delete' && sel;
                return (
                  <div key={n.id}
                       ref={sel ? (el) => el?.scrollIntoView?.({ block: 'nearest' }) : null}
                       className={`tui-row ${sel ? 'sel' : ''} ${pendingDelete ? 'pending-delete' : ''}`}
                       onTouchStart={(e) => lpStart(i, e)}
                       onTouchMove={lpMove}
                       onTouchEnd={lpEnd}
                       onContextMenu={(e) => { if (lpRef.current?.fired) e.preventDefault(); }}
                       onClick={() => {
                         if (lpRef.current?.fired) { lpRef.current = null; return; } // long-press đã xử lý
                         setNoteIndex(i);
                         // phone: tapping a note drills into its preview
                         setFocus(window.matchMedia('(max-width: 768px)').matches ? 'preview' : 'notes');
                       }}
                       onDoubleClick={() => { setNoteIndex(i); setDraft(n.title || ''); setMode('title'); }}>
                    {sel && mode === 'title' && focus !== 'preview' ? (
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      <input ref={inputRef} autoFocus className="tui-input" value={draft}
                             onChange={(e) => setDraft(e.target.value)} onKeyDown={onInputKeyDown} onBlur={onInputBlur} placeholder="title…" />
                    ) : (
                      <span className="tui-title">{n.title || '(untitled)'}</span>
                    )}
                    {(() => {
                      let total = 0, doneCt = 0;
                      String(n.content || '').split('\n').forEach((l) => {
                        const cm = l.match(CHECKBOX_RE);
                        if (cm) { total += 1; if (cm[2].trim()) doneCt += 1; }
                      });
                      return total > 0
                        ? <span className={`tui-sub-chip ${doneCt === total ? 'full' : ''}`} title={`${doneCt}/${total} subtasks`}>▣ {doneCt}/{total}</span>
                        : null;
                    })()}
                    <button type="button" className="tui-row-del" title="Delete note (d)"
                            onClick={(e) => { e.stopPropagation(); setNoteIndex(i); setMode('delete'); }}>
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {resizeOn && (
          <div className="tui-resizer" role="separator" aria-orientation="vertical"
               aria-label="Resize notes panel"
               onPointerDown={(e) => { e.stopPropagation(); startDrag(1, e); }}
               onPointerMove={(e) => dragMove(e.clientX)}
               onPointerUp={endDrag} onPointerCancel={endDrag}
               onLostPointerCapture={endDrag} />
        )}

        {/* PREVIEW */}
        <div className={`tui-panel tui-preview ${panelClass('preview')}`} style={panelStyle(2)}>
          <span className="tui-panel-title"><kbd>3</kbd>PREVIEW{zoomButton('preview')}</span>
          {current ? (
            <div className="tui-scroll" ref={previewRef}>
              {mode === 'title' && focus === 'preview' ? (
                // eslint-disable-next-line jsx-a11y/no-autofocus
                <input ref={inputRef} autoFocus className="tui-input tui-pv-title-input" value={draft}
                       onChange={(e) => setDraft(e.target.value)} onKeyDown={onInputKeyDown} onBlur={onInputBlur}
                       placeholder="title…" />
              ) : (
                <div className="tui-pv-title" title="Click to edit title"
                     onClick={() => { setFocus('preview'); editTitle(); }}>
                  {current.title || '(untitled)'}
                </div>
              )}
              <div className="tui-pv-meta">
                <span className="tag">{catOf(current)}</span>
                {current.timestamp && <span> · {current.timestamp}</span>}
                {current.content && (() => {
                  const s = wordStats(current.content);
                  return <span> · {s.words}w · ~{s.minutes}m read</span>;
                })()}
              </div>
              {mode === 'body' && noteFormat === 'notion' ? (
                <div className="tui-editor-wrap notion">
                  <NotionEditor content={draft} onChange={setDraft} nvim={nvimOn} onEx={() => setEdCmd('')} />
                  {edCmd !== null && (
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    <div className="ed-cmdline">:<input autoFocus value={edCmd}
                      onChange={(e) => setEdCmd(e.target.value)}
                      onKeyDown={(e) => { e.stopPropagation();
                        if (e.key === 'Enter') { e.preventDefault(); execEditorEx(edCmd); }
                        else if (e.key === 'Escape') { e.preventDefault(); setEdCmd(null); suppressBlurRef.current = false; requestAnimationFrame(() => inputRef.current?.focus()); } }}
                      onBlur={() => { setEdCmd(null); suppressBlurRef.current = false; }}
                      placeholder="w · wq · q · q! · x · e! · noh" /></div>
                  )}
                  <div className="tui-editor-bar">
                    <input type="file" ref={fileInputRef} multiple accept="image/*,*" style={{ display: 'none' }}
                           onChange={(e) => {
                             if (e.target.files?.length) uploadFiles(e.target.files);
                             else suppressBlurRef.current = false;
                             e.target.value = '';
                           }} />
                    <button type="button" className="tui-attach-btn" title="Attach image / file"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              suppressBlurRef.current = true;
                              fileInputRef.current?.click();
                            }}>
                      📎 Attach
                    </button>
                    <span className="tui-editor-tip">
                      {uploading ? <Spinner label="uploading" /> : 'Ctrl+Enter to save · Esc to cancel · Options(T) → format'}
                    </span>
                  </div>
                </div>
              ) : mode === 'body' ? (
                <div className="tui-editor-wrap">
                  {/* Formatting toolbar — click to insert markdown so users who
                      don't know the syntax can still format their notes. */}
                  <div className="tui-format-bar">
                    {FORMAT_BTNS.map((b) => (
                      <button key={b.key} type="button" className="tui-fmt-btn" title={b.title}
                              style={b.style}
                              onMouseDown={(e) => { e.preventDefault(); b.run(); }}>
                        {b.label}
                      </button>
                    ))}
                    <span className="tui-fmt-sep" />
                    <button type="button"
                            className={`tui-fmt-toggle ${livePreview ? 'on' : ''}`}
                            title="Live preview — see how the markdown renders"
                            onMouseDown={(e) => { e.preventDefault(); setLivePreview((v) => !v); }}>
                      👁 Preview
                    </button>
                    <button type="button"
                            className={`tui-fmt-toggle ${showCheatsheet ? 'on' : ''}`}
                            title="Markdown syntax"
                            onMouseDown={(e) => { e.preventDefault(); setShowCheatsheet((v) => !v); }}>
                      ? Markdown
                    </button>
                  </div>

                  {showCheatsheet && (
                    <div className="tui-cheatsheet">
                      <div><code>**bold**</code> → <strong>bold</strong></div>
                      <div><code>*italic*</code> → <em>italic</em></div>
                      <div><code># Heading</code> → large heading</div>
                      <div><code>- item</code> → bullet list</div>
                      <div><code>- [ ] task</code> → checklist</div>
                      <div><code>&gt; quote</code> → block quote</div>
                      <div><code>`code`</code> → inline code</div>
                      <div><code>[text](url)</code> → link</div>
                      <div><code>&gt; [!note] …</code> → 💡 callout (info · warning · success · danger)</div>
                      <div><code>&gt; [&gt;] Title</code> → ▸ toggle (indent child lines by 4 spaces)</div>
                      <div className="tui-cheatsheet-tip">No need to memorise — just type normally, use the format buttons, or press <kbd>/</kbd> (Notion-style).</div>
                    </div>
                  )}

                  <div className={`tui-editor-split ${livePreview ? 'split' : ''}`}>
                    <div className="tui-editor-pane">
                      {slash && slashMatches.length > 0 && (
                        <div className="tui-slash">
                          {slashMatches.map((it, i) => {
                            const active = i === Math.min(slash.sel ?? 0, slashMatches.length - 1);
                            return (
                              <button key={it.key} type="button"
                                      ref={active ? (el) => el?.scrollIntoView({ block: 'nearest' }) : null}
                                      className={`tui-slash-item ${active ? 'sel' : ''}`}
                                      onMouseDown={(e) => { e.preventDefault(); applySlash(it); }}>
                                <span className="tui-slash-hint">{it.hint}</span>
                                <span>{it.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* Not readOnly in NORMAL: a readonly textarea hides the
                          caret. We block text mutation by intercepting keys in
                          handleMdVim; the caret stays visible + movable. */}
                      <div className={`tui-textarea-wrap ${nvimOn && vimLineNo ? 'with-lineno' : ''}`}>
                        {nvimOn && vimLineNo && (
                          <LineGutter text={draft} textareaRef={inputRef} gutterRef={lineNoRef} />
                        )}
                        <textarea
                                  ref={(el) => {
                                    inputRef.current = el;
                                    // Focus the editor when it mounts (entering body edit) so nvim
                                    // keys work without clicking. But NOT while the ":" command line
                                    // is open — it owns focus, and stealing it would close it.
                                    if (el && edCmd === null && document.activeElement !== el
                                        && !document.activeElement?.closest?.('.ed-cmdline')) {
                                      el.focus({ preventScroll: true });
                                    }
                                  }}
                                  className={`tui-textarea ${nvimOn && mdVim !== 'insert' ? 'vim-normal' : ''}`} value={draft}
                                  onChange={handleBodyChange} onKeyDown={onInputKeyDown} onBlur={onInputBlur}
                                  onBeforeInput={(e) => {
                                    // Catch ":" even when an IME/keyboard layout swallows the
                                    // keydown — opens the Ex command-line in NORMAL.
                                    if (nvimOn && mdVim !== 'insert') {
                                      e.preventDefault();
                                      if (mdVim === 'normal' && e.data === ':') { suppressBlurRef.current = true; setEdCmd(''); }
                                    }
                                  }}
                                  onFocus={() => { suppressBlurRef.current = false; }}
                                  onScroll={(e) => { if (lineNoRef.current) lineNoRef.current.scrollTop = e.target.scrollTop; }}
                                  onPaste={handleEditorPaste}
                                  placeholder="Write your note… (plain text is fine — or use the format buttons · press / to insert a block · paste images/files)" />
                      </div>
                    </div>
                    {livePreview && (
                      <div className="tui-editor-preview" aria-label="Live preview">
                        {renderMarkdown(draft, false)}
                      </div>
                    )}
                  </div>

                  {edCmd !== null && (
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    <div className="ed-cmdline">:<input autoFocus value={edCmd}
                      onChange={(e) => setEdCmd(e.target.value)}
                      onKeyDown={(e) => { e.stopPropagation();
                        if (e.key === 'Enter') { e.preventDefault(); execEditorEx(edCmd); }
                        else if (e.key === 'Escape') { e.preventDefault(); setEdCmd(null); suppressBlurRef.current = false; requestAnimationFrame(() => inputRef.current?.focus()); } }}
                      onBlur={() => { setEdCmd(null); suppressBlurRef.current = false; }}
                      placeholder="w · wq · q · q! · x · e! · noh" /></div>
                  )}
                  <div className="tui-editor-bar">
                    {nvimOn && (
                      <span className={`ne-vim-badge inline ${mdVim}`}>-- {mdVim === 'vline' ? 'V-LINE' : mdVim.toUpperCase()} --</span>
                    )}
                    <input type="file" ref={fileInputRef} multiple accept="image/*,*" style={{ display: 'none' }}
                           onChange={(e) => {
                             if (e.target.files?.length) uploadFiles(e.target.files);
                             else suppressBlurRef.current = false; // dialog cancelled
                             e.target.value = '';
                           }} />
                    <button type="button" className="tui-attach-btn" title="Attach image / file"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              suppressBlurRef.current = true; // keep editor open through the file dialog
                              fileInputRef.current?.click();
                            }}>
                      📎 Attach
                    </button>
                    {unsavedPrompt ? (
                      <span className="tui-unsaved-prompt">
                        Save changes?
                        <button type="button" className="tui-warn-btn yes"
                                onClick={() => { saveBody(); setUnsavedPrompt(false); setMode('normal'); setDraft(''); setSlash(null); }}>
                          Save (y)
                        </button>
                        <button type="button" className="tui-warn-btn no"
                                onClick={() => { setUnsavedPrompt(false); setMode('normal'); setDraft(''); setSlash(null); }}>
                          Discard (n)
                        </button>
                        <button type="button" className="tui-warn-btn"
                                onClick={() => { setUnsavedPrompt(false); requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true })); }}>
                          Keep (Esc)
                        </button>
                      </span>
                    ) : (
                      <span className="tui-editor-tip">
                        {uploading ? <Spinner label="uploading" /> : 'Ctrl+Enter to save · Esc to cancel'}
                      </span>
                    )}
                    {bodyDirty() && !unsavedPrompt && (
                      <span className="tui-dirty" title="Unsaved changes (Ctrl+Enter to save)">● unsaved</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="tui-pv-body"
                     onClick={() => { if (!window.getSelection?.().toString().trim()) editBody(); }}
                     title="Click to edit · select text to copy (Ctrl+C)">
                  {renderMarkdown(current.content, true)}
                </div>
              )}
            </div>
          ) : (
            <div className="tui-empty">no note selected</div>
          )}
        </div>
      </div>

      {/* Mobile bottom action bar — context-aware; CSS hides it above 768px */}
      <div className="tui-mobile-actions">
        {(() => {
          const ctx = mobileActionContext({ focus, mode, unsavedPrompt });
          if (ctx === 'unsaved') return (<>
            <button type="button" className="tma-btn primary"
                    onClick={() => { saveBody(); setUnsavedPrompt(false); setMode('normal'); setDraft(''); setSlash(null); }}>✓ Save</button>
            <button type="button" className="tma-btn danger"
                    onClick={() => { setUnsavedPrompt(false); setMode('normal'); setDraft(''); setSlash(null); }}>✕ Discard</button>
            <button type="button" className="tma-btn"
                    onClick={() => { setUnsavedPrompt(false); requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true })); }}>Keep</button>
          </>);
          if (ctx === 'editor') return (<>
            <button type="button" className="tma-btn primary"
                    onMouseDown={(e) => { e.preventDefault(); commit(); }}>✓ Save</button>
            <button type="button" className="tma-btn"
                    onMouseDown={(e) => { e.preventDefault();
                      if (mode === 'body' && bodyDirty()) setUnsavedPrompt(true);
                      else { setMode('normal'); setDraft(''); setSlash(null); } }}>✕ Cancel</button>
            {mode === 'body' && (
              <button type="button" className="tma-btn"
                      onMouseDown={(e) => { e.preventDefault(); suppressBlurRef.current = true; fileInputRef.current?.click(); }}>📎</button>
            )}
          </>);
          if (ctx === 'preview') return (<>
            <button type="button" className="tma-btn primary" onClick={editBody}>✎ Edit</button>
            <button type="button" className="tma-btn icon" onClick={() => setSheetOpen('note')}>⋯</button>
          </>);
          return (<>
            <button type="button" className="tma-btn primary" onClick={() => createNote('blank')}>+ New</button>
            <button type="button" className="tma-btn icon" onClick={() => setSheetOpen('tools')}>⋯</button>
          </>);
        })()}
      </div>

      {/* STATUS BAR — st-idle: trên mobile ẩn đi khi chỉ hiện thông tin tĩnh
          (giữ lại khi có confirm delete/category/…, flash, hay ô nhập) */}
      <div className={`tui-status ${!flash && !['command', 'search', 'delete', 'category', 'move'].includes(mode) ? 'st-idle' : ''}`}>
        {mode === 'command' ? (
          <span className="tui-search tui-cmdline">:<input ref={inputRef} className="tui-input inline" value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') { e.preventDefault(); execCommand(cmd); }
              else if (e.key === 'Escape') { e.preventDefault(); setCmd(''); setMode('normal'); }
            }}
            onBlur={() => { setCmd(''); setMode('normal'); }}
            placeholder="export · cal · tag x · sort title · goto yyyy-mm-dd · nvim · help" /></span>
        ) : mode === 'search' ? (
          <span className="tui-search">/<input ref={inputRef} className="tui-input inline" value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={onInputKeyDown} onBlur={onInputBlur} placeholder="search…" /></span>
        ) : mode === 'delete' ? (
          <span className="tui-warn">
            {`delete "${current?.title || 'untitled'}"?`}
            <button type="button" className="tui-warn-btn yes"
                    onClick={() => { if (current) doDelete(current); setMode('normal'); rootRef.current?.focus({ preventScroll: true }); }}>
              Yes (y)
            </button>
            <button type="button" className="tui-warn-btn no"
                    onClick={() => { setMode('normal'); rootRef.current?.focus({ preventScroll: true }); }}>
              No (n / Esc)
            </button>
          </span>
        ) : mode === 'category' ? (
          <span className="tui-cat-pick">
            set category:&nbsp;
            {catList.map((c, i) => (
              <span key={c} className={`tui-cat-opt ${catOf(current) === c ? 'cur' : ''}`}
                    onClick={() => { setCategory(c); setMode('normal'); }}>
                <kbd>{i + 1}</kbd>{c}
              </span>
            ))}
            <span className="tui-cat-esc">Esc:cancel</span>
          </span>
        ) : mode === 'move' ? (
          <span className="tui-cat-pick">
            move to:&nbsp;
            {[['1', 'Today', 0], ['2', 'Tomorrow', 1], ['3', 'Yesterday', -1], ['7', '+1 week', 7]].map(([k, lbl, off]) => (
              <span key={k} className="tui-cat-opt"
                    onClick={() => { if (current) onMoveToDate?.(current.id, off); setMode('normal'); }}>
                <kbd>{k}</kbd>{lbl}
              </span>
            ))}
            <span className="tui-cat-esc">Esc:cancel</span>
          </span>
        ) : (
          <>
            <span className={`tui-badge mode-${mode}`}>{mode === 'normal' ? 'NORMAL' : mode.toUpperCase()}</span>
            {zoomOn && (
              <button type="button" className="tui-zoom-tag" title="Restore (z / Esc)"
                      onClick={(e) => { e.stopPropagation(); setZoomed(false); }}>
                ⛶ {focus.toUpperCase()}
              </button>
            )}
            {count && <span className="tui-count-tag" title="Count prefix">{count}</span>}
            {flash ? <span className="tui-flash">{flash}</span> : <span className="tui-hints">{hints[mode]}</span>}
            <span className="tui-stat">{filtered ? `${list.length}/${notes.length} shown` : `${notes.length} notes`}</span>
            {syncStatus === 'saving' && <Spinner label="saving" className="tui-sync-spinner" />}
            <button type="button" className="tui-help-btn" title="Options (T)" aria-label="Options"
                    onClick={(e) => { e.stopPropagation(); openOptions(); }}>⚙</button>
            <button type="button" className="tui-help-btn" title="Keyboard shortcuts (?)"
                    onClick={(e) => { e.stopPropagation(); setMode('help'); rootRef.current?.focus({ preventScroll: true }); }}>?</button>
          </>
        )}
      </div>

      {mode === 'help' && (
        <div className="tui-help" onClick={() => setMode('normal')}>
          <div className="tui-help-box" onClick={(e) => e.stopPropagation()}>
            <div className="tui-help-head">
              <span className="tui-help-h">DAILY NOTES · TUI — KEYMAP</span>
              <button type="button" className="tui-help-close" title="Close (any key)"
                      onClick={() => { setMode('normal'); rootRef.current?.focus({ preventScroll: true }); }}>×</button>
            </div>
            <div className="tui-help-grid">
              {helpSections.map((sec) => (
                <section key={sec.title} className="tui-help-sec">
                  <h4>{sec.title}</h4>
                  <table>
                    <tbody>
                      {sec.rows.map(([keys, desc]) => (
                        <tr key={keys}>
                          <td><kbd>{keys}</kbd></td>
                          <td>{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
            <div className="tui-help-foot">press any key or click outside to close · <kbd>?</kbd> opens this popup</div>
          </div>
        </div>
      )}

      {/* ── Options popup (T / click ⚙) ── */}
      {showOptions && (
        <OptionsPopup tab={optTab} onTabChange={switchOptTab} sel={optSel} onSelChange={setOptSel}
                      tabRows={optionRows} appearance={appearance} onAppearanceChange={updateAppearance}
                      onAppearanceReset={resetLook} textPanel={textPanel} onTextPanelChange={setTextPanel}
                      onTextChange={updateText} onTextReset={resetText}
                      onError={flashMsg} onClose={() => setShowOptions(false)} />
      )}

      {showTele && (
        <Telescope sources={teleSources}
                   onClose={() => { setShowTele(false); requestAnimationFrame(() => rootRef.current?.focus({ preventScroll: true })); }} />
      )}

      {showCal && (
        <div className="tui-week-overlay" onClick={() => setShowCal(false)}>
          <div className="tui-cal-box" onClick={(e) => e.stopPropagation()}>
            <div className="tui-week-head">
              <span>CALENDAR — {format(calCursor, 'MMMM yyyy')}</span>
              <button type="button" title="Close (Esc)" onClick={() => setShowCal(false)}>×</button>
            </div>
            <div className="tui-cal-grid">
              {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((d) => (
                <span key={d} className="tui-cal-dow">{d}</span>
              ))}
              {(() => {
                const first = startOfWeek(startOfMonth(calCursor), { weekStartsOn: 1 });
                const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
                const todayD = new Date();
                const curDay = new Date(`${dateLabel}T00:00:00`);
                return days.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const count = (markedDates && markedDates[key]) || 0;
                  const cls = [
                    'tui-cal-day',
                    isSameMonth(day, calCursor) ? '' : 'other-month',
                    isSameDay(day, calCursor) ? 'cursor' : '',
                    isSameDay(day, curDay) ? 'current' : '',
                    isSameDay(day, todayD) ? 'today' : '',
                    count > 0 ? 'has-notes' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <button
                      key={key}
                      type="button"
                      className={cls}
                      title={count > 0 ? `${key} · ${count} note${count > 1 ? 's' : ''}` : key}
                      onClick={() => { onGoToDate?.(day); setShowCal(false); }}
                      onMouseEnter={() => setCalCursor(day)}
                    >
                      {format(day, 'd')}
                      {count > 0 && <span className="tui-cal-dot" />}
                    </button>
                  );
                });
              })()}
            </div>
            <div className="tui-week-foot">
              <span>←↑↓→ / hjkl move · [ ] month · t today · Enter open · Esc close</span>
            </div>
          </div>
        </div>
      )}

      {/* Mobile action sheet — long-press trên note row hoặc nút ⋯ */}
      {sheetOpen && (
        <div className="tui-sheet-backdrop" onClick={() => setSheetOpen(null)}>
          <div className="tui-action-sheet" onClick={(e) => e.stopPropagation()}>
            {sheetOpen === 'note' && current ? (<>
              <div className="tui-sheet-title">{current.title || '(untitled)'}</div>
              <button type="button" onClick={() => { setSheetOpen(null); editBody(); }}>✎ Edit content</button>
              <button type="button" onClick={() => { setSheetOpen(null); setMode('category'); }}>🏷 Category</button>
              <button type="button" className="danger"
                      onClick={() => { setSheetOpen(null); setMode('delete'); }}>🗑 Delete</button>
            </>) : (<>
              {onToggleFullscreen && (
                <button type="button" onClick={() => { onToggleFullscreen(); setSheetOpen(null); }}>
                  ⛶ Fullscreen {fullscreenOn ? 'off' : 'on'}</button>
              )}
              <button type="button" onClick={() => { setSheetOpen(null); setShowTele(true); }}>🔍 Search notes</button>
              <button type="button" onClick={() => { setSheetOpen(null); setShowCal(true); }}>📅 Calendar</button>
              <button type="button" onClick={() => { setSheetOpen(null); openOptions(); }}>⚙ Options</button>
              <button type="button" onClick={() => { setSheetOpen(null); setMode('help'); }}>? Help</button>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
};

TuiView.propTypes = {
  notes: PropTypes.array.isRequired,
  onAdd: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onDuplicate: PropTypes.func,
  onMoveToDate: PropTypes.func,
  onChangeDate: PropTypes.func.isRequired,
  dateLabel: PropTypes.string.isRequired,
  categories: PropTypes.array,
  allNotes: PropTypes.array,
  markedDates: PropTypes.object,
  loading: PropTypes.bool,
  syncStatus: PropTypes.string,
  onRestore: PropTypes.func,
  onGoToDate: PropTypes.func,
  fullscreenOn: PropTypes.bool,
  onToggleFullscreen: PropTypes.func,
  onUploadFiles: PropTypes.func.isRequired,
  onExportAll: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  newNoteSignal: PropTypes.number,
};

export default TuiView;
