// Text helpers for READING (word tokens, the sentence around a word) and
// WRITING (word diff between the draft and the AI correction).

const WORD = /([A-Za-z][A-Za-z'-]*)/;

// Splits a paragraph into tokens; words sit at odd indices.
export const tokenize = (paragraph) => paragraph.split(WORD);

export const normalizeWord = (word) => word.toLowerCase().replace(/^'+|'+$/g, '');

// The sentence of `paragraph` that contains the character at `offset`.
export const sentenceAt = (paragraph, offset) => {
  const sentences = paragraph.match(/[^.!?]+[.!?]*/g) || [];
  let end = 0;
  for (const sentence of sentences) {
    end += sentence.length;
    if (offset < end) return sentence.trim();
  }
  return paragraph.trim();
};

const lcsTable = (before, after) => {
  const table = Array.from({ length: before.length + 1 }, () => new Array(after.length + 1).fill(0));
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === after[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
};

// Word-level diff: [{ type: 'same' | 'del' | 'ins', text }], neighbours of
// the same type merged.
export const diffWords = (beforeText, afterText) => {
  const before = beforeText.split(/\s+/).filter(Boolean);
  const after = afterText.split(/\s+/).filter(Boolean);
  const table = lcsTable(before, after);
  const parts = [];
  const push = (type, word) => {
    const last = parts.at(-1);
    if (last && last.type === type) last.text += ` ${word}`;
    else parts.push({ type, text: word });
  };

  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      push('same', before[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push('del', before[i]);
      i += 1;
    } else {
      push('ins', after[j]);
      j += 1;
    }
  }
  before.slice(i).forEach((word) => push('del', word));
  after.slice(j).forEach((word) => push('ins', word));
  return parts;
};
