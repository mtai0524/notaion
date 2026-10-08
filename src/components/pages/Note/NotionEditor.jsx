import { useState, useEffect, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { parseMarkdown, serializeBlocks, reorder } from './noteFormat';
import { wordForward, wordBackward, lineStart, lineEnd, deleteCharAt } from './vimEditor';
import NotionBlock from './NotionBlock';
import { VimNormalContext } from './vimContext';
import './NotionEditor.scss';

// Slash / "turn into" menu — visual block picker (no raw markdown shown).
const SLASH_MENU = [
  { key: 'paragraph', label: 'Text', type: 'paragraph', icon: '¶' },
  { key: 'h1', label: 'Heading 1', type: 'h1', icon: 'H1' },
  { key: 'h2', label: 'Heading 2', type: 'h2', icon: 'H2' },
  { key: 'h3', label: 'Heading 3', type: 'h3', icon: 'H3' },
  { key: 'todo', label: 'To-do', type: 'todo', icon: '☑' },
  { key: 'bullet', label: 'Bullet list', type: 'bullet', icon: '•' },
  { key: 'quote', label: 'Quote', type: 'quote', icon: '❝' },
  { key: 'toggle', label: 'Toggle list', type: 'toggle', icon: '▸' },
  { key: 'callout', label: 'Callout', type: 'callout', kind: 'note', icon: '💡' },
  { key: 'info', label: 'Callout · info', type: 'callout', kind: 'info', icon: 'ℹ️' },
  { key: 'warning', label: 'Callout · warning', type: 'callout', kind: 'warning', icon: '⚠️' },
  { key: 'success', label: 'Callout · success', type: 'callout', kind: 'success', icon: '✅' },
  { key: 'danger', label: 'Callout · danger', type: 'callout', kind: 'danger', icon: '🔥' },
  { key: 'code', label: 'Code block', type: 'code', icon: '</>' },
  { key: 'divider', label: 'Divider', type: 'divider', icon: '―' },
];

// The visible text of a block regardless of its type (toggle uses `title`).
const blockText = (b) => (b.type === 'toggle' ? (b.title || '') : (b.text || ''));

// One draggable row. Memoised on purpose: every <Draggable> scans all drag
// handles when it renders (react-beautiful-dnd findDragHandle), so re-rendering
// all N rows on each NORMAL↔INSERT switch or keystroke cost O(N²) — about a
// second for a 1500-line note. Props are primitives/stable objects only, and
// `api` is one object whose methods always point at the latest handlers, so a
// row re-renders only when something about *that* row changed.
const Row = memo(function Row({ b, i, selected, vimCur, focus, collapsed, slashOpen, slashSel, api }) {
  return (
    <Draggable draggableId={String(b.id)} index={i}>
      {(dr, snapshot) => (
        <div className={`ne-row ${snapshot.isDragging ? 'dragging' : ''} ${selected ? 'selected' : ''}`}
             ref={dr.innerRef} {...dr.draggableProps}
             onMouseEnter={() => api.extendSweep(i)}>
          <span className="ne-gutter" title="Hold and drag to select multiple blocks, then Delete"
                onMouseDown={(e) => { e.preventDefault(); api.startSweep(i); }} />
          <span className="ne-handle" title="Drag to reorder" {...dr.dragHandleProps}>⠿</span>
          <button type="button" className="ne-add" title="Insert / turn into block"
                  onClick={() => api.openSlash(i)}>+</button>
          <button type="button" className="ne-del" title="Delete this block"
                  onClick={() => api.removeAt(i)}>🗑</button>
          <div className={`ne-block ${vimCur ? 'vim-cur' : ''}`} data-vi={i}>
            <NotionBlock
              block={b}
              focus={focus}
              collapsed={collapsed}
              onChange={(t) => api.setText(i, t)}
              onEnter={() => api.addAfter(i)}
              onBackspaceEmpty={() => api.removeAt(i)}
              onSlash={() => api.openSlash(i)}
              onArrowUp={() => api.moveFocus(i, -1)}
              onArrowDown={() => api.moveFocus(i, 1)}
              onToggleCheck={() => api.patch(i, { checked: !b.checked })}
              onToggleCollapse={() => api.toggleCollapse(b.id)}
            />
            {slashOpen && (
              // React's autoFocus only works on form controls, not a
              // <div> — focus the popup imperatively so it owns the
              // arrow keys instead of the block behind it.
              <div className="ne-slash" tabIndex={0}
                   ref={(el) => el?.focus()}
                   onKeyDown={(e) => {
                     if (e.key === 'ArrowDown') { e.preventDefault(); api.setSlashSel((s) => (s + 1) % SLASH_MENU.length); }
                     else if (e.key === 'ArrowUp') { e.preventDefault(); api.setSlashSel((s) => (s - 1 + SLASH_MENU.length) % SLASH_MENU.length); }
                     else if (e.key === 'Enter') { e.preventDefault(); api.setType(i, SLASH_MENU[slashSel]); }
                     else if (e.key === 'Escape') { e.preventDefault(); api.closeSlash(i); }
                   }}>
                {SLASH_MENU.map((it, si) => (
                  <button key={it.key} type="button"
                          // Keep the arrow-selected row scrolled into view.
                          ref={si === slashSel ? (el) => el?.scrollIntoView?.({ block: 'nearest' }) : null}
                          className={`ne-slash-item ${si === slashSel ? 'sel' : ''}`}
                          onMouseEnter={() => api.setSlashSel(si)}
                          onMouseDown={(e) => { e.preventDefault(); api.setType(i, it); }}>
                    <span className="ne-slash-icon">{it.icon}</span>
                    <span>{it.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
});

Row.propTypes = {
  b: PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), checked: PropTypes.bool }).isRequired,
  i: PropTypes.number.isRequired,
  selected: PropTypes.bool,
  vimCur: PropTypes.bool,
  focus: PropTypes.bool,
  collapsed: PropTypes.bool,
  slashOpen: PropTypes.bool,
  slashSel: PropTypes.number,
  api: PropTypes.shape({
    extendSweep: PropTypes.func, startSweep: PropTypes.func, openSlash: PropTypes.func, removeAt: PropTypes.func,
    setText: PropTypes.func, addAfter: PropTypes.func, moveFocus: PropTypes.func, patch: PropTypes.func,
    setType: PropTypes.func, toggleCollapse: PropTypes.func, setSlashSel: PropTypes.func, closeSlash: PropTypes.func,
  }).isRequired,
};

// Block-based Notion-mode editor. The source of truth stays the markdown
// `content` string: we parse it into blocks, edit blocks, then re-serialize
// and hand the markdown back via onChange. Never surfaces raw syntax.
const NotionEditor = ({ content, onChange, nvim = false, onEx }) => {
  const [blocks, setBlocks] = useState(() => parseMarkdown(content));
  const [collapsed, setCollapsed] = useState({});
  const [slashFor, setSlashFor] = useState(null); // index of the block whose menu is open
  const [slashSel, setSlashSel] = useState(0);     // highlighted row in the slash menu
  const [focusIndex, setFocusIndex] = useState(null); // block to focus (arrow-key nav / after edit)
  const [selected, setSelected] = useState(() => new Set()); // block ids in a multi-select
  const dragSel = useRef(null); // { anchor } index while sweeping the mouse
  const [vimMode, setVimMode] = useState('normal'); // nvim: 'normal' | 'insert'
  const [vimIndex, setVimIndex] = useState(0);       // block the vim cursor is on
  const pendingSeq = useRef(null);                   // 'g' or 'd' waiting for the 2nd key
  const rootElRef = useRef(null);                    // the .notion-editor container (owns nvim keys)

  // Markdown we last emitted. When our own onChange feeds `content` right back,
  // it equals this — so we must NOT re-parse (re-parsing mints new block ids,
  // which remounts the contentEditable and destroys the caret on every keystroke).
  // We only re-parse when `content` changes from the OUTSIDE (a note switch).
  const lastEmitted = useRef(content);
  useEffect(() => {
    if (content !== lastEmitted.current) {
      lastEmitted.current = content;
      setBlocks(parseMarkdown(content));
    }
  }, [content]);

  const commit = (next) => {
    setBlocks(next);
    const md = serializeBlocks(next);
    lastEmitted.current = md;
    onChange?.(md);
  };

  const patch = (i, upd) => commit(blocks.map((b, j) => (j === i ? { ...b, ...upd } : b)));

  const setText = (i, text) => {
    const b = blocks[i];
    if (b.type === 'toggle') patch(i, { title: text });
    else patch(i, { text });
  };

  // Turn a block into another type, carrying its text over. Divider/code have
  // no inline text; callouts keep the text as the body.
  const setType = (i, item) => {
    const b = blocks[i];
    const text = blockText(b);
    const next = { ...b, type: item.type };
    delete next.kind; delete next.title; delete next.children; delete next.checked; delete next.lang;
    if (item.type === 'toggle') { next.title = text; next.children = ''; delete next.text; }
    else if (item.type === 'callout') { next.kind = item.kind || 'note'; next.text = text; }
    else if (item.type === 'todo') { next.checked = false; next.text = text; }
    else if (item.type === 'divider') { next.text = ''; }
    else if (item.type === 'code') { next.lang = ''; next.text = text; }
    else next.text = text;
    setSlashFor(null);
    setFocusIndex(i);
    patch(i, next);
  };

  const addAfter = (i) => {
    const next = [...blocks];
    next.splice(i + 1, 0, { id: `n${next.length}-${Date.now()}`, type: 'paragraph', text: '' });
    setFocusIndex(i + 1);
    commit(next);
  };

  const addBefore = (i) => {
    const next = [...blocks];
    next.splice(i, 0, { id: `n${next.length}-${Date.now()}`, type: 'paragraph', text: '' });
    setFocusIndex(i);
    commit(next);
  };

  const removeAt = (i) => {
    if (blocks.length <= 1) return;
    setFocusIndex(Math.max(0, i - 1));
    commit(blocks.filter((_, j) => j !== i));
  };

  // Delete every selected block at once (multi-select sweep + Delete).
  const removeSelected = () => {
    if (!selected.size) return;
    const kept = blocks.filter((b) => !selected.has(b.id));
    setSelected(new Set());
    commit(kept.length ? kept : [{ id: `n${Date.now()}`, type: 'paragraph', text: '' }]);
  };

  // Mouse sweep to multi-select blocks: mousedown on a row's gutter sets the
  // anchor; moving over rows selects the inclusive range.
  const startSweep = (i) => { dragSel.current = { anchor: i }; setSelected(new Set([blocks[i]?.id])); };
  const extendSweep = (i) => {
    if (!dragSel.current) return;
    const a = dragSel.current.anchor;
    const [lo, hi] = a <= i ? [a, i] : [i, a];
    setSelected(new Set(blocks.slice(lo, hi + 1).map((b) => b.id)));
  };
  const endSweep = () => { dragSel.current = null; };

  // Arrow-key navigation between blocks. Clamps at the ends.
  const moveFocus = (i, dir) => {
    const n = (blocks.length ? blocks.length : 1);
    setFocusIndex(Math.max(0, Math.min(n - 1, i + dir)));
  };

  /* ─────────────── Nvim modal editing ─────────────── */

  // The editable DOM node of the vim-current block (tagged with data-vi).
  const vimEl = () => document.querySelector(`.notion-editor [data-vi="${vimIndex}"] [contenteditable]`);
  // Current caret offset within that node (0 if unfocused).
  const vimCaret = () => {
    const sel = window.getSelection?.();
    if (!sel || !sel.rangeCount) return 0;
    return sel.getRangeAt(0).startOffset;
  };
  // Put a collapsed caret at `offset` inside the vim-current block.
  const setVimCaret = (offset) => {
    const el = vimEl();
    if (!el) return;
    el.focus();
    const node = el.firstChild || el;
    const max = (el.textContent || '').length;
    const off = Math.max(0, Math.min(offset, max));
    const sel = window.getSelection?.();
    if (!sel) return;
    const r = document.createRange();
    try { r.setStart(node.nodeType === 3 ? node : el, node.nodeType === 3 ? off : 0); }
    catch { r.selectNodeContents(el); r.collapse(true); }
    r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);
  };

  const enterInsert = (caretAtEnd) => {
    setVimMode('insert');
    setFocusIndex(vimIndex);
    if (caretAtEnd) requestAnimationFrame(() => { const el = vimEl(); if (el) setVimCaret((el.textContent || '').length); });
  };

  // Handle one NORMAL-mode key. Returns true if it consumed the event.
  const handleNormalKey = (key) => {
    const cur = blocks[vimIndex];
    const text = cur ? (cur.type === 'toggle' ? (cur.title || '') : (cur.text || '')) : '';

    // two-key sequences: gg, dd
    if (pendingSeq.current === 'g') {
      pendingSeq.current = null;
      if (key === 'g') { setVimIndex(0); setFocusIndex(0); return true; }
      return true; // swallow the 2nd key of an aborted gg
    }
    if (pendingSeq.current === 'd') {
      pendingSeq.current = null;
      if (key === 'd') { const at = vimIndex; setVimIndex(Math.max(0, at - 1)); removeAt(at); return true; }
      return true;
    }

    switch (key) {
      case 'i': enterInsert(false); return true;
      case 'a': enterInsert(false); return true;
      case 'A': enterInsert(true); return true;
      case 'o': addAfter(vimIndex); setVimIndex(vimIndex + 1); setVimMode('insert'); return true;
      case 'O': addBefore(vimIndex); setVimMode('insert'); return true;
      case 'j': { const ni = Math.min(blocks.length - 1, vimIndex + 1); setVimIndex(ni); return true; }
      case 'k': { const ni = Math.max(0, vimIndex - 1); setVimIndex(ni); return true; }
      case 'h': setVimCaret(Math.max(0, vimCaret() - 1)); return true;
      case 'l': setVimCaret(vimCaret() + 1); return true;
      case 'w': setVimCaret(wordForward(text, vimCaret())); return true;
      case 'b': setVimCaret(wordBackward(text, vimCaret())); return true;
      case '0': setVimCaret(lineStart(text, vimCaret())); return true;
      case '$': setVimCaret(lineEnd(text, vimCaret())); return true;
      case 'g': pendingSeq.current = 'g'; return true;
      case 'G': { const last = Math.max(0, blocks.length - 1); setVimIndex(last); setFocusIndex(last); return true; }
      case 'd': pendingSeq.current = 'd'; return true;
      case 'x': {
        const { text: nt, pos } = deleteCharAt(text, vimCaret());
        if (nt !== text) { patch(vimIndex, cur.type === 'toggle' ? { title: nt } : { text: nt }); requestAnimationFrame(() => setVimCaret(pos)); }
        return true;
      }
      default: return false;
    }
  };

  // Container keydown for nvim. Guarded so nothing runs when nvim is off.
  const onVimKeyDown = (e) => {
    if (!nvim) return;
    if (vimMode === 'insert') {
      if (e.key === 'Escape' || (e.key === '[' && e.ctrlKey)) {
        e.preventDefault();
        setVimMode('normal');
        vimEl()?.blur();
        // blur() drops focus to <body>; hand it back to the container or the
        // next NORMAL key goes nowhere.
        rootElRef.current?.focus({ preventScroll: true });
      }
      return; // typing handled by the editable
    }
    // NORMAL
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Esc in NORMAL only cancels a half-typed sequence (gg/dd). With nothing
    // pending, let it bubble so the TUI can close the editor — otherwise the
    // note becomes impossible to exit with the keyboard.
    if (e.key === 'Escape') {
      if (pendingSeq.current) { e.preventDefault(); pendingSeq.current = null; }
      return;
    }
    if (e.key === ':') { e.preventDefault(); onEx?.(); return; } // Ex command-line
    // Arrow keys behave like h/j/k/l.
    const arrow = { ArrowLeft: 'h', ArrowRight: 'l', ArrowDown: 'j', ArrowUp: 'k' }[e.key];
    const key = arrow || e.key;
    if (arrow || key.length === 1 || key === '$') {
      if (handleNormalKey(key)) e.preventDefault();
    }
  };

  // With nvim on, the container owns the modal keys — it must actually hold
  // DOM focus or NORMAL→INSERT never fires. Claim it on mount / when nvim
  // turns on, unless the user is already typing in a block.
  useEffect(() => {
    if (!nvim) return;
    const el = rootElRef.current;
    if (!el) return;
    const a = document.activeElement;
    if (a && (a.isContentEditable || a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
    if (!el.contains(a)) el.focus({ preventScroll: true });
  }, [nvim]);

  // Keep vimIndex in range as blocks come and go; reset to normal when nvim off.
  useEffect(() => {
    if (!nvim) { setVimMode('normal'); return; }
    setVimIndex((i) => Math.max(0, Math.min(i, Math.max(0, blocks.length - 1))));
  }, [nvim, blocks.length]);

  // Open the slash menu for a block (typed "/" or clicked "+").
  const openSlash = (i) => { setSlashSel(0); setSlashFor((cur) => (cur === i ? null : i)); };

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    commit(reorder(blocks, result.source.index, result.destination.index));
  };

  // Clear the transient focus request after it's consumed, so re-renders don't
  // keep stealing the caret back to the same block.
  useEffect(() => { if (focusIndex !== null) setFocusIndex(null); }, [focusIndex]);

  // While blocks are multi-selected, Delete/Backspace removes them and Esc
  // clears the selection. A window listener avoids fighting rbd for the
  // Droppable's ref/focus.
  useEffect(() => {
    if (!selected.size) return undefined;
    const onKey = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
      else if (e.key === 'Escape') setSelected(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, blocks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Always render at least one editable paragraph so an empty note is writable.
  const view = blocks.length ? blocks : [{ id: 'empty', type: 'paragraph', text: '' }];

  // Stable handler bag for the memoised rows: same object every render, with
  // methods re-pointed at this render's closures (so they never go stale).
  const apiRef = useRef({});
  Object.assign(apiRef.current, {
    extendSweep, startSweep, openSlash, removeAt, setText, addAfter, moveFocus, patch, setType,
    toggleCollapse: (id) => setCollapsed((m) => ({ ...m, [id]: !m[id] })),
    setSlashSel,
    closeSlash: (i) => { setSlashFor(null); setFocusIndex(i); },
  });
  const api = apiRef.current;

  return (
    <VimNormalContext.Provider value={nvim && vimMode === 'normal'}>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="notion-editor">
          {(dp) => (
            <div className={`notion-editor ${nvim ? `vim vim-${vimMode}` : ''}`}
                 ref={(el) => {
                   dp.innerRef(el);
                   rootElRef.current = el;
                 }} {...dp.droppableProps}
                 tabIndex={nvim ? 0 : undefined}
                 onMouseUp={endSweep} onMouseLeave={endSweep}
                 onKeyDownCapture={onVimKeyDown}>
              {nvim && (
                <div className={`ne-vim-badge ${vimMode}`}>-- {vimMode.toUpperCase()} --</div>
              )}
              {view.map((b, i) => (
                <Row key={b.id} b={b} i={i}
                     selected={selected.has(b.id)}
                     vimCur={nvim && vimIndex === i}
                     focus={focusIndex === i}
                     collapsed={!!collapsed[b.id]}
                     slashOpen={slashFor === i}
                     slashSel={slashFor === i ? slashSel : 0}
                     api={api} />
              ))}
              {dp.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </VimNormalContext.Provider>
  );
};

NotionEditor.propTypes = { content: PropTypes.string, onChange: PropTypes.func, nvim: PropTypes.bool, onEx: PropTypes.func };

export default NotionEditor;
