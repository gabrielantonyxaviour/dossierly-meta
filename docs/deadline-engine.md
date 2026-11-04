# The KPA deadline engine

A missed summons deadline can end a residence case, so no model computes a date. The model reads two things from the letter: the period ("7 dni") and the sentence that sets it. `computeKpaDeadline` (`src/lib/legal/deadlines.ts`) does the arithmetic, explains every step in plain words, and attaches the verbatim article text.

It is pure and deterministic: no I/O, no clock, no model. The same input always gives the same output.

## Rules as code

| Rule (Kodeks postępowania administracyjnego) | What the code does | Where |
|---|---|---|
| art. 57 §1: the day of the event is not counted | Day 1 is the day after delivery | `computeKpaDeadline` |
| art. 57 §3: weeks and months end on the matching weekday or date | Weeks end on the same weekday; months clamp to the last day of a shorter month (31 Jan + 1 month → 28/29 Feb) | `calendar.ts` `addMonths` |
| art. 57 §4: an end on a Saturday or a statutory day off moves to the next day that is neither | `rollForward` skips Saturdays, Sundays and holidays and names each skipped day | `deadlines.ts`, `holidays.ts` |
| art. 57 §5 pt 2: posting at a Polish post office on the last day is on time | Added as the final step, with the advice to keep the stamped receipt | `deadlines.ts` |
| art. 44 §1, §4: an uncollected letter counts as delivered when the 14-day storage period ends | `start.kind: "notice"` derives the delivery day from the first notice (awizo) | `deadlines.ts` |
| art. 64 §2: a summons to complete an application gives at least 7 days | Quoted when the letter names it as the legal basis | `articles.ts` |

Polish statutory days off (`holidays.ts`) follow the Act of 18 January 1951 as amended, with Easter computed (anonymous Gregorian algorithm), Easter Monday, Pentecost Sunday and Corpus Christi derived from it, and 24 December a day off from 2025. Saturday is not a statutory day off; art. 57 §4 names it separately, and the code keeps that distinction.

Counting from the date printed on the letter (instead of delivery) is supported because some letters set it, but the result carries a warning that most KPA periods run from delivery.

## Citations

`src/lib/legal/articles.ts` holds the verbatim Polish text of KPA art. 41, 44, 57, 64 and Act on Foreigners art. 106f and 108, extracted on 2026-11-04 from the Sejm ELI register (`api.sejm.gov.pl/eli/acts/DU/2025/1691`, the consolidated KPA text) with only PDF line-break hyphenation removed. Each citation shown to the user is a direct quote with a link to ISAP. The same text backs the MCP `explain_law` tool and Wonder's `fetch_article` tool.

## Worked examples (real engine output)

**Summons, 7 days from delivery** · delivered Thu 5 Nov 2026 → **Thu 12 Nov 2026**
1. You received the letter on Thursday, 5 November 2026. That day is not counted (KPA art. 57 §1).
2. The period is 7 days. The letter says: "w terminie 7 dni od dnia doręczenia". Day 7 is Thursday, 12 November 2026.
3. That is not a Saturday, Sunday or public holiday, so it stays.
4. Posting your reply at a Polish post office on or before that day counts as on time, so keep the stamped receipt (KPA art. 57 §5).

**Uncollected letter (awizo), 14 days** · first notice Tue 20 Oct 2026 → **Tue 17 Nov 2026**
1. The post office keeps the letter for 14 days, counting from the day after (art. 44 §1); those end on Tuesday, 3 November 2026, when the letter counts as delivered (art. 44 §4).
2. If you collect it earlier, that day is the delivery day instead.
3. 3 November is not counted (art. 57 §1); day 14 is Tuesday, 17 November 2026, a working day.

**Period ending on Easter, 14 days** · delivered Sun 22 Mar 2026 → **Tue 7 Apr 2026**
1. Day 14 is Sunday, 5 April 2026: Easter Sunday, a public holiday.
2. Monday 6 April (Easter Monday) is also off, so the deadline moves to Tuesday, 7 April 2026 (KPA art. 57 §4).

Reproduce any of these: `compute_deadline` on the MCP server ([mcp.md](mcp.md)), or call `computeKpaDeadline` from a test.

## Where it is used

- **Look** commit: the confirmed delivery date and the period read from the letter (`src/lib/look/commit.ts`).
- **MCP** `compute_deadline` and `read_letter` (`src/lib/mcp/tools-legal.ts`, `tools-ai.ts`).
- **Muse Wonder** case review: the `compute_deadline` tool, so the model checks dates with the engine instead of doing arithmetic (`src/lib/strategist/tools.ts`).

Mail reading in onboarding and the inbox watcher still goes through an older, smaller helper, `src/lib/features/deadline.ts` (periods in days, art. 57 §1 and §4, step text in the user's language). `tests/unit/deadline-engines-agree.test.ts` checks that the two give the same due date on 2,000 seeded cases (1–365 days, 2024–2030, from delivery or from the letter date) and on the Christmas, Easter, 1 and 11 November chains.

## Tests

| File | What it pins |
|---|---|
| `tests/unit/legal-deadlines.test.ts` (18) | Rules one by one: §1, §3 months and weeks, §4 roll-forward, §5, art. 44 notice, letter-date warning, input errors |
| `tests/unit/legal-deadlines-property.test.ts` (20) | 2,000 seeded random cases (2024–2030, days/weeks/months) against an independent calendar oracle: never ends on a day off, rolls forward only over days off, ≥ start + period, monotone in the period, notice = delivery on notice + 14 days, deterministic; plus Easter, 1 November, year-end, month-end and leap-day cases |
| `tests/unit/legal-holidays.test.ts` (5) | Easter dates, movable feasts, 24 December from 2025 |
| `tests/unit/deadline-engines-agree.test.ts` (2) | The KPA engine and the older mail-reading helper agree on every day-count case |
| `tests/unit/deadline.test.ts` (8) | The older mail-reading helper |

The result is a calculation, not legal advice.
