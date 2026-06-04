import { CHAR_W, CHAR_H } from "./constants";

// Pixel art is defined as small character grids (10 wide) and scaled up. Each
// glyph maps to a colour; 'B' is the per-player body colour (dynamic).
const PIX = 3; // on-screen size of one art pixel
const SPRITE_W = 10 * PIX; // 30
const SPRITE_H = 15 * PIX; // 45

const PALETTE = {
  H: "#e63946", // hat
  S: "#ffd9a0", // skin
  E: "#26233a", // eye
  A: "#ffd9a0", // arm (skin)
  L: "#1d3557", // legs
  O: "#6b3f1d", // boots
};

// Head + body (rows 0-10), shared by every frame.
const BODY = [
  ".HHHHHHH..",
  "HHHHHHHHHH",
  "HHHHHHHHHH",
  "..SSSSESS.",
  "..SSSSSSS.",
  "..SSSSSSS.",
  "...SSSSS..",
  ".BBBBBBBB.",
  "ABBBBBBBBA",
  "ABBBBBBBBA",
  ".BBBBBBBB.",
];

const LEGS = {
  idle: ["..LL.LL...", "..LL.LL...", "..LL.LL...", ".OOO.OOO.."],
  walk1: ["..LL.LL...", ".LL...LL..", ".LL...LL..", "OO.....OO."],
  walk2: ["..LL.LL...", "..LL.LL...", "...LLLL...", "..OOOO...."],
  jump: [".LL...LL..", "LL.....LL.", "LL.....LL.", ".O.....O.."],
};

function legsFor(anim, animT) {
  if (anim === "jump") return LEGS.jump;
  if (anim === "walk") return Math.floor(animT * 10) % 2 ? LEGS.walk1 : LEGS.walk2;
  return LEGS.idle;
}

// Draw the character. (x, y) is the top-left of the collision box; the sprite
// is centred on it. `color` fills the 'B' (body) pixels.
export function drawChar(ctx, x, y, facing, anim, animT, color) {
  const rows = BODY.concat(legsFor(anim, animT));
  const ox = Math.round(x + (CHAR_W - SPRITE_W) / 2);
  const oy = Math.round(y + CHAR_H - SPRITE_H + PIX); // feet roughly at box bottom

  ctx.save();
  if (facing < 0) {
    // Mirror horizontally around the sprite centre.
    ctx.translate(ox + SPRITE_W, 0);
    ctx.scale(-1, 1);
    ctx.translate(-ox, 0);
  }
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === ".") continue;
      ctx.fillStyle = ch === "B" ? color : PALETTE[ch] || "#000";
      ctx.fillRect(ox + c * PIX, oy + r * PIX, PIX, PIX);
    }
  }
  ctx.restore();
}

// A spinning coin (fakes rotation by squashing horizontally over time).
export function drawCoin(ctx, x, y, t) {
  const w = Math.abs(Math.cos(t * 4)) * 9 + 2;
  ctx.fillStyle = "#ffd54a";
  ctx.fillRect(Math.round(x - w / 2), Math.round(y - 11), Math.round(w), 22);
  ctx.fillStyle = "#c79100";
  ctx.fillRect(Math.round(x - w / 2), Math.round(y - 11), Math.round(w), 3);
}

// Goal flag: pole + pennant.
export function drawFlag(ctx, x, y) {
  ctx.fillStyle = "#cfd8dc";
  ctx.fillRect(x + 6, y - 64, 4, 96); // pole spanning ~3 tiles up
  ctx.fillStyle = "#2ecc71";
  ctx.beginPath();
  ctx.moveTo(x + 10, y - 62);
  ctx.lineTo(x + 34, y - 52);
  ctx.lineTo(x + 10, y - 42);
  ctx.closePath();
  ctx.fill();
}

// Stable bright colour from a string (player name) so each player is distinct.
export function colorFromString(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue}, 70%, 55%)`;
}
