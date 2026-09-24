// Textarea editing helpers for fast markdown typing. Pure: take the text and
// caret, return the new text and caret (or null when not applicable).

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
