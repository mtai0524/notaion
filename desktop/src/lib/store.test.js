import { describe, it, expect, vi } from "vitest";
import { createStore } from "./store.js";
import { AuthError } from "./api.js";

const memStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};
const note = (id, extra = {}) => ({ id, date: "2026-09-24", title: id, content: "", timestamp: "09:00", ...extra });

describe("store", () => {
  it("serves cached day instantly, then revalidates from the API", async () => {
    const storage = memStorage();
    const api = vi.fn().mockResolvedValue([note("a")]);
    const s = createStore({ api, storage });
    expect(s.peekDay("2026-09-24")).toEqual([]);
    await s.fetchDay("2026-09-24");
    expect(api).toHaveBeenCalledWith("GET", "/api/DailyNote/2026-09-24");
    // A fresh store (app restart) paints from cache without network.
    const s2 = createStore({ api: vi.fn(), storage });
    expect(s2.peekDay("2026-09-24").map((n) => n.id)).toEqual(["a"]);
  });

  it("queues writes, flushes them, and keeps them while offline", async () => {
    const storage = memStorage();
    let online = false;
    const api = vi.fn(async (method) => {
      if (!online) throw new Error("network down");
      return method === "GET" ? [] : null;
    });
    const s = createStore({ api, storage });
    s.save(note("a", { title: "draft" }));
    await s.flush();
    expect(s.getStatus()).toMatchObject({ status: "offline", pending: 1 });
    // Pending write is visible in the day view even though the server has nothing.
    expect(s.peekDay("2026-09-24")[0].title).toBe("draft");

    online = true;
    await s.flush();
    expect(s.getStatus()).toMatchObject({ status: "idle", pending: 0 });
    expect(api).toHaveBeenCalledWith("POST", "/api/DailyNote", expect.objectContaining({ id: "a", title: "draft" }));
  });

  it("does not drop a newer edit made while the older one was in flight", async () => {
    const storage = memStorage();
    let release;
    const api = vi.fn()
      .mockImplementationOnce(() => new Promise((r) => (release = r)))
      .mockResolvedValue(null);
    const s = createStore({ api, storage });
    s.save(note("a", { content: "v1" }));
    const flushing = s.flush();
    await Promise.resolve();
    s.save(note("a", { content: "v2" })); // superseding edit during request
    release(null);
    await flushing;
    await s.flush();
    const posted = api.mock.calls.map((c) => c[2]?.content);
    expect(posted).toEqual(["v1", "v2"]);
    expect(s.getStatus().pending).toBe(0);
  });

  it("delete wins over pending state and reports auth errors", async () => {
    const storage = memStorage();
    const onAuthError = vi.fn();
    const api = vi.fn().mockRejectedValue(new AuthError("expired"));
    const s = createStore({ api, storage, onAuthError });
    s.save(note("a"));
    s.remove(note("a"));
    expect(s.peekDay("2026-09-24")).toEqual([]);
    await s.flush();
    expect(onAuthError).toHaveBeenCalled();
    expect(s.getStatus()).toMatchObject({ status: "error", pending: 1 });
    await expect(s.fetchDay("2026-09-24")).rejects.toThrow("expired");
    expect(onAuthError).toHaveBeenCalledTimes(2);
  });
});

describe("store: stale reads", () => {
  it("a GET that started before a write finished does not revert that write", async () => {
    const storage = memStorage();
    let releaseGet;
    const api = vi.fn(async (method) => {
      if (method === "GET") return new Promise((r) => (releaseGet = r));
      return null; // POST succeeds immediately
    });
    const s = createStore({ api, storage });
    const fetching = s.fetchDay("2026-09-24"); // GET in flight
    await Promise.resolve();
    s.save(note("a", { content: "new text" }));
    await s.flush(); // POST done, outbox empty
    expect(s.getStatus().pending).toBe(0);
    releaseGet([note("a", { content: "old text" })]); // server copy from before the POST
    const out = await fetching;
    expect(out[0].content).toBe("new text");
    expect(s.peekDay("2026-09-24")[0].content).toBe("new text");
  });
});
