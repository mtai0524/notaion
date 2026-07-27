import PropTypes from 'prop-types';

/* Notaion brand mark v3 — outline-only retro handheld (pixel take on the
   classic line-art gameboy icon): empty screen, cross d-pad, two dot
   buttons, two dashes, clipped bottom-right corner. Single color via
   currentColor so it follows the surrounding theme.
   Static favicon twin: src/assets/notaion-pixel.svg (keep both in sync). */
const NotaionMark = ({ size, className }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    aria-hidden="true"
    focusable="false"
  >
    {/* body outline, bottom-right corner cut 45° */}
    <path
      fill="currentColor"
      d="M3 0h10v1H3zM2 1h1v14H2zM13 1h1v11h-1zM12 12h1v1h-1zM11 13h1v1h-1zM10 14h1v1h-1zM3 15h7v1H3z"
    />
    {/* screen outline (empty window) */}
    <path fill="currentColor" d="M4 2h8v1H4zM4 3h1v4H4zM11 3h1v4h-1zM4 7h8v1H4z" />
    {/* d-pad cross */}
    <path fill="currentColor" d="M5 10h1v3H5zM4 11h3v1H4z" />
    {/* A / B dot buttons (diagonal) */}
    <rect x="11" y="10" width="1" height="1" fill="currentColor" />
    <rect x="9" y="11" width="1" height="1" fill="currentColor" />
    {/* start / select dashes */}
    <rect x="5" y="13" width="2" height="1" fill="currentColor" />
    <rect x="8" y="13" width="2" height="1" fill="currentColor" />
  </svg>
);

NotaionMark.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
};
NotaionMark.defaultProps = {
  size: 24,
  className: '',
};

export default NotaionMark;
