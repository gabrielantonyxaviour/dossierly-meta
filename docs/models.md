# Models: who does what, and why

Every model call goes through `src/lib/model` (or, for the realtime voice lanes and the case-review tool loop, a thin client over the same code). Work is named by **task**, each task maps to a **role**, and each role to a **route**: provider (Meta or Anthropic), model and default effort (`src/lib/config.ts`, resolved in `src/lib/model/roles.ts`). Routing is config only; no code change moves a role.

## Content origin and the Meta gate (a hard rule, enforced in code)

Meta's promotional credits let Meta use content for product improvement. Until Gabriel lifts it, **a real user's content (letters, photos, emails, messages, voice, case data) is never sent to any Meta model.**

- Every call carries a content origin: `"user"`, `"demo"` (the Arjun Raman sample case, the public sample letters) or `"eval"` (the evaluation harness). A missing or unknown origin is `"user"` (fail closed).
- `resolveRole()` (`src/lib/model/roles.ts`) is the single gate: when the resolved provider is Meta, the origin is `user` and `META_USER_CONTENT` is not exactly `allow`, it throws `ModelError` code `provider_blocked` (HTTP 403) **before any network request**. Every role and service (chat, streaming, SAM, speech, grounded search, the case-review loop) resolves through it, and `meta.ts` checks again before each Meta request. Tests: `tests/unit/model-gate.test.ts`, `model-gate-callsites.test.ts`.
- Where the app marks content as demo: `POST /api/look` with the client's `sample: true` (the public sample letters; the flag is client-supplied and only ever loosens routing for that one call), the shared sample user id (`sample-arjun`) in `runModel`, and the eval harness (`origin: "eval"`). Everything else is `user`.
- Lift: set `META_USER_CONTENT=allow` (secret or var). Nothing else lifts it.

## Routing table (defaults)

| Role · task | Real user content (origin `user`) | Demo / eval content |
|---|---|---|
| `interpret` (turns, translation, voice replies, counter lanes, onboarding intake) | Claude Haiku 5.5 · thinking off | Muse Spark 1.2 · minimal |
| `guard` (interpret-only guard) | Claude Haiku 5.5 · thinking off | Muse Spark 1.2 · minimal |
| `draft` task `watch`, `hub_summary` (triage / classification) | Claude Haiku 5.5 · low | Muse Spark 1.3 · low |
| `draft` (welcome narrative, reply drafts, intro, wrap) | Claude Sonnet 5.5 · low | Muse Spark 1.3 · low |
| `vision` (Look: read + ground, photo check) | Claude Sonnet 5.5 · low | Muse Spark 1.3 · low |
| `agent` (prepare, ask, visit-plan structuring) | Claude Sonnet 5.5 · low | Muse Spark 1.3 · low |
| `reason` (link letter to case, mail scan) | Claude Sonnet 5.5 · medium | Muse Spark 1.3 · medium |
| Case review (nightly / after a new letter, tool loop) | Claude Sonnet 5.5 · high | Muse Wonder 1.0 · high |
| Look outlines (SAM 3.1) | **skipped**: the vision model's own boxes are kept | SAM 3.1 box prompts |
| Speech to text (file and live) | **unavailable** (`provider_blocked`) | Muse Voice Transcribe 1.0 |
| Grounded web search (Hub Ask, visit plan) | **unavailable** (empty result) | Meta `web_search` |
| Text to speech | ElevenLabs (not Meta, unchanged) | ElevenLabs |

Claude Opus 5.5 (`claude-opus-5-5`) is available to any role by config.

## Switching by config (no code change)

Per role `<ROLE>` is `INTERPRET GUARD REASON AGENT VISION DRAFT`:

