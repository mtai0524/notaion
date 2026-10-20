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

const DAY_COUNTS_KEY = 'daily-note-day-counts-v1';

/** Cached 'yyyy-MM-dd' -> note count map, so calendar dots render before /all loads. */
export const loadDayCounts = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAY_COUNTS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const saveDayCounts = (counts) => {
  try {
    localStorage.setItem(DAY_COUNTS_KEY, JSON.stringify(counts));
  } catch (err) {
    console.warn('[DAILY-NOTE] Could not cache day counts:', err);
  }
};

/* Answer to the editor's "Save changes?" prompt. Vietnamese IMEs (Unikey,
   Telex…) report letter keys as `Process` while composing, so fall back to
   the physical key (`e.code`). Returns 'save' | 'discard' | 'keep' | null. */
const PROMPT_KEYS = { y: 'save', enter: 'save', n: 'discard', escape: 'keep', c: 'keep' };
const PROMPT_CODES = { KeyY: 'save', Enter: 'save', NumpadEnter: 'save', KeyN: 'discard', Escape: 'keep', KeyC: 'keep' };
export const unsavedPromptAction = (e) => PROMPT_KEYS[String(e.key || '').toLowerCase()] || PROMPT_CODES[e.code] || null;
