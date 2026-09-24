// Notaion pixel mark — twin of web src/assets/notaion-pixel.svg; keep in sync.
export function Mark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">
      <path d="M3 0h10v1H3zM2 1h1v14H2zM13 1h1v11h-1zM12 12h1v1h-1zM11 13h1v1h-1zM10 14h1v1h-1zM3 15h7v1H3z" />
      <path d="M4 2h8v1H4zM4 3h1v4H4zM11 3h1v4h-1zM4 7h8v1H4z" />
      <path d="M5 10h1v3H5zM4 11h3v1H4z" />
      <path d="M11 10h1v1h-1zM9 11h1v1H9zM5 13h2v1H5zM8 13h2v1H8z" />
    </svg>
  );
}
