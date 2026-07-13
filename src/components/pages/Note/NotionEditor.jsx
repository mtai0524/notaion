import { useState, useEffect } from 'react';
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

  // Re-parse when the note switches (content prop changes from outside).
  useEffect(() => { setBlocks(parseMarkdown(content)); }, [content]);

  const commit = (next) => { setBlocks(next); onChange?.(serializeBlocks(next)); };

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
    patch(i, next);
  };

  const addAfter = (i) => {
    const next = [...blocks];
    next.splice(i + 1, 0, { id: `n${next.length}-${Date.now()}`, type: 'paragraph', text: '' });
    commit(next);
  };

  const removeAt = (i) => { if (blocks.length > 1) commit(blocks.filter((_, j) => j !== i)); };

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    commit(reorder(blocks, result.source.index, result.destination.index));
  };

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
                            onClick={() => setSlashFor((cur) => (cur === i ? null : i))}>+</button>
                    <div className="ne-block">
                      <NotionBlock
                        block={b}
                        collapsed={!!collapsed[b.id]}
                        onChange={(t) => setText(i, t)}
                        onEnter={() => addAfter(i)}
                        onBackspaceEmpty={() => removeAt(i)}
                        onToggleCheck={() => patch(i, { checked: !b.checked })}
                        onToggleCollapse={() => setCollapsed((m) => ({ ...m, [b.id]: !m[b.id] }))}
                      />
                      {slashFor === i && (
                        <div className="ne-slash">
                          {SLASH_MENU.map((it) => (
                            <button key={it.key} type="button" className="ne-slash-item"
                                    onClick={() => setType(i, it)}>
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
