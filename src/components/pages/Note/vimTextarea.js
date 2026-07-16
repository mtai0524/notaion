// Pure vim reducer for a <textarea>. Given the current state and a key event,
// returns the next state, or `null` when the key should fall through to the
// textarea (normal typing in INSERT mode). No DOM — the caller applies the
// resulting text/pos/mode.
//
// State shape (all optional except text/pos/mode):
//   { text, pos, mode: 'normal'|'insert'|'visual'|'vline',
//     pending, count, register, undo, redo, anchor, lastEdit }
//   - register: { text, linewise }  — yank/delete buffer for p/P
//   - undo/redo: arrays of { text, pos } snapshots
//   - anchor: selection anchor offset while in visual/vline
//   - lastEdit: { keys:[...] } — the last change, replayed by '.'
import { wordForward, wordBackward, wordEnd, lineStart, lineEnd, deleteCharAt } from './vimEditor';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const ARROW_TO_HJKL = { ArrowLeft: 'h', ArrowRight: 'l', ArrowDown: 'j', ArrowUp: 'k' };

// Push an undo snapshot (cap the stack).
const withUndo = (state) => {
  const undo = [...(state.undo || []), { text: state.text, pos: state.pos }].slice(-100);
  return { undo, redo: [] };
};

// Resolve a motion key to a target { to, linewise, inclusive }. Returns null if
// `key` isn't a motion. `count` repeats the motion.
const resolveMotion = (text, pos, key, count) => {
  const rep = Math.max(1, count || 1);
  let p = pos;
  switch (key) {
    case 'h': for (let i = 0; i < rep; i++) p = clamp(p - 1, 0, text.length); return { to: p };
    case 'l': for (let i = 0; i < rep; i++) p = clamp(p + 1, 0, text.length); return { to: p };
    case 'w': for (let i = 0; i < rep; i++) p = wordForward(text, p); return { to: p };
    case 'b': for (let i = 0; i < rep; i++) p = wordBackward(text, p); return { to: p };
    case 'e': for (let i = 0; i < rep; i++) p = wordEnd(text, p); return { to: p };
    case '0': return { to: lineStart(text, pos) };
    case '$': for (let i = 0; i < rep; i++) p = lineEnd(text, p + (i ? 1 : 0)); return { to: lineEnd(text, pos) };
    default: return null;
  }
};

// Vertical move for j/k keeping the column.
const vMove = (text, pos, dir, count) => {
  let p = pos;
  const rep = Math.max(1, count || 1);
  for (let i = 0; i < rep; i++) {
    if (dir > 0) {
      const eol = lineEnd(text, p);
      if (eol >= text.length) break;
      const col = p - lineStart(text, p);
      const ns = eol + 1;
      p = clamp(ns + col, ns, lineEnd(text, ns));
    } else {
      const s = lineStart(text, p);
      if (s === 0) break;
      const col = p - s;
      const ps = lineStart(text, s - 1);
      p = clamp(ps + col, ps, lineEnd(text, s - 1));
    }
  }
  return p;
};

// Delete the range [from, to) and return { text, pos } (pos = from clamped).
const deleteRange = (text, from, to) => {
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const next = text.slice(0, lo) + text.slice(hi);
  return { text: next, pos: clamp(lo, 0, next.length), removed: text.slice(lo, hi) };
};

// Delete `count` whole lines starting at pos → { text, pos, removed }.
const deleteLines = (text, pos, count) => {
  const rep = Math.max(1, count || 1);
  const s = lineStart(text, pos);
  let e = s;
  for (let i = 0; i < rep; i++) e = lineEnd(text, e) < text.length ? lineEnd(text, e) + 1 : lineEnd(text, e);
  let next = text.slice(0, s) + text.slice(e);
  const removed = text.slice(s, e);
  if (e === text.length && s > 0) next = text.slice(0, s - 1); // last line(s): drop preceding \n
  return { text: next, pos: clamp(lineStart(next, Math.min(s, next.length)), 0, next.length), removed };
};

