/* Pure helpers for TUI panel resizing (Omarchy/Hyprland style).
   Sizes are percentages of .tui-body width: [folders, notes, preview],
   always summing to 100. All functions here are DOM-free so they unit-test
   directly. */

export const DEFAULT_SIZES = [16, 35, 49];
export const MIN = 8;
export const STEP = 2;
export const BIG_STEP = 8;

const PANELS = ['folders', 'notes', 'preview'];

const valid = (s) =>
  Array.isArray(s) && s.length === 3 && s.every((n) => typeof n === 'number' && Number.isFinite(n));

/* Floor every panel at MIN, then rescale so the total is exactly 100.
   Rescaling can push a panel back under MIN, so we settle it by handing the
   deficit to the largest panel — with 3 panels and MIN=8 there is always
   room (3*8 = 24 < 100). */
export function clampSizes(sizes) {
  if (!valid(sizes)) return [...DEFAULT_SIZES];
  const out = sizes.map((n) => Math.max(MIN, n));
  const total = out.reduce((a, b) => a + b, 0);
  if (total <= 0) return [...DEFAULT_SIZES];
  let excess = total - 100;
  // Take the excess from whoever has slack above MIN, largest first.
  while (excess > 1e-9) {
    const slack = out.map((n) => n - MIN);
    const pool = slack.reduce((a, b) => a + b, 0);
    if (pool <= 1e-9) return [...DEFAULT_SIZES]; // cannot fit — shouldn't happen
    const take = Math.min(excess, pool);
    for (let i = 0; i < out.length; i += 1) out[i] -= (slack[i] / pool) * take;
    excess -= take;
  }
  if (excess < -1e-9) out[out.indexOf(Math.max(...out))] -= excess; // deficit → biggest
  return out.map((n) => Math.round(n * 1e6) / 1e6);
}

/* Which neighbour a panel borrows from. NOTES sits in the middle, so by
   convention it always negotiates with PREVIEW (the widest panel). */
const NEIGHBOUR = { folders: 1, notes: 2, preview: 1 };

/* Grow (delta > 0) or shrink (delta < 0) the focused panel, taking the space
   from exactly one neighbour so the third panel never moves. */
export function applyDelta(sizes, focus, delta) {
  const base = clampSizes(sizes);
  const i = PANELS.indexOf(focus);
  if (i === -1 || !delta) return base;
  const j = NEIGHBOUR[focus];
  if (i === j) return base;
  // Both sides are bounded by MIN: we can move at most this much.
  const room = delta > 0 ? base[j] - MIN : base[i] - MIN;
  const move = Math.min(Math.abs(delta), Math.max(0, room)) * Math.sign(delta);
  const out = [...base];
  out[i] += move;
  out[j] -= move;
  return out.map((n) => Math.round(n * 1e6) / 1e6);
}
