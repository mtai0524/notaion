---
name: changelog
description: Update CHANGELOG.md from commits since the last tag, following Keep a Changelog. Use when the user asks to update the changelog or prepare a release.
---

# Changelog

1. Find the last tag: `git describe --tags --abbrev=0` (no tag: use the full history).
2. List commits: `git log <tag>..HEAD --pretty=format:'%s'`.
3. Group Conventional Commit types into Keep a Changelog sections under `## [Unreleased]`:
   - `feat` → **Added**
   - `fix` → **Fixed**
   - `refactor`, `perf` → **Changed**
   - removals → **Removed**
   - breaking changes (`!`) → list first, prefixed with **BREAKING:**
   - skip `chore`, `ci`, `test`, `style`, `docs` unless user-visible.
4. Write for users, not developers: one line per entry, plain language.
5. Create `CHANGELOG.md` with the standard header if it does not exist. Do not touch older released sections.
