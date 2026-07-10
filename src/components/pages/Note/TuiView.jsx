import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { wordStats, CHECKBOX_RE, toggleChecklistLine, notesToMarkdown, downloadTextFile } from './noteUtils';
import { uploadFilesToCloudinary } from '../../../services/fileService';
import { overlayDeadlines, setLocalDeadline } from '../../../utils/deadlineLocalStore';
import { clearFiredForNote } from '../../../utils/deadlineReminders';
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

const POMO_LS_KEY = 'daily-note-tui-pomodoro';
const POMO_CFG_KEY = 'daily-note-pomo-cfg';        // { focusMin, soundOn }
const POMO_STATS_KEY = 'daily-note-pomo-stats';    // { 'yyyy-MM-dd': finished count }
const FOCUS_TIME_KEY = 'daily-note-focus-time';    // { noteId: seconds focused }
const ARCHIVE_KEY = 'daily-note-archived';         // [noteId]
const TUI_THEME_KEY = 'daily-note-tui-theme';
const TUI_ZEN_KEY = 'daily-note-tui-zen';
const YANK_KEY = 'daily-note-tui-yank';            // yanked note snapshot (cross-day paste)
const RECUR_KEY = 'daily-note-recurring';          // [{key,title,content,category,freq,weekday,created}]
const RECUR_DONE_KEY = 'daily-note-recurring-done';// { '<templateKey>|<date>': 1 }

const BREAK_SHORT = 5 * 60;
const BREAK_LONG = 15 * 60;
const LONG_EVERY = 4; // long break after every 4th focus
const FOCUS_CHOICES = [25, 45, 90];
const TUI_THEMES = ['default', 'catppuccin', 'gruvbox', 'nord', 'dracula'];
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

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const loadPomoCfg = () => ({ focusMin: 25, soundOn: true, ...lsGet(POMO_CFG_KEY, {}) });

/* Tiny WebAudio chime/tick — no assets, degrades silently. */
let audioCtx = null;
const beep = (freq, at, dur, gain) => {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
};
const playSound = (kind) => {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime + 0.01;
    if (kind === 'tick') beep(1800, t, 0.03, 0.012);
    else if (kind === 'break-end') [520, 660].forEach((f, i) => beep(f, t + i * 0.18, 0.16, 0.05));
    else [660, 880, 990].forEach((f, i) => beep(f, t + i * 0.16, 0.15, 0.05)); // focus-end
  } catch { /* no audio — fine */ }
};

// Restore a persisted pomodoro, subtracting the time that passed while the
// page was closed (only when it was left running). Migrates the old
// phase-less shape from earlier versions.
const loadPomodoro = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(POMO_LS_KEY));
    if (!saved || typeof saved.remaining !== 'number') return null;
    const elapsed = saved.running ? Math.floor((Date.now() - (saved.savedAt || Date.now())) / 1000) : 0;
    const remaining = Math.max(0, saved.remaining - elapsed);
    if (remaining <= 0) { localStorage.removeItem(POMO_LS_KEY); return null; }
    const phase = saved.phase || 'focus';
    return {
      noteId: saved.noteId ?? null,
      phase,
      cycle: saved.cycle || 1,
      total: saved.total || (phase === 'focus' ? loadPomoCfg().focusMin * 60 : phase === 'long' ? BREAK_LONG : BREAK_SHORT),
      remaining,
      running: !!saved.running,
    };
  } catch { return null; }
};

