import { TILE, CHAR_W, CHAR_H } from "./constants";

// The level is a grid built with a tiny rect/set DSL so it stays readable and
// error-free. Legend:
//   '#' solid brick   '=' one-way-ish platform (treated solid here)
//   'o' coin          'F' goal flag          'P' player spawn
const COLS = 90;
const ROWS = 15;

function buildGrid() {
  const g = Array.from({ length: ROWS }, () => new Array(COLS).fill(" "));
  const set = (r, c, ch) => {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) g[r][c] = ch;
  };
  const rect = (r0, r1, c0, c1, ch) => {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) set(r, c, ch);
  };
  const coins = (r, cs) => cs.forEach((c) => set(r, c, "o"));

  // Solid ground across the bottom, with a couple of pits to jump over.
  rect(13, 14, 0, COLS - 1, "#");
  rect(13, 14, 20, 23, " "); // pit 1
  rect(13, 14, 46, 49, " "); // pit 2
  rect(13, 14, 70, 72, " "); // pit 3

  // Floating platforms (a Mario-ish staircase + islands).
  rect(10, 10, 8, 12, "=");
  rect(8, 8, 15, 18, "=");
  rect(6, 6, 22, 25, "="); // island over pit 1
  rect(9, 9, 30, 34, "=");
  rect(7, 11, 38, 38, "#"); // a small wall to wall-less-ly hop
  rect(8, 8, 42, 45, "=");
  rect(6, 6, 50, 54, "="); // island over pit 2
  rect(10, 10, 58, 61, "=");
  rect(8, 8, 64, 67, "=");
  rect(11, 11, 74, 78, "="); // landing after pit 3
  rect(9, 9, 80, 84, "=");

  // Coins sprinkled along the route.
  coins(9, [9, 10, 11]);
  coins(7, [16, 17]);
  coins(5, [23, 24]);
  coins(8, [31, 32, 33]);
  coins(7, [43, 44]);
  coins(5, [51, 52, 53]);
  coins(9, [59, 60]);
  coins(7, [65, 66]);
  coins(10, [75, 76, 77]);
  coins(8, [81, 82, 83]);

  // Spawn near the left, goal flag near the right.
  set(12, 2, "P");
  set(12, COLS - 4, "F");

  return g;
}

const GRID = buildGrid();

// Parse the grid into fast-lookup structures for physics & rendering.
export function parseLevel() {
  const solids = new Set(); // key "c,r"
  const coins = [];
  let spawn = { x: TILE, y: TILE };
  let goal = { x: (COLS - 4) * TILE, y: 12 * TILE };
  let coinId = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = GRID[r][c];
      if (ch === "#" || ch === "=") {
        solids.add(`${c},${r}`);
      } else if (ch === "o") {
        coins.push({ id: coinId++, x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, taken: false });
      } else if (ch === "P") {
        spawn = { x: c * TILE + (TILE - CHAR_W) / 2, y: r * TILE + (TILE - CHAR_H) };
      } else if (ch === "F") {
        goal = { x: c * TILE, y: r * TILE };
      }
    }
  }

  return {
    solids,
    coins,
    spawn,
    goal,
    cols: COLS,
    rows: ROWS,
    widthPx: COLS * TILE,
    heightPx: ROWS * TILE,
  };
}

export const LEVEL_COLS = COLS;
export const LEVEL_ROWS = ROWS;
