---
description: Testing standards for test files
paths:
  - "tests/**"
  - "**/*.test.*"
  - "**/*.spec.*"
---

# Testing

- Test behavior, not implementation details. Test the public API of a module, not its internals.
- One clear assertion per test; name the test after what it proves.
- Group related tests with `describe`; one case per `it`/`test`.
- Prefer real dependencies over mocks. Mock only external services (HTTP APIs, databases, clocks).
- Every bug fix includes a regression test that fails without the fix.
- Run the full test suite before marking a task complete (see Commands in CLAUDE.md).
