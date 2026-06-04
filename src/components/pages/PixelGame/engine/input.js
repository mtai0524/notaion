// Keyboard input. Exposes a per-frame sample so physics can read held keys and
// consume a one-shot jump press (for jump buffering).

const LEFT_KEYS = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const JUMP_KEYS = new Set(["ArrowUp", "KeyW", "Space"]);
const PREVENT = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
]);

export function createInput(target = window) {
  const held = { left: false, right: false, jump: false };
  let jumpQueued = false;

  const onDown = (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (LEFT_KEYS.has(e.code)) held.left = true;
    if (RIGHT_KEYS.has(e.code)) held.right = true;
    if (JUMP_KEYS.has(e.code)) {
      if (!e.repeat && !held.jump) jumpQueued = true;
      held.jump = true;
    }
  };

  const onUp = (e) => {
    if (LEFT_KEYS.has(e.code)) held.left = false;
    if (RIGHT_KEYS.has(e.code)) held.right = false;
    if (JUMP_KEYS.has(e.code)) held.jump = false;
  };

  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);

  return {
    sample() {
      const s = {
        left: held.left,
        right: held.right,
        jump: held.jump,
        jumpPressed: jumpQueued,
      };
      jumpQueued = false;
      return s;
    },
    // For touch buttons / external triggers.
    setHeld(key, value) {
      if (key in held) {
        if (key === "jump" && value && !held.jump) jumpQueued = true;
        held[key] = value;
      }
    },
    destroy() {
      target.removeEventListener("keydown", onDown);
      target.removeEventListener("keyup", onUp);
    },
  };
}
