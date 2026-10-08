import { describe, it, expect, vi } from "vitest";
import {
  notesToMarkdown, allNotesToMarkdown, groupByDate, notesToJson, collectMedia, safeName,
  buildZip, buildExport, exportStamp,
} from "../../../shared/exportNotes.js";

// Minimal ZIP reader: central directory → { name: bytes }, verifying CRC32.
function readZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = bytes.length - 22;
  expect(dv.getUint32(eocd, true)).toBe(0x06054b50);
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = {};
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    expect(dv.getUint32(p, true)).toBe(0x02014b50);
    const crc = dv.getUint32(p + 16, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const off = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    expect(dv.getUint32(off, true)).toBe(0x04034b50);
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const data = bytes.slice(start, start + size);
    // CRC check via a second independent implementation
    let c = ~0;
    for (const b of data) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; }
    expect((~c) >>> 0).toBe(crc);
    out[name] = data;
    p += 46 + nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return out;
}

const note = (id, date, extra = {}) => ({ id, date, title: id, content: "", timestamp: "09:00:00", category: "LOG", ...extra });

describe("markdown", () => {
  it("renders one day with checkbox, category, time, attachments and totals", () => {
    const md = notesToMarkdown("2026-09-24", [
      note("a", "2026-09-24", { title: "Họp", content: "- [ ] x\nhello world", isCompleted: true, deadline: "2026-09-25" }),
      note("b", "2026-09-24", { attachments: [{ type: "image", name: "p.png", url: "https://x/p.png" }, { type: "file", name: "d.pdf", url: "https://x/d.pdf" }] }),
    ]);
    expect(md).toContain("# Daily Note — 2026-09-24");
    expect(md).toContain("## [x] Họp");
    expect(md).toContain("*LOG · 09:00:00 · due 2026-09-25*");
    expect(md).toContain("- ![p.png](https://x/p.png)");
    expect(md).toContain("- [d.pdf](https://x/d.pdf)");
    expect(md).toMatch(/_2 notes · 6 words · ~1 min read_/); // same word counting as the old web export
  });

  it("rewrites only inline media lines, never normal links", () => {
    const md = notesToMarkdown("d", [note("a", "d", { content: "see [site](https://x.com)\n![a.png](https://cdn/a.png)\n[f.pdf](https://cdn/f.pdf)" })], (u) => `L:${u}`);
    expect(md).toContain("[site](https://x.com)");
    expect(md).toContain("![a.png](L:https://cdn/a.png)");
    expect(md).toContain("[f.pdf](L:https://cdn/f.pdf)");
  });

  it("groups by day oldest-first, time-ordered, dropping deleted", () => {
    const g = groupByDate([
      note("late", "2026-09-02", { timestamp: "18:00:00" }),
      note("early", "2026-09-02", { timestamp: "08:00:00" }),
      note("old", "2026-09-01"),
      note("gone", "2026-09-03", { isDeleted: true }),
    ]);
    expect(g.map(([d, l]) => [d, l.map((n) => n.id)])).toEqual([["2026-09-01", ["old"]], ["2026-09-02", ["early", "late"]]]);
    const all = allNotesToMarkdown([note("a", "2026-09-01"), note("b", "2026-09-02")]);
    expect(all).toContain("# Daily Notes — 2026-09-01 → 2026-09-02");
    expect(all.indexOf("# Daily Note — 2026-09-01")).toBeLessThan(all.indexOf("# Daily Note — 2026-09-02"));
    expect(allNotesToMarkdown([])).toContain("no notes");
  });
});

describe("json", () => {
  it("keeps every field and wraps with metadata", () => {
    const j = JSON.parse(notesToJson([note("a", "d", { x: 60, drawingData: "base64", linkedNoteIds: ["z"] }), note("b", "d", { isDeleted: true })], new Date("2026-10-08T01:02:03Z")));
    expect(j).toMatchObject({ app: "notaion-daily-note", version: 1, count: 1, exportedAt: "2026-10-08T01:02:03.000Z" });
    expect(j.notes[0]).toMatchObject({ id: "a", x: 60, drawingData: "base64", linkedNoteIds: ["z"] });
  });
});

describe("collectMedia / safeName", () => {
  it("finds inline and canvas media once each, ignores plain links and deleted notes", () => {
    const m = collectMedia([
      note("a", "d1", { content: "![one.png](https://c/1.png)\n[web](https://example.com/page)\n[doc.pdf](https://res.cloudinary.com/demo/raw/upload/doc.pdf)\n[big.zip](https://api.x.io/api/files/download/big.zip)", attachments: [{ url: "https://c/1.png", name: "dup" }, { url: "https://c/2.jpg", name: "two.jpg" }] }),
      note("b", "d2", { isDeleted: true, content: "![x](https://c/x.png)" }),
    ]);
    // a plain link on its own line (example.com) is not an attachment; app file storage links are
    expect(m.map((x) => x.url)).toEqual([
      "https://c/1.png",
      "https://res.cloudinary.com/demo/raw/upload/doc.pdf",
      "https://api.x.io/api/files/download/big.zip",
      "https://c/2.jpg",
    ]);
    expect(m[0]).toMatchObject({ name: "one.png", date: "d1" });
  });
  it("sanitizes names and keeps extensions when truncating", () => {
    expect(safeName('a/b:c*?.png')).toBe("a_b_c__.png");
    expect(safeName("")).toBe("file");
    const long = safeName(`${"x".repeat(200)}.jpeg`);
    expect(long.length).toBe(80);
    expect(long.endsWith(".jpeg")).toBe(true);
  });
});

