// Pure vim caret-offset helpers over a plain string. No DOM. A "word" is a run
// of non-space chars (vim WORD-ish — good enough for note text).
const isSpace = (c) => c === ' ' || c === '\t' || c === '\n';

export const wordForward = (text, pos) => {
  const n = text.length;
  let i = Math.min(pos, n);
  while (i < n && !isSpace(text[i])) i++; // skip current word
  while (i < n && isSpace(text[i])) i++;  // skip spaces
  return i;
};

export const wordBackward = (text, pos) => {
  let i = Math.max(0, Math.min(pos, text.length)) - 1;
  while (i > 0 && isSpace(text[i])) i--;      // skip spaces to the left
  while (i > 0 && !isSpace(text[i - 1])) i--; // to the start of the word
  return Math.max(0, i);
};

// Offset of the last char of the current/next word (vim `e`). Returns an index
// ONE PAST that char (exclusive end) so `de` can slice [pos, wordEnd).
export const wordEnd = (text, pos) => {
  const n = text.length;
  let i = Math.min(pos, n);
  if (i < n && isSpace(text[i])) { while (i < n && isSpace(text[i])) i++; } // skip leading spaces
  else i++; // move off the current char so `e` advances
  while (i < n && isSpace(text[i])) i++; // skip spaces between words
  while (i < n && !isSpace(text[i])) i++; // to end of the word
  return i;
};

export const lineStart = (text, pos) => {
  const nl = text.lastIndexOf('\n', Math.max(0, pos - 1));
  return nl === -1 ? 0 : nl + 1;
};

export const lineEnd = (text, pos) => {
  const nl = text.indexOf('\n', pos);
  return nl === -1 ? text.length : nl;
};

export const deleteCharAt = (text, pos) => {
  if (pos < 0 || pos >= text.length) return { text, pos: Math.min(pos, text.length) };
  return { text: text.slice(0, pos) + text.slice(pos + 1), pos };
};
