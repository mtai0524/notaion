import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { wordStats, CHECKBOX_RE, toggleChecklistLine } from './noteUtils';
import { uploadFilesToCloudinary } from '../../../services/fileService';
import './TuiView.scss';

// Notion-style "/" block menu for the body editor.
const SLASH_ITEMS = [
  { key: 'todo', label: 'To-do', hint: '- [ ]', snippet: '- [ ] ' },
  { key: 'h1', label: 'Heading 1', hint: '#', snippet: '# ' },
  { key: 'h2', label: 'Heading 2', hint: '##', snippet: '## ' },
  { key: 'bullet', label: 'Bullet list', hint: '-', snippet: '- ' },
  { key: 'numbered', label: 'Numbered list', hint: '1.', snippet: '1. ' },
  { key: 'quote', label: 'Quote', hint: '>', snippet: '> ' },
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
  { key: 'status', label: 'status' },
  { key: 'updated', label: 'updated' },
];

const TuiView = ({ notes, onAdd, onUpdate, onDelete, onDuplicate, onMoveToDate, onChangeDate, dateLabel, categories }) => {
  const [focus, setFocus] = useState('notes');
  const [folderIndex, setFolderIndex] = useState(0);
  const [noteIndex, setNoteIndex] = useState(0);
  const [mode, setMode] = useState('normal'); // normal | title | body | search | delete | help | category | move
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [pendingSelect, setPendingSelect] = useState(null); // id of a just-created note to select
  const [uploading, setUploading] = useState(false);
  const [slash, setSlash] = useState(null); // { start, filter, sel } — "/" menu in body editor
  const [showCheatsheet, setShowCheatsheet] = useState(false); // markdown syntax hint panel
  const [livePreview, setLivePreview] = useState(false); // split editor + live rendered preview
  const [sortBy, setSortBy] = useState('created'); // created | title | status | updated
  const [selectedIds, setSelectedIds] = useState([]); // multi-select for bulk actions
  const [pomodoro, setPomodoro] = useState(null); // { noteId, endsAt, remaining, running }
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  // While true, the textarea's onBlur must NOT commit/close the editor —
  // opening the file dialog blurs the textarea, and we want to come back to it.
  const suppressBlurRef = useRef(false);

  const catOf = (n) => n?.customCategory || n?.category || 'MEMO';
  const catList = categories && categories.length ? categories : ['MEMO'];

  // FOLDERS = "ALL" + each category, with live counts.
  const folders = useMemo(() => {
    const cats = categories && categories.length ? categories : ['MEMO'];
    const counts = {};
    notes.forEach((n) => { const c = catOf(n); counts[c] = (counts[c] || 0) + 1; });
    return [{ key: 'ALL', label: 'ALL', count: notes.length }, ...cats.map((c) => ({ key: c, label: c, count: counts[c] || 0 }))];
  }, [notes, categories]);

  const activeFolder = folders[Math.min(folderIndex, folders.length - 1)] || folders[0];

  const list = useMemo(() => {
    let l = notes;
    if (activeFolder && activeFolder.key !== 'ALL') l = l.filter((n) => catOf(n) === activeFolder.key);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((n) => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q));
    }
    // Sort by the chosen key, then always float pinned notes to the top.
    const cmp = {
      title: (a, b) => (a.title || '').localeCompare(b.title || ''),
      status: (a, b) => (a.isCompleted ? 1 : 0) - (b.isCompleted ? 1 : 0),
      updated: (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
      created: (a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')),
    }[sortBy] || (() => 0);
    return [...l].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return cmp(a, b);
    });
  }, [notes, activeFolder, query, sortBy]);

  useEffect(() => { setNoteIndex((i) => Math.max(0, Math.min(i, list.length - 1))); }, [list.length]);
  useEffect(() => { rootRef.current?.focus({ preventScroll: true }); }, []);

  // Pomodoro countdown — ticks every second while running; notifies at 0.
  useEffect(() => {
    if (!pomodoro?.running) return undefined;
    const id = setInterval(() => {
      setPomodoro((p) => {
        if (!p || !p.running) return p;
        if (p.remaining <= 1) {
          try { if (Notification?.permission === 'granted') new Notification('🍅 Pomodoro xong!', { body: 'Nghỉ một chút nhé.' }); } catch { /* ignore */ }
          return { ...p, remaining: 0, running: false };
        }
        return { ...p, remaining: p.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pomodoro?.running]);
  useEffect(() => {
    if (mode === 'title' || mode === 'body' || mode === 'search') {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      // Leaving an edit mode unmounts the focused input, which would drop DOM
      // focus (and all shortcuts) — hand it back to the TUI root.
      requestAnimationFrame(() => rootRef.current?.focus({ preventScroll: true }));
    }
  }, [mode]);

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
  const editBody = () => { if (current) { setDraft(current.content || ''); setMode('body'); } };

  const goToday = () => {
    const [y, m, d] = dateLabel.split('-').map(Number);
    const cur = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    cur.setHours(0, 0, 0, 0);
    const delta = Math.round((today - cur) / 86400000);
    if (delta !== 0) onChangeDate(delta);
  };

  // New notes inherit the active folder's category, so "n" inside TASK
  // creates a TASK note and it stays visible in the current filter.
  const createNote = (template) => {
    setFocus('notes');
    setQuery('');
    const cat = activeFolder && activeFolder.key !== 'ALL' ? activeFolder.key : null;
    const overrides = cat ? { category: cat, customCategory: cat } : {};
    Promise.resolve(onAdd(template, null, null, overrides)).then((created) => {
      if (created?.id) setPendingSelect(created.id);
    });
  };

  const toggleDone = () => { if (current) onUpdate(current.id, { isCompleted: !current.isCompleted }); };

  const scrollPreview = (dy) => previewRef.current?.scrollBy({ top: dy });

  /* ── Pin / sort ── */
  const togglePin = () => { if (current) onUpdate(current.id, { pinned: !current.pinned }); };
  const cycleSort = () => setSortBy((s) => SORTS[(SORTS.findIndex(x => x.key === s) + 1) % SORTS.length].key);

  /* ── Multi-select / bulk actions ── */
  const toggleSelect = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const clearSelection = () => setSelectedIds([]);
  const selectAllVisible = () => setSelectedIds(list.map(n => n.id));
  const bulkTargets = () => (selectedIds.length ? list.filter(n => selectedIds.includes(n.id)) : (current ? [current] : []));
  const bulkComplete = (done) => { bulkTargets().forEach(n => onUpdate(n.id, { isCompleted: done })); };
  const bulkCategory = (cat) => { bulkTargets().forEach(n => onUpdate(n.id, { category: cat, customCategory: cat })); };
  const bulkDelete = () => { bulkTargets().forEach(n => onDelete(n.id, true)); clearSelection(); };
  const bulkMove = (offset) => { bulkTargets().forEach(n => onMoveToDate?.(n.id, offset)); clearSelection(); };

  /* ── Pomodoro focus timer (25 min) bound to the selected note ── */
  const startPomodoro = () => {
    if (!current) return;
    setPomodoro({ noteId: current.id, remaining: 25 * 60, running: true });
  };
  const stopPomodoro = () => setPomodoro(null);
  const togglePomodoro = () => setPomodoro((p) => (p ? { ...p, running: !p.running } : p));

  const commit = () => {
    if (mode !== 'title' && mode !== 'body') return;
    if (current) onUpdate(current.id, mode === 'title' ? { title: draft } : { content: draft });
    setMode('normal');
    setDraft('');
    setSlash(null);
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
    { key: 'link', label: '🔗', title: 'Link ([text](url))', run: insertLink },
  ];

  // Render inline markdown (**bold**, *italic*, `code`, ~~strike~~) within one
  // line of text into React nodes. Deliberately small — enough that non-md
  // users see their formatting take effect without a full parser.
  const renderInline = (text, keyBase) => {
    const parts = [];
    const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|~~([^~]+)~~)/g;
    let last = 0;
    let m;
    let idx = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      if (m[2] !== undefined) parts.push(<strong key={`${keyBase}-${idx}`}>{m[2]}</strong>);
      else if (m[3] !== undefined) parts.push(<em key={`${keyBase}-${idx}`}>{m[3]}</em>);
      else if (m[4] !== undefined) parts.push(<code key={`${keyBase}-${idx}`} className="tui-inline-code">{m[4]}</code>);
      else if (m[5] !== undefined) parts.push(<del key={`${keyBase}-${idx}`}>{m[5]}</del>);
      last = m.index + m[0].length;
      idx += 1;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length ? parts : text;
  };

  // Render a note's markdown body into JSX rows: checklists, images, file
  // links, headings, quotes, bullets — plus inline formatting. `interactive`
  // enables the click-to-toggle checkboxes (only makes sense on the saved note).
  const renderMarkdown = (text, interactive) => {
    if (!text) return <span className="tui-pv-empty">— empty —  (press i or click to edit)</span>;
    return text.split('\n').map((ln, li) => {
      const chk = ln.match(CHECKBOX_RE);
      if (chk) {
        const checked = !!chk[2].trim();
        return (
          <div key={li} className={`tui-check-line ${checked ? 'checked' : ''}`}
               title={interactive ? 'Click to toggle' : undefined}
               onClick={interactive ? (e) => {
                 e.stopPropagation();
                 const next = toggleChecklistLine(current.content, li);
                 if (next !== null) onUpdate(current.id, { content: next });
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
      if (/^>\s?/.test(ln)) return <div key={li} className="tui-pv-quote">{renderInline(ln.replace(/^>\s?/, ''), li)}</div>;
      if (/^[-*]\s+/.test(ln)) return <div key={li} className="tui-pv-bullet">{renderInline(ln.replace(/^[-*]\s+/, ''), li)}</div>;
      if (/^---+$/.test(ln.trim())) return <hr key={li} className="tui-pv-hr" />;
      return <div key={li} className="tui-pv-line">{ln ? renderInline(ln, li) : ' '}</div>;
    });
  };

  // Track the caret: "/" after start-of-line or whitespace opens the menu
  // (Notion-style — works mid-line too); typing filters it. A "/" glued to a
  // word or another "/" (URLs like https://…) does NOT trigger it.
  const handleBodyChange = (e) => {
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
      const uploaded = await uploadFilesToCloudinary(list);
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
        onUpdate(current.id, { content: append(current.content || '') });
      }
    } catch (err) {
      console.error('[TUI-UPLOAD-ERROR]', err);
      // eslint-disable-next-line no-alert
      alert('Upload thất bại — thử lại.');
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
    if (current && cat) onUpdate(current.id, { category: cat, customCategory: cat });
  };

  const cycleCategory = (dir = 1) => {
    if (!current) return;
    const next = catList[(catList.indexOf(catOf(current)) + dir + catList.length) % catList.length];
    setCategory(next);
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (mode === 'title' || mode === 'body' || mode === 'search') return; // inputs handle their own keys

    if (mode === 'help') { setMode('normal'); e.preventDefault(); return; }

    if (mode === 'delete') {
      // y/Enter confirms; n/Esc/anything else cancels.
      if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') {
        if (selectedIds.length) bulkDelete();
        else if (current) onDelete(current.id, true);
      }
      setMode('normal');
      e.preventDefault();
      return;
    }

    if (mode === 'category') {
      const idx = parseInt(e.key, 10);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= catList.length) {
        if (selectedIds.length) bulkCategory(catList[idx - 1]);
        else setCategory(catList[idx - 1]);
      }
      setMode('normal');
      e.preventDefault();
      return;
    }

    // Move mode: pick a target day for the current note (or the selection).
    if (mode === 'move') {
      const map = { '1': 0, '2': 1, '3': -1, '7': 7 };
      if (e.key in map) {
        if (selectedIds.length) bulkMove(map[e.key]);
        else if (current) onMoveToDate?.(current.id, map[e.key]);
      }
      setMode('normal');
      e.preventDefault();
      return;
    }

    const k = e.key;

    // Global keys regardless of focused panel.
    switch (k) {
      case 'Tab': moveFocus(e.shiftKey ? -1 : 1); e.preventDefault(); return;
      case '1': setFocus('folders'); e.preventDefault(); return;
      case '2': setFocus('notes'); e.preventDefault(); return;
      case '3': setFocus('preview'); e.preventDefault(); return;
      case '?': setMode('help'); e.preventDefault(); return;
      case '/': setMode('search'); e.preventDefault(); return;
      case '[': onChangeDate(-1); e.preventDefault(); return;
      case ']': onChangeDate(1); e.preventDefault(); return;
      case 't': goToday(); e.preventDefault(); return;
      case 'f': setFolderIndex((i) => (i + 1) % folders.length); e.preventDefault(); return;
      case 'F': setFolderIndex((i) => (i - 1 + folders.length) % folders.length); e.preventDefault(); return;
      case 'n': createNote('blank'); e.preventDefault(); return;
      case 'N': createNote('todo'); e.preventDefault(); return;
      case 'm': if (current) setMode('category'); e.preventDefault(); return;
      case 'M': if (current || selectedIds.length) setMode('move'); e.preventDefault(); return;
      case 'p': togglePin(); e.preventDefault(); return;
      case 'S': cycleSort(); e.preventDefault(); return;
      case 'y': if (current) onDuplicate?.({ ...current }); e.preventDefault(); return;
      case 'a': selectedIds.length === list.length ? clearSelection() : selectAllVisible(); e.preventDefault(); return;
      case '.': pomodoro ? stopPomodoro() : startPomodoro(); e.preventDefault(); return;
      case ',': togglePomodoro(); e.preventDefault(); return;
      case 'Escape':
        if (query) setQuery('');
        else if (selectedIds.length) clearSelection();
        else setFocus('notes');
        e.preventDefault();
        return;
      default: break;
    }

    if (focus === 'folders') {
      if (k === 'j' || k === 'ArrowDown') setFolderIndex((i) => Math.min(i + 1, folders.length - 1));
      else if (k === 'k' || k === 'ArrowUp') setFolderIndex((i) => Math.max(i - 1, 0));
      else if (k === 'g') setFolderIndex(0);
      else if (k === 'G') setFolderIndex(folders.length - 1);
      else if (k === 'Enter' || k === 'l' || k === 'ArrowRight') setFocus('notes');
      else return;
      e.preventDefault();
      return;
    }

    if (focus === 'notes') {
      switch (k) {
        case 'j': case 'ArrowDown': setNoteIndex((i) => Math.min(i + 1, list.length - 1)); break;
        case 'k': case 'ArrowUp': setNoteIndex((i) => Math.max(i - 1, 0)); break;
        case 'g': setNoteIndex(0); break;
        case 'G': setNoteIndex(Math.max(0, list.length - 1)); break;
        case 'h': case 'ArrowLeft': setFocus('folders'); break;
        case 'l': case 'L': case 'ArrowRight': setFocus('preview'); break;
        case 'Enter': case 'e': editTitle(); break;
        case 'i': editBody(); break;
        case 'x':
          if (selectedIds.length) bulkComplete(!bulkTargets().every(n => n.isCompleted));
          else toggleDone();
          break;
        case ' ': if (current) toggleSelect(current.id); break;
        case 'c': cycleCategory(1); break;
        case 'C': cycleCategory(-1); break;
        case 'd': if (selectedIds.length) setMode('delete'); else if (current) setMode('delete'); break;
        default: return;
      }
      e.preventDefault();
      return;
    }

    if (focus === 'preview') {
      switch (k) {
        case 'i': case 'Enter': editBody(); break;
        case 'h': case 'ArrowLeft': setFocus('notes'); break;
        case 'j': case 'ArrowDown': scrollPreview(48); break;
        case 'k': case 'ArrowUp': scrollPreview(-48); break;
        case 'g': previewRef.current?.scrollTo({ top: 0 }); break;
        case 'G': previewRef.current?.scrollTo({ top: previewRef.current.scrollHeight }); break;
        case 'x': case ' ': toggleDone(); break;
        case 'c': cycleCategory(1); break;
        case 'C': cycleCategory(-1); break;
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

  const onInputKeyDown = (e) => {
    e.stopPropagation();
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
    // body edit is multi-line: Ctrl+Enter saves, Enter inserts newline.
    if (e.key === 'Enter' && (mode === 'title' || mode === 'search' || (mode === 'body' && (e.ctrlKey || e.metaKey)))) {
      e.preventDefault();
      if (mode === 'search') setMode('normal');
      else commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (mode === 'search') { setQuery(''); setMode('normal'); }
      else { setMode('normal'); setDraft(''); }
    }
  };

  const done = notes.filter((n) => n.isCompleted).length;
  const filtered = list.length !== notes.length;

  const helpSections = [
    {
      title: 'PANELS',
      rows: [
        ['1 / 2 / 3', 'jump to folders / notes / preview'],
        ['Tab / Shift+Tab', 'cycle panel focus'],
        ['h / l', 'panel left / right'],
        ['Esc', 'clear search · back to notes'],
      ],
    },
    {
      title: 'NOTES',
      rows: [
        ['j / k', 'move down / up'],
        ['g / G', 'first / last note'],
        ['Enter / e', 'edit title'],
        ['i', 'edit body · Ctrl+Enter saves'],
        ['x', 'toggle done'],
        ['p', 'pin / unpin (pinned float to top)'],
        ['S', 'cycle sort (created/title/status/updated)'],
        ['y', 'duplicate note'],
        ['d → y', 'delete note'],
        ['n / N', 'new note / todo (active folder)'],
      ],
    },
    {
      title: 'SELECT & BULK',
      rows: [
        ['space', 'select / deselect note'],
        ['Ctrl+click', 'select with mouse'],
        ['a', 'select all / clear'],
        ['x', 'complete / reopen selected'],
        ['d', 'delete selected'],
        ['m → 1-N', 'set category for selected'],
        ['M → 1/2/3/7', 'move selected to day'],
        ['Esc', 'clear selection'],
      ],
    },
    {
      title: 'CATEGORY & MOVE',
      rows: [
        ['c / C', 'cycle category fwd / back'],
        [`m → 1-${catList.length}`, 'set category directly'],
        ['M', 'move note → today/tomorrow/…'],
        ['f / F', 'folder filter next / prev'],
      ],
    },
    {
      title: 'FOCUS TIMER',
      rows: [
        ['.', 'start / stop pomodoro (25m)'],
        [',', 'pause / resume'],
      ],
    },
    {
      title: 'DATE & SEARCH',
      rows: [
        ['[ / ]', 'previous / next day'],
        ['t', 'jump to today'],
        ['/', 'search · Esc clears'],
      ],
    },
    {
      title: 'PREVIEW',
      rows: [
        ['j / k', 'scroll'],
        ['g / G', 'top / bottom'],
        ['Ctrl+d / Ctrl+u', 'half page down / up'],
        ['x · c · d', 'act on note from preview'],
      ],
    },
    {
      title: 'EDITOR',
      rows: [
        ['/', 'block menu: todo, heading, code…'],
        ['paste file/image', 'upload & insert markdown link'],
        ['click [ ] in preview', 'toggle checklist item'],
        ['Ctrl+Enter', 'save body'],
      ],
    },
    {
      title: 'MOUSE',
      rows: [
        ['2×click title', 'edit title'],
        ['click body', 'edit body'],
        ['click chips', 'pick category'],
      ],
    },
  ];
  const hints = {
    normal: '1/2/3:panel  j/k:move  Enter/e:title  i:body  x:done  p:pin  S:sort  space:select  y:dup  m/M:cat/move  n/N:new  d:del  .:pomodoro  /:find  ?:help',
    category: '',
    move: '',
    title: '── EDIT TITLE ──  Enter:save  Esc:cancel',
    body: '── EDIT BODY ──  Ctrl+Enter:save  Esc:cancel  /:blocks  paste:attach file',
    delete: '',
    help: 'press any key to close',
    search: '',
  };

  return (
    <div className="tui" tabIndex={0} ref={rootRef} onKeyDown={handleKeyDown}
         onClick={(e) => { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') rootRef.current?.focus({ preventScroll: true }); }}>
      <div className="tui-body">
        {/* FOLDERS */}
        <div className={`tui-panel tui-folders ${focus === 'folders' ? 'focused' : ''}`}>
          <span className="tui-panel-title"><kbd>1</kbd>FOLDERS</span>
          <div className="tui-scroll">
            {folders.map((f, i) => (
              <div key={f.key} className={`tui-folder ${i === folderIndex ? 'sel' : ''}`}
                   onClick={() => { setFolderIndex(i); setFocus('notes'); }}>
                <span className="tui-folder-name">{f.label}</span>
                <span className="tui-folder-count">{f.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* NOTES */}
        <div className={`tui-panel tui-notes ${focus === 'notes' ? 'focused' : ''}`}>
          <span className="tui-panel-title">
            <kbd>2</kbd>{`NOTES · ${dateLabel}`}
            <button type="button" className="tui-sort-chip" title="Sort order (S)"
                    onMouseDown={(e) => { e.preventDefault(); cycleSort(); }}>
              ⇅ {sortBy}
            </button>
          </span>
          <div className="tui-scroll">
            {list.length === 0 ? (
              <div className="tui-empty">{query ? 'no matches' : 'no entries — press n'}</div>
            ) : (
              list.map((n, i) => {
                const sel = i === noteIndex;
                const picked = selectedIds.includes(n.id);
                const pendingDelete = mode === 'delete' && (selectedIds.length ? picked : sel);
                return (
                  <div key={n.id} className={`tui-row ${sel ? 'sel' : ''} ${n.isCompleted ? 'done' : ''} ${picked ? 'picked' : ''} ${pendingDelete ? 'pending-delete' : ''} ${n.pinned ? 'pinned' : ''}`}
                       onClick={(e) => {
                         if (e.ctrlKey || e.metaKey) { toggleSelect(n.id); return; }
                         setNoteIndex(i); setFocus('notes');
                       }}
                       onDoubleClick={() => { setNoteIndex(i); setDraft(n.title || ''); setMode('title'); }}>
                    <button type="button" className={`tui-row-pick ${picked ? 'on' : ''}`}
                            title="Select (Space / Ctrl+click)"
                            onClick={(e) => { e.stopPropagation(); toggleSelect(n.id); }}>
                      {picked ? '☑' : '☐'}
                    </button>
                    <span className="tui-check">{n.isCompleted ? '[x]' : '[ ]'}</span>
                    {n.pinned && <span className="tui-pin" title="Pinned">📌</span>}
                    {sel && mode === 'title' ? (
                      <input ref={inputRef} className="tui-input" value={draft}
                             onChange={(e) => setDraft(e.target.value)} onKeyDown={onInputKeyDown} onBlur={onInputBlur} placeholder="title…" />
                    ) : (
                      <span className="tui-title">{n.title || '(untitled)'}</span>
                    )}
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

        {/* PREVIEW */}
        <div className={`tui-panel tui-preview ${focus === 'preview' ? 'focused' : ''}`}>
          <span className="tui-panel-title"><kbd>3</kbd>PREVIEW</span>
          {current ? (
            <div className="tui-scroll" ref={previewRef}>
              <div className="tui-pv-title">{current.title || '(untitled)'}</div>
              <div className="tui-pv-meta">
                <span className="tag">{catOf(current)}</span>
                {current.timestamp && <span> · {current.timestamp}</span>}
                <span> · {current.isCompleted ? 'done' : 'open'}</span>
                {current.content && (() => {
                  const s = wordStats(current.content);
                  return <span> · {s.words}w · ~{s.minutes}m read</span>;
                })()}
              </div>
              {mode === 'body' ? (
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
                            title="Live preview — xem markdown hiển thị ra sao"
                            onMouseDown={(e) => { e.preventDefault(); setLivePreview((v) => !v); }}>
                      👁 Preview
                    </button>
                    <button type="button"
                            className={`tui-fmt-toggle ${showCheatsheet ? 'on' : ''}`}
                            title="Cú pháp Markdown"
                            onMouseDown={(e) => { e.preventDefault(); setShowCheatsheet((v) => !v); }}>
                      ? Markdown
                    </button>
                  </div>

                  {showCheatsheet && (
                    <div className="tui-cheatsheet">
                      <div><code>**đậm**</code> → <strong>đậm</strong></div>
                      <div><code>*nghiêng*</code> → <em>nghiêng</em></div>
                      <div><code># Tiêu đề</code> → tiêu đề lớn</div>
                      <div><code>- mục</code> → gạch đầu dòng</div>
                      <div><code>- [ ] việc</code> → checklist</div>
                      <div><code>&gt; trích</code> → trích dẫn</div>
                      <div><code>`mã`</code> → mã lệnh</div>
                      <div><code>[chữ](url)</code> → liên kết</div>
                      <div className="tui-cheatsheet-tip">Không cần nhớ — cứ viết bình thường, hoặc bấm nút định dạng / gõ <kbd>/</kbd>.</div>
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
                      <textarea ref={inputRef} className="tui-textarea" value={draft}
                                onChange={handleBodyChange} onKeyDown={onInputKeyDown} onBlur={onInputBlur}
                                onFocus={() => { suppressBlurRef.current = false; }}
                                onPaste={handleEditorPaste}
                                placeholder="Viết ghi chú… (viết bình thường được — hoặc bấm nút định dạng · gõ / để chèn khối · dán ảnh/file)" />
                    </div>
                    {livePreview && (
                      <div className="tui-editor-preview" aria-label="Live preview">
                        {renderMarkdown(draft, false)}
                      </div>
                    )}
                  </div>

                  <div className="tui-editor-bar">
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
                    <span className="tui-editor-tip">
                      {uploading ? '⏳ uploading…' : 'Ctrl+Enter to save · Esc to cancel'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="tui-pv-body" onClick={editBody} title="Click to edit">
                  {renderMarkdown(current.content, true)}
                </div>
              )}
            </div>
          ) : (
            <div className="tui-empty">no note selected</div>
          )}
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="tui-status">
        {mode === 'search' ? (
          <span className="tui-search">/<input ref={inputRef} className="tui-input inline" value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={onInputKeyDown} onBlur={onInputBlur} placeholder="search…" /></span>
        ) : mode === 'delete' ? (
          <span className="tui-warn">
            {selectedIds.length
              ? `delete ${selectedIds.length} selected note${selectedIds.length > 1 ? 's' : ''}?`
              : `delete "${current?.title || 'untitled'}"?`}
            <button type="button" className="tui-warn-btn yes"
                    onClick={() => { if (selectedIds.length) bulkDelete(); else if (current) onDelete(current.id, true); setMode('normal'); rootRef.current?.focus({ preventScroll: true }); }}>
              Yes (y)
            </button>
            <button type="button" className="tui-warn-btn no"
                    onClick={() => { setMode('normal'); rootRef.current?.focus({ preventScroll: true }); }}>
              No (n / Esc)
            </button>
          </span>
        ) : mode === 'category' ? (
          <span className="tui-cat-pick">
            {selectedIds.length ? `category → ${selectedIds.length} notes:` : 'set category:'}&nbsp;
            {catList.map((c, i) => (
              <span key={c} className={`tui-cat-opt ${!selectedIds.length && catOf(current) === c ? 'cur' : ''}`}
                    onClick={() => { if (selectedIds.length) bulkCategory(c); else setCategory(c); setMode('normal'); }}>
                <kbd>{i + 1}</kbd>{c}
              </span>
            ))}
            <span className="tui-cat-esc">Esc:cancel</span>
          </span>
        ) : mode === 'move' ? (
          <span className="tui-cat-pick">
            {selectedIds.length ? `move ${selectedIds.length} notes to:` : 'move to:'}&nbsp;
            {[['1', 'Today', 0], ['2', 'Tomorrow', 1], ['3', 'Yesterday', -1], ['7', '+1 week', 7]].map(([k, lbl, off]) => (
              <span key={k} className="tui-cat-opt"
                    onClick={() => { if (selectedIds.length) bulkMove(off); else if (current) onMoveToDate?.(current.id, off); setMode('normal'); }}>
                <kbd>{k}</kbd>{lbl}
              </span>
            ))}
            <span className="tui-cat-esc">Esc:cancel</span>
          </span>
        ) : (
          <>
            <span className={`tui-badge mode-${mode}`}>{mode === 'normal' ? 'NORMAL' : mode.toUpperCase()}</span>
            <span className="tui-focus-tag">◈ {focus.toUpperCase()}</span>
            {selectedIds.length > 0 && (
              <span className="tui-sel-tag" title="Selected — d/m/M act on all; Esc clears">✓ {selectedIds.length} selected</span>
            )}
            {pomodoro && (
              <button type="button" className={`tui-pomo ${pomodoro.running ? 'run' : 'paused'}`}
                      title="Pomodoro — , pause/resume · . stop"
                      onClick={(e) => { e.stopPropagation(); togglePomodoro(); rootRef.current?.focus({ preventScroll: true }); }}>
                🍅 {String(Math.floor(pomodoro.remaining / 60)).padStart(2, '0')}:{String(pomodoro.remaining % 60).padStart(2, '0')}
                {!pomodoro.running && ' ⏸'}
              </button>
            )}
            <span className="tui-hints">{hints[mode]}</span>
            <span className="tui-stat">{filtered ? `${list.length}/${notes.length} shown` : `${notes.length} notes`} · {done} done</span>
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
};

export default TuiView;
