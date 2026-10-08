/* Small pure helpers for Daily Notes: word statistics and Markdown export.
   Kept dependency-free so both DailyNoteApp and TuiView can share them. */

/** Word count + estimated reading time (~200 wpm, floor 1 minute). */
export const wordStats = (text) => {
  const words = (String(text || '').trim().match(/\S+/g) || []).length;
  return { words, minutes: Math.max(1, Math.ceil(words / 200)) };
};

/** Serialize one day's notes into a single Markdown document (shared with the desktop app). */
export { notesToMarkdown } from '../../../../shared/exportNotes';

/** Matches a markdown task line: `- [ ] thing` / `* [x] thing`. */
export const CHECKBOX_RE = /^(\s*[-*]\s*\[)( |x|X)(\])\s?(.*)$/;

/**
 * Flip the checkbox on one line of markdown content.
 * Returns the new content, or null when that line is not a task line.
 */
export const toggleChecklistLine = (content, lineIndex) => {
  const lines = String(content || '').split('\n');
  const m = (lines[lineIndex] || '').match(CHECKBOX_RE);
  if (!m) return null;
  lines[lineIndex] = `${m[1]}${m[2].trim() ? ' ' : 'x'}${m[3]} ${m[4]}`;
  return lines.join('\n');
};

/** Trigger a client-side download. `data` is a string or bytes (Uint8Array). */
export const downloadFile = (filename, data, mime = 'application/octet-stream') => {
  const text = typeof data === 'string';
  const blob = new Blob([data], { type: text ? `${mime};charset=utf-8` : mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Trigger a client-side download of a text file. */
export const downloadTextFile = (filename, content, mime = 'text/markdown') => downloadFile(filename, content, mime);
