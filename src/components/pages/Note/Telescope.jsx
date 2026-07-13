import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { fuzzyFilter } from './fuzzy';
import './Telescope.scss';

// Telescope-style fuzzy finder. Sources are abstract — this component never
// knows about notes/commands; the caller supplies items + accessors + onPick.
const Telescope = ({ sources, onClose }) => {
  const [srcIdx, setSrcIdx] = useState(0);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);

  const source = sources[srcIdx] || { items: [], getLabel: (x) => String(x), getKey: (_, i) => i };
  const nameOf = (it) => (source.getName ? source.getName(it) : source.getLabel(it));

  const results = useMemo(
    () => fuzzyFilter(source.items || [], query, source.getLabel),
    [source, query],
  );
  const curSel = Math.min(sel, Math.max(0, results.length - 1));
  const current = results[curSel];

  const move = (d) => setSel((s) => {
    const n = results.length;
    if (!n) return 0;
    return (Math.min(s, n - 1) + d + n) % n;
  });

  const cycleSource = (d) => {
    setSrcIdx((i) => (i + d + sources.length) % sources.length);
    setSel(0);
  };

  const pick = () => {
    if (current) { source.onPick?.(current); onClose?.(); }
  };

  const onKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(); }
    else if (e.key === 'Tab') { e.preventDefault(); cycleSource(e.shiftKey ? -1 : 1); }
    else if (e.key === 'ArrowDown' || (e.key === 'j' && e.ctrlKey)) { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp' || (e.key === 'k' && e.ctrlKey)) { e.preventDefault(); move(-1); }
  };

  return (
    <div className="tele-overlay" onMouseDown={onClose}>
      <div className="tele-box" onMouseDown={(e) => e.stopPropagation()}>
        <div className="tele-tabs">
          {sources.map((s, i) => (
            <button key={s.key} type="button" className={`tele-tab ${i === srcIdx ? 'on' : ''}`}
                    onClick={() => { setSrcIdx(i); setSel(0); }}>{s.label}</button>
          ))}
          <span className="tele-tabhint">Tab đổi nguồn</span>
        </div>
        <div className="tele-prompt">
          <span className="tele-caret">›</span>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input autoFocus value={query} placeholder="Search…"
                 onChange={(e) => { setQuery(e.target.value); setSel(0); }}
                 onKeyDown={onKeyDown} />
          <span className="tele-count">{results.length}</span>
        </div>
        <div className="tele-body">
          <div className="tele-list">
            {results.length === 0 ? (
              <div className="tele-empty">no results</div>
            ) : results.map((it, i) => (
              <button key={source.getKey(it, i)} type="button"
                      // Keep the arrow-selected row scrolled into view.
                      ref={i === curSel ? (el) => el?.scrollIntoView?.({ block: 'nearest' }) : null}
                      className={`tele-item ${i === curSel ? 'sel' : ''}`}
                      onMouseEnter={() => setSel(i)}
                      onMouseDown={(e) => { e.preventDefault(); source.onPick?.(it); onClose?.(); }}>
                <span className="tele-item-name">{nameOf(it)}</span>
                {source.getMeta && source.getMeta(it) && (
                  <span className="tele-item-meta">{source.getMeta(it)}</span>
                )}
              </button>
            ))}
          </div>
          <div className="tele-preview">
            {current ? (source.getPreview ? source.getPreview(current) : nameOf(current)) : ''}
          </div>
        </div>
        <div className="tele-hint">Ctrl+j/k · ↑↓ move · Tab source · Enter open · Esc close</div>
      </div>
    </div>
  );
};

Telescope.propTypes = {
  sources: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
    label: PropTypes.string,
    items: PropTypes.array,
    getKey: PropTypes.func,
    getLabel: PropTypes.func,
    getMeta: PropTypes.func,
    getName: PropTypes.func,
    getPreview: PropTypes.func,
    onPick: PropTypes.func,
  })).isRequired,
  onClose: PropTypes.func,
};

export default Telescope;
