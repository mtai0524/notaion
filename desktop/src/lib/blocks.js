// Block operations for the desktop block editor, on top of the web's
// markdown <-> block model (noteFormat.js). Pure — no DOM.
import { parseMarkdown, serializeBlocks, reorder } from "./noteFormat.js";

let seq = 0;
export const newId = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

export const TEXT_TYPES = new Set(["paragraph", "h1", "h2", "h3", "bullet", "todo", "quote", "callout", "code", "toggle"]);
/** Types where Enter inserts a newline instead of starting a new block. */
export const MULTILINE_TYPES = new Set(["code", "callout"]);
/** Types that continue on Enter (a new bullet after a bullet, etc.). */
const CONTINUING = new Set(["bullet", "todo"]);

export const isText = (b) => TEXT_TYPES.has(b?.type);
export const textOf = (b) => (b.type === "toggle" ? b.title || "" : b.text || "");
export const withText = (b, text) => (b.type === "toggle" ? { ...b, title: text } : { ...b, text });
export const paragraph = (text = "") => ({ id: newId(), type: "paragraph", text });

export const parse = (md) => {
  const blocks = parseMarkdown(md);
  return blocks.length ? blocks : [paragraph()];
};

/** Upload placeholders live only in the editor; they never reach saved markdown. */
export const serialize = (blocks) => serializeBlocks(blocks.filter((b) => b.type !== "uploading"));

export { reorder };

/** Enter at `pos`: split block i. Returns { blocks, focus: { id, pos } }. */
export function splitBlock(blocks, i, pos) {
  const b = blocks[i];
  const t = textOf(b);
  // Enter on an empty list/quote/heading line turns it back into plain text.
  if (!t && b.type !== "paragraph") {
    const plain = { id: b.id, type: "paragraph", text: "" };
    return { blocks: blocks.map((x, j) => (j === i ? plain : x)), focus: { id: b.id, pos: 0 } };
  }
  const type = CONTINUING.has(b.type) ? b.type : "paragraph";
  const after = { id: newId(), type, text: t.slice(pos), ...(type === "todo" ? { checked: false } : {}) };
  const next = [...blocks];
  next.splice(i, 1, withText(b, t.slice(0, pos)), after);
  return { blocks: next, focus: { id: after.id, pos: 0 } };
}

/**
 * Backspace at the very start of block i.
 *  - styled block → plain paragraph (keeps text)
 *  - paragraph after a text block → merge into it
 *  - empty paragraph after a non-text block (image, file, divider) → removed
 * Returns null when there is nothing to do.
 */
export function backspaceAtStart(blocks, i) {
  const b = blocks[i];
  if (b.type !== "paragraph" && b.type !== "toggle" && b.type !== "code") {
    const plain = { id: b.id, type: "paragraph", text: textOf(b) };
    return { blocks: blocks.map((x, j) => (j === i ? plain : x)), focus: { id: b.id, pos: 0 } };
  }
  if (i === 0) return null;
  const prev = blocks[i - 1];
  if (isText(prev) && prev.type !== "code" && prev.type !== "toggle") {
    const pt = textOf(prev);
    const merged = withText(prev, pt + textOf(b));
    const next = [...blocks];
    next.splice(i - 1, 2, merged);
    return { blocks: next, focus: { id: prev.id, pos: pt.length } };
  }
  if (!textOf(b)) {
    const target = [...blocks.slice(0, i)].reverse().find(isText);
    return { blocks: blocks.filter((_, j) => j !== i), focus: target ? { id: target.id, pos: "end" } : null };
  }
  return null;
}

/**
 * Insert new blocks at the caret inside block i (paste / attach).
 * Splits the block when the caret is mid-text; an empty paragraph is replaced.
 * Always leaves a text block after the inserted ones so typing can continue.
 */
export function insertAtCaret(blocks, i, pos, inserted) {
  const b = blocks[i];
  const t = isText(b) ? textOf(b) : "";
  let before = [];
  let after = [];
  if (!isText(b)) after = [b];
  else if (!t && b.type === "paragraph") after = [];
  else if (pos <= 0) after = [b];
  else if (pos >= t.length) before = [b];
  else {
    before = [withText(b, t.slice(0, pos))];
    after = [{ ...withText(b, t.slice(pos)), id: newId(), ...(b.type === "todo" ? { checked: false } : {}) }];
  }
  if (!after.length || !isText(after[0])) after = [paragraph(), ...after];
  const next = [...blocks];
  next.splice(i, 1, ...before, ...inserted, ...after);
  return { blocks: next, focus: { id: after[0].id, pos: 0 } };
}

/** Insert at a gap between blocks (drop target). gap ∈ [0, blocks.length]. */
export function insertAtGap(blocks, gap, inserted) {
  const next = [...blocks];
  next.splice(gap, 0, ...inserted);
  // Keep a writable line at the end if the drop landed after the last block.
  if (gap >= blocks.length) next.push(paragraph());
  return next;
}

/** Move block `from` to the gap `gap` (gap indexes are pre-move positions). */
export function moveToGap(blocks, from, gap) {
  const to = gap > from ? gap - 1 : gap;
  return to === from ? blocks : reorder(blocks, from, to);
}

/** Typing a markdown prefix at the start of a paragraph turns it into that block. */
export function markdownShortcut(text) {
  let m;
  if ((m = text.match(/^(#{1,3}) (.*)$/s))) return { type: `h${m[1].length}`, text: m[2] };
  if ((m = text.match(/^(?:[-*] )?\[( |x|X)?\] (.*)$/s))) return { type: "todo", checked: !!m[1]?.trim(), text: m[2] };
  if ((m = text.match(/^[-*] (.*)$/s))) return { type: "bullet", text: m[1] };
  if ((m = text.match(/^> (.*)$/s))) return { type: "quote", text: m[1] };
  if (text === "```") return { type: "code", lang: "", text: "" };
  if (text === "---") return { type: "divider", text: "" };
  return null;
}

/** Uploaded attachment → inline block (same markdown the web writes). */
export const attachmentToBlock = (a) =>
  a.type === "image"
    ? { id: newId(), type: "image", alt: a.name || "", url: a.url }
    : { id: newId(), type: "file", label: a.name || "file", url: a.url };

/** Markdown lines for attachments (used when the editor is gone). */
export const attachmentsToMarkdown = (atts) => serializeBlocks(atts.map(attachmentToBlock));
