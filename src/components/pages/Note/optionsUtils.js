import PropTypes from 'prop-types';

// Keys typed into the popup's own inputs must not reach the TUI shortcuts —
// except Esc, which still closes the popup.
export const keepKeysLocal = (e) => { if (e.key !== 'Escape') e.stopPropagation(); };

// Props that mark a row as the keyboard-selected one and select it on click.
export const rowSelection = (fields, sel, onSelChange) => (field) => ({
  selected: fields[sel] === field,
  onSelect: () => onSelChange(fields.indexOf(field)),
});

export const textShape = PropTypes.shape({
  font: PropTypes.string.isRequired,
  fontWeight: PropTypes.string.isRequired,
  fontSize: PropTypes.number.isRequired,
  lineHeight: PropTypes.number.isRequired,
  textColor: PropTypes.string,
});

export const appearanceShape = PropTypes.shape({
  theme: PropTypes.string.isRequired,
  accent: PropTypes.string,
  borderWidth: PropTypes.number.isRequired,
  borderStyle: PropTypes.string.isRequired,
  radius: PropTypes.number.isRequired,
  opacity: PropTypes.number.isRequired,
  bgImage: PropTypes.string.isRequired,
  text: PropTypes.objectOf(textShape).isRequired,
});
