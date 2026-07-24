# Notaion MCP Server — Design Spec

**Date:** 2026-07-24
**Status:** Approved, ready for planning

## Overview

Build a standalone MCP (Model Context Protocol) server that exposes Notaion's
Daily Note feature to Claude Code. This lets Claude Code read, search, create,
append to, update, and soft-delete the user's Daily Notes directly from the
terminal — for example logging work just done into today's note, or reading
today's TODO cards for context.

The server is a thin HTTP client over the existing Notaion ASP.NET Core backend
(`https://notaion.runasp.net`). It adds no backend changes.

## Scope

**In scope (v1):** Daily Note only.

**Out of scope (v1):** Notion-style Pages (`/api/Page`), Items, chat, files,
analytics. A future v2 may add Pages using the same tool pattern.

## Architecture

- Standalone Node.js package in `mcp-server/` inside this repo. Independent
  `package.json`; does not touch the frontend build.
- Uses `@modelcontextprotocol/sdk` with **stdio** transport (the standard for a
  local Claude Code MCP server).
- Node 18+ (global `fetch`, `crypto.randomUUID()`). `zod` for tool input schemas.
- The server is a normal Node process, so `Date` is available for "today"
  resolution (local time).

### File structure

```
mcp-server/
  package.json          # deps (@modelcontextprotocol/sdk, zod) + bin entry
  src/
    index.js            # create server, register tools, connect stdio
    auth.js             # signin + in-memory JWT cache + 401 retry
    api.js              # authed fetch wrapper (adds Bearer, base URL)
    tools/dailyNote.js  # the 6 tools below
  README.md             # install into Claude Code (claude mcp add / .mcp.json)
  src/*.test.js         # vitest unit tests
```

## Authentication (`src/auth.js`)

- Reads `NOTAION_EMAIL` / `NOTAION_PASSWORD` from environment.
- Calls `POST /api/account/SignIn` to obtain a JWT, cached in memory.
- On any `401` response, re-runs SignIn once and retries the original request.
- `NOTAION_API_URL` env overrides the backend base URL (default:
  `https://notaion.runasp.net`).
- Missing credentials → the server fails fast at startup with a clear message.

## API wrapper (`src/api.js`)

- `apiFetch(method, path, body?)` — prefixes base URL, attaches
  `Authorization: Bearer <jwt>`, sets JSON headers, parses JSON, and delegates
  to `auth.js` for the 401 re-signin retry.

## Tools (`src/tools/dailyNote.js`)

All dates use `yyyy-MM-dd`. "Today" is resolved from local time when `date` is
omitted.

| Tool | Purpose | Inputs | Backend call |
|------|---------|--------|--------------|
| `list_daily_notes` | List notes for a date | `date?` | `GET /api/DailyNote/{date}` |
| `search_daily_notes` | Keyword search across all notes | `query`, `limit?` (default 20) | `GET /api/DailyNote/all` + client-side filter on title/content |
| `create_daily_note` | Create a sticky note | `title`, `content`, `category?`, `date?` | `POST /api/DailyNote` |
| `append_to_daily_note` | Append text to an existing note's content | `id`, `text` | read note, then `POST /api/DailyNote` (upsert) |
| `update_daily_note` | Edit fields | `id`, `title?`, `content?`, `category?`, `deadline?` | read note, merge, `POST /api/DailyNote` |
| `delete_daily_note` | Soft delete (to trash) | `id` | `DELETE /api/DailyNote/{id}` |

### Note payload shape (create/update)

`create_daily_note` builds the full DailyNote object the backend expects, using
sensible defaults so the caller only supplies content-level fields:

- `id`: `crypto.randomUUID()`
- `title`, `content`, `category` (default `LOG`), `date`
- `color`: default note color; `timestamp`: `HH:mm:ss` now
- Layout defaults matching the frontend: `x`, `y` (cascade offset),
  `width` 280, `height` 200, `zIndex`, `fontSize` `0.85rem`, `opacity` 1,
  `borderStyle` 0, `isMinimized` false, `isCompleted` false
- `deadline` null, `reminderLeadMinutes` null, `reminderDone` false
- `updatedAt`: ISO now

`append_to_daily_note` / `update_daily_note` read the existing note (via the
note's date, obtained from the note object), merge the change, bump `updatedAt`,
and re-`POST` (the backend `POST /api/DailyNote` upserts by id).

Category enum surfaced to the model: `TASK`, `LOG`, `SYSTEM` (free-form string
still accepted).

## Error handling

- Auth failure (bad creds): fail fast at startup with actionable message.
- Backend `4xx/5xx`: tool returns an MCP error result with status + body text,
  not a thrown crash — Claude Code shows it to the user.
- `append`/`update` on a missing id: return a clear "note not found" error.

## Registering with Claude Code

README documents both:

1. `claude mcp add notaion --env NOTAION_EMAIL=... --env NOTAION_PASSWORD=... -- node <abs-path>/mcp-server/src/index.js`
2. A `.mcp.json` snippet with the `notaion` server entry and env block.

## Testing

Uses `vitest` (already in the repo). Unit tests with `fetch` mocked:

- `auth.js`: SignIn success caches token; 401 triggers exactly one re-signin +
  retry; missing env fails fast.
- `create_daily_note`: maps inputs → correct backend payload shape (id present,
  defaults applied, date defaults to today).
- `append_to_daily_note`: merges appended text onto existing content.
- `search_daily_notes`: filters by keyword and respects `limit`.

No live backend calls in tests.

## Success criteria

- `claude mcp add` registers the server; `list_daily_notes` returns today's
  notes for the authenticated account.
- Creating a note via Claude Code makes it appear in the Notaion web app for
  the same date.
- All unit tests pass; `npm run lint` clean for the new package.
