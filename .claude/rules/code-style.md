---
description: Universal code style rules for the entire project
---

# Code Style

- Functions should do one thing. If you need the word "and" to describe it, split it.
- Name variables after what they contain, functions after what they do.
- Keep names short and plain: `GetStudent`, `IssueMonth`, `students.ts` — not `RetrieveStudentInformationById`, `TuitionInvoiceIssuanceProcessor`, `student-management-utils.ts`.
- IMPORTANT: every asynchronous function (returns `Task`/`ValueTask` in C#, `Promise` in TypeScript) ends with `Async`: `GetStudentAsync`, `issueMonthAsync`. Synchronous functions never end with `Async`.
- Files, folders, projects, DB tables, routes and other resources also get short, plain names that match what they contain (`Payment.cs`, `api/tuition`, `Students` table).
- Don't abbreviate names: `getUserProfile`, not `getUsrProf`.
- No commented-out code — delete it; git remembers.
- Handle errors explicitly. Don't swallow exceptions or ignore error returns — log context and return a clear error.
- Keep files under 300 lines. If a file grows past that, extract a module.
- Prefer early returns over nested conditionals.
- Imports at the top, grouped: stdlib, external packages, internal modules.
