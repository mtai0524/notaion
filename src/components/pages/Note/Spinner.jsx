import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './Spinner.scss';

// Tiny braille spinner — fits the monospace TUI aesthetic. Frames are cycled in
// JS (a plain interval) rather than via a CSS `content` animation, because
// animating `content` is unreliable across browsers/themes; this renders and
// animates identically everywhere.
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const Spinner = ({ label, className = '' }) => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);
  return (
    <span className={`tui-spinner ${className}`} role="status" aria-live="polite">
      <span className="tui-spinner-glyph" aria-hidden>{FRAMES[i]}</span>
      {label ? <span className="tui-spinner-label">{label}</span> : null}
    </span>
  );
};

Spinner.propTypes = {
  label: PropTypes.string,
  className: PropTypes.string,
};

export default Spinner;
