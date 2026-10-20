import { useRef } from 'react';
import PropTypes from 'prop-types';

// Range inputs keep ←/→ for themselves but let j/k/Esc reach the popup.
const keepArrowsLocal = (e) => { if (e.key.startsWith('Arrow')) e.stopPropagation(); };

export const LookRow = ({ label, selected, onSelect, children }) => (
  // Clicking anywhere in the row (its label or any control) selects it.
  <div className={`tui-look-row ${selected ? 'sel' : ''}`} onClick={onSelect}>
    <span className="lab">{label}</span>
    {children}
  </div>
);

export const RangeRow = ({ label, value, min, max, step, format, selected, onSelect, onChange }) => (
  <LookRow label={label} selected={selected} onSelect={onSelect}>
    <input type="range" min={min} max={max} step={step} value={value}
           onKeyDown={keepArrowsLocal} onChange={(e) => onChange(Number(e.target.value))} />
    <span className="val">{format(value)}</span>
  </LookRow>
);

export const SegmentRow = ({ label, value, options, selected, onSelect, onChange }) => (
  <LookRow label={label} selected={selected} onSelect={onSelect}>
    <div className="tui-look-seg">
      {options.map((option) => (
        <button key={option} type="button" className={value === option ? 'on' : ''} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  </LookRow>
);

// Presets + a "default" swatch (value null) + a native picker for any color.
export const ColorRow = ({ label, value, colors, defaultClass, selected, onSelect, onChange }) => {
  const inputRef = useRef(null);
  const isCustom = value && !colors.includes(value);
  return (
    <LookRow label={label} selected={selected} onSelect={onSelect}>
      <div className="tui-accent-swatches">
        <button type="button" className={`sw ${defaultClass} ${value ? '' : 'cur'}`} title="Default"
                onClick={() => onChange(null)} />
        {colors.map((color) => (
          <button key={color} type="button" className={`sw ${value === color ? 'cur' : ''}`} title={color}
                  style={{ background: color }} onClick={() => onChange(color)} />
        ))}
        <button type="button" className={`tui-accent-custom ${isCustom ? 'cur' : ''}`}
                onClick={() => inputRef.current?.click()}>
          <i aria-hidden />Custom…
        </button>
        <input ref={inputRef} type="color" className="tui-hidden-input" value={value || colors[0]}
               onChange={(e) => onChange(e.target.value)} />
      </div>
    </LookRow>
  );
};

export const ResetRow = ({ label, selected, onSelect, onReset }) => (
  <button type="button" className={`tui-accent-reset ${selected ? 'sel' : ''}`} onClick={() => { onSelect(); onReset(); }}>
    ⟲ {label}
  </button>
);

const selectionProps = {
  selected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
};

LookRow.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  ...selectionProps,
};

RangeRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  format: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  ...selectionProps,
};

SegmentRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  ...selectionProps,
};

ColorRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  colors: PropTypes.arrayOf(PropTypes.string).isRequired,
  defaultClass: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  ...selectionProps,
};

ResetRow.propTypes = {
  label: PropTypes.string.isRequired,
  onReset: PropTypes.func.isRequired,
  ...selectionProps,
};
