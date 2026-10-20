---
name: verify
description: Build/launch/drive recipe for verifying changes to the notaion frontend at runtime (headless Chrome against the vite dev server).
---

# Verifying notaion frontend changes

## Launch

- `npm run dev` (background) — vite prints the port in its output; it is **not** 5173 (custom config, recently 2405). Grep the task output for `Local:`.
- Backend (`https://localhost:7059`) is usually NOT running in dev — API calls fail, notes come back empty. UI still renders; don't treat console network errors as findings.

## Drive (headless browser)

- No playwright/puppeteer in the repo. Install `playwright-core` in the scratchpad and launch the system Chrome:
  `chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--mute-audio'] })`.
- Default landing is `/daily-note`, which renders the TUI (the only view).

## Gotchas

- Without a backend there are no notes. Mock them with `page.route('**/api/DailyNote/**', …)` (return `[note]` for GETs, `{}` for writes) to exercise the editor and autosave.
- `addInitScript` re-runs on every navigation — it wipes localStorage state you're trying to verify persistence of. For reload/persistence probes open a **second page in the same context** (init script is page-scoped) instead of `page.reload()`.
- TUI is keyboard-driven: `T` options (Notion/Markdown format, nvim), `c` calendar, `?` help, `Esc` close. `page.keyboard.press` works.
