import { randomUUID } from "node:crypto";
import { z } from "zod";
import { todayKey, nowTime } from "../dates.js";

const defaultDeps = { uuid: randomUUID, now: () => new Date() };

export function buildNotePayload(input, deps = defaultDeps) {
  const now = deps.now();
  return {
    id: deps.uuid(),
    title: input.title,
    content: input.content,
    color: "#fff8b8",
    category: input.category || "LOG",
    timestamp: nowTime(now),
    date: input.date || todayKey(now),
    x: 60,
    y: 100,
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

export async function findNoteById(api, id) {
  const all = (await api("GET", "/api/DailyNote/all")) || [];
  const note = all.find((n) => n.id === id);
  if (!note) throw new Error(`Daily note not found: ${id}`);
  return note;
}

export async function listDailyNotes(api, { date }) {
  const key = date || todayKey();
  const notes = (await api("GET", `/api/DailyNote/${key}`)) || [];
  return notes.filter((n) => !n.isDeleted);
}

export async function searchDailyNotes(api, { query, limit = 20 }) {
  const all = (await api("GET", "/api/DailyNote/all")) || [];
  const q = query.toLowerCase();
  return all
    .filter((n) => !n.isDeleted)
    .filter(
      (n) =>
        (n.title || "").toLowerCase().includes(q) ||
        (n.content || "").toLowerCase().includes(q)
    )
    .slice(0, limit);
}

export async function createDailyNote(api, input, deps = defaultDeps) {
  const note = buildNotePayload(input, deps);
  await api("POST", "/api/DailyNote", note);
  return note;
}

export async function appendToDailyNote(api, { id, text }, deps = defaultDeps) {
  const note = await findNoteById(api, id);
  const updated = {
    ...note,
    content: note.content ? `${note.content}\n${text}` : text,
    updatedAt: deps.now().toISOString(),
  };
  await api("POST", "/api/DailyNote", updated);
  return updated;
}

export async function updateDailyNote(api, input, deps = defaultDeps) {
  const { id, ...fields } = input;
  const note = await findNoteById(api, id);
  const updated = { ...note, updatedAt: deps.now().toISOString() };
  for (const key of ["title", "content", "category", "deadline"]) {
    if (fields[key] !== undefined) updated[key] = fields[key];
  }
  await api("POST", "/api/DailyNote", updated);
  return updated;
}

export async function deleteDailyNote(api, { id }) {
  await api("DELETE", `/api/DailyNote/${id}`);
  return { id, deleted: true };
}

export const schemas = {
  list_daily_notes: {
    date: z.string().optional().describe("yyyy-MM-dd; defaults to today"),
  },
  search_daily_notes: {
    query: z.string().describe("keyword to match in title or content"),
    limit: z.number().int().positive().optional().describe("max results, default 20"),
  },
  create_daily_note: {
    title: z.string().describe("note title"),
    content: z.string().describe("note body (markdown)"),
    category: z.enum(["TASK", "LOG", "SYSTEM"]).optional().describe("default LOG"),
    date: z.string().optional().describe("yyyy-MM-dd; defaults to today"),
  },
  append_to_daily_note: {
    id: z.string().describe("target note id"),
    text: z.string().describe("text appended on a new line"),
  },
  update_daily_note: {
    id: z.string().describe("target note id"),
    title: z.string().optional(),
    content: z.string().optional(),
    category: z.enum(["TASK", "LOG", "SYSTEM"]).optional(),
    deadline: z.string().nullable().optional().describe("ISO datetime or null"),
  },
  delete_daily_note: {
    id: z.string().describe("note id to soft-delete"),
  },
};
