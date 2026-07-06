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
  const [pendingSelect, setPendingSelect] = useState(null); // id of a just-created note to select
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const previewRef = useRef(null);

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
    } else {
      // Leaving an edit mode unmounts the focused input, which would drop DOM
      // focus (and all shortcuts) — hand it back to the TUI root.
      requestAnimationFrame(() => rootRef.current?.focus());
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

  const createNote = (template) => {
    setFocus('notes');
    setFolderIndex(0);
    setQuery('');
    Promise.resolve(onAdd(template)).then((created) => {
      if (created?.id) setPendingSelect(created.id);
    });
  };

  const toggleDone = () => { if (current) onUpdate(current.id, { isCompleted: !current.isCompleted }); };

  const scrollPreview = (dy) => previewRef.current?.scrollBy({ top: dy });

  const commit = () => {
    if (mode !== 'title' && mode !== 'body') return;
    if (current) onUpdate(current.id, mode === 'title' ? { title: draft } : { content: draft });
    setMode('normal');
    setDraft('');
  };

  // Clicking anywhere outside an open editor must not strand the TUI in an
  // edit mode with no focused input (all shortcuts would go dead) — commit
  // the draft on blur instead.
  const onInputBlur = () => {
    if (mode === 'search') setMode('normal');
    else commit();
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
      case 'Escape':
        if (query) setQuery('');
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
        case 'x': case ' ': toggleDone(); break;
        case 'c': cycleCategory(); break;
        case 'd': if (current) setMode('delete'); break;
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
        case 'c': cycleCategory(); break;
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
  const hints = {
    normal: '1/2/3:panel  j/k:move  Enter/e:title  i:body  x:done  c:cat  f:folder  n/N:new  d:del  [ ]:day  t:today  /:find  ?:help',
    title: '── EDIT TITLE ──  Enter:save  Esc:cancel',
    body: '── EDIT BODY ──  Ctrl+Enter:save  Esc:cancel',
    delete: '',
    help: 'press any key to close',
    search: '',
  };

  return (
    <div className="tui" tabIndex={0} ref={rootRef} onKeyDown={handleKeyDown}
         onClick={(e) => { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') rootRef.current?.focus(); }}>
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
          <span className="tui-panel-title"><kbd>2</kbd>{`NOTES · ${dateLabel}`}</span>
          <div className="tui-scroll">
            {list.length === 0 ? (
              <div className="tui-empty">{query ? 'no matches' : 'no entries — press n'}</div>
            ) : (
              list.map((n, i) => {
                const sel = i === noteIndex;
                return (
                  <div key={n.id} className={`tui-row ${sel ? 'sel' : ''} ${n.isCompleted ? 'done' : ''}`}
                       onClick={() => { setNoteIndex(i); setFocus('notes'); }}
                       onDoubleClick={() => { setNoteIndex(i); setDraft(n.title || ''); setMode('title'); }}>
                    <span className="tui-check">{n.isCompleted ? '[x]' : '[ ]'}</span>
                    {sel && mode === 'title' ? (
                      <input ref={inputRef} className="tui-input" value={draft}
                             onChange={(e) => setDraft(e.target.value)} onKeyDown={onInputKeyDown} onBlur={onInputBlur} placeholder="title…" />
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
          <span className="tui-panel-title"><kbd>3</kbd>PREVIEW</span>
          {current ? (
            <div className="tui-scroll" ref={previewRef}>
              <div className="tui-pv-title">{current.title || '(untitled)'}</div>
              <div className="tui-pv-meta">
                <span className="tag">{catOf(current)}</span>
                {current.timestamp && <span> · {current.timestamp}</span>}
                <span> · {current.isCompleted ? 'done' : 'open'}</span>
              </div>
              {mode === 'body' ? (
                <textarea ref={inputRef} className="tui-textarea" value={draft}
                          onChange={(e) => setDraft(e.target.value)} onKeyDown={onInputKeyDown} onBlur={onInputBlur} placeholder="body… (Ctrl+Enter to save)" />
              ) : (
                <pre className="tui-pv-body" onClick={editBody} title="Click to edit">{current.content || '— empty —  (press i or click to edit)'}</pre>
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
          <span className="tui-warn">delete &quot;{current?.title || 'untitled'}&quot;? (y/n)</span>
        ) : (
          <>
            <span className={`tui-badge mode-${mode}`}>{mode === 'normal' ? 'NORMAL' : mode.toUpperCase()}</span>
            <span className="tui-hints">{hints[mode]}</span>
            <span className="tui-stat">{filtered ? `${list.length}/${notes.length} shown` : `${notes.length} notes`} · {done} done</span>
          </>
        )}
      </div>

      {mode === 'help' && (
        <div className="tui-help" onClick={() => setMode('normal')}>
          <div className="tui-help-box">
            <div className="tui-help-h">DAILY NOTES · TUI</div>
            <table>
              <tbody>
                <tr><td>1 2 3</td><td>jump to folders / notes / preview</td></tr>
                <tr><td>Tab / h l</td><td>cycle / move panel focus</td></tr>
                <tr><td>j k · g G</td><td>move · top / bottom (scrolls preview too)</td></tr>
                <tr><td>Ctrl+d / Ctrl+u</td><td>preview half-page down / up</td></tr>
                <tr><td>f / F</td><td>next / previous folder filter</td></tr>
                <tr><td>Enter / e</td><td>edit title</td></tr>
                <tr><td>i</td><td>edit body (Ctrl+Enter save)</td></tr>
                <tr><td>x / space</td><td>toggle done</td></tr>
                <tr><td>c</td><td>cycle category</td></tr>
                <tr><td>n / N</td><td>new note / new todo list</td></tr>
                <tr><td>d then y</td><td>delete</td></tr>
                <tr><td>[ ]</td><td>previous / next day</td></tr>
                <tr><td>t</td><td>jump to today</td></tr>
                <tr><td>/</td><td>search · Esc clears</td></tr>
                <tr><td>Esc</td><td>clear search / back to notes</td></tr>
                <tr><td>?</td><td>this help</td></tr>
                <tr><td>2×click / click body</td><td>edit title / body with mouse</td></tr>
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
