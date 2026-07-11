import PropTypes from 'prop-types';

/* Notaion brand mark — an original pixel-art handheld whose screen shows a
   note (text line + red todo bullet). Body pixels use currentColor so the
   mark follows the surrounding theme; the screen is a transparent window.
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
    {/* body — corner pixels cut for the pixel-rounded silhouette */}
    <path
      fill="currentColor"
      d="M3 0h10v1H3zM2 1h12v14H2zM3 15h10v1H3z"
    />
    {/* screen window */}
    <rect x="4" y="2" width="8" height="6" fill="var(--container-bg, #fdfcf8)" />
    {/* note on screen: title line + red todo bullet + text line */}
    <rect x="5" y="3" width="6" height="1" fill="currentColor" />
    <rect x="5" y="5" width="1" height="1" fill="#e11d48" />
    <rect x="7" y="5" width="3" height="1" fill="currentColor" />
    {/* d-pad */}
    <path fill="var(--container-bg, #fdfcf8)" d="M5 10h1v3H5zM4 11h3v1H4z" />
    {/* A / B buttons */}
    <rect x="11" y="10" width="1" height="1" fill="var(--container-bg, #fdfcf8)" />
    <rect x="9" y="11" width="1" height="1" fill="var(--container-bg, #fdfcf8)" />
    {/* start / select */}
    <rect x="6" y="13" width="1" height="1" fill="var(--container-bg, #fdfcf8)" />
    <rect x="8" y="13" width="1" height="1" fill="var(--container-bg, #fdfcf8)" />
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
