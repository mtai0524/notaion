# Notaion MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Node.js MCP server (`mcp-server/`) that lets Claude Code read, search, create, append to, update, and soft-delete Notaion Daily Notes over the existing backend HTTP API.

**Architecture:** A stdio MCP server using `@modelcontextprotocol/sdk`. An `auth` module signs in with email/password and caches a JWT; an `api` wrapper adds the Bearer token and re-signs-in once on 401; a `dailyNote` tools module holds pure handler functions the server registers as MCP tools. Tool logic is unit-tested with a mocked `fetch` — no live backend in tests.

**Tech Stack:** Node 18+ (global `fetch`, `node:crypto`), `@modelcontextprotocol/sdk`, `zod`, `vitest`.

## Global Constraints

- Backend base URL default: `https://notaion.runasp.net`; override via `NOTAION_API_URL`.
- Auth via `POST /api/account/SignIn` with body `{ email, username, password }` → response `{ token }` (JWT). Header on calls: `Authorization: Bearer <token>`.
- Credentials from env: `NOTAION_EMAIL`, `NOTAION_PASSWORD`. Missing either → fail fast at startup.
- The package is ESM (`"type": "module"`); use `import`.
- All dates use `yyyy-MM-dd`. "Today" = local time when a `date` arg is omitted.
- Do not modify the frontend or its `package.json`. All new files live under `mcp-server/`.
- `create_daily_note` category default: `LOG`. Surfaced category enum: `TASK`, `LOG`, `SYSTEM` (free-form string still accepted).
- Note lookup by id (append/update/delete-context) uses `GET /api/DailyNote/all` then finds by `id`.
- Backend `POST /api/DailyNote` upserts by `id` (used for create, append, update).

---

## File Structure

```
mcp-server/
  package.json          # ESM, deps, bin, test script
  vitest.config.js      # node environment
  src/
    config.js           # reads env, exposes { apiUrl, email, password }
    auth.js             # createAuth(config, fetchImpl) -> { getToken, invalidate }
    api.js              # createApi({ apiUrl, auth, fetchImpl }) -> apiFetch
    dates.js            # todayKey(), nowTime()
    tools/dailyNote.js  # pure handlers + zod shapes + buildNotePayload
    index.js            # McpServer wiring, registers tools, stdio transport
  src/auth.test.js
  src/api.test.js
  src/tools/dailyNote.test.js
  README.md             # install into Claude Code
```

---

## Task 1: Package scaffold + config + date helpers

**Files:**
- Create: `mcp-server/package.json`
- Create: `mcp-server/vitest.config.js`
- Create: `mcp-server/src/config.js`
- Create: `mcp-server/src/dates.js`
- Test: `mcp-server/src/dates.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `config.js`: `loadConfig(env = process.env)` → `{ apiUrl: string, email: string, password: string }`. Throws `Error` if `NOTAION_EMAIL` or `NOTAION_PASSWORD` missing.
  - `dates.js`: `todayKey(d = new Date())` → `"yyyy-MM-dd"` (local); `nowTime(d = new Date())` → `"HH:mm:ss"` (local).

- [ ] **Step 1: Create the package**

`mcp-server/package.json`:
```json
{
  "name": "notaion-mcp-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "notaion-mcp": "src/index.js" },
  "scripts": {
    "start": "node src/index.js",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run (from `mcp-server/`):
```bash
cd mcp-server && npm install @modelcontextprotocol/sdk zod && npm install -D vitest
```
Expected: dependencies added to `package.json`, `node_modules/` created.

- [ ] **Step 3: Create vitest config**

`mcp-server/vitest.config.js`:
```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node" },
});
```

- [ ] **Step 4: Write the failing test for date helpers**

`mcp-server/src/dates.test.js`:
```js
import { describe, it, expect } from "vitest";
import { todayKey, nowTime } from "./dates.js";

describe("dates", () => {
  it("formats a date as yyyy-MM-dd in local time", () => {
    const d = new Date(2026, 6, 24, 9, 5, 3); // 2026-07-24 09:05:03 local
    expect(todayKey(d)).toBe("2026-07-24");
  });

  it("zero-pads single-digit month and day", () => {
    const d = new Date(2026, 0, 4, 0, 0, 0); // 2026-01-04
    expect(todayKey(d)).toBe("2026-01-04");
  });

  it("formats time as HH:mm:ss zero-padded", () => {
    const d = new Date(2026, 6, 24, 9, 5, 3);
    expect(nowTime(d)).toBe("09:05:03");
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run src/dates.test.js`
Expected: FAIL — cannot find module `./dates.js`.

- [ ] **Step 6: Implement date helpers**

`mcp-server/src/dates.js`:
```js
const pad = (n) => String(n).padStart(2, "0");

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowTime(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
```

- [ ] **Step 7: Implement config**

`mcp-server/src/config.js`:
```js
export function loadConfig(env = process.env) {
  const email = env.NOTAION_EMAIL;
  const password = env.NOTAION_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Missing credentials: set NOTAION_EMAIL and NOTAION_PASSWORD in the MCP server env."
    );
  }
  return {
    apiUrl: env.NOTAION_API_URL || "https://notaion.runasp.net",
    email,
    password,
  };
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run src/dates.test.js`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add mcp-server/package.json mcp-server/package-lock.json mcp-server/vitest.config.js mcp-server/src/config.js mcp-server/src/dates.js mcp-server/src/dates.test.js
git commit -m "feat(mcp): scaffold notaion mcp-server package with config and date helpers"
```

---

## Task 2: Auth module (signin + JWT cache + invalidate)

**Files:**
- Create: `mcp-server/src/auth.js`
- Test: `mcp-server/src/auth.test.js`

**Interfaces:**
- Consumes: `loadConfig` output shape `{ apiUrl, email, password }`.
- Produces: `createAuth({ apiUrl, email, password }, fetchImpl = fetch)` → object with:
  - `async getToken()` → returns cached JWT string, signing in on first call.
  - `invalidate()` → clears the cached token (next `getToken()` re-signs-in).
  - Sign-in: `POST {apiUrl}/api/account/SignIn`, JSON body `{ email, username: email, password }`, expects `{ token }`. Non-2xx → throws `Error` with status.

- [ ] **Step 1: Write the failing test**

`mcp-server/src/auth.test.js`:
```js
import { describe, it, expect, vi } from "vitest";
import { createAuth } from "./auth.js";

const cfg = { apiUrl: "https://api.test", email: "u@test.io", password: "pw" };

function okSignIn(token = "jwt-1") {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ token }),
  });
}

