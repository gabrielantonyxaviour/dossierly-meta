# Claude vs Meta on the 28-letter Look pipeline

Run 2026-11-18 (local timezone of the run). Same harness, same 28 generated letters, clean and photo A variants (56 images per config), `readLook` unchanged (grounding call + reading call, deterministic KPA engine). Claude configs ran at effort `low` through the Anthropic Messages API with no SAM refinement (SAM is Meta only, and no Meta key was used); Meta rows are the 2026-11-04 results (`2026-11-04T10-*.json`, [docs/eval.md](../../docs/eval.md)). Raw outputs: `2026-11-18T07-23-28-004Z-claude.json`.

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
