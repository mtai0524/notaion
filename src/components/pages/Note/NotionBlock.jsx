import { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { CALLOUT_KINDS } from './noteFormat';
import './NotionBlock.scss';

// One block, rendered visually (never showing raw markdown syntax) and
// inline-editable via contentEditable. The block chrome (icon, caret, checkbox)
// stays put while editing; only the text region is editable.
// Uncontrolled contentEditable: the browser owns the text and caret while
// editing. React seeds the initial text exactly once (on mount) and never
// writes textContent during typing — writing it is what collapses the caret to
// the start. A genuine external change (note switch / block type change)
// remounts this via its React key, so fresh text is picked up naturally.
const Editable = ({ value, className, focus, onChange, onEnter, onBackspaceEmpty, onSlash, onArrowUp, onArrowDown }) => {
  const ref = useRef(null);
  const seeded = useRef(false);
  // Runs once per mount; the guard means later re-renders never touch the DOM.
  useEffect(() => {
    if (!seeded.current && ref.current) {
      ref.current.textContent = value ?? '';
      seeded.current = true;
    }
  }, [value]);
  // Focus this block when the parent asks (arrow-key navigation), placing the
  // caret at the end of its text.
  useEffect(() => {
    if (!focus || !ref.current) return;
    const el = ref.current;
    el.focus();
    const sel = window.getSelection?.();
    if (sel) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
  }, [focus]);
  return (
    <div
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onChange?.(e.currentTarget.textContent)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter?.(); }
        else if (e.key === 'Backspace' && !e.currentTarget.textContent) { e.preventDefault(); onBackspaceEmpty?.(); }
        else if (e.key === '/' && !e.currentTarget.textContent) { e.preventDefault(); onSlash?.(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); onArrowUp?.(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); onArrowDown?.(); }
      }}
    />
  );
};
Editable.propTypes = {
  value: PropTypes.string,
  className: PropTypes.string,
  focus: PropTypes.bool,
  onChange: PropTypes.func,
  onEnter: PropTypes.func,
  onBackspaceEmpty: PropTypes.func,
  onSlash: PropTypes.func,
  onArrowUp: PropTypes.func,
  onArrowDown: PropTypes.func,
};

const NotionBlock = ({ block, focus, onChange, onEnter, onBackspaceEmpty, onSlash, onArrowUp, onArrowDown, onToggleCheck, onToggleCollapse, collapsed }) => {
  const b = block;
  const common = { focus, onChange, onEnter, onBackspaceEmpty, onSlash, onArrowUp, onArrowDown };

  if (b.type === 'divider') return <hr className="nb-hr" />;

  if (b.type === 'todo') {
    return (
      <div className={`nb-todo ${b.checked ? 'checked' : ''}`}>
        <input type="checkbox" checked={!!b.checked} onChange={() => onToggleCheck?.()} />
        <Editable value={b.text} className="nb-text" {...common} />
      </div>
    );
  }

  if (b.type === 'callout') {
    const k = CALLOUT_KINDS[b.kind] || CALLOUT_KINDS.note;
    return (
      <div className={`nb-callout kind-${b.kind || 'note'}`}>
        <span className="nb-callout-icon">{k.icon}</span>
        <Editable value={b.text} className="nb-callout-body" {...common} />
      </div>
    );
  }

  if (b.type === 'toggle') {
    return (
      <div className={`nb-toggle ${collapsed ? 'collapsed' : ''}`}>
        <div className="nb-toggle-head">
          <span className="nb-toggle-caret" onClick={() => onToggleCollapse?.()}>▸</span>
          <Editable value={b.title} className="nb-toggle-title" {...common} />
        </div>
        {!collapsed && b.children ? <div className="nb-toggle-body">{b.children}</div> : null}
      </div>
    );
  }

  if (b.type === 'image') {
    return <img className="nb-img" src={b.url} alt={b.alt || ''} loading="lazy" />;
  }
  if (b.type === 'file') {
    return <a className="nb-file" href={b.url} target="_blank" rel="noopener noreferrer">{b.label}</a>;
  }
  if (b.type === 'code') {
    return <pre className="nb-code"><code>{b.text}</code></pre>;
  }

  const cls = b.type === 'h1' ? 'nb-h1'
    : b.type === 'h2' ? 'nb-h2'
    : b.type === 'h3' ? 'nb-h3'
    : b.type === 'quote' ? 'nb-quote'
    : b.type === 'bullet' ? 'nb-bullet'
    : 'nb-p';
  return <Editable value={b.text} className={`nb-text ${cls}`} {...common} />;
};

NotionBlock.propTypes = {
  block: PropTypes.object.isRequired,
  focus: PropTypes.bool,
  onChange: PropTypes.func,
  onEnter: PropTypes.func,
  onBackspaceEmpty: PropTypes.func,
  onSlash: PropTypes.func,
  onArrowUp: PropTypes.func,
  onArrowDown: PropTypes.func,
  onToggleCheck: PropTypes.func,
  onToggleCollapse: PropTypes.func,
  collapsed: PropTypes.bool,
};

export default NotionBlock;