describe("createAuth", () => {
  it("signs in once and caches the token", async () => {
    const fetchImpl = okSignIn("jwt-1");
    const auth = createAuth(cfg, fetchImpl);

    expect(await auth.getToken()).toBe("jwt-1");
    expect(await auth.getToken()).toBe("jwt-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.test/api/account/SignIn");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({
      email: "u@test.io",
      username: "u@test.io",
      password: "pw",
    });
  });

  it("re-signs-in after invalidate", async () => {
    const fetchImpl = okSignIn("jwt-1");
    const auth = createAuth(cfg, fetchImpl);
    await auth.getToken();
    auth.invalidate();
    await auth.getToken();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws on non-2xx signin", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "bad creds",
    });
    const auth = createAuth(cfg, fetchImpl);
    await expect(auth.getToken()).rejects.toThrow(/401/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run src/auth.test.js`
Expected: FAIL — cannot find module `./auth.js`.

- [ ] **Step 3: Implement auth**

`mcp-server/src/auth.js`:
```js
export function createAuth(config, fetchImpl = fetch) {
  let token = null;

  async function signIn() {
    const res = await fetchImpl(`${config.apiUrl}/api/account/SignIn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: config.email,
        username: config.email,
        password: config.password,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`SignIn failed (${res.status}): ${body}`);
    }
    const data = await res.json();
    if (!data?.token) throw new Error("SignIn response missing token");
    token = data.token;
    return token;
  }

  return {
    async getToken() {
      if (token) return token;
      return signIn();
    },
    invalidate() {
      token = null;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run src/auth.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/auth.js mcp-server/src/auth.test.js
git commit -m "feat(mcp): add auth module with signin and jwt cache"
```

---

## Task 3: API wrapper (authed fetch + 401 retry)

**Files:**
- Create: `mcp-server/src/api.js`
- Test: `mcp-server/src/api.test.js`

**Interfaces:**
- Consumes: an `auth` object with `getToken()` and `invalidate()` (from Task 2).
- Produces: `createApi({ apiUrl, auth }, fetchImpl = fetch)` → `async apiFetch(method, path, body?)`:
  - Sends `{apiUrl}{path}` with `Authorization: Bearer <token>`, JSON content-type, `body` JSON-stringified when provided.
  - On `401`: calls `auth.invalidate()`, gets a fresh token, retries the request exactly once.
  - Success (2xx): returns parsed JSON, or `null` when the response body is empty.
  - Non-2xx (after any retry): throws `Error` with `HTTP <status>: <body>`.

- [ ] **Step 1: Write the failing test**

`mcp-server/src/api.test.js`:
```js
import { describe, it, expect, vi } from "vitest";
import { createApi } from "./api.js";

function jsonRes(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (data === undefined ? "" : JSON.stringify(data)),
  };
}

function fakeAuth(tokens = ["t1", "t2"]) {
  let i = 0;
  return {
    getToken: vi.fn(async () => tokens[Math.min(i, tokens.length - 1)]),
    invalidate: vi.fn(() => { i += 1; }),
  };
}

describe("createApi", () => {
  it("attaches bearer token and returns parsed json", async () => {
    const auth = fakeAuth();
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200, [{ id: "a" }]));
    const api = createApi({ apiUrl: "https://api.test", auth }, fetchImpl);

    const out = await api("GET", "/api/DailyNote/all");
    expect(out).toEqual([{ id: "a" }]);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.test/api/DailyNote/all");
    expect(opts.headers.Authorization).toBe("Bearer t1");
  });

  it("retries once on 401 with a refreshed token", async () => {
    const auth = fakeAuth(["t1", "t2"]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRes(401, "expired"))
      .mockResolvedValueOnce(jsonRes(200, { ok: true }));
    const api = createApi({ apiUrl: "https://api.test", auth }, fetchImpl);

    const out = await api("POST", "/api/DailyNote", { id: "x" });
    expect(out).toEqual({ ok: true });
    expect(auth.invalidate).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe("Bearer t2");
  });

  it("returns null on empty body", async () => {
    const auth = fakeAuth();
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200));
    const api = createApi({ apiUrl: "https://api.test", auth }, fetchImpl);
    expect(await api("DELETE", "/api/DailyNote/x")).toBeNull();
  });

  it("throws on non-2xx after retry", async () => {
    const auth = fakeAuth();
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(500, "boom"));
    const api = createApi({ apiUrl: "https://api.test", auth }, fetchImpl);
    await expect(api("GET", "/api/DailyNote/all")).rejects.toThrow(/HTTP 500/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run src/api.test.js`
Expected: FAIL — cannot find module `./api.js`.

- [ ] **Step 3: Implement api wrapper**

`mcp-server/src/api.js`:
```js
export function createApi({ apiUrl, auth }, fetchImpl = fetch) {
  async function doFetch(method, path, body, token) {
    return fetchImpl(`${apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  return async function apiFetch(method, path, body) {
    let token = await auth.getToken();
    let res = await doFetch(method, path, body, token);

    if (res.status === 401) {
      auth.invalidate();
      token = await auth.getToken();
      res = await doFetch(method, path, body, token);
    }

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return text ? JSON.parse(text) : null;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run src/api.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/api.js mcp-server/src/api.test.js
git commit -m "feat(mcp): add authed api wrapper with 401 retry"
```

---

## Task 4: Daily Note tool handlers

**Files:**
- Create: `mcp-server/src/tools/dailyNote.js`
- Test: `mcp-server/src/tools/dailyNote.test.js`

**Interfaces:**
- Consumes: `apiFetch(method, path, body?)` (from Task 3); `todayKey`, `nowTime` (Task 1).
- Produces (all take `(api, input)` and return a plain JS value; `api` is the `apiFetch` function):
  - `buildNotePayload({ title, content, category, date })` → full note object (pure; `randomUuid` injectable for tests via 2nd arg `deps = { uuid, now }`).
  - `listDailyNotes(api, { date })` → array of active notes for the date.
  - `searchDailyNotes(api, { query, limit })` → array of matching notes (title/content, case-insensitive), capped at `limit`.
  - `createDailyNote(api, { title, content, category, date })` → the created note object.
  - `appendToDailyNote(api, { id, text })` → the updated note object.
  - `updateDailyNote(api, { id, title, content, category, deadline })` → the updated note object.
  - `deleteDailyNote(api, { id })` → `{ id, deleted: true }`.
  - `findNoteById(api, id)` → note object; throws `Error("Daily note not found: <id>")` if absent.
  - Exported `schemas` object: zod raw shapes keyed by tool name (for Task 5 registration).

- [ ] **Step 1: Write the failing test**

`mcp-server/src/tools/dailyNote.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run src/tools/dailyNote.test.js`
Expected: FAIL — cannot find module `./dailyNote.js`.

- [ ] **Step 3: Implement the tool handlers**

`mcp-server/src/tools/dailyNote.js`:
```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp-server && npx vitest run src/tools/dailyNote.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/dailyNote.js mcp-server/src/tools/dailyNote.test.js
git commit -m "feat(mcp): add daily note tool handlers and schemas"
```

---

## Task 5: Server wiring + README

**Files:**
- Create: `mcp-server/src/index.js`
- Create: `mcp-server/README.md`

**Interfaces:**
- Consumes: `loadConfig` (Task 1), `createAuth` (Task 2), `createApi` (Task 3), all handlers + `schemas` (Task 4).
- Produces: an executable stdio MCP server registering the six tools. No new exports.

- [ ] **Step 1: Implement the server entry**

`mcp-server/src/index.js`:
```js
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createAuth } from "./auth.js";
import { createApi } from "./api.js";
import {
  schemas,
  listDailyNotes,
  searchDailyNotes,
  createDailyNote,
  appendToDailyNote,
  updateDailyNote,
  deleteDailyNote,
} from "./tools/dailyNote.js";

const config = loadConfig();
const auth = createAuth(config);
const api = createApi({ apiUrl: config.apiUrl, auth });

const server = new McpServer({ name: "notaion", version: "0.1.0" });

function register(name, description, shape, handler) {
  server.tool(name, description, shape, async (args) => {
    try {
      const result = await handler(api, args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  });
}

register("list_daily_notes", "List Daily Notes for a date (defaults to today).", schemas.list_daily_notes, listDailyNotes);
register("search_daily_notes", "Search Daily Notes by keyword in title or content.", schemas.search_daily_notes, searchDailyNotes);
register("create_daily_note", "Create a new Daily Note sticky card.", schemas.create_daily_note, createDailyNote);
register("append_to_daily_note", "Append text to an existing Daily Note's content.", schemas.append_to_daily_note, appendToDailyNote);
register("update_daily_note", "Update fields of an existing Daily Note.", schemas.update_daily_note, updateDailyNote);
register("delete_daily_note", "Soft-delete a Daily Note (moves it to trash).", schemas.delete_daily_note, deleteDailyNote);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: Verify the server starts and lists tools**

Run (from `mcp-server/`):
```bash
cd mcp-server && NOTAION_EMAIL=x NOTAION_PASSWORD=y node -e "import('./src/index.js').then(()=>{console.error('started');process.exit(0)})"
```
Expected: prints `started` with no throw (startup wiring is valid; no network call happens until a tool runs).

Note: if the SDK's `server.tool` signature differs in the installed version, adapt the `register` helper to match the installed `@modelcontextprotocol/sdk` API (check `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts`). The four-arg `(name, description, zodRawShape, handler)` form is the target.

- [ ] **Step 3: Write the README**

`mcp-server/README.md`:
```markdown
# Notaion MCP Server

Exposes your Notaion **Daily Notes** to Claude Code as MCP tools:
`list_daily_notes`, `search_daily_notes`, `create_daily_note`,
`append_to_daily_note`, `update_daily_note`, `delete_daily_note`.

## Requirements
- Node 18+
- A Notaion account (email + password)

## Install
```bash
cd mcp-server
npm install
```

## Configure

Environment variables:
- `NOTAION_EMAIL` (required)
- `NOTAION_PASSWORD` (required)
- `NOTAION_API_URL` (optional, default `https://notaion.runasp.net`)

## Register with Claude Code

Option A — CLI:
```bash
claude mcp add notaion \
  --env NOTAION_EMAIL=you@example.com \
  --env NOTAION_PASSWORD=yourpassword \
  -- node /ABSOLUTE/PATH/notaion/mcp-server/src/index.js
```

Option B — `.mcp.json`:
```json
{
  "mcpServers": {
    "notaion": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/notaion/mcp-server/src/index.js"],
      "env": {
        "NOTAION_EMAIL": "you@example.com",
        "NOTAION_PASSWORD": "yourpassword"
      }
    }
  }
}
```

Restart Claude Code, then try: "list my daily notes for today".

## Test
```bash
npm test
```
```

- [ ] **Step 4: Run the full test suite**

Run: `cd mcp-server && npm test`
Expected: all tests across `dates`, `auth`, `api`, `dailyNote` PASS.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/index.js mcp-server/README.md
git commit -m "feat(mcp): wire stdio server, register daily note tools, add README"
```

---

## Task 6: Live smoke test (manual)

**Files:** none (manual verification).

**Interfaces:** Consumes the completed server.

- [ ] **Step 1: Register locally**

Run (replace path + real creds):
```bash
claude mcp add notaion --env NOTAION_EMAIL=you@example.com --env NOTAION_PASSWORD=yourpw -- node "$(pwd)/mcp-server/src/index.js"
```

- [ ] **Step 2: Verify read path**

In Claude Code: ask "list my daily notes for today".
Expected: returns the same notes visible in the Notaion web app for today (or an empty list if none).

- [ ] **Step 3: Verify write path**

Ask Claude Code to create a note titled "MCP smoke test" with content "hello from claude code".
Expected: the note appears in the Notaion web app under today's date after refresh.

- [ ] **Step 4: Clean up**

Delete the smoke-test note (via `delete_daily_note` or the web app).

---

## Self-Review Notes

- **Spec coverage:** auth (Task 2), api wrapper w/ 401 retry (Task 3), all 6 tools + payload defaults + search/append semantics (Task 4), stdio wiring + registration docs (Task 5), vitest tests (Tasks 1–4), live success criteria (Task 6). All spec sections mapped.
- **Type consistency:** `api` = the `apiFetch` function throughout; handlers are `(api, input[, deps])`; `schemas` keys match registered tool names in Task 5.
- **No live backend in unit tests:** every test injects a mocked `fetch` or a mock `api`.
