import {
  VIEW_W,
  VIEW_H,
  TILE,
  CHAR_W,
  CHAR_H,
  SEND_HZ,
  REMOTE_LERP,
} from "./constants";
import { createPlayer, step } from "./physics";
import { createInput } from "./input";
import { render } from "./render";
import { colorFromString } from "./sprites";

// Wires input + physics + remote interpolation + networking + rendering into a
// single requestAnimationFrame loop. Net events are pushed in from PixelGame
// via setRemoteState / addRemote / removeRemote.
export function createGame(canvas, level, opts = {}) {
  const ctx = canvas.getContext("2d");
  const input = createInput(window);
  const local = createPlayer(level.spawn);

  const remotes = new Map(); // connectionId -> remote player

  let score = 0;
  let finished = false;
  let sendAccum = 0;
  let raf = 0;
  let last = 0;
  let running = false;

  const localColor = colorFromString(opts.localName || "you");

  function makeRemote(info) {
    return {
      x: info.x ?? 0,
      y: info.y ?? 0,
      targetX: info.x ?? 0,
      targetY: info.y ?? 0,
      vx: info.vx ?? 0,
      facing: info.facing ?? 1,
      anim: info.anim || "idle",
      animT: 0,
      name: info.name || "Player",
      color: colorFromString(info.name || info.connectionId || "p"),
    };
  }

  function collectCoins() {
    const cx = local.x + CHAR_W / 2;
    const cy = local.y + CHAR_H / 2;
    for (const coin of level.coins) {
      if (coin.taken) continue;
      if (Math.abs(coin.x - cx) < 22 && Math.abs(coin.y - cy) < 24) {
        coin.taken = true;
        score += 1;
        opts.onScore && opts.onScore(score);
      }
    }
  }

  function checkFinish() {
    if (finished) return;
    if (Math.abs(local.x + CHAR_W / 2 - (level.goal.x + 8)) < TILE) {
      finished = true;
      opts.onFinish && opts.onFinish(score);
    }
  }

  function update(dt) {
    // Local player.
    const sample = input.sample();
    step(local, sample, dt, level);
    collectCoins();
    checkFinish();

    // Remote players: dead-reckon then ease toward the latest target.
    const k = Math.min(1, REMOTE_LERP * dt);
    for (const rp of remotes.values()) {
      rp.targetX += rp.vx * dt;
      rp.x += (rp.targetX - rp.x) * k;
      rp.y += (rp.targetY - rp.y) * k;
      if (rp.anim === "walk") rp.animT += dt;
    }

    // Throttled network send.
    sendAccum += dt;
    if (sendAccum >= 1 / SEND_HZ) {
      sendAccum = 0;
      opts.sendState &&
        opts.sendState({
          x: local.x,
          y: local.y,
          vx: local.vx,
          facing: local.facing,
          anim: local.anim,
        });
    }
  }

  function draw() {
    let camX = local.x + CHAR_W / 2 - VIEW_W / 2;
    camX = Math.max(0, Math.min(level.widthPx - VIEW_W, camX));
    render(ctx, {
      level,
      camX,
      local,
      localColor,
      localName: opts.localName || "You",
      remotes: Array.from(remotes.values()),
    });
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    // --- network-driven remote management ---
    setRemotes(list) {
      remotes.clear();
      (list || []).forEach((info) => remotes.set(info.connectionId, makeRemote(info)));
      opts.onPlayers && opts.onPlayers(remotes.size + 1);
    },
    addRemote(info) {
      remotes.set(info.connectionId, makeRemote(info));
      opts.onPlayers && opts.onPlayers(remotes.size + 1);
    },
    removeRemote(connectionId) {
      remotes.delete(connectionId);
      opts.onPlayers && opts.onPlayers(remotes.size + 1);
    },
    setRemoteState(connectionId, x, y, vx, facing, anim) {
      const rp = remotes.get(connectionId);
      if (!rp) return;
      rp.targetX = x;
      rp.targetY = y;
      rp.vx = vx;
      rp.facing = facing;
      rp.anim = anim;
    },
    getInput() {
      return input;
    },
    destroy() {
      this.stop();
      input.destroy();
    },
  };
}

export { VIEW_W, VIEW_H };
