// Local-first note store.
//  - Every day view is served instantly from localStorage, then revalidated.
//  - Writes go to an outbox first (survives restarts/offline), and a single
//    flusher drains it to the API in order.
import { AuthError } from "./api.js";
import { mergeDay } from "./notes.js";
import { uploadAttachments } from "./attachments.js";

const K = {
  day: (d) => `nd:day:${d}`,
  dayIndex: "nd:days",
  outbox: "nd:outbox",
  all: "nd:all",
};
const MAX_CACHED_DAYS = 60;
const RETRY_MS = 10_000;

// Search index only needs text fields; keep heavy blobs out of storage.
const slim = ({ id, title, content, date, timestamp, category, isCompleted, isDeleted }) => ({
  id, title, content, date, timestamp, category, isCompleted, isDeleted,
});

export function createStore({ api, storage = globalThis.localStorage, onAuthError = () => {} }) {
  const listeners = new Set();
  let status = "idle"; // idle | syncing | offline | error
  let lastError = "";
  let flushing = null;
  let retryTimer = null;
  // Every local write gets a sequence number. A GET that was in flight while
  // a write happened may return the pre-write server copy (the write's POST
  // can finish and leave the outbox before the GET response lands), so those
  // writes are re-applied over the response instead of being reverted.
  let writeSeq = 0;
  const recentWrites = new Map(); // id -> { seq, entry }

  const read = (key, fallback) => {
    try {
      const v = storage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota — cache is best-effort */
    }
  };

  const emit = () => listeners.forEach((fn) => fn());
  const setStatus = (s, err = "") => {
    status = s;
    lastError = err;
    emit();
  };

  const outbox = () => read(K.outbox, {});
  const pendingCount = () => Object.keys(outbox()).length;

  function cacheDay(date, notes) {
    write(K.day(date), notes);
    const days = read(K.dayIndex, []).filter((d) => d !== date);
    days.unshift(date);
    for (const old of days.splice(MAX_CACHED_DAYS)) storage.removeItem(K.day(old));
    write(K.dayIndex, days);
  }

  /** Cached + pending view of a day. Synchronous — used for instant paint. */
  const peekDay = (date) => mergeDay(read(K.day(date), []), outbox(), date);
  const hasDayCache = (date) => storage.getItem(K.day(date)) !== null;

  // Reads surface auth failures the same way the flusher does.
  const get = (path) =>
    api("GET", path).catch((err) => {
      if (err instanceof AuthError) onAuthError(err);
      throw err;
    });

  // Re-apply local writes made after `sinceSeq` onto a server list for `date`.
  function overlayRecent(notes, date, sinceSeq) {
    const byId = new Map(notes.map((n) => [n.id, n]));
    for (const [id, { seq, entry }] of recentWrites) {
      if (seq <= sinceSeq) continue;
      if (entry.op === "delete" || entry.note.date !== date) byId.delete(id);
      else byId.set(id, entry.note);
    }
    return [...byId.values()];
  }

  async function fetchDay(date) {
    const since = writeSeq;
    const notes = overlayRecent((await get(`/api/DailyNote/${date}`)) || [], date, since);
    cacheDay(date, notes);
    return mergeDay(notes, outbox(), date);
  }

  // Apply a confirmed server write to the cached day lists.
  function applyToCache(entry) {
    if (entry.op === "upsert") {
      const n = entry.note;
      for (const d of read(K.dayIndex, [])) {
        const list = read(K.day(d), []);
        const had = list.some((x) => x.id === n.id);
        if (d === n.date) write(K.day(d), had ? list.map((x) => (x.id === n.id ? n : x)) : [...list, n]);
        else if (had) write(K.day(d), list.filter((x) => x.id !== n.id));
      }
    } else {
      const list = read(K.day(entry.date), []);
      write(K.day(entry.date), list.filter((x) => x.id !== entry.id));
    }
    const all = read(K.all, null);
    if (all) {
      const rest = all.filter((x) => x.id !== (entry.note?.id ?? entry.id));
      write(K.all, entry.op === "upsert" ? [...rest, slim(entry.note)] : rest);
    }
  }

  function enqueue(entry) {
    const id = entry.note?.id ?? entry.id;
    recentWrites.delete(id);
    recentWrites.set(id, { seq: ++writeSeq, entry });
    if (recentWrites.size > 200) recentWrites.delete(recentWrites.keys().next().value);
    const box = outbox();
    box[id] = entry;
    write(K.outbox, box);
    emit();
    scheduleFlush(0);
  }

  function scheduleFlush(ms) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => flush(), ms);
  }

  async function flushOnce() {
    for (;;) {
      const box = outbox();
      const ids = Object.keys(box);
      if (!ids.length) break;
      const id = ids[0];
      const entry = box[id];
      setStatus("syncing");
      if (entry.op === "upsert") await api("POST", "/api/DailyNote", entry.note);
      else await api("DELETE", `/api/DailyNote/${entry.id}`);
      applyToCache(entry);
      // Only drop the entry if it was not superseded while the request ran.
      const latest = outbox();
      if (JSON.stringify(latest[id]) === JSON.stringify(entry)) {
        delete latest[id];
        write(K.outbox, latest);
      }
    }
    setStatus("idle");
  }

  function flush() {
    if (flushing) return flushing;
    flushing = flushOnce()
      .catch((err) => {
        if (err instanceof AuthError) {
          setStatus("error", err.message);
          onAuthError(err);
        } else {
          setStatus("offline", err.message);
          scheduleFlush(RETRY_MS);
        }
      })
      .finally(() => {
        flushing = null;
      });
    return flushing;
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getStatus: () => ({ status, lastError, pending: pendingCount() }),
    peekDay,
    hasDayCache,
    fetchDay,
    flush,

    save(note) {
      enqueue({ op: "upsert", note: { ...note, updatedAt: new Date().toISOString() } });
    },
    remove(note) {
      enqueue({ op: "delete", id: note.id, date: note.date });
    },

    /** Search corpus: cached slim copy of every note, merged with pending writes. */
    peekAll() {
      const all = new Map((read(K.all, []) || []).map((n) => [n.id, n]));
      for (const e of Object.values(outbox())) {
        if (e.op === "delete") all.delete(e.id);
        else all.set(e.note.id, slim(e.note));
      }
      return [...all.values()];
    },
    async fetchAll() {
      const notes = ((await get("/api/DailyNote/all")) || []).filter((n) => !n.isDeleted);
      write(K.all, notes.map(slim));
      return this.peekAll();
    },

    /** Upload files (online only) → web-compatible attachment entries. */
    upload(files) {
      return uploadAttachments(api, files).catch((err) => {
        if (err instanceof AuthError) onAuthError(err);
        throw err;
      });
    },

    clear() {
      for (const d of read(K.dayIndex, [])) storage.removeItem(K.day(d));
      [K.dayIndex, K.outbox, K.all].forEach((k) => storage.removeItem(k));
      emit();
    },
  };
}
