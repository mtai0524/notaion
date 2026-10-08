// Daily Note export — shared by the web app (src/) and the desktop app
// (desktop/src/). Pure logic: no DOM, no framework, no dependencies.
//
//   md   one Markdown file with every day
//   json full backup of every field (re-importable)
//   zip  notes/<date>.md + notes.json + attachments/ (images & files downloaded,
//        Markdown links rewritten to the local copies)

export const EXPORT_VERSION = 1;

const pad = (n) => String(n).padStart(2, "0");

export const wordStats = (text) => {
  const words = (String(text || "").trim().match(/\S+/g) || []).length;
  return { words, minutes: Math.max(1, Math.ceil(words / 200)) };
};

/** A line that is only an inline image `![alt](url)` or file `[label](url)`. */
export const MEDIA_LINE = /^!?\[[^\]]*\]\(([^)\s]+)\)$/;

// ---------------------------------------------------------------- markdown

const mapContentUrls = (content, mapUrl) =>
  String(content || "")
    .split("\n")
    .map((line) => {
      const m = line.trim().match(MEDIA_LINE);
      return m ? line.replace(m[1], () => mapUrl(m[1])) : line;
    })
    .join("\n");

/** One day's notes as a Markdown document. */
export const notesToMarkdown = (dateKey, notes, mapUrl = (u) => u) => {
  const list = notes || [];
  const lines = [`# Daily Note — ${dateKey}`, ""];
  list.forEach((n) => {
    const cat = n.customCategory || n.category || "MEMO";
    lines.push(`## [${n.isCompleted ? "x" : " "}] ${n.title || "(untitled)"}`);
    lines.push(`*${cat}${n.timestamp ? ` · ${n.timestamp}` : ""}${n.deadline ? ` · due ${n.deadline}` : ""}*`, "");
    if (n.content) lines.push(mapContentUrls(n.content, mapUrl), "");
    // Files attached on the web canvas (not inline in the content).
    const atts = n.attachments || [];
    if (atts.length) {
      atts.forEach((a) => lines.push(`- ${a.type === "image" ? "!" : ""}[${a.name || "file"}](${mapUrl(a.url)})`));
      lines.push("");
    }
    lines.push("---", "");
  });
  const { words, minutes } = wordStats(list.map((n) => n.content).join(" "));
  lines.push(`_${list.length} notes · ${words} words · ~${minutes} min read_`);
  return lines.join("\n");
};

const byTime = (a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || ""));

/** [[date, notes[]], …] — oldest day first, notes in time order. Deleted notes dropped. */
export const groupByDate = (notes) => {
  const days = new Map();
  for (const n of notes || []) {
    if (n.isDeleted || !n.date) continue;
    if (!days.has(n.date)) days.set(n.date, []);
    days.get(n.date).push(n);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, list]) => [d, list.sort(byTime)]);
};

/** Every day in one Markdown document. */
export const allNotesToMarkdown = (notes, mapUrl) => {
  const days = groupByDate(notes);
  if (!days.length) return "# Daily Notes\n\n_(no notes)_\n";
  const total = days.reduce((s, [, l]) => s + l.length, 0);
  const head = `# Daily Notes — ${days[0][0]} → ${days[days.length - 1][0]}\n\n_${total} notes · ${days.length} days_\n`;
  return [head, ...days.map(([d, list]) => notesToMarkdown(d, list, mapUrl))].join("\n\n");
};

// -------------------------------------------------------------------- json

/** Full backup. Wrapped with metadata so a future import can check the format. */
export const notesToJson = (notes, now = new Date()) => {
  const list = (notes || []).filter((n) => !n.isDeleted);
  return JSON.stringify(
    { app: "notaion-daily-note", version: EXPORT_VERSION, exportedAt: now.toISOString(), count: list.length, notes: list },
    null,
    2
  );
};

// ------------------------------------------------------------- attachments

/**
 * A bare `[label](url)` line is how the editor writes an attached *file*, but it
 * is also what an ordinary pasted link looks like. Only treat it as an
 * attachment when it points into the app's own file storage; otherwise we
 * would download arbitrary web pages into the export.
 */
export const isAppFileUrl = (url) => {
  try {
    const u = new URL(url);
    return u.hostname === "res.cloudinary.com" || u.pathname.includes("/api/files/");
  } catch {
    return false;
  }
};

/** Unique media referenced by the notes (inline blocks + canvas attachments). */
export const collectMedia = (notes) => {
  const seen = new Map();
  const add = (url, name, n) => {
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.set(url, { url, name: name || "", date: n.date, noteId: n.id });
  };
  for (const n of notes || []) {
    if (n.isDeleted) continue;
    String(n.content || "").split("\n").forEach((line) => {
      const t = line.trim();
      const m = t.match(MEDIA_LINE);
      if (!m) return;
      if (!t.startsWith("!") && !isAppFileUrl(m[1])) return; // plain link, not an attachment
      add(m[1], (t.match(/\[([^\]]*)\]/) || [])[1], n);
    });
    (n.attachments || []).forEach((a) => add(a.url, a.name, n));
  }
  return [...seen.values()];
};

const EXT_BY_TYPE = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp",
  "image/svg+xml": ".svg", "application/pdf": ".pdf", "text/plain": ".txt", "application/zip": ".zip",
};

const basenameOf = (url) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "");
  } catch {
    return "";
  }
};

/** Safe file name (no path separators / reserved chars), keeping the extension. */
export const safeName = (raw, fallback = "file") => {
  let s = Array.from(String(raw || ""), (ch) => (ch.charCodeAt(0) < 32 ? "_" : ch))
    .join("")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim()
    .replace(/^\.+/, "");
  if (!s) s = fallback;
  if (s.length > 80) {
    const dot = s.lastIndexOf(".");
    const ext = dot > 0 && s.length - dot <= 8 ? s.slice(dot) : "";
    s = s.slice(0, 80 - ext.length) + ext;
  }
  return s;
};

