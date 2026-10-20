---
name: debug-root-cause
description: Systematic debugging that finds and fixes the root cause instead of patching symptoms. Use for any bug, error, failing test, or unexpected behavior.
---

# Debug root cause

1. **Reproduce**: get the exact error, stack trace, and the smallest steps that trigger it. If you cannot reproduce it, say so before guessing.
2. **Locate**: follow the stack trace to the failing line, then read backwards to where the bad state was created.
3. **Hypothesize**: state one cause in one sentence. Verify it with a log, a test, or by reading the code. No fix before the cause is confirmed.
4. **Fix once, at the source**: grep every caller of the function you touch; fix the shared code, not each call site.
5. **Prove it**: add or run a test that failed before the fix and passes after, and re-run the related tests. No test project: build the affected project and walk through the failing case in the code.
6. **Report**: cause, fix, how it was verified — three lines.

Never: silence the error, add a blind `try/catch`, or retry without understanding why it failed.
