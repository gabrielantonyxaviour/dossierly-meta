# Dossierly MCP server

Dossierly is a specialist caseworker for newcomers with a Polish temporary-residence case. A general-purpose agent cannot safely do this bureaucracy on its own: deadline arithmetic, KPA citations and official-letter reading need verified tooling. This server exposes those tools over the [Model Context Protocol](https://modelcontextprotocol.io) so any agent (Claude, ChatGPT, Muse when it reaches Europe, your own) can call them for the signed-in user.

- Endpoint: `POST https://dossierly.cosmiclan.com/api/mcp`
- Transport: Streamable HTTP, JSON-RPC 2.0, JSON responses (no SSE stream; `GET` returns 405, which the spec allows)
- Protocol versions: 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05

## Connect

1. Sign in to Dossierly and create a personal access token (`POST /api/mcp/tokens` with `{ "name": "Claude Desktop", "scope": "read" | "act" }`). The secret (`dsl_...`) is shown once.
2. Add the server:

```bash
claude mcp add --transport http dossierly https://dossierly.cosmiclan.com/api/mcp \
  --header "Authorization: Bearer dsl_..."
```

Any other client: HTTP transport, URL above, header `Authorization: Bearer dsl_...`. For clients that only speak stdio, bridge with `npx mcp-remote https://dossierly.cosmiclan.com/api/mcp --header "Authorization: Bearer dsl_..."`.

Manage tokens: `GET /api/mcp/tokens` lists active tokens (never secrets); `DELETE /api/mcp/tokens` with `{ "id": "mt_..." }` revokes one. Up to 10 active tokens per account.

## Tools

| Tool | Scope | What it does |
|---|---|---|
| `get_case` | read | Profile, facts with sources, open deadlines (steps + citation), appointments, open tasks, document metadata. No file bytes, no phone numbers. |
| `next_step` | read | The most urgent item, with days left and why. |
| `compute_deadline` | read | `{deliveredOn, periodDays \| periodText, rule?, quote?, legalBasis?}` to due date, human steps and verbatim KPA citations. Pure code, no model. Handles weekends, Polish holidays and awizo. |
| `read_letter` | read (`save_to_case` needs act) | `{imageUrl \| imageBase64, hint?, question?, deliveredOn?, save_to_case?}`. Muse Spark grounding + SAM 3.1 outlines (boxes in source pixels) and extracted fields; optional computed deadline and case write. |
| `explain_law` | read | `{act: "KPA" \| "Act on Foreigners", article}` to the verbatim Polish text from the official register plus a Muse Spark plain-language summary. Covered: KPA 41, 44, 57, 64; Foreigners Act 106f, 108. |
| `interpret` | read | `{text, from, to}` translation between Polish and en/uk/ru/hi/ta/zh/ja/vi via Muse Spark 1.2, with office-term glossary and an advice guard. |
| `add_task` | act | Add a to-do to the case. |
| `add_deadline` | act | Add a deadline (pass steps/rule from `compute_deadline`). |

Errors are tool results with `isError: true` and body `{ "error", "code" }` (for example `invalid_period`, `insufficient_scope`, `article_not_covered`, `rate_limited`).

## Security model

- Bearer tokens only; Dossierly stores a SHA-256 hash, never the token. Revocation is immediate.
- Scope `read` cannot write anything. Scope `act` can add tasks/deadlines and save a read letter to the case. Tokens created while the shared demo case is active are always read-only.
- A token is bound to one case (the one active when it was created). It cannot reach other users' data.
- Rate limits: 60 requests/minute per token; 30 model-backed calls/hour per token; plus the app's global model budget.
- Personal data: phone numbers and file keys are never returned; the user's name is masked before any model call.
- Guidance only: Dossierly never gives legal advice and never submits anything to a government system. Deadline output is a calculation to confirm with the office.
- `read_letter` accepts only https image URLs (no redirects), JPEG/PNG/WebP up to ~4 MB.
