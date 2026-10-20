---
name: branch-naming
description: Branch naming convention and the rule to branch before changing code on the default branch (main/master). Use when starting new work, creating a branch, or when about to edit code while on the default branch.
---

# Branch naming

Format: `<type>/<short-kebab-description>`

- Types match commit types: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `test/`, `hotfix/`.
- Lowercase, kebab-case, under 40 chars, no issue-less vagueness (`fix/stuff` is bad).
- Include the ticket id when there is one: `feat/KV-12-login-screen`.

Rules:
- Before changing code, check `git branch --show-current`. If on the default branch (`main` or `master`), create a branch first: `git switch -c <type>/<name>`.
- Never push the branch; the user pushes manually.
