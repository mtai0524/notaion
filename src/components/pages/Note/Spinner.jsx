import PropTypes from 'prop-types';
import './Spinner.scss';

// Tiny braille spinner — fits the monospace TUI aesthetic. Animation is
// CSS-only (a steps() keyframe cycles the braille frames), so it costs nothing
// on the JS side. Optional label sits after the glyph.
const Spinner = ({ label, className = '' }) => (
  <span className={`tui-spinner ${className}`} role="status" aria-live="polite">
    <span className="tui-spinner-glyph" aria-hidden />
    {label ? <span className="tui-spinner-label">{label}</span> : null}
  </span>
);

Spinner.propTypes = {
  label: PropTypes.string,
  className: PropTypes.string,
};

export default Spinner;
