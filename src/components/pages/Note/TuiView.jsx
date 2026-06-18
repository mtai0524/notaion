import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import './TuiView.scss';

/**
 * TUI (terminal) view for Daily Notes — a fully keyboard-driven, minimal list.
 * No toolbars, no mouse needed: a header line, the note list with a `>` cursor,
 * and a status/help bar. Single-key commands run everything.
 *
 * Modes:
 *   normal  — navigate & act (j/k, n, e, x, c, d, h/l, /, ?)
 *   insert  — edit selected note's title (Enter save, Esc cancel)
 *   search  — filter the list (Enter keep, Esc clear)
 *   delete  — confirm deletion (y/n)
 */
const TuiView = ({ notes, onAdd, onUpdate, onDelete, onChangeDate, dateLabel, categories }) => {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState('normal'); // normal | insert | search | delete
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const list = useMemo(() => {
    if (!query.trim()) return notes;
    const q = query.toLowerCase();
    return notes.filter(
      (n) =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q) ||
        (n.customCategory || n.category || '').toLowerCase().includes(q)
    );
  }, [notes, query]);

  // Keep the cursor within bounds when the list size changes.
  useEffect(() => {
    setIndex((i) => Math.max(0, Math.min(i, list.length - 1)));
  }, [list.length]);

  // Grab focus so the view owns the keyboard the moment it mounts.
  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  // Focus the inline input when entering insert/search mode.
  useEffect(() => {
    if (mode === 'insert' || mode === 'search') {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [mode]);

  const current = list[index] || null;
  const catOf = (n) => n?.customCategory || n?.category || 'MEMO';

  const enterEdit = () => {
    if (!current) return;
    setDraft(current.title || '');
    setMode('insert');
  };

  const commitEdit = () => {
    if (current) onUpdate(current.id, { title: draft });
    setMode('normal');
    setDraft('');
  };

  const cycleCategory = () => {
    if (!current) return;
    const cats = categories && categories.length ? categories : ['MEMO'];
    const cur = catOf(current);
    const next = cats[(cats.indexOf(cur) + 1) % cats.length];
    onUpdate(current.id, { category: next, customCategory: next });
  };

  // Normal-mode keymap. The view stops propagation so the app's global
  // single-key hotkeys never fire while the terminal is focused.
  const handleKeyDown = (e) => {
    e.stopPropagation();

    // Inline input modes are handled by the <input>'s own onKeyDown.
    if (mode === 'insert' || mode === 'search') return;

    if (mode === 'delete') {
      if (e.key === 'y' || e.key === 'Y') {
        if (current) onDelete(current.id, true);
        setMode('normal');
      } else {
        setMode('normal');
      }
      e.preventDefault();
      return;
    }

    if (showHelp) {
      setShowHelp(false);
      e.preventDefault();
      return;
    }

    const k = e.key;
    switch (k) {
      case 'j':
      case 'ArrowDown':
        setIndex((i) => Math.min(i + 1, list.length - 1));
        break;
      case 'k':
      case 'ArrowUp':
        setIndex((i) => Math.max(i - 1, 0));
        break;
      case 'g':
        setIndex(0);
        break;
      case 'G':
        setIndex(Math.max(0, list.length - 1));
        break;
      case 'n':
        onAdd('blank');
        // Newest note lands at the end — select & edit it next tick.
        requestAnimationFrame(() => {
          setIndex(notes.length); // will clamp to last after re-render
          setDraft('');
          setMode('insert');
        });
        break;
      case 'Enter':
      case 'e':
      case 'i':
        enterEdit();
        break;
      case 'x':
      case ' ':
        if (current) onUpdate(current.id, { isCompleted: !current.isCompleted });
        break;
      case 'c':
        cycleCategory();
        break;
      case 'd':
        if (current) setMode('delete');
        break;
      case 'h':
      case '[':
        onChangeDate(-1);
        break;
      case 'l':
      case ']':
        onChangeDate(1);
        break;
      case '/':
        setMode('search');
        break;
      case '?':
        setShowHelp(true);
        break;
      default:
        return; // let unhandled keys through (still stopped from window)
    }
    e.preventDefault();
  };

  const onInputKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      if (mode === 'insert') commitEdit();
      else setMode('normal'); // search: keep the filter
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (mode === 'insert') {
        setMode('normal');
        setDraft('');
      } else {
        setQuery('');
        setMode('normal');
      }
    }
  };

  const done = notes.filter((n) => n.isCompleted).length;

  return (
    <div
      className="tui-view"
      tabIndex={0}
      ref={rootRef}
      onKeyDown={handleKeyDown}
      onClick={() => rootRef.current?.focus()}
    >
      {/* Header / path line */}
      <div className="tui-head">
        <span className="tui-prompt">notaion@daily</span>
        <span className="tui-sep">:</span>
        <span className="tui-path">~/{dateLabel}</span>
        <span className="tui-meta">[{notes.length} notes · {done} done]</span>
        {query && <span className="tui-filter">/{query}</span>}
      </div>

      {/* Note list */}
      <div className="tui-list">
        {list.length === 0 ? (
          <div className="tui-empty">
            {query ? 'no matches — Esc to clear filter' : 'no entries — press n to create one'}
          </div>
        ) : (
          list.map((n, i) => {
            const sel = i === index;
            const editing = sel && mode === 'insert';
            return (
              <div key={n.id} className={`tui-row ${sel ? 'sel' : ''} ${n.isCompleted ? 'done' : ''}`}>
                <span className="tui-cursor">{sel ? '>' : ' '}</span>
                <span className="tui-check">[{n.isCompleted ? 'x' : ' '}]</span>
                <span className="tui-cat">{catOf(n).padEnd(6).slice(0, 6)}</span>
                {editing ? (
                  <input
                    ref={inputRef}
                    className="tui-input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onInputKeyDown}
                    placeholder="title…"
                  />
                ) : (
                  <span className="tui-title">{n.title || '(untitled)'}</span>
                )}
                {!editing && n.content && (
                  <span className="tui-preview">— {n.content.replace(/\s+/g, ' ').slice(0, 48)}</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Status / command bar */}
      <div className="tui-status">
        {mode === 'search' ? (
          <span className="tui-cmd">
            /
            <input
              ref={inputRef}
              className="tui-input inline"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="search…"
            />
          </span>
        ) : mode === 'delete' ? (
          <span className="tui-warn">delete &quot;{(current?.title || 'untitled')}&quot;? (y/n)</span>
        ) : mode === 'insert' ? (
          <span className="tui-mode">-- INSERT --  Enter:save  Esc:cancel</span>
        ) : (
          <span className="tui-hints">
            NORMAL  j/k:move  n:new  e:edit  x:done  c:cat  d:del  h/l:day  /:find  ?:help
          </span>
        )}
      </div>

      {showHelp && (
        <div className="tui-help" onClick={() => setShowHelp(false)}>
          <pre>{`┌─ DAILY NOTES — TUI KEYS ───────────────┐
│ j / ↓        move down                  │
│ k / ↑        move up                    │
│ g / G        jump top / bottom          │
│ n            new entry (edit title)     │
│ e / i / ⏎    edit selected title        │
│ x / space    toggle done                │
│ c            cycle category             │
│ d  then  y   delete selected            │
│ h / l        previous / next day        │
│ /            search (Esc clears)        │
│ ?            toggle this help           │
└─────────────────────────────────────────┘
        press any key to close`}</pre>
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
