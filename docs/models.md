# Models: who does what, and why

Every Meta model call goes through `src/lib/model` (or, for the realtime voice lanes and the Wonder tool loop, a thin client over the same endpoints). Work is named by **task**, each task maps to a **role**, each role to a model and a default reasoning effort (`src/lib/config.ts`). Any role can be moved to another OpenAI-compatible host with environment variables only: `MODEL_<ROLE>_BASE_URL`, `_MODEL`, `_KEY_ENV` (the name of the variable holding the key) and `_EFFORT` (`src/lib/model/roles.ts`).

## Per job

| Job | Task → role | Model · effort | Why this model |
|---|---|---|---|
| Counter: official ↔ user interpreting (spoken lane) | voice `streamLines`, role `interpret` | Muse Spark 1.2 · minimal, streamed | Text-only and latency-bound. On the same 28 letters Spark 1.2 minimal ran a full read in 6.7 s p50 (clean images) vs 19.0 s for Spark 1.3 low ([eval.md](eval.md)); reasoning tokens dominate latency, so the prompt is kept bare (`voice/server/prompts.ts`). |
| Counter: coach card | `reason` raced with `interpret` | Spark 1.3 · low vs Spark 1.2 · minimal | The card needs case reasoning; racing keeps it on screen even when 1.3 is slow (`modes/counter-lanes.ts`). |
| Counter: documents and tasks the official asked for | `interpret`, JSON | Spark 1.2 · minimal | Side lane, never blocks speech. |
| Talk, welcome call, phone call | `interpret` (`VOICE_AGENT_ROLE=agent` → `agent`) | Spark 1.2 · minimal (or 1.3 · low) | Conversational latency; the whole case is in the prompt, dates pre-spelled with weekdays. |
| Voice onboarding | `intake` → `interpret` | Spark 1.2 · minimal | Profile extraction and the spoken reply run in parallel. |
| Text interpret + interpret-only guard | `interpret`, `guard` | Spark 1.2 · minimal | See [safety.md](safety.md). |
| Look: reading the letter | `read` → `vision` | Spark 1.3 · low | 100% deadline-correct, docs F1 1.00 ([eval.md](eval.md)). |
| Look: grounding (boxes) | `read` → `vision` | Spark 1.3 · medium | Spark 1.3 grounds about twice as well as 1.1/1.2: IoU ≥ 0.5 on 77% of letters after SAM vs 38–42%. |
| Look: outlines, photo check | — | SAM 3.1, box prompts | +0.09–0.11 IoU over the Spark box on every model tested. |
| Reading official mail (onboarding + watcher) | `mail_scan` → `reason` | Spark 1.3 · low | Same reading quality as Look; attachments go in as images. |
| Drafts (reply to the office, dean's office) and the welcome narrative | `welcome` → `draft` | Spark 1.3 · low | |
| Linking a letter to the case | `link` → `reason` | Spark 1.3 · high | Rare, consequential, not latency-bound. |
| Visit plan | `webSearch` (Responses API, `web_search` tool), then `metaJson` with role `agent` | Spark 1.3 · low, twice | Checklist from today's official pages with numbered citations, compared against the user's documents (`src/lib/visit/plan.ts`). |
| Case review | strategist tool loop | **Muse Wonder 1.0** · high | Matches Spark 1.3 on letters at 3.3× the cost, so it is kept for the long-horizon job: ≤ 8 tool rounds over `get_case_item`, `compute_deadline`, `fetch_article`. |
| Speech to text | realtime WebSocket | Muse Voice Transcribe 1.0 | Endpointing, language bias, keywords from the case. |
| Text to speech | — | ElevenLabs `eleven_v4_turbo` (not Meta) | Streaming: 16 kHz PCM to the browser, 8 kHz μ-law to Twilio. |

## API lessons encoded in the code

- **Reasoning tokens count against `max_tokens`, even at `minimal`.** A low cap returns empty content, so caps sit well above the visible output: 1,200 for a two-sentence onboarding reply, 4,000–6,000 for reading a mail with attachments (`model/types.ts`, `onboarding/intake.ts`, `onboarding/extract.ts`).
- **`logprobs` is rejected (400)**, so confidence comes from the model's own field, never from token probabilities (`model/meta.ts`).
- **Structured output**: `response_format` `json_object` or `json_schema`; every reply is parsed with zod, and a failed parse is retried once with the validation error, then fails clearly (`model/json.ts`). `<think>` blocks and code fences are stripped before parsing (`tests/unit/json.test.ts`).
- **Edge 404s**: the Meta API answered 404 from some Cloudflare locations (seen: HKG). A 404 is re-sent once through `ModelRelayDO` in western Europe; `MODEL_RELAY_MODE=always` routes every call there; `VoiceDO` is pinned to `weur` (`model/relay.ts`, `voice/server/route.ts`, `tests/unit/model-relay.test.ts`).
- **Errors** map to stable codes (`rate_limited`, `model_unavailable`, `bad_request`, `provider_unavailable`) and user-safe messages; no provider body reaches the client.

## Spend control

- **Reserve, then settle** (`model/meter.ts`): every `runModel` call, grounded search, SAM call and Wonder review round reserves an upper bound (estimated input + all of `max_tokens` at the output price) against a daily cap, then settles to the billed usage. A reply without usage is metered as the worst case, never zero.
- **Caps**: US$5 of model spend per day across the app (`MODEL_DAILY_USD_CAP`), 40 grounded searches per day (5 per user), US$0.50 of Wonder review per user per day.
- **Kill switch**: `MODELS_DISABLED=1` stops all of those paths.
- **Live voice** (`voice/server/meter.ts`) is metered without adding latency to a turn. Before each Spark call and each Voice Transcribe connect, a synchronous gate checks the kill switch and a cached "cap reached today" flag (primed from D1 at session start). After each call, its billed usage is booked against the same daily cap, never awaited by the turn: a stream cut short by barge-in or a corrected partial is booked from an estimate, and Voice Transcribe is booked by the audio streamed. Because booking follows the call, the cap can be overshot by the calls already in flight. ElevenLabs is outside the model cap.
- Cap, settle, retry metering and the kill switch are pinned by `tests/unit/token-cap.test.ts`.
- **Records**: each `runModel` call writes a `runs` row (task, model, ms, tokens, cost) and a `ledger` row (bytes sent, items masked) in D1.

Prices used for metering (USD): Spark 1.2/1.3 $1.25 / M input, $0.15 / M cached, $4.25 / M output; Wonder 1.0 $4 / M input, $20 / M output (the app meters cached Wonder input at $1 / M; the eval billed it as full input because no cached rate is published); SAM 3.1 $2.50 / 1,000 images; Voice Transcribe $0.18 / hour; web search $2.50 / 1,000 calls.

## Measured cost and latency per action

Mean billed cost per model call from D1 `runs` (preview environment, 134 cloud runs, 4–5 Nov 2026; `npm run latency`):

| Action | Model | n | Tokens in / out (mean) | Cost per call (mean) |
|---|---|---|---|---|
| Voice onboarding reply | Spark 1.2 | 45 | 238 / 236 | $0.0012 |
| Reading an official mail | Spark 1.3 | 54 | 1,347 / 1,074 | $0.0060 |
| Drafts and welcome narrative | Spark 1.3 | 27 | 1,552 / 864 | $0.0052 |
| Look, one of two Spark calls | Spark 1.3 | 4 | 2,433 / 2,568 | $0.0139 |
| Look outlines | SAM 3.1 | 2 | | $0.0025 |
| Photo check | Spark 1.3 | 2 | 2,927 / 846 | $0.0073 |

Output tokens include reasoning tokens. Live voice turns stream outside `runModel`: they are booked against the cap but not written to `runs`.

Letter reading under controlled conditions, 28 letters × clean and photo variants ([eval.md](eval.md)): Spark 1.3 low (production) $0.033 per letter including SAM, 19.0 s p50 for the whole read (both calls in parallel), SAM 2.7 s p50.

## Reproduce

```bash
npm run smoke:meta     # one live call per Meta helper (needs MODEL_API_KEY)
npm run eval           # the letter evaluation (live calls: US$1.5–2.3 per Spark config, US$6.1 for Wonder)
npm run eval:report    # tables from eval/results/*.json (offline)
npm run latency        # per-task latency and cost from D1 runs (read-only)
```
