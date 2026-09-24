// Textarea editing helpers for fast markdown typing. Pure: take the text and
// caret, return the new text and caret (or null when not applicable).

const LIST_RE = /^(\s*)([-*]\s\[[ xX]\]\s|[-*]\s|(\d+)\.\s)(.*)$/;

const lineBounds = (text, pos) => {
  const start = text.lastIndexOf("\n", pos - 1) + 1;
  const endIdx = text.indexOf("\n", pos);
  return { start, end: endIdx === -1 ? text.length : endIdx };
};

/**
 * Enter inside a list item continues the list ("- ", "- [ ] ", "3. ").
 * Enter on an empty item ends the list (removes the bare marker).
 */
export function continueList(text, caret) {
  const { start, end } = lineBounds(text, caret);
  if (caret !== end) return null; // only when typing at end of line
  const m = text.slice(start, end).match(LIST_RE);
  if (!m) return null;
  const [, indent, marker, num, body] = m;
  if (!body.trim()) {
    const next = text.slice(0, start) + text.slice(end);
    return { text: next, caret: start };
  }
  let nextMarker = marker.replace(/\[[xX]\]/, "[ ]");
  if (num) nextMarker = `${Number(num) + 1}. `;
  const insert = `\n${indent}${nextMarker}`;
  return { text: text.slice(0, caret) + insert + text.slice(caret), caret: caret + insert.length };
}

/**
 * Ctrl+L: plain line → "- [ ] line", "- [ ]" → "- [x]", "- [x]" → "- [ ]".
 * A plain "- item" becomes "- [ ] item".
 */
export function toggleTodo(text, caret) {
  const { start, end } = lineBounds(text, caret);
  const line = text.slice(start, end);
  let next;
  const todo = line.match(/^(\s*[-*]\s\[)( |x|X)(\].*)$/);
  if (todo) next = `${todo[1]}${todo[2] === " " ? "x" : " "}${todo[3]}`;
  else {
    const bullet = line.match(/^(\s*)[-*]\s(.*)$/);
    const indent = bullet ? bullet[1] : line.match(/^\s*/)[0];
    const body = bullet ? bullet[2] : line.trimStart();
    next = `${indent}- [ ] ${body}`;
  }
  return { text: text.slice(0, start) + next + text.slice(end), caret: caret + (next.length - line.length) };
}

/**
 * Apply a helper result to a <textarea> through execCommand so the change
 * lands on the native undo stack (Ctrl+Z still works). Only the differing
 * middle span is replaced. Fires a normal `input` event.
 */
export function applyEdit(el, { text, caret }) {
  const old = el.value;
  let s = 0;
  while (s < old.length && s < text.length && old[s] === text[s]) s++;
  let e = 0;
  while (e < old.length - s && e < text.length - s && old[old.length - 1 - e] === text[text.length - 1 - e]) e++;
  const insert = text.slice(s, text.length - e);
  el.focus();
  el.setSelectionRange(s, old.length - e);
  const ok = document.execCommand(insert ? "insertText" : "delete", false, insert);
  if (!ok || el.value !== text) {
    el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  el.setSelectionRange(caret, caret);
}

/** Insert "[HH:MM] " at caret — quick log stamp (Ctrl+;). */
export function insertTimeStamp(text, caret, now = new Date()) {
  const stamp = `[${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}] `;
  return { text: text.slice(0, caret) + stamp + text.slice(caret), caret: caret + stamp.length };
}
