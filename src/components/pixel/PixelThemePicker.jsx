import { useEffect, useRef } from "react";
import { PIXEL_THEMES } from "./pixelThemes";
import "./PixelThemePicker.scss";

const SPRITE_SIZE = 16;

/** Renders a single 16x16 sprite onto a pixelated canvas. */
function SpriteCanvas({ theme }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = SPRITE_SIZE;
    canvas.height = SPRITE_SIZE;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    theme.sprite.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const color = theme.colors[ch];
        if (!color) continue; // '.' => transparent
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }, [theme]);

  return <canvas ref={ref} className="pixel-card-sprite" />;
}

/**
 * Pixel theme picker.
 * @param {string} value     currently selected theme id, or "none"
 * @param {(id:string)=>void} onChange  called with the chosen theme id ("none" to disable)
 */
export default function PixelThemePicker({ value, onChange }) {
  return (
    <div className="pixel-theme-picker">
      <button
        type="button"
        className={`pixel-card pixel-card-off ${value === "none" ? "selected" : ""}`}
        onClick={() => onChange("none")}
      >
        <span className="pixel-off-x">✕</span>
        <span className="pixel-card-name">OFF</span>
        {value === "none" && <span className="pixel-card-check">✔</span>}
      </button>

      {PIXEL_THEMES.map((theme) => {
        const selected = value === theme.id;
        return (
          <button
            type="button"
            key={theme.id}
            className={`pixel-card ${selected ? "selected" : ""}`}
            style={{
              "--pc-screen": theme.screen,
              "--pc-accent": theme.accent,
              "--pc-bg": theme.palette[0],
              "--pc-check-fg": theme.checkFg || "#000",
            }}
            onClick={() => onChange(theme.id)}
            aria-label={theme.name}
          >
            {selected && <span className="pixel-card-check">✔</span>}
            <div className="pixel-card-screen">
              <SpriteCanvas theme={theme} />
            </div>
            <div className="pixel-card-palette">
              {theme.palette.map((c, i) => (
                <span key={i} style={{ background: c }} />
              ))}
            </div>
            <span className="pixel-card-name">{theme.name}</span>
          </button>
        );
      })}
    </div>
  );
}
