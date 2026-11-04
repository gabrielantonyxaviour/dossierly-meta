# Dossierly UI

Owned by the App UX pane. Ask there for new primitives instead of building parallel ones.

## Tokens
- `src/app/globals.css`: semantic colours. `--ink`, `--ink-2`, `--ink-3`, `--line`, `--official` (the office's side, violet), `--user` (you, amber), `--deadline` (red, **deadlines and overdue only**), `--ok`, each with a `-soft` fill.
- `tokens.css`: surfaces (`--canvas` app background, `--card`, `--sunken`), agent gradient (`--agent-grad`, `--agent-a`), type scale `--t-xs … --t-4xl`, space `--s-1 … --s-9` (4px grid), radius `--r-xs … --r-xl`, elevation `--e-1 … --e-3`, motion (`--ease`, `--ease-out`, `--spring`, `--d-1 … --d-4`).
- Baseline (Gabriel, 4 Nov): the original landing page's style. **Dark only**, Inter + JetBrains Mono only (no serif), headings at weight 400 with tight tracking, big numbers at 300, radii 10/14/20, hairline rings instead of heavy shadows.
- `.ui-display` = large Inter heading; add `.ui-num` for countdown numbers.

## Components (`import { … } from "@/components/ui"`)
| Need | Use |
|---|---|
| Actions | `Button` / `ButtonLink` (`variant`: primary, secondary, soft, ghost, danger, agent; `size`: sm, md, lg; `icon`, `iconEnd`, `loading`, `block`), `IconButton` / `IconLink` (`label` required, `dot` for unread) |
| Surfaces | `Card` (`flush` for lists, `raised`), `CardLink` |
| Lists | `Section` (title + action link) holding `<Card flush>` of `Row`s (`icon`, `title`, `sub`, `end`, `chevron`, `href`/`onClick`) |
| Status | `Pill` (`tone`: neutral, deadline, ok, warn, official, info, agent, outline; `dot`, `icon`) |
| Inputs | `.ui-field` + `.ui-input`, `Switch`, `CheckCircle` (tasks), `Segmented` (tabs) |
| Overlays | `BottomSheet` / `Sheet` (bottom sheet below 768px with drag-to-dismiss, dialog on desktop), `FullScreenFlow` (camera, counter, guided steps; hides app chrome; `step`, `dark`, `footer`) |
| Feedback | `useToast().toast(text, { tone, action })`, `EmptyState`, `ErrorState` (with `onRetry`), `InlineError`, `Skeleton`, `Spinner` |
| Mobile flow screen | `MobileFlowHeader` (56px: `back` href/fn or `close`, `title`, `progress={{at,of}}`, `action`), `MobilePage` (gutter + safe areas; `actions` / `actions="double"` reserves room for the bar), `ScreenTitle` (28px/600 + one helper line), `StickyActionBar` (children = primary Button 52px full width; `secondary` text button; keyboard, safe-area and tab-bar aware; inline row on desktop) |
| Choices | `OptionList` (full-width 56px rows, check on the right; `multiple` for multi-select), `OptionGrid` (equal 2- or 3-col tiles). Never a wrapping cloud of pills. |
| Page header | `TopBar` (large title that collapses into a sticky bar; `back`, `actions`, `eyebrow`, `sub`) |
| Agent | `AgentOrb` (`state`: idle breathes, live ripples, still) |
| Text | `Markdown` for model answers (safe subset, no HTML) |
| Logos | `logos.tsx`: Gmail, Google Calendar, Outlook, Meta |

## Page layout
Wrap a page in `<div className="sh-page">` (720px column, 16px gutter) or `sh-page sh-page--wide` (1120px). The shell adds the tab bar (phones) or sidebar (≥1024px). Routes listed in `IMMERSIVE` (`src/components/app/shell/nav.ts`) get no tab bar.

## Case data on the client
`useCaseData()` from `src/components/app/shell/case-data.tsx` gives `{ snapshot, next, status, refresh, patchItem, patchProfile }`. After a flow writes to the case through the API, call `announceCaseChange()` so Home and Case refresh at once.

## Mobile-first standard
Below 768px every screen follows `briefs/mobile-first-standard.md`: one task per screen, primary action always visible in `StickyActionBar`, compact header, 28px/600 titles, 16px body (15 minimum), 52px inputs. Live reference: `/kit` on any preview or local (404 in production).

## Rules
Mobile first at 390px, then 820 and 1440. 44px minimum touch targets. Red only for deadlines. Don't add a light theme or new brand colours. Every async view has loading, empty and error states. Respect `prefers-reduced-motion` (built into the primitives).
