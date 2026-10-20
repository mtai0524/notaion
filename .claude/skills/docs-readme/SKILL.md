---
name: docs-readme
description: Keep README.md and project docs in sync when features, setup, or configuration change. Use after adding a feature, changing setup steps, adding env vars, or when the user asks to update docs.
---

# Docs & README

When a change affects how someone installs, runs, configures, or uses the project, update `README.md` in the same change.

README should cover, briefly:
- What the project is (1-2 sentences).
- Requirements and install steps.
- How to run, test, and build — copy-pasteable commands.
- Configuration: every env var with purpose and example value (never real secrets).
- Short usage examples for main features.

Rules:
- Edit only the sections the change affects; do not rewrite the whole file.
- Verify every command you document actually works.
- English, short sentences, no marketing language.
