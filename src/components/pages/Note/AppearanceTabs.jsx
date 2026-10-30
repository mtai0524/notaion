import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ACCENT_COLORS, TEXT_COLORS, BORDER_STYLES, FONTS, FONT_WEIGHTS, LOOK_FIELDS, TEXT_FIELDS, TEXT_PANELS, MAX_BG_BYTES,
} from './appearance';
import { THEME_NAMES, themeSwatch } from './tuiThemes';
import { ColorRow, LookRow, RangeRow, ResetRow, SegmentRow } from './OptionRows';
import { appearanceShape, keepKeysLocal, rowSelection, textShape } from './optionsUtils';

const px = (value) => `${value}px`;

const readFileAsDataUrlAsync = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const BackgroundRow = ({ value, selected, onSelect, onChange, onError }) => {
  const [urlDraft, setUrlDraft] = useState('');
  const fileInputRef = useRef(null);

  const applyUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    onChange(url);
    setUrlDraft('');
  };

  const uploadAsync = async (file) => {
    if (!file) return;
    if (file.size > MAX_BG_BYTES) {
      onError('image too large (max 2MB) — paste an image URL instead');
      return;
    }
    try {
      onChange(await readFileAsDataUrlAsync(file));
    } catch (err) {
      console.error('[APPEARANCE] Could not read background image:', err);
      onError('could not read the image');
    }
  };

  return (
    <LookRow label="background" selected={selected} onSelect={onSelect}>
      <span className="tui-bg-thumb" style={value ? { backgroundImage: `url(${JSON.stringify(value)})` } : undefined} />
      <input type="text" className="tui-bg-url" placeholder="paste image URL https://…" value={urlDraft}
             onChange={(e) => setUrlDraft(e.target.value)} onBlur={applyUrl}
             onKeyDown={(e) => { keepKeysLocal(e); if (e.key === 'Enter') applyUrl(); }} />
      <button type="button" className="tui-look-btn" onClick={() => fileInputRef.current?.click()}>⬆ Upload</button>
      <button type="button" className="tui-look-btn" title="Remove background" disabled={!value}
              onClick={() => onChange('')}>✕</button>
      <input ref={fileInputRef} type="file" accept="image/*" className="tui-hidden-input"
             onChange={(e) => { uploadAsync(e.target.files?.[0]); e.target.value = ''; }} />
    </LookRow>
  );
};

const ThemeSwatch = ({ name }) => {
  const colors = themeSwatch(name);
  if (!colors) return null;
  return <i className="tui-theme-swatch">{colors.map((color) => <b key={color} style={{ background: color }} />)}</i>;
};

const ThemeRow = ({ value, selected, onSelect, onChange }) => (
  <LookRow label="theme" selected={selected} onSelect={onSelect}>
    <div className="tui-look-seg tui-theme-seg">
      {THEME_NAMES.map((name) => (
        <button key={name} type="button" className={value === name ? 'on' : ''} onClick={() => onChange(name)}>
          <ThemeSwatch name={name} />{name}
        </button>
      ))}
    </div>
  </LookRow>
);

export const LookTab = ({ appearance, sel, onSelChange, onChange, onReset, onError }) => {
  const row = rowSelection(LOOK_FIELDS, sel, onSelChange);
  return (
    <>
      <ThemeRow value={appearance.theme} onChange={(theme) => onChange({ theme })} {...row('theme')} />
      <ColorRow label="highlight" value={appearance.accent} colors={ACCENT_COLORS} defaultClass="default"
                onChange={(accent) => onChange({ accent })} {...row('accent')} />
      <RangeRow label="border width" value={appearance.borderWidth} min={0} max={4} step={1} format={px}
                onChange={(borderWidth) => onChange({ borderWidth })} {...row('borderWidth')} />
      <SegmentRow label="border style" value={appearance.borderStyle} options={BORDER_STYLES}
                  onChange={(borderStyle) => onChange({ borderStyle })} {...row('borderStyle')} />
      <RangeRow label="corner radius" value={appearance.radius} min={0} max={20} step={2} format={px}
                onChange={(radius) => onChange({ radius })} {...row('radius')} />
      <RangeRow label="panel opacity" value={appearance.opacity} min={40} max={100} step={5} format={(v) => `${v}%`}
                onChange={(opacity) => onChange({ opacity })} {...row('opacity')} />
      <BackgroundRow value={appearance.bgImage} onChange={(bgImage) => onChange({ bgImage })} onError={onError}
                     {...row('bgImage')} />
      <ResetRow label="Reset appearance to default" onReset={onReset} {...row('reset')} />
    </>
  );
};

// `text` is the style of the panel picked in the first row.
export const TextTab = ({ panel, onPanelChange, text, sel, onSelChange, onChange, onReset }) => {
  const row = rowSelection(TEXT_FIELDS, sel, onSelChange);
  return (
    <>
      <SegmentRow label="panel" value={panel} options={TEXT_PANELS} onChange={onPanelChange} {...row('panel')} />
      <SegmentRow label="font" value={text.font} options={FONTS}
                  onChange={(font) => onChange({ font })} {...row('font')} />
      <SegmentRow label="font weight" value={text.fontWeight} options={FONT_WEIGHTS}
                  onChange={(fontWeight) => onChange({ fontWeight })} {...row('fontWeight')} />
      <RangeRow label="font size" value={text.fontSize} min={12} max={20} step={1} format={px}
                onChange={(fontSize) => onChange({ fontSize })} {...row('fontSize')} />
      <RangeRow label="line height" value={text.lineHeight} min={1.2} max={2} step={0.1}
                format={(v) => v.toFixed(1)} onChange={(lineHeight) => onChange({ lineHeight })} {...row('lineHeight')} />
      <ColorRow label="text color" value={text.textColor} colors={TEXT_COLORS} defaultClass="default-text"
                onChange={(textColor) => onChange({ textColor })} {...row('textColor')} />
      <ResetRow label={`Reset ${panel} text to default`} onReset={onReset} {...row('reset')} />
    </>
  );
};

BackgroundRow.propTypes = {
  value: PropTypes.string.isRequired,
  selected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
};

ThemeSwatch.propTypes = { name: PropTypes.string.isRequired };

ThemeRow.propTypes = {
  value: PropTypes.string.isRequired,
  selected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

const tabProps = {
  sel: PropTypes.number.isRequired,
  onSelChange: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
};

LookTab.propTypes = { ...tabProps, appearance: appearanceShape.isRequired, onError: PropTypes.func.isRequired };
TextTab.propTypes = {
  ...tabProps,
  panel: PropTypes.oneOf(TEXT_PANELS).isRequired,
  onPanelChange: PropTypes.func.isRequired,
  text: textShape.isRequired,
};
