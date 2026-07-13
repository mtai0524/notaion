import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { parseMarkdown, serializeBlocks, reorder } from './noteFormat';
import NotionBlock from './NotionBlock';
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

// Block-based Notion-mode editor. The source of truth stays the markdown
// `content` string: we parse it into blocks, edit blocks, then re-serialize
// and hand the markdown back via onChange. Never surfaces raw syntax.
const NotionEditor = ({ content, onChange }) => {
  const [blocks, setBlocks] = useState(() => parseMarkdown(content));
  const [collapsed, setCollapsed] = useState({});
  const [slashFor, setSlashFor] = useState(null); // index of the block whose menu is open
  const [slashSel, setSlashSel] = useState(0);     // highlighted row in the slash menu
  const [focusIndex, setFocusIndex] = useState(null); // block to focus (arrow-key nav / after edit)

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

  const removeAt = (i) => {
    if (blocks.length <= 1) return;
    setFocusIndex(Math.max(0, i - 1));
    commit(blocks.filter((_, j) => j !== i));
  };

  // Arrow-key navigation between blocks. Clamps at the ends.
  const moveFocus = (i, dir) => {
    const n = (blocks.length ? blocks.length : 1);
    setFocusIndex(Math.max(0, Math.min(n - 1, i + dir)));
  };

  // Open the slash menu for a block (typed "/" or clicked "+").
  const openSlash = (i) => { setSlashSel(0); setSlashFor((cur) => (cur === i ? null : i)); };

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    commit(reorder(blocks, result.source.index, result.destination.index));
  };

  // Clear the transient focus request after it's consumed, so re-renders don't
  // keep stealing the caret back to the same block.
  useEffect(() => { if (focusIndex !== null) setFocusIndex(null); }, [focusIndex]);

  // Always render at least one editable paragraph so an empty note is writable.
  const view = blocks.length ? blocks : [{ id: 'empty', type: 'paragraph', text: '' }];

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="notion-editor">
        {(dp) => (
          <div className="notion-editor" ref={dp.innerRef} {...dp.droppableProps}>
            {view.map((b, i) => (
              <Draggable key={b.id} draggableId={String(b.id)} index={i}>
                {(dr, snapshot) => (
                  <div className={`ne-row ${snapshot.isDragging ? 'dragging' : ''}`}
                       ref={dr.innerRef} {...dr.draggableProps}>
                    <span className="ne-handle" title="Drag to reorder" {...dr.dragHandleProps}>⠿</span>
                    <button type="button" className="ne-add" title="Insert / turn into block"
                            onClick={() => openSlash(i)}>+</button>
                    <div className="ne-block">
                      <NotionBlock
                        block={b}
                        focus={focusIndex === i}
                        collapsed={!!collapsed[b.id]}
                        onChange={(t) => setText(i, t)}
                        onEnter={() => addAfter(i)}
                        onBackspaceEmpty={() => removeAt(i)}
                        onSlash={() => openSlash(i)}
                        onArrowUp={() => moveFocus(i, -1)}
                        onArrowDown={() => moveFocus(i, 1)}
                        onToggleCheck={() => patch(i, { checked: !b.checked })}
                        onToggleCollapse={() => setCollapsed((m) => ({ ...m, [b.id]: !m[b.id] }))}
                      />
                      {slashFor === i && (
                        // React's autoFocus only works on form controls, not a
                        // <div> — focus the popup imperatively so it owns the
                        // arrow keys instead of the block behind it.
                        <div className="ne-slash" tabIndex={0}
                             ref={(el) => el?.focus()}
                             onKeyDown={(e) => {
                               if (e.key === 'ArrowDown') { e.preventDefault(); setSlashSel((s) => (s + 1) % SLASH_MENU.length); }
                               else if (e.key === 'ArrowUp') { e.preventDefault(); setSlashSel((s) => (s - 1 + SLASH_MENU.length) % SLASH_MENU.length); }
                               else if (e.key === 'Enter') { e.preventDefault(); setType(i, SLASH_MENU[slashSel]); }
                               else if (e.key === 'Escape') { e.preventDefault(); setSlashFor(null); setFocusIndex(i); }
                             }}>
                          {SLASH_MENU.map((it, si) => (
                            <button key={it.key} type="button"
                                    className={`ne-slash-item ${si === slashSel ? 'sel' : ''}`}
                                    onMouseEnter={() => setSlashSel(si)}
                                    onMouseDown={(e) => { e.preventDefault(); setType(i, it); }}>
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
            ))}
            {dp.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

NotionEditor.propTypes = { content: PropTypes.string, onChange: PropTypes.func };

export default NotionEditor;
