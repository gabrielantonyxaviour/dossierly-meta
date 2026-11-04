# Dossierly UI

Owned by the App UX pane. Ask there for new primitives instead of building parallel ones.

## Tokens
- `src/app/globals.css`: semantic colours. `--ink`, `--ink-2`, `--ink-3`, `--line`, `--official` (the office's side, violet), `--user` (you, amber), `--deadline` (red, **deadlines and overdue only**), `--ok`, each with a `-soft` fill.
- `tokens.css`: surfaces (`--canvas` app background, `--card`, `--sunken`), agent gradient (`--agent-grad`, `--agent-a`), type scale `--t-xs … --t-4xl`, space `--s-1 … --s-9` (4px grid), radius `--r-xs … --r-xl`, elevation `--e-1 … --e-3`, motion (`--ease`, `--ease-out`, `--spring`, `--d-1 … --d-4`).
- Fonts: Inter (body), Instrument Serif via `.ui-display` / `var(--font-display)` for big titles and numbers, JetBrains Mono for codes.
- Light/dark both ways: system preference, or `data-theme` on `<html>` (Settings → Appearance).

## Components (`import { … } from "@/components/ui"`)
| Need | Use |
|---|---|
| Actions | `Button` / `ButtonLink` (`variant`: primary, secondary, soft, ghost, danger, agent; `size`: sm, md, lg; `icon`, `iconEnd`, `loading`, `block`), `IconButton` / `IconLink` (`label` required, `dot` for unread) |
| Surfaces | `Card` (`flush` for lists, `raised`), `CardLink` |
| Lists | `Section` (title + action link) holding `<Card flush>` of `Row`s (`icon`, `title`, `sub`, `end`, `chevron`, `href`/`onClick`) |
| Status | `Pill` (`tone`: neutral, deadline, ok, warn, official, info, agent, outline; `dot`, `icon`) |
| Inputs | `.ui-field` + `.ui-input`, `Switch`, `CheckCircle` (tasks), `Segmented` (tabs) |
| Overlays | `Sheet` (bottom sheet on phones, dialog on desktop), `FullScreenFlow` (camera, counter, guided steps; hides app chrome; `step`, `dark`, `footer`) |
| Feedback | `useToast().toast(text, { tone, action })`, `EmptyState`, `ErrorState` (with `onRetry`), `InlineError`, `Skeleton`, `Spinner` |
| Page header | `TopBar` (large serif title that collapses into a sticky bar; `back`, `actions`, `eyebrow`, `sub`) |
| Agent | `AgentOrb` (`state`: idle breathes, live ripples, still) |
| Text | `Markdown` for model answers (safe subset, no HTML) |
| Logos | `logos.tsx`: Gmail, Google Calendar, Outlook, Meta |

## Page layout
Wrap a page in `<div className="sh-page">` (720px column, 16px gutter) or `sh-page sh-page--wide` (1120px). The shell adds the tab bar (phones) or sidebar (≥1024px). Routes listed in `IMMERSIVE` (`src/components/app/shell/nav.ts`) get no tab bar.

## Case data on the client
`useCaseData()` from `src/components/app/shell/case-data.tsx` gives `{ snapshot, next, status, refresh, patchItem, patchProfile }`. After a flow writes to the case through the API, call `announceCaseChange()` so Home and Case refresh at once.

## Rules
Mobile first at 390px, then 820 and 1440. 44px minimum touch targets. Red only for deadlines. Every async view has loading, empty and error states. Respect `prefers-reduced-motion` (built into the primitives).
