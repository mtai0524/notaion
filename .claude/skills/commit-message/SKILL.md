---
name: commit-message
description: Write git commit messages in Conventional Commits format. Use whenever creating a commit, when the user asks for a commit message, and at the end of every task that changed files (to propose the commit message).
---

# Commit message

Format: `<type>(<optional scope>): <summary>`

- Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `chore`, `build`, `ci`.
- Summary: English, imperative mood ("add", not "added"), lowercase, no trailing period, max 72 chars.
- Body (optional): blank line after the summary, explain *why*, wrap at 72 chars.
- Breaking change: add `!` after the type and a `BREAKING CHANGE:` footer.
- One logical change per commit. Stage only the files that belong to it; never `git add -A` blindly.

## When a task is done

If the task changed files, end the reply with a proposed commit, ready to copy:

```
<type>(<scope>): <summary>

<why, 1-3 lines, only if the summary is not enough>
```

- Base it on `git diff` of the files this task touched, not on unrelated changes already in the working tree.
- Changes that are really separate (e.g. a bug fix and a UI rename) get one proposed commit each, with the files for each listed under it.
- Propose only. Do not run `git commit` unless the user asks.

Rules:
- Never add `Co-Authored-By` or "Generated with" lines.
- Commit only when asked. Never `git push` unless the user explicitly asks.
