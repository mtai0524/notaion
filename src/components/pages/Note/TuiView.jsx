import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import './TuiView.scss';

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

const TuiView = ({ notes, onAdd, onUpdate, onDelete, onChangeDate, dateLabel, categories }) => {
  const [focus, setFocus] = useState('notes');
  const [folderIndex, setFolderIndex] = useState(0);
  const [noteIndex, setNoteIndex] = useState(0);
  const [mode, setMode] = useState('normal'); // normal | title | body | search | delete | help
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const catOf = (n) => n?.customCategory || n?.category || 'MEMO';

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
    return l;
  }, [notes, activeFolder, query]);

  useEffect(() => { setNoteIndex((i) => Math.max(0, Math.min(i, list.length - 1))); }, [list.length]);
  useEffect(() => { rootRef.current?.focus(); }, []);
  useEffect(() => {
    if (mode === 'title' || mode === 'body' || mode === 'search') {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [mode]);

  const current = list[noteIndex] || null;

  const moveFocus = (dir) => {
    const i = PANELS.indexOf(focus);
    setFocus(PANELS[(i + dir + PANELS.length) % PANELS.length]);
  };

  const editTitle = () => { if (current) { setDraft(current.title || ''); setMode('title'); } };
  const editBody = () => { if (current) { setDraft(current.content || ''); setMode('body'); } };

  const commit = () => {
    if (current) onUpdate(current.id, mode === 'title' ? { title: draft } : { content: draft });
    setMode('normal');
    setDraft('');
  };

  const cycleCategory = () => {
    if (!current) return;
    const cats = categories && categories.length ? categories : ['MEMO'];
    const next = cats[(cats.indexOf(catOf(current)) + 1) % cats.length];
    onUpdate(current.id, { category: next, customCategory: next });
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (mode === 'title' || mode === 'body' || mode === 'search') return; // inputs handle their own keys

    if (mode === 'help') { setMode('normal'); e.preventDefault(); return; }

    if (mode === 'delete') {
      if (e.key === 'y' || e.key === 'Y') { if (current) onDelete(current.id, true); }
      setMode('normal');
      e.preventDefault();
      return;
    }

    const k = e.key;

    // Global keys regardless of focused panel.
    switch (k) {
      case 'Tab': moveFocus(e.shiftKey ? -1 : 1); e.preventDefault(); return;
      case '?': setMode('help'); e.preventDefault(); return;
      case '/': setMode('search'); e.preventDefault(); return;
      case '[': onChangeDate(-1); e.preventDefault(); return;
      case ']': onChangeDate(1); e.preventDefault(); return;
      case 'n':
        onAdd('blank');
        requestAnimationFrame(() => { setFocus('notes'); setFolderIndex(0); setNoteIndex(notes.length); setDraft(''); setMode('title'); });
        e.preventDefault();
        return;
      default: break;
    }

    if (focus === 'folders') {
      if (k === 'j' || k === 'ArrowDown') setFolderIndex((i) => Math.min(i + 1, folders.length - 1));
      else if (k === 'k' || k === 'ArrowUp') setFolderIndex((i) => Math.max(i - 1, 0));
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
        case 'L': case 'ArrowRight': setFocus('preview'); break;
        case 'Enter': case 'e': editTitle(); break;
        case 'i': editBody(); break;
        case 'x': case ' ': if (current) onUpdate(current.id, { isCompleted: !current.isCompleted }); break;
        case 'c': cycleCategory(); break;
        case 'd': if (current) setMode('delete'); break;
        default: return;
      }
      e.preventDefault();
      return;
    }

    if (focus === 'preview') {
      if (k === 'i' || k === 'Enter') editBody();
      else if (k === 'h' || k === 'ArrowLeft') setFocus('notes');
      else return;
      e.preventDefault();
    }
  };

  const onInputKeyDown = (e) => {
    e.stopPropagation();
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
  const hints = {
    normal: 'Tab:focus  j/k:move  Enter/e:title  i:body  x:done  c:cat  n:new  d:del  [ ]:day  /:find  ?:help',
    title: '── EDIT TITLE ──  Enter:save  Esc:cancel',
    body: '── EDIT BODY ──  Ctrl+Enter:save  Esc:cancel',
    delete: '',
    help: 'press any key to close',
    search: '',
  };

  return (
    <div className="tui" tabIndex={0} ref={rootRef} onKeyDown={handleKeyDown} onClick={() => rootRef.current?.focus()}>
      <div className="tui-body">
        {/* FOLDERS */}
        <div className={`tui-panel tui-folders ${focus === 'folders' ? 'focused' : ''}`}>
          <span className="tui-panel-title">FOLDERS</span>
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
          <span className="tui-panel-title">{`NOTES · ${dateLabel}`}</span>
          <div className="tui-scroll">
            {list.length === 0 ? (
              <div className="tui-empty">{query ? 'no matches' : 'no entries — press n'}</div>
            ) : (
              list.map((n, i) => {
                const sel = i === noteIndex;
                return (
                  <div key={n.id} className={`tui-row ${sel ? 'sel' : ''} ${n.isCompleted ? 'done' : ''}`}
                       onClick={() => { setNoteIndex(i); setFocus('notes'); }}>
                    <span className="tui-check">{n.isCompleted ? '' : ''}</span>
                    {sel && mode === 'title' ? (
                      <input ref={inputRef} className="tui-input" value={draft}
                             onChange={(e) => setDraft(e.target.value)} onKeyDown={onInputKeyDown} placeholder="title…" />
                    ) : (
                      <span className="tui-title">{n.title || '(untitled)'}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PREVIEW */}
        <div className={`tui-panel tui-preview ${focus === 'preview' ? 'focused' : ''}`}>
          <span className="tui-panel-title">PREVIEW</span>
          {current ? (
            <div className="tui-scroll">
              <div className="tui-pv-title">{current.title || '(untitled)'}</div>
              <div className="tui-pv-meta">
                <span className="tag">{catOf(current)}</span>
                {current.timestamp && <span> · {current.timestamp}</span>}
                <span> · {current.isCompleted ? 'done' : 'open'}</span>
              </div>
              {mode === 'body' ? (
                <textarea ref={inputRef} className="tui-textarea" value={draft}
                          onChange={(e) => setDraft(e.target.value)} onKeyDown={onInputKeyDown} placeholder="body… (Ctrl+Enter to save)" />
              ) : (
                <pre className="tui-pv-body">{current.content || '— empty —  (press i to edit)'}</pre>
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
            onChange={(e) => setQuery(e.target.value)} onKeyDown={onInputKeyDown} placeholder="search…" /></span>
        ) : mode === 'delete' ? (
          <span className="tui-warn">delete &quot;{current?.title || 'untitled'}&quot;? (y/n)</span>
        ) : (
          <>
            <span className={`tui-badge mode-${mode}`}>{mode === 'normal' ? 'NORMAL' : mode.toUpperCase()}</span>
            <span className="tui-hints">{hints[mode]}</span>
            <span className="tui-stat">{notes.length} notes · {done} done</span>
          </>
        )}
      </div>

      {mode === 'help' && (
        <div className="tui-help" onClick={() => setMode('normal')}>
          <div className="tui-help-box">
            <div className="tui-help-h">DAILY NOTES · TUI</div>
            <table>
              <tbody>
                <tr><td>Tab / h l</td><td>cycle / move panel focus</td></tr>
                <tr><td>j k · g G</td><td>move · top / bottom</td></tr>
                <tr><td>Enter / e</td><td>edit title</td></tr>
                <tr><td>i</td><td>edit body (Ctrl+Enter save)</td></tr>
                <tr><td>x / space</td><td>toggle done</td></tr>
                <tr><td>c</td><td>cycle category</td></tr>
                <tr><td>n</td><td>new note</td></tr>
                <tr><td>d then y</td><td>delete</td></tr>
                <tr><td>[ ]</td><td>previous / next day</td></tr>
                <tr><td>/</td><td>search</td></tr>
                <tr><td>?</td><td>this help</td></tr>
              </tbody>
            </table>
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
  onChangeDate: PropTypes.func.isRequired,
  dateLabel: PropTypes.string.isRequired,
  categories: PropTypes.array,
};

export default TuiView;
