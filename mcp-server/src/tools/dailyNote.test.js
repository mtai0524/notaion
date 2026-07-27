import { describe, it, expect, vi } from "vitest";
import {
  buildNotePayload,
  listDailyNotes,
  searchDailyNotes,
  createDailyNote,
  appendToDailyNote,
  deleteDailyNote,
} from "./dailyNote.js";

const fixedNow = new Date(2026, 6, 24, 9, 0, 0);
const deps = { uuid: () => "uuid-1", now: () => fixedNow };

describe("buildNotePayload", () => {
  it("applies defaults and required fields", () => {
    const n = buildNotePayload({ title: "T", content: "C" }, deps);
    expect(n.id).toBe("uuid-1");
    expect(n.title).toBe("T");
    expect(n.content).toBe("C");
    expect(n.category).toBe("LOG");
    expect(n.date).toBe("2026-07-24");
    expect(n.timestamp).toBe("09:00:00");
    expect(n.width).toBe(280);
    expect(n.isCompleted).toBe(false);
    expect(n.deadline).toBeNull();
  });

  it("honors explicit category and date", () => {
    const n = buildNotePayload(
      { title: "T", content: "C", category: "TASK", date: "2026-01-02" },
      deps
    );
    expect(n.category).toBe("TASK");
    expect(n.date).toBe("2026-01-02");
  });
});

describe("listDailyNotes", () => {
  it("fetches by date and drops deleted notes", async () => {
    const api = vi.fn().mockResolvedValue([
      { id: "a", isDeleted: false },
      { id: "b", isDeleted: true },
    ]);
    const out = await listDailyNotes(api, { date: "2026-07-24" });
    expect(api).toHaveBeenCalledWith("GET", "/api/DailyNote/2026-07-24");
    expect(out).toEqual([{ id: "a", isDeleted: false }]);
  });
});

describe("searchDailyNotes", () => {
  it("matches title/content case-insensitively and caps at limit", async () => {
    const api = vi.fn().mockResolvedValue([
      { id: "1", title: "Deploy plan", content: "" },
      { id: "2", title: "x", content: "fix DEPLOY bug" },
      { id: "3", title: "unrelated", content: "nope" },
    ]);
    const out = await searchDailyNotes(api, { query: "deploy", limit: 1 });
    expect(api).toHaveBeenCalledWith("GET", "/api/DailyNote/all");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("1");
  });
});

describe("createDailyNote", () => {
  it("posts the built payload and returns it", async () => {
    const api = vi.fn().mockResolvedValue(null);
    const out = await createDailyNote(
      api,
      { title: "T", content: "C" },
      deps
    );
    expect(api).toHaveBeenCalledWith("POST", "/api/DailyNote", expect.objectContaining({ id: "uuid-1", title: "T" }));
    expect(out.id).toBe("uuid-1");
  });
});

describe("appendToDailyNote", () => {
  it("appends text to existing content and re-posts", async () => {
    const existing = { id: "a", title: "T", content: "line1", date: "2026-07-24" };
    const api = vi
      .fn()
      .mockResolvedValueOnce([existing]) // GET /all
      .mockResolvedValueOnce(null); // POST
    const out = await appendToDailyNote(api, { id: "a", text: "line2" }, deps);
    expect(out.content).toBe("line1\nline2");
    const postCall = api.mock.calls[1];
    expect(postCall[0]).toBe("POST");
    expect(postCall[1]).toBe("/api/DailyNote");
    expect(postCall[2].content).toBe("line1\nline2");
  });

  it("throws when id not found", async () => {
    const api = vi.fn().mockResolvedValue([]);
    await expect(appendToDailyNote(api, { id: "z", text: "x" }, deps)).rejects.toThrow(/not found/);
  });
});

describe("deleteDailyNote", () => {
  it("issues a delete and reports success", async () => {
    const api = vi.fn().mockResolvedValue(null);
    const out = await deleteDailyNote(api, { id: "a" });
    expect(api).toHaveBeenCalledWith("DELETE", "/api/DailyNote/a");
    expect(out).toEqual({ id: "a", deleted: true });
  });
});