const TuiView = ({ notes, onAdd, onUpdate, onDelete, onDuplicate, onMoveToDate, onChangeDate, dateLabel, categories,
  allNotes, markedDates, onRestore, onCarryOver, onRedate }) => {
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
  const [pomodoro, setPomodoro] = useState(loadPomodoro); // { noteId, phase, cycle, total, remaining, running }
  const [pomoOverlay, setPomoOverlay] = useState(false); // fullscreen focus overlay
  const [pomoCfg, setPomoCfg] = useState(loadPomoCfg); // { focusMin, soundOn }
  const [pomoStats, setPomoStats] = useState(() => lsGet(POMO_STATS_KEY, {})); // finished 🍅 per day
  const [focusTimes, setFocusTimes] = useState(() => lsGet(FOCUS_TIME_KEY, {})); // seconds per note
  const [archivedIds, setArchivedIds] = useState(() => lsGet(ARCHIVE_KEY, [])); // local archive
  const [tuiTheme, setTuiTheme] = useState(() => lsGet(TUI_THEME_KEY, 'default'));
  const [zen, setZen] = useState(() => lsGet(TUI_ZEN_KEY, false)); // notes-only layout
  const [tagFilter, setTagFilter] = useState(null); // '#tag' filter (lowercase, no #)
  const [cmd, setCmd] = useState(''); // ":" command line buffer
  const [count, setCount] = useState(''); // vim count prefix
  const [flash, setFlash] = useState(null); // transient status-bar message
  const [showWeek, setShowWeek] = useState(false); // weekly review overlay
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const marksRef = useRef({}); // vim marks: letter -> noteId
  const undoRef = useRef([]); // undo stack (max 50)
  const redoRef = useRef([]);
  const flashTimerRef = useRef(null);
  const notesRef = useRef(notes); // fresh notes inside timer callbacks
  const pomoMetaRef = useRef({}); // { overlayOpen, soundOn } for the tick interval
  // While true, the textarea's onBlur must NOT commit/close the editor —
  // opening the file dialog blurs the textarea, and we want to come back to it.
  const suppressBlurRef = useRef(false);

  notesRef.current = notes;
  pomoMetaRef.current = { overlayOpen: pomoOverlay, soundOn: pomoCfg.soundOn };

  const flashMsg = (msg) => {
    setFlash(msg);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), 3000);
  };

  const catOf = (n) => n?.customCategory || n?.category || 'MEMO';
  const catList = categories && categories.length ? categories : ['MEMO'];

  // Deadlines live in the local overlay store until the backend migration
  // lands — merge them so rows/preview can show ⏰ badges. overlayDeadlines
  // also appends orphaned store entries (meant for the reminder engine);
  // those are not real notes, so keep only ids that exist on this day.
  const notesWithMeta = useMemo(() => {
    const ids = new Set(notes.map((n) => n.id));
    return overlayDeadlines(notes).filter((n) => ids.has(n.id));
  }, [notes]);

  const archivedSet = useMemo(() => new Set(archivedIds), [archivedIds]);

  // #tags harvested from titles + bodies of the day's notes (archive excluded).
  const dayTags = useMemo(() => {
    const m = {};
    notesWithMeta.forEach((n) => {
      if (archivedSet.has(n.id)) return;
      const found = new Set(
        [...String(n.title || '').matchAll(TAG_RE), ...String(n.content || '').matchAll(TAG_RE)]
          .map((x) => x[1].toLowerCase()),
      );
      found.forEach((t) => { m[t] = (m[t] || 0) + 1; });
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 24);
  }, [notesWithMeta, archivedSet]);

  // FOLDERS = "ALL" + each category (+ 📦 ARCHIVE when anything is archived).
  const folders = useMemo(() => {
    const cats = categories && categories.length ? categories : ['MEMO'];
    const counts = {};
    const active = notesWithMeta.filter((n) => !archivedSet.has(n.id));
    active.forEach((n) => { const c = catOf(n); counts[c] = (counts[c] || 0) + 1; });
    const archCount = notesWithMeta.length - active.length;
    const base = [
      { key: 'ALL', label: 'ALL', count: active.length },
      ...cats.map((c) => ({ key: c, label: c, count: counts[c] || 0 })),
    ];
    if (archCount > 0) base.push({ key: '__ARCHIVE', label: '📦 ARCHIVE', count: archCount });
    return base;
  }, [notesWithMeta, categories, archivedSet]);

  const activeFolder = folders[Math.min(folderIndex, folders.length - 1)] || folders[0];

  const hasTag = (n, tag) => {
    const probe = `${n.title || ''}\n${n.content || ''}`.toLowerCase();
    return probe.includes(`#${tag}`);
  };

  const list = useMemo(() => {
    const inArchive = activeFolder?.key === '__ARCHIVE';
    let l = notesWithMeta.filter((n) => archivedSet.has(n.id) === inArchive);
    if (activeFolder && activeFolder.key !== 'ALL' && !inArchive) l = l.filter((n) => catOf(n) === activeFolder.key);
    if (tagFilter) l = l.filter((n) => hasTag(n, tagFilter));
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
  }, [notesWithMeta, activeFolder, query, sortBy, archivedSet, tagFilter]);

  useEffect(() => { setNoteIndex((i) => Math.max(0, Math.min(i, list.length - 1))); }, [list.length]);
  useEffect(() => { rootRef.current?.focus({ preventScroll: true }); }, []);

  // Pomodoro countdown — ticks every second while running. Also accrues
  // per-note focus time and plays the soft tick while the overlay is open.
  useEffect(() => {
    if (!pomodoro?.running) return undefined;
    const isFocusPhase = pomodoro.phase === 'focus';
    const trackedNote = pomodoro.noteId;
    const id = setInterval(() => {
      if (isFocusPhase && trackedNote) {
        setFocusTimes((ft) => {
          const next = { ...ft, [trackedNote]: (ft[trackedNote] || 0) + 1 };
          lsSet(FOCUS_TIME_KEY, next);
          return next;
        });
      }
      const meta = pomoMetaRef.current;
      if (meta.overlayOpen && meta.soundOn) playSound('tick');
      setPomodoro((p) => {
        if (!p || !p.running) return p;
        if (p.remaining <= 1) return { ...p, remaining: 0, running: false, ended: true };
        return { ...p, remaining: p.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pomodoro?.running, pomodoro?.phase, pomodoro?.noteId]);

  // Phase transition — runs exactly once when a phase counts down to zero:
  // focus → (stats + auto-log + chime) → break; break → chime → next focus.
  useEffect(() => {
    if (!pomodoro?.ended) return;
    const p = pomodoro;
    if (p.phase === 'focus') {
      // 1 more 🍅 for today (real today, not the viewed date)
      const day = todayStr();
      setPomoStats((s) => { const next = { ...s, [day]: (s[day] || 0) + 1 }; lsSet(POMO_STATS_KEY, next); return next; });
      // auto-log the finished session onto the focused note
      const note = notesRef.current.find((n) => n.id === p.noteId);
      if (note) {
        const hhmm = new Date().toTimeString().slice(0, 5);
        const line = `🍅 ${Math.round(p.total / 60)}m ${hhmm}`;
        const content = note.content ? `${note.content}${note.content.endsWith('\n') ? '' : '\n'}${line}` : line;
        onUpdate(note.id, { content });
      }
      if (pomoCfg.soundOn) playSound('focus-end');
      try {
        if (Notification?.permission === 'granted') new Notification('🍅 Pomodoro xong!', { body: 'Nghỉ một chút nhé ☕' });
      } catch { /* ignore */ }
      const long = p.cycle % LONG_EVERY === 0;
      setPomodoro({
        noteId: p.noteId, phase: long ? 'long' : 'break', cycle: p.cycle,
        total: long ? BREAK_LONG : BREAK_SHORT, remaining: long ? BREAK_LONG : BREAK_SHORT, running: true,
      });
    } else {
      if (pomoCfg.soundOn) playSound('break-end');
      try {
        if (Notification?.permission === 'granted') new Notification('☕ Hết giờ nghỉ!', { body: 'Vào phiên tập trung tiếp theo 🍅' });
      } catch { /* ignore */ }
      const focusSecs = pomoCfg.focusMin * 60;
      setPomodoro({
        noteId: p.noteId, phase: 'focus', cycle: p.cycle + 1,
        total: focusSecs, remaining: focusSecs, running: true,
      });
    }
  }, [pomodoro?.ended]);

  // Persist the pomodoro so a reload (or accidental close) doesn't lose it.
  useEffect(() => {
    try {
      if (pomodoro) localStorage.setItem(POMO_LS_KEY, JSON.stringify({ ...pomodoro, savedAt: Date.now() }));
      else localStorage.removeItem(POMO_LS_KEY);
    } catch { /* storage full/blocked — timer still works in-memory */ }
  }, [pomodoro]);
  useEffect(() => {
    if (mode === 'title' || mode === 'body' || mode === 'search' || mode === 'command') {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      // Leaving an edit mode unmounts the focused input, which would drop DOM
      // focus (and all shortcuts) — hand it back to the TUI root.
      requestAnimationFrame(() => rootRef.current?.focus({ preventScroll: true }));
    }
  }, [mode]);

  // Closing an overlay unmounts whatever was DOM-focused inside it (e.g. the
  // 45m button), dropping focus to <body> and killing every shortcut — hand
  // focus back to the TUI root, unless an editor input owns it.
  useEffect(() => {
    if (pomoOverlay || showWeek) return;
    if (mode === 'title' || mode === 'body' || mode === 'search' || mode === 'command') return;
    requestAnimationFrame(() => rootRef.current?.focus({ preventScroll: true }));
  }, [pomoOverlay, showWeek]);

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

  /* ── Undo / redo — every TUI mutation goes through these wrappers ── */
  const pushUndo = (entry) => {
    undoRef.current.push(entry);
    if (undoRef.current.length > 50) undoRef.current.shift();
    redoRef.current = [];
  };

  // Update with undo capture: remembers the previous values of exactly the
  // keys being changed.
  const doUpdate = (id, updates) => {
    const n = notesWithMeta.find((x) => x.id === id);
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
    if (n.deadline) { setLocalDeadline(n.id, { deadline: null }); clearFiredForNote(n.id); }
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
        if (e.note.deadline) {
          setLocalDeadline(e.note.id, {
            deadline: e.note.deadline,
            reminderLeadMinutes: e.note.reminderLeadMinutes ?? null,
            reminderDone: !!e.note.reminderDone,
          });
        }
        flashMsg(`undo: restored "${e.note.title || 'untitled'}"`);
      } else flashMsg('undo: cannot restore (no handler)');
    } else if (e.type === 'add') { onDelete(e.note.id, true); flashMsg('undo: create'); }
    else if (e.type === 'carry') {
      if (onRedate) {
        Promise.resolve(onRedate(e.moves.map((m) => ({ id: m.id, date: m.from }))))
          .then(() => flashMsg(`undo: ${e.moves.length} notes back to their original days`))
          .catch(() => flashMsg('undo carry failed'));
      } else flashMsg('undo: cannot revert carry (no handler)');
    }
  };

  const redo = () => {
    const e = redoRef.current.pop();
    if (!e) { flashMsg('nothing to redo'); return; }
    undoRef.current.push(e);
    if (e.type === 'update') { onUpdate(e.id, e.next); flashMsg('redo: edit'); }
    else if (e.type === 'delete') { onDelete(e.note.id, true); flashMsg('redo: delete'); }
    else if (e.type === 'add') { if (onRestore) onRestore(e.note); flashMsg('redo: create'); }
    else if (e.type === 'carry') {
      if (onRedate) {
        Promise.resolve(onRedate(e.moves.map((m) => ({ id: m.id, date: m.to }))))
          .then(() => flashMsg(`redo: carried ${e.moves.length} notes again`));
      }
    }
  };

  // New notes inherit the active folder's category, so "n" inside TASK
  // creates a TASK note and it stays visible in the current filter.
  const createNote = (template, extraOverrides = null, silent = false) => {
    if (!silent) { setFocus('notes'); setQuery(''); }
    const cat = activeFolder && activeFolder.key !== 'ALL' && activeFolder.key !== '__ARCHIVE' ? activeFolder.key : null;
    const overrides = { ...(cat ? { category: cat, customCategory: cat } : {}), ...(extraOverrides || {}) };
    return Promise.resolve(onAdd(template, null, null, overrides)).then((created) => {
      if (created?.id) {
        pushUndo({ type: 'add', note: { ...created } });
        if (!silent) setPendingSelect(created.id);
      }
      return created;
    });
  };

  const toggleDone = () => { if (current) doUpdate(current.id, { isCompleted: !current.isCompleted }); };

  const scrollPreview = (dy) => previewRef.current?.scrollBy({ top: dy });

  /* ── Pin / sort ── */
  const togglePin = () => { if (current) doUpdate(current.id, { pinned: !current.pinned }); };
  const cycleSort = () => setSortBy((s) => SORTS[(SORTS.findIndex(x => x.key === s) + 1) % SORTS.length].key);

  /* ── Multi-select / bulk actions ── */
  const toggleSelect = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const clearSelection = () => setSelectedIds([]);
  const selectAllVisible = () => setSelectedIds(list.map(n => n.id));
  const bulkTargets = () => (selectedIds.length ? list.filter(n => selectedIds.includes(n.id)) : (current ? [current] : []));
  const bulkComplete = (done) => { bulkTargets().forEach(n => doUpdate(n.id, { isCompleted: done })); };
  const bulkCategory = (cat) => { bulkTargets().forEach(n => doUpdate(n.id, { category: cat, customCategory: cat })); };
  const bulkDelete = () => { bulkTargets().forEach(n => doDelete(n)); clearSelection(); };
  const bulkMove = (offset) => { bulkTargets().forEach(n => onMoveToDate?.(n.id, offset)); clearSelection(); };

  /* ── Pomodoro focus timer bound to the selected note ── */
  const startPomodoro = () => {
    if (!current) return;
    const total = pomoCfg.focusMin * 60;
    setPomodoro({ noteId: current.id, phase: 'focus', cycle: 1, total, remaining: total, running: true });
  };
  const stopPomodoro = () => { setPomodoro(null); setPomoOverlay(false); };
  const togglePomodoro = () => setPomodoro((p) => (p ? { ...p, running: !p.running } : p));

  // Change session length (25/45/90). Applies immediately when the current
  // focus phase hasn't started counting yet, otherwise from the next one.
  const setFocusMinutes = (min) => {
    if (!FOCUS_CHOICES.includes(min)) { flashMsg('pomo: 25 | 45 | 90'); return; }
    const cfg = { ...pomoCfg, focusMin: min };
    setPomoCfg(cfg); lsSet(POMO_CFG_KEY, cfg);
    setPomodoro((p) => (p && p.phase === 'focus' && !p.running && p.remaining === p.total
      ? { ...p, total: min * 60, remaining: min * 60 } : p));
    flashMsg(`pomodoro: ${min} minutes`);
  };

  const toggleSound = () => {
    const cfg = { ...pomoCfg, soundOn: !pomoCfg.soundOn };
    setPomoCfg(cfg); lsSet(POMO_CFG_KEY, cfg);
    if (cfg.soundOn) playSound('tick');
  };

  /* ── Yank / paste (cross-day via localStorage) ── */
  const yankNote = () => {
    if (!current) return;
    const { title, content, category, customCategory, color } = current;
    lsSet(YANK_KEY, { title, content, category, customCategory, color });
    flashMsg(`yanked "${title || 'untitled'}" — P to paste (works on any day)`);
  };
  const pasteNote = () => {
    const y = lsGet(YANK_KEY, null);
    if (!y) { flashMsg('nothing yanked — Y first'); return; }
    createNote('blank', { ...y }, true).then((created) => {
      if (created?.id) flashMsg(`pasted "${y.title || 'untitled'}"`);
    });
  };

  /* ── Vim marks: ;a sets mark a on the current note, 'a jumps to it ── */
  const setMark = (letter) => {
    if (!current) return;
    marksRef.current[letter] = current.id;
    flashMsg(`mark '${letter}' → "${current.title || 'untitled'}"`);
  };
  const jumpMark = (letter) => {
    const id = marksRef.current[letter];
    if (!id) { flashMsg(`mark '${letter}' not set`); return; }
    const idx = list.findIndex((n) => n.id === id);
    if (idx >= 0) { setNoteIndex(idx); setFocus('notes'); return; }
    if (notesWithMeta.some((n) => n.id === id)) {
      // filtered out — reset filters, then land on it
      setFolderIndex(0); setQuery(''); setTagFilter(null);
      requestAnimationFrame(() => setPendingJump(id));
    } else flashMsg(`mark '${letter}': note not on this day`);
  };
  const [pendingJump, setPendingJump] = useState(null);
  useEffect(() => {
    if (!pendingJump) return;
    const idx = list.findIndex((n) => n.id === pendingJump);
    if (idx >= 0) { setNoteIndex(idx); setPendingJump(null); }
  }, [list, pendingJump]);

  /* ── Zen / theme / archive ── */
  const toggleZen = () => setZen((z) => { lsSet(TUI_ZEN_KEY, !z); return !z; });

  const setTheme = (name) => {
    const t = name === 'next'
      ? TUI_THEMES[(TUI_THEMES.indexOf(tuiTheme) + 1) % TUI_THEMES.length]
      : name;
    if (!TUI_THEMES.includes(t)) { flashMsg(`theme: ${TUI_THEMES.join(' | ')}`); return; }
    setTuiTheme(t); lsSet(TUI_THEME_KEY, t);
    flashMsg(`theme: ${t}`);
  };

  const toggleArchive = () => {
    if (!current) return;
    const has = archivedSet.has(current.id);
    const next = has ? archivedIds.filter((id) => id !== current.id) : [...archivedIds, current.id];
    setArchivedIds(next); lsSet(ARCHIVE_KEY, next);
    flashMsg(has ? `unarchived "${current.title || 'untitled'}"` : `archived "${current.title || 'untitled'}" — 📦 folder`);
  };

  /* ── Jump to an absolute date via the day-delta prop ── */
  const gotoDate = (dStr) => {
    const delta = Math.round((new Date(`${dStr}T00:00:00`) - new Date(`${dateLabel}T00:00:00`)) / 86400000);
    if (Number.isFinite(delta) && delta !== 0) onChangeDate(delta);
  };

  /* ── Carry-over: bring unfinished notes from the past week to this day.
     Destructive-ish (re-dates many notes at once), so it always asks first
     and the whole batch is one undo step. ── */
  const carryCandidates = useMemo(() => {
    const cutoff = new Date(`${dateLabel}T00:00:00`);
    const inWindow = (d) => {
      if (!d) return false;
      const delta = (cutoff - new Date(`${d}T00:00:00`)) / 86400000;
      return delta >= 1 && delta <= 7;
    };
    return (allNotes || []).filter((n) => !n.isDeleted && !n.isCompleted && inWindow(n.date));
  }, [allNotes, dateLabel]);

  const askCarryOver = () => {
    if (!onCarryOver) { flashMsg('carry-over unavailable'); return; }
    if (!carryCandidates.length) { flashMsg('nothing to carry over (no unfinished notes in the last 7 days)'); return; }
    setMode('carry');
  };

  const doCarryOver = () => {
    flashMsg('carrying over unfinished notes…');
    Promise.resolve(onCarryOver(dateLabel)).then((moves) => {
      const n = Array.isArray(moves) ? moves.length : (moves || 0);
      if (Array.isArray(moves) && moves.length) pushUndo({ type: 'carry', moves });
      flashMsg(n > 0 ? `carried over ${n} note${n > 1 ? 's' : ''} — u to undo` : 'nothing to carry over');
    }).catch(() => flashMsg('carry-over failed'));
  };

  /* ── Export: current day (or week) as Markdown ── */
  const exportDay = (toClipboard) => {
    const md = notesToMarkdown(dateLabel, list.length ? list : notesWithMeta);
    if (toClipboard) {
      navigator.clipboard?.writeText(md)
        .then(() => flashMsg('markdown copied to clipboard'))
        .catch(() => flashMsg('clipboard blocked — use :export'));
    } else {
      downloadTextFile(`daily-note-${dateLabel}.md`, md);
      flashMsg(`exported daily-note-${dateLabel}.md`);
    }
  };
  const weekDays = useMemo(() => {
    // the 7 days ending on the viewed date, oldest first
    const end = new Date(`${dateLabel}T00:00:00`);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(end); d.setDate(end.getDate() - (6 - i));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
  }, [dateLabel]);

  const weekReview = useMemo(() => {
    if (!showWeek) return null;
    const byDay = weekDays.map((day) => {
      const dayNotes = day === dateLabel
        ? notesWithMeta
        : (allNotes || []).filter((n) => n.date === day && !n.isDeleted);
      const done = dayNotes.filter((n) => n.isCompleted).length;
      const words = wordStats(dayNotes.map((n) => n.content).join(' ')).words;
      return { day, total: dayNotes.length, done, words, pomos: pomoStats[day] || 0 };
    });
    const sum = (k) => byDay.reduce((s, d) => s + d[k], 0);
    return { byDay, total: sum('total'), done: sum('done'), words: sum('words'), pomos: sum('pomos') };
  }, [showWeek, weekDays, allNotes, notesWithMeta, dateLabel, pomoStats]);

  const exportWeek = () => {
    const md = weekDays.map((day) => {
      const dayNotes = day === dateLabel ? notesWithMeta : (allNotes || []).filter((n) => n.date === day && !n.isDeleted);
      return dayNotes.length ? notesToMarkdown(day, dayNotes) : `# Daily Note — ${day}\n\n_(empty)_`;
    }).join('\n\n');
    downloadTextFile(`weekly-review-${dateLabel}.md`, md);
    flashMsg(`exported weekly-review-${dateLabel}.md`);
  };

  /* ── Recurring notes — templates in localStorage, generated per day ── */
  const recurGenerated = useRef(null); // guard: one generation pass per viewed day
  useEffect(() => {
    if (recurGenerated.current === dateLabel) return;
    recurGenerated.current = dateLabel;
    if (dateLabel > todayStr()) return; // don't seed future days while browsing
    const templates = lsGet(RECUR_KEY, []);
    if (!templates.length) return;
    const doneMap = lsGet(RECUR_DONE_KEY, {});
    const weekday = new Date(`${dateLabel}T00:00:00`).getDay();
    const due = templates.filter((t) =>
      dateLabel >= (t.created || '') &&
      (t.freq === 'daily' || (t.freq === 'weekly' && t.weekday === weekday)) &&
      !doneMap[`${t.key}|${dateLabel}`]);
    if (!due.length) return;
    due.forEach((t) => { doneMap[`${t.key}|${dateLabel}`] = 1; });
    lsSet(RECUR_DONE_KEY, doneMap);
    Promise.all(due.map((t) => createNote('blank', {
      title: t.title, content: t.content || '', category: t.category, customCategory: t.category,
    }, true))).then(() => flashMsg(`recurring: +${due.length} note${due.length > 1 ? 's' : ''}`));
  }, [dateLabel]);

  const setRecurring = (freq) => {
    if (!current) { flashMsg('select a note first'); return; }
    const templates = lsGet(RECUR_KEY, []).filter((t) => !t.key.startsWith(current.id));
    if (freq === 'off') {
      lsSet(RECUR_KEY, templates);
      flashMsg(`recurring off for "${current.title || 'untitled'}"`);
      return;
    }
    templates.push({
      key: `${current.id}:${freq}`,
      title: current.title || '(untitled)',
      content: current.content || '',
      category: catOf(current),
      freq,
      weekday: new Date(`${dateLabel}T00:00:00`).getDay(),
      created: dateLabel,
    });
    lsSet(RECUR_KEY, templates);
    flashMsg(`"${current.title || 'untitled'}" repeats ${freq}${freq === 'weekly' ? ' (this weekday)' : ''}`);
  };

  /* ── Due time on the current note (deadline + optional lead reminder) ── */
  const setDue = (hhmm, leadMin) => {
    if (!current) { flashMsg('select a note first'); return; }
    if (hhmm === 'off') {
      doUpdate(current.id, { deadline: null, reminderLeadMinutes: null, reminderDone: false });
      setLocalDeadline(current.id, { deadline: null });
      clearFiredForNote(current.id);
      flashMsg('due time cleared');
      return;
    }
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm || '');
    if (!m) { flashMsg('usage: :due HH:mm [leadMinutes] | :due off'); return; }
    const iso = new Date(`${dateLabel}T${m[1].padStart(2, '0')}:${m[2]}:00`).toISOString();
    const lead = Number.isFinite(+leadMin) && +leadMin > 0 ? +leadMin : null;
    const fields = { deadline: iso, reminderLeadMinutes: lead, reminderDone: false };
    doUpdate(current.id, fields);
    setLocalDeadline(current.id, fields);
    clearFiredForNote(current.id);
    flashMsg(`due ${m[1].padStart(2, '0')}:${m[2]}${lead ? ` · remind ${lead}m before` : ''}`);
  };

  /* ── ":" command line ── */
  const execCommand = (raw) => {
    const [name, ...args] = raw.trim().split(/\s+/);
    const arg = args[0];
    switch ((name || '').toLowerCase()) {
      case 'export': arg === 'week' ? exportWeek() : exportDay(arg === 'clip'); break;
      case 'week': setShowWeek(true); break;
      case 'carry': askCarryOver(); break;
      case 'due': setDue(arg, args[1]); break;
      case 'recur':
        if (arg === 'daily' || arg === 'weekly' || arg === 'off') setRecurring(arg);
        else if (arg === 'list') {
          const ts = lsGet(RECUR_KEY, []);
          flashMsg(ts.length ? `recurring: ${ts.map((t) => `${t.title} (${t.freq})`).join(' · ')}` : 'no recurring notes');
        } else flashMsg('usage: :recur daily | weekly | off | list');
        break;
      case 'theme': setTheme(arg || 'next'); break;
      case 'pomo':
        if (arg === 'sound') toggleSound();
        else setFocusMinutes(parseInt(arg, 10));
        break;
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
      case 'archive': toggleArchive(); break;
      case 'zen': toggleZen(); break;
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
  // Click a [[wiki-link]]: same-day target → select it; another day → jump
  // there and select once loaded.
  const openWikiLink = (title) => {
    const t = title.trim().toLowerCase();
    const sameDay = notesWithMeta.find((n) => (n.title || '').trim().toLowerCase() === t);
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
        doUpdate(current.id, { content: append(current.content || '') });
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
    if (current && cat) doUpdate(current.id, { category: cat, customCategory: cat });
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
    if (mode === 'command') return; // the ":" input handles its own keys

    // Weekly review overlay: any of Esc / W / q closes.
    if (showWeek) {
      if (e.key === 'Escape' || e.key === 'W' || e.key === 'q') setShowWeek(false);
      e.preventDefault();
      return;
    }

    // Pomodoro focus overlay swallows keys: , or Space pause/resume · . stop ·
    // s sound · Esc/q close.
    if (pomoOverlay) {
      if (e.key === ',' || e.key === ' ') togglePomodoro();
      else if (e.key === '.') stopPomodoro();
      else if (e.key === 's') toggleSound();
      else if (e.key === 'Escape' || e.key === 'q') setPomoOverlay(false);
      e.preventDefault();
      return;
    }

    // Marks: ';<letter>' sets, '\'<letter>' jumps.
    if (mode === 'markset' || mode === 'markjump') {
      if (/^[a-z]$/.test(e.key)) (mode === 'markset' ? setMark : jumpMark)(e.key);
      setMode('normal');
      e.preventDefault();
      return;
    }

    if (mode === 'delete') {
      // y/Enter confirms; n/Esc/anything else cancels.
      if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') {
        if (selectedIds.length) bulkDelete();
        else if (current) doDelete(current);
      }
      setMode('normal');
      e.preventDefault();
      return;
    }

    if (mode === 'carry') {
      // y/Enter runs the carry-over; anything else cancels.
      if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') doCarryOver();
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

    // Vim count prefix. 1/2/3 stay panel switches when no count is pending —
    // start a count with 0 or 4-9 (e.g. 5j; 02j for "2j").
    if (/^\d$/.test(k) && (count !== '' || k === '0' || k >= '4')) {
      setCount((c) => (c + k).slice(0, 4));
      e.preventDefault();
      return;
    }
    const rep = Math.max(1, parseInt(count || '1', 10));
    const consumeCount = () => { if (count) setCount(''); };

    // Global keys regardless of focused panel.
    switch (k) {
      case 'Tab': moveFocus(e.shiftKey ? -1 : 1); e.preventDefault(); return;
      case '1': setFocus('folders'); e.preventDefault(); return;
      case '2': setFocus('notes'); e.preventDefault(); return;
      case '3': setFocus('preview'); e.preventDefault(); return;
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
      case 'M': if (current || selectedIds.length) setMode('move'); e.preventDefault(); return;
      case 'p': togglePin(); e.preventDefault(); return;
      case 'S': cycleSort(); e.preventDefault(); return;
      case 'y': if (current) onDuplicate?.({ ...current }); e.preventDefault(); return;
      case 'Y': yankNote(); e.preventDefault(); return;
      case 'P': pasteNote(); e.preventDefault(); return;
      case 'a': selectedIds.length === list.length ? clearSelection() : selectAllVisible(); e.preventDefault(); return;
      case 'A': toggleArchive(); e.preventDefault(); return;
      case 'z': toggleZen(); e.preventDefault(); return;
      case 'W': setShowWeek(true); e.preventDefault(); return;
      case 'B': askCarryOver(); e.preventDefault(); return;
      case ';': setMode('markset'); e.preventDefault(); return;
      case "'": setMode('markjump'); e.preventDefault(); return;
      case 'u': if (!e.ctrlKey) { undo(); e.preventDefault(); return; } break;
      case 'U': redo(); e.preventDefault(); return;
      case '.': pomodoro ? stopPomodoro() : startPomodoro(); e.preventDefault(); return;
      case ',': togglePomodoro(); e.preventDefault(); return;
      case 'Escape':
        if (count) setCount('');
        else if (tagFilter) setTagFilter(null);
        else if (query) setQuery('');
        else if (selectedIds.length) clearSelection();
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
        ['.', 'start / stop pomodoro'],
        [',', 'pause / resume'],
        ['click 🍅', 'fullscreen focus overlay'],
        ['s (overlay)', 'sound on / off'],
        [':pomo 25|45|90', 'session length'],
        ['auto', 'break 5m · long break 15m sau 4 🍅'],
        ['auto', 'log "🍅 25m HH:mm" vào note khi xong'],
      ],
    },
    {
      title: 'DATE & SEARCH',
      rows: [
        ['[ / ]', 'previous / next day (5] = +5 days)'],
        ['t', 'jump to today'],
        ['/', 'search · Esc clears'],
        ['W', 'weekly review'],
        ['B → y', 'carry-over (hỏi trước) · u hoàn tác'],
        ['click heatmap', 'jump to that day'],
      ],
    },
    {
      title: 'VIM POWER',
      rows: [
        [':', 'command line — :help for list'],
        ['5j · 02k', 'count prefix (0/4-9 starts)'],
        ['u / U', 'undo / redo'],
        ['Y / P', 'yank / paste (cross-day)'],
        [';a → \'a', 'set mark a → jump to it'],
        ['z', 'zen mode (notes only)'],
        ['A', 'archive / unarchive → 📦'],
      ],
    },
    {
      title: 'TAGS & LINKS',
      rows: [
        ['#tag', 'in text → chip; click filters'],
        ['[[title]]', 'wiki-link — click jumps to note'],
        [':tag x / off', 'filter by tag / clear'],
        [':due 14:30 10', 'deadline + remind 10m before'],
        [':recur daily|weekly', 'note lặp tự tạo mỗi ngày/tuần'],
        [':export | clip | week', 'markdown ra file / clipboard'],
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
    normal: '1/2/3:panel  j/k:move  i:body  x:done  p:pin  u:undo  Y/P:yank  z:zen  A:arch  W:week  B:carry  ;/\':marks  :cmd  .:pomodoro  ?:help',
    category: '',
    move: '',
    title: '── EDIT TITLE ──  Enter:save  Esc:cancel',
    body: '── EDIT BODY ──  Ctrl+Enter:save  Esc:cancel  /:blocks  paste:attach file',
    delete: '',
    help: 'press any key to close',
    search: '',
    command: '',
    carry: '',
    markset: 'mark: press a letter (a-z) to tag this note',
    markjump: "jump: press a mark letter (a-z)",
  };

  /* Month heatmap for the FOLDERS panel — GitHub-style activity levels. */
  const heatmap = useMemo(() => {
    const [yy, mm] = dateLabel.split('-').map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = `${yy}-${String(mm).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      const c = (markedDates || {})[day] || 0;
      return { day, n: i + 1, level: c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : c <= 6 ? 3 : 4 };
    });
  }, [dateLabel, markedDates]);

  return (
    <div className={`tui ${zen ? 'tui-zen' : ''}`} data-tui-theme={tuiTheme === 'default' ? undefined : tuiTheme}
         tabIndex={0} ref={rootRef} onKeyDown={handleKeyDown}
         onClick={(e) => { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') rootRef.current?.focus({ preventScroll: true }); }}>
      <div className="tui-body">
        {/* FOLDERS */}
        <div className={`tui-panel tui-folders ${focus === 'folders' ? 'focused' : ''}`}>
          <span className="tui-panel-title"><kbd>1</kbd>FOLDERS</span>
          <div className="tui-scroll">
            {folders.map((f, i) => (
              <div key={f.key} className={`tui-folder ${i === folderIndex ? 'sel' : ''} ${f.key === '__ARCHIVE' ? 'archive' : ''}`}
                   onClick={() => { setFolderIndex(i); setFocus('notes'); }}>
                <span className="tui-folder-name">{f.label}</span>
                <span className="tui-folder-count">{f.count}</span>
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

            <div className="tui-heatmap">
              <div className="tui-side-h">ACTIVITY · {dateLabel.slice(0, 7)}</div>
              <div className="tui-heatmap-grid">
                {heatmap.map((c) => (
                  <button key={c.day} type="button"
                          className={`hm lv${c.level} ${c.day === dateLabel ? 'cur' : ''}`}
                          title={`${c.day} — ${(markedDates || {})[c.day] || 0} notes`}
                          onClick={() => gotoDate(c.day)}>
                    {c.n}
                  </button>
                ))}
              </div>
            </div>
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
            {tagFilter && (
              <button type="button" className="tui-tagfilter-chip" title="Clear tag filter (Esc)"
                      onMouseDown={(e) => { e.preventDefault(); setTagFilter(null); }}>
                #{tagFilter} ×
              </button>
            )}
            {(() => {
              const day = notesWithMeta.filter((n) => !archivedSet.has(n.id));
              if (!day.length) return null;
              const done = day.filter((n) => n.isCompleted).length;
              const pct = Math.round((done / day.length) * 100);
              return (
                <span className="tui-day-progress" title={`${done}/${day.length} done today`}>
                  <span className="bar"><span className="fill" style={{ width: `${pct}%` }} /></span>
                  {pct}%
                </span>
              );
            })()}
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
                    {n.deadline && (() => {
                      const d = new Date(n.deadline);
                      const overdue = !n.isCompleted && d.getTime() < Date.now();
                      return (
                        <span className={`tui-due-chip ${overdue ? 'overdue' : ''}`}
                              title={overdue ? 'Overdue' : 'Due time'}>
                          ⏰ {String(d.getHours()).padStart(2, '0')}:{String(d.getMinutes()).padStart(2, '0')}
                        </span>
                      );
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
                {current.deadline && (() => {
                  const d = new Date(current.deadline);
                  const overdue = !current.isCompleted && d.getTime() < Date.now();
                  return (
                    <span className={overdue ? 'tui-pv-overdue' : undefined}>
                      {' '}· ⏰ due {String(d.getHours()).padStart(2, '0')}:{String(d.getMinutes()).padStart(2, '0')}
                      {current.reminderLeadMinutes ? ` (remind ${current.reminderLeadMinutes}m before)` : ''}
                      {overdue ? ' — OVERDUE' : ''}
                    </span>
                  );
                })()}
                {(focusTimes[current.id] || 0) >= 60 && (() => {
                  const secs = focusTimes[current.id];
                  const h = Math.floor(secs / 3600);
                  const mn = Math.floor((secs % 3600) / 60);
                  return <span> · ⏱ {h ? `${h}h` : ''}{mn}m focused</span>;
                })()}
                {archivedSet.has(current.id) && <span> · 📦 archived</span>}
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
        {mode === 'command' ? (
          // eslint-disable-next-line jsx-a11y/no-autofocus
          <span className="tui-search tui-cmdline">:<input ref={inputRef} autoFocus className="tui-input inline" value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') { e.preventDefault(); execCommand(cmd); }
              else if (e.key === 'Escape') { e.preventDefault(); setCmd(''); setMode('normal'); }
            }}
            onBlur={() => { setCmd(''); setMode('normal'); }}
            placeholder="export · week · carry · due HH:mm · recur daily · theme · pomo 45 · tag x · goto…" /></span>
        ) : mode === 'search' ? (
          <span className="tui-search">/<input ref={inputRef} autoFocus className="tui-input inline" value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={onInputKeyDown} onBlur={onInputBlur} placeholder="search…" /></span>
        ) : mode === 'delete' ? (
          <span className="tui-warn">
            {selectedIds.length
              ? `delete ${selectedIds.length} selected note${selectedIds.length > 1 ? 's' : ''}?`
              : `delete "${current?.title || 'untitled'}"?`}
            <button type="button" className="tui-warn-btn yes"
                    onClick={() => { if (selectedIds.length) bulkDelete(); else if (current) doDelete(current); setMode('normal'); rootRef.current?.focus({ preventScroll: true }); }}>
              Yes (y)
            </button>
            <button type="button" className="tui-warn-btn no"
                    onClick={() => { setMode('normal'); rootRef.current?.focus({ preventScroll: true }); }}>
              No (n / Esc)
            </button>
          </span>
        ) : mode === 'carry' ? (
          <span className="tui-warn">
            carry over {carryCandidates.length} unfinished note{carryCandidates.length > 1 ? 's' : ''} from the last 7 days to {dateLabel}?
            <button type="button" className="tui-warn-btn yes"
                    onClick={() => { doCarryOver(); setMode('normal'); rootRef.current?.focus({ preventScroll: true }); }}>
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
              <button type="button"
                      className={`tui-pomo phase-${pomodoro.phase} ${pomodoro.remaining === 0 ? 'done' : pomodoro.running ? 'run' : 'paused'}`}
                      title="Pomodoro — click: focus overlay · , pause/resume · . stop"
                      onClick={(e) => { e.stopPropagation(); setPomoOverlay(true); rootRef.current?.focus({ preventScroll: true }); }}>
                {pomodoro.phase === 'focus' ? '🍅' : '☕'} {String(Math.floor(pomodoro.remaining / 60)).padStart(2, '0')}:{String(pomodoro.remaining % 60).padStart(2, '0')}
                {!pomodoro.running && pomodoro.remaining > 0 && ' ⏸'}
              </button>
            )}
            {(pomoStats[todayStr()] || 0) > 0 && (
              <span className="tui-pomo-count" title={`${pomoStats[todayStr()]} pomodoro finished today`}>
                🍅×{pomoStats[todayStr()]}
              </span>
            )}
            {count && <span className="tui-count-tag" title="Count prefix">{count}</span>}
            {flash ? <span className="tui-flash">{flash}</span> : <span className="tui-hints">{hints[mode]}</span>}
            <span className="tui-stat">{filtered ? `${list.length}/${notes.length} shown` : `${notes.length} notes`} · {done} done</span>
            {zen && <span className="tui-zen-tag" title="Zen mode (z)">◎ zen</span>}
            <button type="button" className="tui-theme-chip" title="TUI theme — click to cycle (:theme)"
                    onClick={(e) => { e.stopPropagation(); setTheme('next'); rootRef.current?.focus({ preventScroll: true }); }}>
              ◐ {tuiTheme}
            </button>
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

      {/* ── Pomodoro focus overlay — big animated timer over the whole screen ── */}
      {pomoOverlay && pomodoro && (() => {
        const isBreak = pomodoro.phase !== 'focus';
        const frac = Math.max(0, Math.min(1, pomodoro.remaining / (pomodoro.total || 1)));
        const mm = String(Math.floor(pomodoro.remaining / 60)).padStart(2, '0');
        const ss = String(pomodoro.remaining % 60).padStart(2, '0');
        const CELLS = 28;
        const filledCells = Math.round(frac * CELLS);
        const focusNote = notes.find((n) => n.id === pomodoro.noteId);
        const todayCount = pomoStats[todayStr()] || 0;
        return (
          <div className="tui-pomo-overlay" onClick={() => setPomoOverlay(false)}>
            <div className={`tui-pomo-stage ${isBreak ? 'break' : ''} ${pomodoro.running ? 'run' : 'paused'}`}
                 onClick={(e) => e.stopPropagation()}>
              <div className="tui-pomo-rings"><span /><span /><span /></div>
              <div className="tui-pomo-tomato">{isBreak ? '☕' : '🍅'}</div>
              <div className="tui-pomo-time">
                {mm}<span className="tui-pomo-colon">:</span>{ss}
              </div>
              <div className="tui-pomo-bar">
                <span className="fill">{'▓'.repeat(filledCells)}</span>{'░'.repeat(CELLS - filledCells)}
              </div>
              <div className="tui-pomo-label">
                {isBreak
                  ? `${pomodoro.phase === 'long' ? 'LONG BREAK' : 'BREAK'} · NGHỈ MỘT CHÚT ☕${pomodoro.running ? '' : ' · PAUSED'}`
                  : `FOCUS #${pomodoro.cycle} · ${focusNote?.title || 'deep work'}${pomodoro.running ? '' : ' · PAUSED'}`}
              </div>
              <div className="tui-pomo-sub">
                hôm nay: {'🍅'.repeat(Math.min(todayCount, 8))}{todayCount > 8 ? ` ×${todayCount}` : todayCount === 0 ? '—' : ''}
                {' · '}sau {LONG_EVERY - ((pomodoro.cycle - 1) % LONG_EVERY)} 🍅 nữa được nghỉ dài
              </div>
              <div className="tui-pomo-ctl">
                <button type="button" onClick={togglePomodoro}>
                  {pomodoro.running ? '⏸ pause' : '▶ resume'} <kbd>,</kbd>
                </button>
                <button type="button" onClick={stopPomodoro}>■ stop <kbd>.</kbd></button>
                <button type="button" onClick={() => setPomoOverlay(false)}>× close <kbd>Esc</kbd></button>
              </div>
              <div className="tui-pomo-cfg">
                {FOCUS_CHOICES.map((min) => (
                  <button key={min} type="button" className={pomoCfg.focusMin === min ? 'on' : ''}
                          title={`Focus ${min} minutes`}
                          onClick={() => setFocusMinutes(min)}>{min}m</button>
                ))}
                <button type="button" className={pomoCfg.soundOn ? 'on' : ''}
                        title="Chime + tick sound (s)" onClick={toggleSound}>
                  {pomoCfg.soundOn ? '♪ on' : '♪ off'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Weekly review overlay (W / :week) ── */}
      {showWeek && weekReview && (
        <div className="tui-week-overlay" onClick={() => setShowWeek(false)}>
          <div className="tui-week-box" onClick={(e) => e.stopPropagation()}>
            <div className="tui-week-head">
              <span>WEEKLY REVIEW — {weekDays[0]} → {weekDays[6]}</span>
              <button type="button" title="Close (Esc)" onClick={() => setShowWeek(false)}>×</button>
            </div>
            <table className="tui-week-table">
              <thead>
                <tr><th>day</th><th>notes</th><th>done</th><th>progress</th><th>words</th><th>🍅</th></tr>
              </thead>
              <tbody>
                {weekReview.byDay.map((d) => {
                  const pct = d.total ? Math.round((d.done / d.total) * 100) : 0;
                  return (
                    <tr key={d.day} className={d.day === dateLabel ? 'cur' : ''}
                        onClick={() => { gotoDate(d.day); setShowWeek(false); }}>
                      <td>{d.day}{d.day === todayStr() ? ' ★' : ''}</td>
                      <td>{d.total || '—'}</td>
                      <td>{d.done || '—'}</td>
                      <td>
                        <span className="wk-bar"><span style={{ width: `${pct}%` }} /></span> {d.total ? `${pct}%` : ''}
                      </td>
                      <td>{d.words || '—'}</td>
                      <td>{d.pomos || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>TOTAL</td>
                  <td>{weekReview.total}</td>
                  <td>{weekReview.done}</td>
                  <td>{weekReview.total ? `${Math.round((weekReview.done / weekReview.total) * 100)}%` : '—'}</td>
                  <td>{weekReview.words}</td>
                  <td>{weekReview.pomos}</td>
                </tr>
              </tfoot>
            </table>
            <div className="tui-week-foot">
              <button type="button" onClick={exportWeek}>⬇ export week .md</button>
              <span>click a row to open that day · Esc to close</span>
            </div>
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
  onRestore: PropTypes.func,
  onCarryOver: PropTypes.func,
  onRedate: PropTypes.func,
};

export default TuiView;