describe("buildZip", () => {
  it("round-trips names (incl. UTF-8), bytes and CRCs", () => {
    const bin = new Uint8Array([0, 255, 1, 2, 3, 128]);
    const files = readZip(buildZip([{ name: "a.txt", data: "xin chào ✓" }, { name: "dir/b.bin", data: bin }, { name: "empty.txt", data: "" }]));
    expect(new TextDecoder().decode(files["a.txt"])).toBe("xin chào ✓");
    expect([...files["dir/b.bin"]]).toEqual([...bin]);
    expect(files["empty.txt"].length).toBe(0);
  });
});

describe("buildExport", () => {
  const notes = [
    note("a", "2026-09-24", { title: "Có ảnh", content: "intro\n![shot.png](https://cdn/shot.png)\n[spec.pdf](https://res.cloudinary.com/demo/spec.pdf)\n![gone.png](https://cdn/gone.png)" }),
    note("b", "2026-09-25", { title: "Ngày sau", attachments: [{ type: "image", name: "shot.png", url: "https://cdn/other.png" }] }),
  ];
  const fakeFetch = vi.fn(async (url) => {
    if (url.includes("gone")) return { ok: false, status: 404 };
    return { ok: true, status: 200, headers: { get: () => (url.endsWith("other.png") ? "image/png" : "") }, arrayBuffer: async () => new TextEncoder().encode(`bytes:${url}`).buffer };
  });

  it("md and json are single files with stamped names", async () => {
    const now = new Date(2026, 9, 8, 14, 5);
    expect(exportStamp(now)).toBe("2026-10-08_1405");
    const md = await buildExport(notes, { format: "md", now });
    expect(md).toMatchObject({ filename: "notaion-daily-2026-10-08_1405.md", mime: "text/markdown", stats: { notes: 2, days: 2 } });
    expect(md.data).toContain("# Daily Notes — 2026-09-24 → 2026-09-25");
    const js = await buildExport(notes, { format: "json", now });
    expect(js.filename.endsWith(".json")).toBe(true);
    expect(JSON.parse(js.data).count).toBe(2);
  });

  it("zip downloads media, dedupes names, rewrites links, keeps failed links and reports them", async () => {
    const progress = [];
    const r = await buildExport(notes, { format: "zip", fetchImpl: fakeFetch, onProgress: (p) => progress.push(p) });
    expect(r.mime).toBe("application/zip");
    expect(r.stats).toMatchObject({ notes: 2, days: 2, files: 3 });
    expect(r.stats.failed.map((f) => f.url)).toEqual(["https://cdn/gone.png"]);
    const z = readZip(r.data);
    const names = Object.keys(z);
    expect(names).toEqual(expect.arrayContaining(["notes.json", "notes/2026-09-24.md", "notes/2026-09-25.md", "download-errors.txt"]));
    const att = names.filter((n) => n.startsWith("attachments/"));
    expect(att).toHaveLength(3);
    expect(new Set(att.map((n) => n.toLowerCase())).size).toBe(3); // two "shot.png" did not collide
    const dec = (n) => new TextDecoder().decode(z[n]);
    const day1 = dec("notes/2026-09-24.md");
    expect(day1).toMatch(/!\[shot\.png\]\(\.\.\/attachments\/2026-09-24-\d\d-shot\.png\)/);
    expect(day1).toMatch(/\[spec\.pdf\]\(\.\.\/attachments\/2026-09-24-\d\d-spec\.pdf\)/);
    expect(day1).toContain("![gone.png](https://cdn/gone.png)"); // original link kept
    expect(dec("notes/2026-09-25.md")).toMatch(/\(\.\.\/attachments\/2026-09-25-\d\d-shot\.png\)/);
    expect(dec("download-errors.txt")).toContain("HTTP 404");
    const copied = att.find((n) => n.includes("spec"));
    expect(dec(copied)).toBe("bytes:https://res.cloudinary.com/demo/spec.pdf");
    expect(progress.at(-1)).toEqual({ phase: "zip" });
    expect(progress.filter((p) => p.phase === "files").at(-1)).toMatchObject({ done: 4, total: 4 });
  });

  it("zip without media and unknown formats", async () => {
    const r = await buildExport([note("a", "d")], { format: "zip", fetchImpl: fakeFetch });
    expect(Object.keys(readZip(r.data)).sort()).toEqual(["notes.json", "notes/d.md"]);
    await expect(buildExport([], { format: "pdf" })).rejects.toThrow(/không hỗ trợ/);
  });
});
