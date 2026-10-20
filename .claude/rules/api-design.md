---
description: API design standards for route handlers and endpoints
paths:
  - "src/api/**"
  - "src/routes/**"
  - "app/api/**"
  - "**/Controllers/**"
  - "**/Apis/**"
---

# API Design

- Validate every input at the boundary. Never trust raw request data.
- Consistent error shape: `{ "error": { "code": "...", "message": "..." } }`.
- Correct status codes: 201 created, 404 not found, 422 validation error.
- Keep route handlers thin — move business logic into service functions.
- Every endpoint has request/response type definitions.
- Log errors with context (request ID, user ID, endpoint). Never log tokens, passwords, or personal data.
- Rate-limit every public-facing endpoint.
