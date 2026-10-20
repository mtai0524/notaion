---
name: review-diff
description: Review the current uncommitted diff or branch diff for bugs, security, performance and unnecessary code. Use when the user asks to review changes before committing or merging.
---

# Review diff

1. Get the diff: `git diff HEAD` (uncommitted) or `git diff <default-branch>...HEAD` (branch).
2. Read surrounding code for every changed function; grep its callers.
3. Check, in this order:
   - **Correctness**: logic errors, edge cases (empty, null, boundaries), broken callers.
   - **Security**: unvalidated input at trust boundaries, injection, secrets in code, data exposure.
   - **Data loss**: missing error handling around writes, deletes, migrations.
   - **Performance**: needless loops, N+1 queries, work repeated per render/request.
   - **Bloat**: dead code, unused abstractions, code that duplicates an existing helper.
4. Report each finding as `file:line — problem — concrete fix`, sorted by severity (Critical / Major / Minor).
5. Only report real problems you can point to. If nothing is wrong, say so in one line. Do not edit files unless asked.
