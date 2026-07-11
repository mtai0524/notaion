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
- Default landing is `/daily-note` (TUI view is default via `daily-note-view-mode` = `tui`).

## Gotchas

- The pomodoro needs a selected note, unreachable without a backend. Instead seed a running timer via `page.addInitScript`:
  `localStorage['daily-note-tui-pomodoro'] = { noteId: 'seed', phase: 'focus', cycle: 1, total: 1500, remaining: 1490, running: true, savedAt: Date.now() }`
  then click `.tui-status .tui-pomo` to open the fullscreen overlay.
- `addInitScript` re-runs on every navigation — it wipes localStorage state you're trying to verify persistence of. For reload/persistence probes open a **second page in the same context** (init script is page-scoped) instead of `page.reload()`.
- TUI is keyboard-driven; overlay keys: `,` pause · `.` stop · `s` chime · `m` ambient · `Esc` close. `page.keyboard.press` works.
- Canvas activity (e.g. `.tui-pomo-wave` equalizer) is best asserted by counting non-transparent pixels via `getImageData`, not screenshots alone.