| Variable | Effect |
|---|---|
| `MODEL_<ROLE>_PROVIDER` = `meta` \| `anthropic` | Provider for both origins. Without a model, the provider's default for that role is used. |
| `MODEL_<ROLE>_MODEL` | Model id. A `claude-*` id implies Anthropic when no provider is set; anything else implies Meta. |
| `MODEL_<ROLE>_EFFORT` | `minimal` `low` `medium` `high`. For Claude this is `output_config.effort` (`minimal` also switches thinking off). |
| `MODEL_<ROLE>_BASE_URL`, `MODEL_<ROLE>_KEY_ENV` | Host and the NAME of the variable holding the key. Defaults: `https://api.anthropic.com` + `ANTHROPIC_API_KEY`, or the Meta URL + `MODEL_API_KEY`. |
| `MODEL_<ROLE>_USER_<X>` / `MODEL_<ROLE>_DEMO_<X>` | Same, for real-user calls only / demo and eval calls only. The scoped variable wins. |
| `STRATEGIST_MODEL` | Pins the case-review model for both origins. |
| `META_USER_CONTENT=allow` | Lifts the gate. Then, to give users Meta again, set `MODEL_<ROLE>_USER_PROVIDER=meta` per role. |

Example, once Meta use is cleared: `META_USER_CONTENT=allow`, `MODEL_VISION_USER_PROVIDER=meta`, `MODEL_INTERPRET_USER_PROVIDER=meta` (SAM, speech and search follow automatically, they are Meta-only). The Meta provider keeps its relay, `reasoning_effort` and `json_schema` behaviour; `meta.ts` `metaChat`/`metaChatStream` are the dispatchers and send a role routed to Anthropic through `anthropic.ts`.

## Claude provider notes (`src/lib/model/anthropic.ts`, `anthropic-tools.ts`)

- Anthropic Messages API, plain `fetch` (`x-api-key`, `anthropic-version: 2023-06-01`). Text, streaming (SSE text deltas plus one usage chunk, used by voice and chat), images as base64 blocks, tool use for the case-review loop (thinking blocks are echoed back unchanged).
- JSON output: the system prompt asks for one JSON object (plus the JSON Schema when a schema is given) and the caller's zod schema validates it with the existing one-retry `callJson`. Anthropic structured-output mode is not used, so no schema feature can 400 a call.
- No `temperature` (Sonnet 5.5 and Haiku 5.5 reject non-default sampling). Refusals and empty replies become `model_error` with the billed usage. Provider bodies never reach the client. The server-side refusal `fallbacks` beta is not enabled (unverified against live refusals).
- Metering: `cost.ts` prices Claude at list (USD per million tokens): Haiku 5.5 $0.10 in / $0.50 out, Sonnet 5.5 $2 / $10 (cache read $0.20), Opus 5.5 $4 / $20 (cache read $0.20), from the pinned claude-api skill on 2026-11-18. **Unverified:** Haiku's cache-read rate ($0.01 assumed) and Haiku's higher rate above 100K prompt tokens; no explicit prompt caching is used, so billed cost equals the metered cost. The daily cap, reserve-then-settle and kill switch apply unchanged.

## Features unavailable to real users while the gate holds

| Feature | Why | What the code does |
|---|---|---|
| Voice input everywhere: Counter, Talk, rehearse, welcome call, phone call, voice onboarding | Speech to text is Meta Voice Transcribe only | The live session cannot connect recognition: it emits error code `provider_blocked` ("Voice input is not available for your account yet.") and `ready` with `asr:false`; nothing is streamed to Meta. Spoken replies (ElevenLabs) and typed turns still work. |
| Recorded-clip transcription (`POST /api/asr`) | Same | HTTP 403 `{ error, code: "provider_blocked" }`; `/api/status` reports `asr.online: false`. |
| Look outlines (SAM) | SAM 3.1 is Meta only | Not an error: the highlight uses the vision model's own box. |
| Grounded web search (Hub Ask, visit-plan sources) | Meta `web_search` tool | The search returns no passages and the caller shows its no-source state. |

Voice replies for the Counter and phone lanes would need a Claude path only if recognition is added; no ASR provider was built.

