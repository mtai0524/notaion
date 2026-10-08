// Pure pieces of the desktop nvim mode (no DOM, no framework): motions inside a
// block, operator ranges (dw, d$, …), and the undo/redo history. The component
// (BlockEditor) wires keys to these and applies the results.
import { wordForward, wordBackward, wordEnd, lineStart, lineEnd } from "./vimEditor.js";

/** Last valid caret offset in NORMAL mode on the line holding `pos` (vim can't sit past the last char). */
export const normalMax = (text, pos = 0) => {
  const p = Math.min(Math.max(pos, 0), text.length);
  return Math.max(lineStart(text, p), lineEnd(text, p) - 1);
};

/** Clamp a caret to where NORMAL mode may rest. */
export const clampNormal = (text, pos) => Math.max(0, Math.min(pos, normalMax(text, pos)));

/**
 * Horizontal / word motion within one block.
 * Returns { pos, cross } — `cross` is "next" / "prev" when the motion ran off the
 * block (vim continues onto the neighbouring line), else null.
 */
export function motion(text, pos, key, count = 1) {
  const n = Math.max(1, count);
  let p = pos;
  switch (key) {
    case "h": return { pos: Math.max(lineStart(text, pos), pos - n), cross: null };
    case "l": return { pos: Math.min(normalMax(text, pos), pos + n), cross: null };
    case "0":
    case "^": return { pos: lineStart(text, pos), cross: null };
    case "$": return { pos: normalMax(text, pos), cross: null };
    case "w": {
      for (let i = 0; i < n; i++) {
        if (wordForward(text, p) >= text.length) return { pos: normalMax(text, p), cross: "next" };
        p = wordForward(text, p);
      }
      return { pos: p, cross: null };
    }
    case "b": {
      for (let i = 0; i < n; i++) {
        if (p <= lineStart(text, p) && p === 0) return { pos: 0, cross: "prev" };
        p = wordBackward(text, p);
      }
      return { pos: p, cross: null };
    }
    case "e": {
      for (let i = 0; i < n; i++) {
        const end = wordEnd(text, p) - 1;
        if (end <= p && p >= normalMax(text, p)) return { pos: normalMax(text, p), cross: "next" };
        p = Math.max(p, end);
      }
      return { pos: clampNormal(text, p), cross: null };
    }
    default: return null;
  }
}

/** j / k inside a multi-line block (code, callout). null when already on the first/last line. */
export function vertical(text, pos, dir) {
  const ls = lineStart(text, pos);
  const col = pos - ls;
  if (dir > 0) {
    const le = lineEnd(text, pos);
    if (le >= text.length) return null;
    const next = le + 1;
    return Math.min(next + col, Math.max(next, lineEnd(text, next) - 1));
  }
  if (ls === 0) return null;
  const prev = lineStart(text, ls - 1);
  return Math.min(prev + col, Math.max(prev, ls - 2));
}

/**
 * [from, to) a `d`/`c`/`y` operator covers for the given motion key, or null.
 * `cw` is special in vim: on a word it changes only that word, keeping the
 * space after it (unlike `dw`, which takes the space too).
 */
export function operatorRange(text, pos, key, op = "d") {
  switch (key) {
    case "w": {
      if (op === "c" && pos < text.length && !/\s/.test(text[pos])) {
        let to = pos;
        while (to < text.length && !/\s/.test(text[to])) to++;
        return { from: pos, to };
      }
      return { from: pos, to: Math.min(wordForward(text, pos), lineEnd(text, pos)) };
    }
    case "e": return { from: pos, to: wordEnd(text, pos) };
    case "b": return { from: wordBackward(text, pos), to: pos };
    case "$": return { from: pos, to: lineEnd(text, pos) };
    case "0":
    case "^": return { from: lineStart(text, pos), to: pos };
    default: return null;
  }
}

export const cut = (text, from, to) => ({ text: text.slice(0, from) + text.slice(to), removed: text.slice(from, to) });

/**
 * Undo/redo of whole-note snapshots { md, i, pos }. A snapshot equal to the
 * newest one is ignored, so entering INSERT twice without typing is one step.
 */
export function createHistory(limit = 100) {
  let undo = [];
  let redo = [];
  return {
    push(snap) {
      if (undo.length && undo[undo.length - 1].md === snap.md) return;
      undo.push(snap);
      if (undo.length > limit) undo.shift();
      redo = [];
    },
    undo(current) {
      const s = undo.pop();
      if (!s) return null;
      redo.push(current);
      return s;
    },
    redo(current) {
      const s = redo.pop();
      if (!s) return null;
      undo.push(current);
      return s;
    },
    clear() { undo = []; redo = []; },
    get size() { return undo.length; },
  };
}
