---
name: refactor-safe
description: Refactor without changing behavior, in small verified steps. Use when the user asks to refactor, clean up, restructure, rename, or extract code.
---

# Safe refactor

1. **Baseline**: run the existing tests first. If there are none for the code being touched, add a minimal characterization test that pins current behavior; if the project has no test setup, build it and note the behavior you must keep.
2. **Small steps**: one mechanical change at a time (rename, extract, inline, move). Run tests after each step.
3. **Same behavior**: no feature changes, no bug fixes mixed in. If you find a bug, note it and fix it in a separate commit.
4. **Keep the guards**: moved or merged code keeps its validation and error handling.
5. **Update every reference**: grep callers, imports, tests, config, docs.
6. **Finish**: run the full test suite (or build, without tests) and summarize what moved where.

Stop and ask if the refactor would change a public API or data format.
