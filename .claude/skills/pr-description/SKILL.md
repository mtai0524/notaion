---
name: pr-description
description: Draft a pull request title and description from the current branch's commits and diff. Use when the user asks for a PR, PR description, or merge request text.
---

# PR description

1. Read `git log <base>..HEAD` and `git diff <base>...HEAD` (base is the default branch, usually `main` or `master`).
2. Title: same style as a Conventional Commit summary, under 70 chars.
3. Body, fitting on one screen:

```
## Summary
- What changed, 1-3 bullets.

## Why
One or two sentences on the motivation.

## How to test
- Concrete steps or commands.

## Risks
- Breaking changes, migrations, anything reviewers must check. "None" if none.
```

Rules:
- No attribution or "Generated with" lines.
- Do not push or open the PR unless the user explicitly asks; show the draft instead.
