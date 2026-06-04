import {
  TILE,
  CHAR_W,
  CHAR_H,
  GRAVITY,
  MOVE_SPEED,
  JUMP_V,
  MAX_FALL,
  COYOTE,
  JUMP_BUFFER,
} from "./constants";

const isSolid = (solids, c, r) => solids.has(`${c},${r}`);

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: false,
    coyote: 0,
    jumpBuf: 0,
    anim: "idle",
    animT: 0,
  };
}

function collideX(p, solids) {
  const top = Math.floor(p.y / TILE);
  const bottom = Math.floor((p.y + CHAR_H - 1) / TILE);
  if (p.vx > 0) {
    const col = Math.floor((p.x + CHAR_W - 1) / TILE);
    for (let r = top; r <= bottom; r++) {
      if (isSolid(solids, col, r)) {
        p.x = col * TILE - CHAR_W;
        p.vx = 0;
        break;
      }
    }
  } else if (p.vx < 0) {
    const col = Math.floor(p.x / TILE);
    for (let r = top; r <= bottom; r++) {
      if (isSolid(solids, col, r)) {
        p.x = (col + 1) * TILE;
        p.vx = 0;
        break;
      }
    }
  }
}

function collideY(p, solids) {
  p.onGround = false;
  const left = Math.floor(p.x / TILE);
  const right = Math.floor((p.x + CHAR_W - 1) / TILE);
  if (p.vy > 0) {
    const row = Math.floor((p.y + CHAR_H - 1) / TILE);
    for (let c = left; c <= right; c++) {
      if (isSolid(solids, c, row)) {
        p.y = row * TILE - CHAR_H;
        p.vy = 0;
        p.onGround = true;
        break;
      }
    }
  } else if (p.vy < 0) {
    const row = Math.floor(p.y / TILE);
    for (let c = left; c <= right; c++) {
      if (isSolid(solids, c, row)) {
        p.y = (row + 1) * TILE;
        p.vy = 0;
        break;
      }
    }
  }
}

// Advance the local player one fixed-ish step. `input` is a sample from input.js.
export function step(p, input, dt, level) {
  let move = 0;
  if (input.left) move -= 1;
  if (input.right) move += 1;
  p.vx = move * MOVE_SPEED;
  if (move !== 0) p.facing = move > 0 ? 1 : -1;

  // Jump with buffering + coyote time so it feels forgiving.
  if (input.jumpPressed) p.jumpBuf = JUMP_BUFFER;
  else p.jumpBuf = Math.max(0, p.jumpBuf - dt);
  p.coyote = p.onGround ? COYOTE : Math.max(0, p.coyote - dt);
  if (p.jumpBuf > 0 && p.coyote > 0) {
    p.vy = -JUMP_V;
    p.jumpBuf = 0;
    p.coyote = 0;
    p.onGround = false;
  }

  // Horizontal move + resolve.
  p.x += p.vx * dt;
  collideX(p, level.solids);

  // Gravity + vertical move + resolve.
  p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
  p.y += p.vy * dt;
  collideY(p, level.solids);

  // Keep inside the world horizontally.
  if (p.x < 0) {
    p.x = 0;
    p.vx = 0;
  }
  const maxX = level.widthPx - CHAR_W;
  if (p.x > maxX) {
    p.x = maxX;
    p.vx = 0;
  }

  // Animation state.
  if (!p.onGround) p.anim = "jump";
  else if (Math.abs(p.vx) > 1) p.anim = "walk";
  else p.anim = "idle";
  p.animT += dt;

  // Fell into a pit -> respawn at start.
  if (p.y > level.heightPx + 240) {
    p.x = level.spawn.x;
    p.y = level.spawn.y;
    p.vx = 0;
    p.vy = 0;
  }

  return p;
}