const hasExt = (s) => /\.[A-Za-z0-9]{1,8}$/.test(s);

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

/**
 * Download every media file. Returns { files: [{name, data}], urlToPath, failed }.
 * A failed download keeps its original URL in the Markdown (never drops data).
 */
export async function downloadMedia(media, { fetchImpl, onProgress, concurrency = 4 } = {}) {
  const doFetch = fetchImpl || ((...a) => globalThis.fetch(...a));
  const used = new Set();
  const files = [];
  const urlToPath = new Map();
  const failed = [];
  let done = 0;

  await mapPool(media, concurrency, async (m, i) => {
    try {
      const res = await doFetch(m.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = new Uint8Array(await res.arrayBuffer());
      let name = safeName(m.name || basenameOf(m.url), "file");
      if (!hasExt(name)) name += EXT_BY_TYPE[(res.headers?.get?.("content-type") || "").split(";")[0].trim()] || "";
      let path = `attachments/${m.date}-${String(i + 1).padStart(2, "0")}-${name}`;
      while (used.has(path.toLowerCase())) path = path.replace(/(\.[^.]*)?$/, (e) => `_${used.size}${e || ""}`);
      used.add(path.toLowerCase());
      files.push({ name: path, data });
      urlToPath.set(m.url, path);
    } catch (err) {
      failed.push({ url: m.url, name: m.name, error: String(err?.message || err) });
    } finally {
      onProgress?.({ phase: "files", done: ++done, total: media.length });
    }
  });
  return { files, urlToPath, failed };
}

// --------------------------------------------------------------------- zip

let crcTable;
const crc32 = (bytes) => {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const enc = new TextEncoder();

/** ZIP archive, "stored" (uncompressed) — images/PDFs are already compressed. */
export function buildZip(entries, now = new Date()) {
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = (Math.max(0, now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const prepared = entries.map((e) => {
    const data = typeof e.data === "string" ? enc.encode(e.data) : e.data;
    return { name: enc.encode(e.name), data, crc: crc32(data) };
  });

  let size = 22;
  for (const p of prepared) size += 30 + p.name.length + p.data.length + 46 + p.name.length;
  if (size > 0xffffffff || prepared.length > 0xffff) throw new Error("Export quá lớn cho một file zip (>4GB)");

  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  let pos = 0;
  const u16 = (v) => { dv.setUint16(pos, v, true); pos += 2; };
  const u32 = (v) => { dv.setUint32(pos, v, true); pos += 4; };

  const offsets = [];
  for (const p of prepared) {
    offsets.push(pos);
    u32(0x04034b50); u16(20); u16(0x0800); u16(0); u16(time); u16(date);
    u32(p.crc); u32(p.data.length); u32(p.data.length); u16(p.name.length); u16(0);
    out.set(p.name, pos); pos += p.name.length;
    out.set(p.data, pos); pos += p.data.length;
  }
  const cdStart = pos;
  prepared.forEach((p, i) => {
    u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0); u16(time); u16(date);
    u32(p.crc); u32(p.data.length); u32(p.data.length); u16(p.name.length);
    u16(0); u16(0); u16(0); u16(0); u32(0); u32(offsets[i]);
    out.set(p.name, pos); pos += p.name.length;
  });
  const cdSize = pos - cdStart;
  u32(0x06054b50); u16(0); u16(0); u16(prepared.length); u16(prepared.length); u32(cdSize); u32(cdStart); u16(0);
  return out;
}

// ------------------------------------------------------------------- build

export const exportStamp = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

/**
 * Build an export. format: "md" | "json" | "zip".
 * Returns { filename, mime, data (string | Uint8Array), stats }.
 */
export async function buildExport(notes, { format, fetchImpl, onProgress, now = new Date() } = {}) {
  const live = (notes || []).filter((n) => !n.isDeleted);
  const days = groupByDate(live);
  const stats = { notes: live.length, days: days.length, files: 0, failed: [] };
  const stamp = exportStamp(now);

  if (format === "md") {
    return { filename: `notaion-daily-${stamp}.md`, mime: "text/markdown", data: allNotesToMarkdown(live), stats };
  }
  if (format === "json") {
    return { filename: `notaion-daily-${stamp}.json`, mime: "application/json", data: notesToJson(live, now), stats };
  }
  if (format !== "zip") throw new Error(`Định dạng export không hỗ trợ: ${format}`);

  const media = collectMedia(live);
  onProgress?.({ phase: "files", done: 0, total: media.length });
  const { files, urlToPath, failed } = await downloadMedia(media, { fetchImpl, onProgress });
  stats.files = files.length;
  stats.failed = failed;

  // Notes live in notes/, attachments in attachments/ → "../attachments/…".
  const mapUrl = (u) => (urlToPath.has(u) ? `../${urlToPath.get(u)}` : u);
  const entries = [
    { name: "notes.json", data: notesToJson(live, now) },
    ...days.map(([d, list]) => ({ name: `notes/${d}.md`, data: notesToMarkdown(d, list, mapUrl) })),
    ...files,
  ];
  if (failed.length) {
    entries.push({
      name: "download-errors.txt",
      data: `Các file sau không tải được; ghi chú vẫn giữ link gốc:\n\n${failed.map((f) => `${f.url}\n  ${f.error}`).join("\n")}\n`,
    });
  }
  onProgress?.({ phase: "zip" });
  return { filename: `notaion-daily-${stamp}.zip`, mime: "application/zip", data: buildZip(entries, now), stats };
}