export const vimTextareaKey = (state, e) => {
  const { text, pos, mode } = state;
  const count = state.count || '';
  const pending = state.pending || null;
  const register = state.register || null;
  const anchor = state.anchor ?? null;

  // ── INSERT: only Esc / Ctrl+[ is ours; everything else falls through. ──
  if (mode === 'insert') {
    if (e.key === 'Escape' || (e.key === '[' && e.ctrlKey)) {
      return { ...state, pos: clamp(pos - 1, 0, text.length), mode: 'normal', pending: null, count: '', anchor: null };
    }
    return null;
  }

  const key = ARROW_TO_HJKL[e.key] || e.key;

  // ── Ctrl+r : redo (works in NORMAL). ──
  if (e.key === 'r' && e.ctrlKey) {
    const redo = [...(state.redo || [])];
    const snap = redo.pop();
    if (!snap) return { ...state, pending: null, count: '' };
    const undo = [...(state.undo || []), { text, pos }].slice(-100);
    return { ...state, text: snap.text, pos: clamp(snap.pos, 0, snap.text.length), undo, redo, pending: null, count: '' };
  }

  // ── pending 'r' (replace one char) ──
  if (pending === 'r') {
    if (key.length === 1) {
      const u = withUndo(state);
      const next = text.slice(0, pos) + key + text.slice(pos + 1);
      return { ...state, ...u, text: next, pos, pending: null, count: '' };
    }
    return { ...state, pending: null, count: '' };
  }

  // ── digit → build the count prefix (but '0' alone is a motion). ──
  if (/[0-9]/.test(key) && !(key === '0' && count === '')) {
    return { ...state, count: count + key };
  }

  // ── VISUAL / VLINE mode ──
  if (mode === 'visual' || mode === 'vline') {
    const linewise = mode === 'vline';
    if (key === 'Escape') return { ...state, mode: 'normal', anchor: null, count: '', pending: null };
    // movement extends the selection
    const m = resolveMotion(text, pos, key, parseInt(count || '1', 10));
    if (m) return { ...state, pos: m.to, count: '' };
    if (key === 'j' || key === 'k') return { ...state, pos: vMove(text, pos, key === 'j' ? 1 : -1, parseInt(count || '1', 10)), count: '' };
    if (key === 'g') return { ...state, pending: 'g' };
    if (key === 'G') return { ...state, pos: text.length, count: '' };
    // operators on the selection
    if (key === 'd' || key === 'x' || key === 'y' || key === 'c') {
      const u = withUndo(state);
      let from = Math.min(anchor ?? pos, pos);
      let to = Math.max(anchor ?? pos, pos);
      if (linewise) { from = lineStart(text, from); to = lineEnd(text, to) < text.length ? lineEnd(text, to) + 1 : lineEnd(text, to); }
      else { to = clamp(to + 1, 0, text.length); } // charwise is inclusive
      const removed = text.slice(from, to);
      if (key === 'y') return { ...state, mode: 'normal', anchor: null, register: { text: removed, linewise }, count: '' };
      const del = deleteRange(text, from, to);
      const base = { ...state, ...u, text: del.text, pos: del.pos, register: { text: removed, linewise }, anchor: null, count: '' };
      return key === 'c' ? { ...base, mode: 'insert' } : { ...base, mode: 'normal' };
    }
    return { ...state, count: '' };
  }

  // ── NORMAL two-key sequences ──
  if (pending === 'g') {
    if (key === 'g') return { ...state, pos: 0, pending: null, count: '' };
    return { ...state, pending: null, count: '' };
  }

  // operator pending: d / c / y  → expect a motion or doubled key
  if (pending === 'd' || pending === 'c' || pending === 'y') {
    const op = pending;
    const rep = parseInt(count || '1', 10);
    // doubled: dd / cc / yy → linewise on `rep` lines
    if (key === op) {
      const s = lineStart(text, pos);
      const eSel = (() => { let ee = s; for (let i = 0; i < Math.max(1, rep); i++) ee = lineEnd(text, ee) < text.length ? lineEnd(text, ee) + 1 : lineEnd(text, ee); return ee; })();
      const removed = text.slice(s, eSel);
      if (op === 'y') return { ...state, register: { text: removed, linewise: true }, pending: null, count: '' };
      if (op === 'c') {
        const u = withUndo(state);
        // cc keeps the line but empties it (classic vim), enters insert
        const lineFrom = s;
        const lineTo = lineEnd(text, pos);
        const next = text.slice(0, lineFrom) + text.slice(lineTo);
        return { ...state, ...u, text: next, pos: lineFrom, mode: 'insert', register: { text: removed, linewise: true }, pending: null, count: '' };
      }
      const u = withUndo(state);
      const del = deleteLines(text, pos, rep);
      return { ...state, ...u, text: del.text, pos: del.pos, register: { text: del.removed, linewise: true }, pending: null, count: '' };
    }
    // operator + motion
    const m = resolveMotion(text, pos, key, rep);
    if (m) {
      const u = withUndo(state);
      const del = deleteRange(text, pos, m.to);
      const base = { ...state, ...u, text: del.text, pos: del.pos, register: { text: del.removed, linewise: false }, pending: null, count: '' };
      if (op === 'y') return { ...state, register: { text: text.slice(Math.min(pos, m.to), Math.max(pos, m.to)), linewise: false }, pending: null, count: '' };
      return op === 'c' ? { ...base, mode: 'insert' } : { ...base, mode: 'normal' };
    }
    return { ...state, pending: null, count: '' };
  }

  const rep = parseInt(count || '1', 10);

  switch (key) {
    // enter INSERT
    case 'i': return { ...state, mode: 'insert', pending: null, count: '' };
    case 'a': return { ...state, pos: clamp(pos + 1, 0, text.length), mode: 'insert', pending: null, count: '' };
    case 'A': return { ...state, pos: lineEnd(text, pos), mode: 'insert', pending: null, count: '' };
    case 'o': { const u = withUndo(state); const eol = lineEnd(text, pos); return { ...state, ...u, text: text.slice(0, eol) + '\n' + text.slice(eol), pos: eol + 1, mode: 'insert', pending: null, count: '' }; }
    case 'O': { const u = withUndo(state); const s = lineStart(text, pos); return { ...state, ...u, text: text.slice(0, s) + '\n' + text.slice(s), pos: s, mode: 'insert', pending: null, count: '' }; }
    // visual
    case 'v': return { ...state, mode: 'visual', anchor: pos, count: '' };
    case 'V': return { ...state, mode: 'vline', anchor: pos, count: '' };
    // motions
    case 'h': case 'l': case 'w': case 'b': case 'e': case '0': case '$': {
      const m = resolveMotion(text, pos, key, rep);
      return { ...state, pos: m.to, count: '' };
    }
    case 'j': return { ...state, pos: vMove(text, pos, 1, rep), count: '' };
    case 'k': return { ...state, pos: vMove(text, pos, -1, rep), count: '' };
    case 'G': return { ...state, pos: text.length, count: '' };
    case 'g': return { ...state, pending: 'g' };
    // operators
    case 'd': return { ...state, pending: 'd' };
    case 'c': return { ...state, pending: 'c' };
    case 'y': return { ...state, pending: 'y' };
    case 'D': { const u = withUndo(state); const eol = lineEnd(text, pos); const removed = text.slice(pos, eol); return { ...state, ...u, text: text.slice(0, pos) + text.slice(eol), pos: clamp(pos, 0, text.length), register: { text: removed, linewise: false }, count: '' }; }
    case 'C': { const u = withUndo(state); const eol = lineEnd(text, pos); const removed = text.slice(pos, eol); return { ...state, ...u, text: text.slice(0, pos) + text.slice(eol), pos, mode: 'insert', register: { text: removed, linewise: false }, count: '' }; }
    // edits
    case 'x': {
      const u = withUndo(state);
      let t = text; let p = pos; let removed = '';
      for (let i = 0; i < rep; i++) { const d = deleteCharAt(t, p); removed += t[p] || ''; t = d.text; p = clamp(d.pos, 0, t.length); }
      return { ...state, ...u, text: t, pos: p, register: { text: removed, linewise: false }, count: '' };
    }
    case 'r': return { ...state, pending: 'r' };
    case '~': {
      const u = withUndo(state);
      const c = text[pos];
      if (!c) return { ...state, count: '' };
      const flipped = c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase();
      return { ...state, ...u, text: text.slice(0, pos) + flipped + text.slice(pos + 1), pos: clamp(pos + 1, 0, text.length), count: '' };
    }
    // yank/paste
    case 'p': case 'P': {
      if (!register) return { ...state, count: '' };
      const u = withUndo(state);
      if (register.linewise) {
        const at = key === 'p' ? (lineEnd(text, pos) < text.length ? lineEnd(text, pos) + 1 : text.length) : lineStart(text, pos);
        let ins = register.text;
        if (key === 'p' && at === text.length && text.length && !text.endsWith('\n')) ins = '\n' + register.text.replace(/\n$/, '');
        const next = text.slice(0, at) + ins + text.slice(at);
        return { ...state, ...u, text: next, pos: at, count: '' };
      }
      const at = key === 'p' ? clamp(pos + 1, 0, text.length) : pos;
      const next = text.slice(0, at) + register.text + text.slice(at);
      return { ...state, ...u, text: next, pos: clamp(at + register.text.length - 1, 0, next.length), count: '' };
    }
    // undo
    case 'u': {
      const undo = [...(state.undo || [])];
      const snap = undo.pop();
      if (!snap) return { ...state, count: '' };
      const redo = [...(state.redo || []), { text, pos }].slice(-100);
      return { ...state, text: snap.text, pos: clamp(snap.pos, 0, snap.text.length), undo, redo, count: '' };
    }
    default: return { ...state, count: '', noop: true };
  }
};
