import { TILE, VIEW_W, VIEW_H, CHAR_W, CHAR_H } from "./constants";
import { drawChar, drawCoin, drawFlag } from "./sprites";

const isSolid = (solids, c, r) => solids.has(`${c},${r}`);

function drawBackground(ctx, camX) {
  // Sky gradient.
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, "#5ec5ff");
  sky.addColorStop(1, "#bfeaff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Parallax hills (slower than the camera).
  const par = camX * 0.4;
  ctx.fillStyle = "#8fd66b";
  for (let i = -1; i < VIEW_W / 200 + 2; i++) {
    const hx = i * 220 - (par % 220);
    ctx.beginPath();
    ctx.arc(hx + 110, VIEW_H - 64, 130, Math.PI, 0);
    ctx.fill();
  }
  // A couple of clouds.
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const cp = camX * 0.2;
  for (let i = -1; i < VIEW_W / 260 + 2; i++) {
    const cx = i * 300 - (cp % 300) + 60;
    const cy = 60 + ((i * 53) % 40);
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.arc(cx + 22, cy + 4, 22, 0, Math.PI * 2);
    ctx.arc(cx + 48, cy, 16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTiles(ctx, level, camX) {
  const c0 = Math.max(0, Math.floor(camX / TILE));
  const c1 = Math.min(level.cols - 1, Math.floor((camX + VIEW_W) / TILE));
  for (let c = c0; c <= c1; c++) {
    for (let r = 0; r < level.rows; r++) {
      if (!isSolid(level.solids, c, r)) continue;
      const x = Math.round(c * TILE - camX);
      const y = r * TILE;
      const grassTop = !isSolid(level.solids, c, r - 1);
      ctx.fillStyle = grassTop ? "#7c4a2d" : "#955b38";
      ctx.fillRect(x, y, TILE, TILE);
      // brick seams
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(x, y + TILE - 3, TILE, 3);
      ctx.fillRect(x + TILE - 3, y, 3, TILE);
      if (grassTop) {
        ctx.fillStyle = "#5ec24a";
        ctx.fillRect(x, y, TILE, 7);
        ctx.fillStyle = "#46a838";
        ctx.fillRect(x, y + 7, TILE, 2);
      }
    }
  }
}

function drawLabel(ctx, text, cx, topY) {
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeText(text, cx, topY);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, cx, topY);
  ctx.textAlign = "left";
}

// remotes: array of { x, y, facing, anim, animT, name, color }
export function render(ctx, { level, camX, local, localColor, localName, remotes }) {
  ctx.imageSmoothingEnabled = false;
  drawBackground(ctx, camX);
  drawTiles(ctx, level, camX);

  // Coins.
  for (const coin of level.coins) {
    if (coin.taken) continue;
    const sx = coin.x - camX;
    if (sx < -TILE || sx > VIEW_W + TILE) continue;
    drawCoin(ctx, sx, coin.y, performance.now() / 1000 + coin.id);
  }

  // Goal flag.
  drawFlag(ctx, level.goal.x - camX, level.goal.y);

  // Remote players first (so the local player draws on top).
  for (const rp of remotes) {
    const sx = rp.x - camX;
    if (sx < -64 || sx > VIEW_W + 64) continue;
    drawChar(ctx, sx, rp.y, rp.facing, rp.anim, rp.animT, rp.color);
    drawLabel(ctx, rp.name, sx + CHAR_W / 2, rp.y - 6);
  }

  // Local player.
  const lx = local.x - camX;
  drawChar(ctx, lx, local.y, local.facing, local.anim, local.animT, localColor);
  drawLabel(ctx, localName, lx + CHAR_W / 2, local.y - 6);
}

export { CHAR_W, CHAR_H };
