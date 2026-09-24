import { describe, it, expect } from "vitest";
import { buildNote, mergeDay, searchNotes, sortNotes, previewLine, checklistProgress } from "./notes.js";

describe("buildNote", () => {
  it("fills web-canvas defaults and the given date", () => {
    const now = new Date(2026, 8, 24, 9, 5, 7);
    const n = buildNote({ title: "T", date: "2026-09-20" }, now);
    expect(n.id).toMatch(/[0-9a-f-]{36}/);
    expect(n).toMatchObject({ title: "T", content: "", category: "LOG", date: "2026-09-20", timestamp: "09:05:07", width: 280, isCompleted: false });
  });
  it("defaults date to today (local)", () => {
    expect(buildNote({}, new Date(2026, 0, 2, 23, 59)).date).toBe("2026-01-02");
  });
});

describe("mergeDay", () => {
  const server = [
    { id: "a", date: "d1", timestamp: "08:00", title: "a" },
    { id: "b", date: "d1", timestamp: "09:00", title: "b" },
    { id: "gone", date: "d1", isDeleted: true },
  ];
  it("overlays pending upserts, deletes and moves", () => {
    const outbox = {
      a: { op: "upsert", note: { id: "a", date: "d1", timestamp: "08:00", title: "a*" } },
      b: { op: "delete", id: "b", date: "d1" },
      c: { op: "upsert", note: { id: "c", date: "d1", timestamp: "10:00", title: "c" } },
      x: { op: "upsert", note: { id: "x", date: "d2", timestamp: "10:00" } },
    };
    const out = mergeDay(server, outbox, "d1");
    expect(out.map((n) => n.id)).toEqual(["c", "a"]);
    expect(out[1].title).toBe("a*");
  });
  it("drops a note moved to another day", () => {
    const outbox = { a: { op: "upsert", note: { id: "a", date: "d9" } } };
    expect(mergeDay(server, outbox, "d1").map((n) => n.id)).toEqual(["b"]);
  });
});

describe("sortNotes", () => {
  it("pinned first, then newest", () => {
    const out = sortNotes([
      { id: "1", timestamp: "07:00" },
      { id: "2", timestamp: "09:00" },
      { id: "3", timestamp: "06:00", pinned: true },
    ]);
    expect(out.map((n) => n.id)).toEqual(["3", "2", "1"]);
  });
});

describe("searchNotes", () => {
  const notes = [
    { id: "1", date: "2026-09-01", title: "Họp dự án", content: "deploy lên server" },
    { id: "2", date: "2026-09-10", title: "Ý tưởng", content: "Deploy tự động" },
    { id: "3", date: "2026-09-11", title: "x", content: "y", isDeleted: true },
  ];
  it("is accent- and case-insensitive, all terms must match, newest day first", () => {
    expect(searchNotes(notes, "DEPLOY").map((n) => n.id)).toEqual(["2", "1"]);
    expect(searchNotes(notes, "hop du an").map((n) => n.id)).toEqual(["1"]);
    expect(searchNotes(notes, "deploy tu dong").map((n) => n.id)).toEqual(["2"]);
  });
  it("ignores empty queries and deleted notes", () => {
    expect(searchNotes(notes, "   ")).toEqual([]);
    expect(searchNotes(notes, "x")).toEqual([]); // only the deleted note matches
  });
});

describe("previewLine / checklistProgress", () => {
  it("strips markdown markers from the first line", () => {
    expect(previewLine("\n\n- [ ] buy milk\nmore")).toBe("buy milk");
    expect(previewLine("## Heading")).toBe("Heading");
    expect(previewLine("")).toBe("");
  });
  it("counts checklist items", () => {
    expect(checklistProgress("- [x] a\n- [ ] b\n* [X] c")).toEqual({ done: 2, total: 3 });
    expect(checklistProgress("plain")).toBeNull();
  });
});
