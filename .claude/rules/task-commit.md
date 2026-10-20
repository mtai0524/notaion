---
description: Propose a commit message when a task that changed files is done
---

# Commit proposal at the end of a task

- When a task changed files, end the reply with a proposed commit message in a code block, ready to copy, following the `commit-message` skill (Conventional Commits, English, no `Co-Authored-By`).
- Cover only the files this task touched. Separate changes get separate proposed commits, each with its file list.
- Propose only: do not run `git commit` or `git push` unless the user asks.