## Per job (demo and eval content, the Meta routes)

The rows below describe the Meta routes: demo/eval content today, and real users' content once `META_USER_CONTENT=allow` and the roles are pointed back at Meta.

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

## Claude vs Meta on the letter eval

Run 2026-11-18 (local timezone of the run). Same harness, same 28 generated letters, clean and photo A variants (56 images per config), `readLook` unchanged (grounding call + reading call, deterministic KPA engine). Claude configs ran at effort `low` through the Anthropic Messages API with no SAM refinement (SAM is Meta only, and no Meta key was used); Meta rows are the 2026-11-04 results (`eval/results/2026-11-04T10-*.json`, [eval.md](eval.md)). Raw outputs: `eval/results/2026-11-18T07-23-28-004Z-claude.json`.

| config | deadline correct | docs F1 | model box found | box IoU (model's own box) | IoU >= 0.5 | read p50 / p95 | model cost per letter | total spend |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 low | 100% | 1.00 | 100% | **0.71** | 83% | 10.1 s / 12.5 s | $0.0488 | $2.73 |
| claude-haiku-5-5 low | 100% | 1.00 | 33% | 0.11 | 13% | 6.5 s / 10.0 s | $0.0027 | $0.15 |
| spark-1.3 low (Meta) | 100% | 1.00 | 100% | 0.54 (0.63 after SAM) | 60% (77% after SAM) | 19.0 s / 26.6 s | $0.0302 (+$0.0025 SAM) | $1.83 |
| spark-1.2 low (Meta) | 98% | 0.97 | 98% | 0.26 | 25% | 7.8 s / 11.1 s | $0.0282 (+$0.0025 SAM) | $1.72 |
| wonder-1.0 low (Meta) | 100% | 1.00 | 100% | 0.51 (0.62 after SAM) | 60% (73% after SAM) | 13.6 s / 21.3 s | $0.1062 (+$0.0025 SAM) | $6.09 |

Per type, Claude Sonnet 5.5: deadline correct 100% on all four letter types, appointment date and time exact 100%, box IoU 0.80 (requests for missing documents), 0.57 (document requests), 0.66 (decisions). Claude Haiku 5.5: same extraction, but it rarely places the deadline box (IoU 0.13 / 0.10 / 0.05), so it is kept to text roles.

Reading of the result:

- Extraction is saturated for every model (this is why the product does the date arithmetic in code). Choose on grounding, latency and cost.
- **Vision: Claude Sonnet 5.5.** Its own boxes (IoU 0.71) beat Spark 1.3 plus SAM (0.63), it is 1.9x faster at p50 than Spark 1.3 low, at about 1.6x the cost per letter. Dropping SAM for real users therefore costs nothing measurable here.
- **Text roles: Claude Haiku 5.5.** Equal extraction, 6.5 s for the whole two-call read, $0.0027 per letter, 10x cheaper than Spark. Its grounding is weak, so it is not used for vision.
- Caveats: single run per cell, fictional template letters (upper bound for real scans), Claude thinking is adaptive at effort low (output tokens include thinking), Meta numbers come from an earlier run, and the interpret and guard roles were not measured here (no text-only eval exists for them).

Spend: US$2.88 in the result file plus about US$0.15 for a 2-letter pilot and a run that stopped on missing photo files, so about US$3.0 of the US$12 cap.

## Reproduce

```bash
npm run smoke:meta     # one live call per Meta helper (needs MODEL_API_KEY)
npm run eval           # the letter evaluation (live calls: US$1.5–2.3 per Spark config, US$6.1 for Wonder; --configs claude-sonnet-5-5-low,claude-haiku-5-5-low need ANTHROPIC_API_KEY, US$2.7 and US$0.15)
npm run eval:report    # tables from eval/results/*.json (offline)
npm run latency        # per-task latency and cost from D1 runs (read-only)
```
