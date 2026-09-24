// Pure note logic: payload defaults, ordering, outbox merge, search.
// No storage or network here so it stays unit-testable.
import { todayKey, nowTime } from "./dates.js";

export const CATEGORIES = ["LOG", "TASK", "IDEA", "MEMO", "SYSTEM"];

const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

/**
 * New note with the layout/style defaults the web canvas expects, so a note
 * created on desktop renders normally in the sticky-note view.
 */
export function buildNote({ title = "", content = "", category = "LOG", date }, now = new Date()) {
  return {
    id: uuid(),
    title,
    content,
    color: "#fff8b8",
    category,
    timestamp: nowTime(now),
    date: date || todayKey(now),
    x: 60 + Math.round(Math.random() * 240),
    y: 100 + Math.round(Math.random() * 160),
    width: 280,
    height: 200,
    zIndex: 1,
    isMinimized: false,
    opacity: 1,
    fontSize: "0.85rem",
    borderStyle: 0,
    isCompleted: false,
    customTextColor: null,
    deadline: null,
    reminderLeadMinutes: null,
    reminderDone: false,
    updatedAt: now.toISOString(),
  };
}

/** Pinned first, then newest timestamp first. */
export const sortNotes = (notes) =>
  [...notes].sort(
    (a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
      String(b.timestamp || "").localeCompare(String(a.timestamp || "")) ||
      String(a.title || "").localeCompare(String(b.title || ""))
  );

/**
 * Overlay pending local changes (outbox) on top of the server's list for one
 * day, so unsynced edits/creates/deletes never flicker away on refresh.
 * outbox: { [id]: { op: "upsert", note } | { op: "delete", id, date } }
 */
export function mergeDay(serverNotes, outbox, date) {
  const byId = new Map();
  for (const n of serverNotes || []) if (!n.isDeleted) byId.set(n.id, n);
  for (const entry of Object.values(outbox || {})) {
    if (entry.op === "delete") byId.delete(entry.id);
    else if (entry.op === "upsert") {
      if (entry.note.date === date) byId.set(entry.note.id, entry.note);
      else byId.delete(entry.note.id); // moved to another day locally
    }
  }
  return sortNotes([...byId.values()]);
}

/** Case/diacritic-insensitive search over title + content, newest day first. */
const fold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

export function searchNotes(notes, query, limit = 50) {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return notes
    .filter((n) => !n.isDeleted)
    .filter((n) => {
      const hay = fold(`${n.title}\n${n.content}`);
      return terms.every((t) => hay.includes(t));
    })
    .sort(
      (a, b) =>
        String(b.date).localeCompare(String(a.date)) ||
        String(b.timestamp || "").localeCompare(String(a.timestamp || ""))
    )
    .slice(0, limit);
}

/** First non-empty content line, trimmed of markdown markers — list preview. */
export const previewLine = (content) => {
  const line = String(content || "")
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  return line ? line.replace(/^([-*]\s*\[[ xX]\]\s*|[#>*-]+\s*)/, "").slice(0, 120) : "";
};

export const wordCount = (text) => (String(text || "").trim().match(/\S+/g) || []).length;

/** Checklist progress for `- [ ]` / `- [x]` lines, or null when none. */
export const checklistProgress = (content) => {
  const m = String(content || "").match(/^\s*[-*]\s*\[( |x|X)\]/gm);
  if (!m) return null;
  return { done: m.filter((s) => /x/i.test(s)).length, total: m.length };
};
