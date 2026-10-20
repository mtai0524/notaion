import PropTypes from 'prop-types';
import { OPTION_TABS } from './appearance';
import { LookTab, TextTab } from './AppearanceTabs';
import { appearanceShape } from './optionsUtils';

const SettingRows = ({ rows, sel, onSelChange }) => rows.map((row, i) => (
  <button key={row.label} type="button"
          className={`tui-opt-row ${sel === i ? 'sel' : ''} ${row.on ? 'on' : ''}`}
          onClick={() => { onSelChange(i); row.run(); }}>
    <span className="nm">{row.label}</span>
    {row.value && <span className="cur">{row.value}</span>}
  </button>
));

const OptionsPopup = ({
  tab, onTabChange, sel, onSelChange, tabRows, appearance, onAppearanceChange, onAppearanceReset,
  textPanel, onTextPanelChange, onTextChange, onTextReset, onError, onClose,
}) => {
  const tabBody = {
    look: <LookTab appearance={appearance} sel={sel} onSelChange={onSelChange}
                   onChange={onAppearanceChange} onReset={onAppearanceReset} onError={onError} />,
    text: <TextTab panel={textPanel} onPanelChange={onTextPanelChange} text={appearance.text[textPanel]}
                   sel={sel} onSelChange={onSelChange} onChange={onTextChange} onReset={onTextReset} />,
  }[tab];

  return (
    <div className="tui-week-overlay" onClick={onClose}>
      <div className="tui-opt-box" onClick={(e) => e.stopPropagation()}>
        <div className="tui-opt-head">
          <span className="tui-opt-title">◈ OPTIONS</span>
          <button type="button" className="tui-opt-close" title="Close (Esc)" onClick={onClose}>×</button>
        </div>
        <div className="tui-opt-tabs">
          {OPTION_TABS.map((t) => (
            <button key={t.key} type="button" className={tab === t.key ? 'on' : ''} onClick={() => onTabChange(t.key)}>
              {t.label}
            </button>
          ))}
          <span className="tui-opt-tabhint">h/l · Tab</span>
        </div>
        <div className="tui-opt-body">
          {tabBody || <SettingRows rows={tabRows[tab] || []} sel={sel} onSelChange={onSelChange} />}
        </div>
        <div className="tui-opt-foot">
          {tabBody
            ? 'h/l:tab · j/k:move · ←/→:adjust · Enter:select · Esc:close'
            : 'h/l:tab · j/k:move · Enter:apply · 1-9:pick · Esc:close'}
        </div>
      </div>
    </div>
  );
};

const rowShape = PropTypes.shape({
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  on: PropTypes.bool,
  run: PropTypes.func.isRequired,
});

SettingRows.propTypes = {
  rows: PropTypes.arrayOf(rowShape).isRequired,
  sel: PropTypes.number.isRequired,
  onSelChange: PropTypes.func.isRequired,
};

OptionsPopup.propTypes = {
  tab: PropTypes.oneOf(OPTION_TABS.map((t) => t.key)).isRequired,
  onTabChange: PropTypes.func.isRequired,
  sel: PropTypes.number.isRequired,
  onSelChange: PropTypes.func.isRequired,
  tabRows: PropTypes.objectOf(PropTypes.arrayOf(rowShape)).isRequired,
  appearance: appearanceShape.isRequired,
  onAppearanceChange: PropTypes.func.isRequired,
  onAppearanceReset: PropTypes.func.isRequired,
  textPanel: PropTypes.string.isRequired,
  onTextPanelChange: PropTypes.func.isRequired,
  onTextChange: PropTypes.func.isRequired,
  onTextReset: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default OptionsPopup;
