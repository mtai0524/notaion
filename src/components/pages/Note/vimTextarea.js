// Pure vim reducer for a <textarea>. Given the current state
// { text, pos, mode, pending } and a key event {key, ctrlKey…}, returns the
// next state, or `null` when the key should fall through to the textarea (i.e.
// normal typing in INSERT mode). No DOM — the caller applies text/pos/mode.
import { wordForward, wordBackward, lineStart, lineEnd, deleteCharAt } from './vimEditor';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const ARROW_TO_HJKL = { ArrowLeft: 'h', ArrowRight: 'l', ArrowDown: 'j', ArrowUp: 'k' };

export const vimTextareaKey = (state, e) => {
  const { text, pos, mode } = state;
  const pending = state.pending || null;

  // INSERT: only Esc / Ctrl+[ is ours; everything else (incl. arrows) falls through.
  if (mode === 'insert') {
    if (e.key === 'Escape' || (e.key === '[' && e.ctrlKey)) {
      return { text, pos: clamp(pos - 1, 0, text.length), mode: 'normal', pending: null };
    }
    return null;
  }

  // NORMAL: arrow keys behave like h/j/k/l.
  const key = ARROW_TO_HJKL[e.key] || e.key;
  e = { ...e, key };

  // NORMAL — two-key sequences first.
  if (pending === 'g') {
    if (e.key === 'g') return { text, pos: 0, mode, pending: null };
    return { text, pos, mode, pending: null };
  }
  if (pending === 'd') {
    if (e.key === 'd') {
      const s = lineStart(text, pos);
      const eol = lineEnd(text, pos);
      // remove the line plus its trailing newline (or the leading one at EOF)
      const from = s;
      const to = eol < text.length ? eol + 1 : eol;
      let next = text.slice(0, from) + text.slice(to);
      if (to === eol && from > 0) next = text.slice(0, from - 1) + text.slice(to); // last line: drop preceding \n
      return { text: next, pos: clamp(s, 0, next.length), mode, pending: null };
    }
    return { text, pos, mode, pending: null };
  }

  switch (e.key) {
    // enter INSERT
    case 'i': return { text, pos, mode: 'insert', pending: null };
    case 'a': return { text, pos: clamp(pos + 1, 0, text.length), mode: 'insert', pending: null };
    case 'A': return { text, pos: lineEnd(text, pos), mode: 'insert', pending: null };
    case 'o': {
      const eol = lineEnd(text, pos);
      const next = text.slice(0, eol) + '\n' + text.slice(eol);
      return { text: next, pos: eol + 1, mode: 'insert', pending: null };
    }
    case 'O': {
      const s = lineStart(text, pos);
      const next = text.slice(0, s) + '\n' + text.slice(s);
      return { text: next, pos: s, mode: 'insert', pending: null };
    }
    // motions
    case 'h': return { text, pos: clamp(pos - 1, 0, text.length), mode, pending: null };
    case 'l': return { text, pos: clamp(pos + 1, 0, text.length), mode, pending: null };
    case 'j': {
      const eol = lineEnd(text, pos);
      const col = pos - lineStart(text, pos);
      if (eol >= text.length) return { text, pos, mode, pending: null };
      const ns = eol + 1;
      const ne = lineEnd(text, ns);
      return { text, pos: clamp(ns + col, ns, ne), mode, pending: null };
    }
    case 'k': {
      const s = lineStart(text, pos);
      const col = pos - s;
      if (s === 0) return { text, pos, mode, pending: null };
      const ps = lineStart(text, s - 1);
      const pe = lineEnd(text, s - 1);
      return { text, pos: clamp(ps + col, ps, pe), mode, pending: null };
    }
    case 'w': return { text, pos: wordForward(text, pos), mode, pending: null };
    case 'b': return { text, pos: wordBackward(text, pos), mode, pending: null };
    case '0': return { text, pos: lineStart(text, pos), mode, pending: null };
    case '$': return { text, pos: lineEnd(text, pos), mode, pending: null };
    case 'G': return { text, pos: text.length, mode, pending: null };
    case 'g': return { text, pos, mode, pending: 'g' };
    case 'd': return { text, pos, mode, pending: 'd' };
    case 'x': {
      const { text: nt, pos: np } = deleteCharAt(text, pos);
      return { text: nt, pos: clamp(np, 0, nt.length), mode, pending: null };
    }
    default: return { text, pos, mode, pending: null, noop: true };
  }
};
