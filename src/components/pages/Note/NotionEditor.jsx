import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { parseMarkdown, serializeBlocks } from './noteFormat';
import NotionBlock from './NotionBlock';
import './NotionEditor.scss';

// Block-based Notion-mode editor. The source of truth stays the markdown
// `content` string: we parse it into blocks, edit blocks, then re-serialize
// and hand the markdown back via onChange. Never surfaces raw syntax.
const NotionEditor = ({ content, onChange }) => {
  const [blocks, setBlocks] = useState(() => parseMarkdown(content));
  const [collapsed, setCollapsed] = useState({});

  // Re-parse when the note switches (content prop changes from outside).
  useEffect(() => { setBlocks(parseMarkdown(content)); }, [content]);

  const commit = (next) => { setBlocks(next); onChange?.(serializeBlocks(next)); };

  const patch = (i, upd) => commit(blocks.map((b, j) => (j === i ? { ...b, ...upd } : b)));

  const setText = (i, text) => {
    const b = blocks[i];
    if (b.type === 'toggle') patch(i, { title: text });
    else patch(i, { text });
  };

  const addAfter = (i) => {
    const next = [...blocks];
    next.splice(i + 1, 0, { id: `n${next.length}-${Date.now()}`, type: 'paragraph', text: '' });
    commit(next);
  };

  const removeAt = (i) => { if (blocks.length > 1) commit(blocks.filter((_, j) => j !== i)); };

  // Always render at least one editable paragraph so an empty note is writable.
  const view = blocks.length ? blocks : [{ id: 'empty', type: 'paragraph', text: '' }];

  return (
    <div className="notion-editor">
      {view.map((b, i) => (
        <div key={b.id} className="ne-row">
          <span className="ne-handle" aria-hidden>⠿</span>
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
          </div>
        </div>
      ))}
    </div>
  );
};

NotionEditor.propTypes = { content: PropTypes.string, onChange: PropTypes.func };

export default NotionEditor;
