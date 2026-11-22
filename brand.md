# Brand — UptimeWatch

_Status: active_

## Personality
"Paper": calm, warm and editorial. Warm off-white paper, ink-dark text, a
serif voice for headlines, and one orange accent. The interface stays quiet so
that a problem is the loudest thing on screen.

## Color
Tokens live in `apps/frontend/app/globals.css` (light + dark). Never hardcode
colors; never use purple/violet/indigo.

| Token | Use |
|---|---|
| `background`, `surface`, `card`, `muted`, `border` | Warm paper neutrals for all chrome (warm espresso in dark mode) |
| `foreground` / `primary` | Text and primary buttons (near-black in light, near-white in dark) |
| `brand` | Orange. Logo dot, focus ring, active accents, charts' primary series. Used sparingly |
| `success` | Up / operational |
| `warning` | Degraded, expiring SSL, needs attention |
| `destructive` | Down, errors, destructive actions |
| `info` | Maintenance |

Status color always comes with a label or icon (never color alone).
Soft fills: `bg-<status>/10 text-<status> ring-1 ring-inset ring-<status>/20`.

## Typography
Instrument Serif (`font-serif`) for page titles and marketing headlines only.
Geist Sans for all UI, Geist Mono for codes, URLs and tokens. All metrics use the
`numeric` utility (tabular numbers). Page titles use `PageHeader` (serif, 28–32px);
section titles `text-sm font-semibold`; meta text `text-xs text-muted-foreground`.

## Shape & depth
Radius `0.5rem` (cards `rounded-xl`). Borders over shadows; at most `shadow-xs`
on cards. Dense but breathable: 16px gutters, `gap-4`/`gap-6` between blocks.

## Components to reuse
`components/app/`: `PageHeader`, `StatCard`, `Panel`, `EmptyState`,
`StatusBadge`/`StatusDot`/`MonitorTypeIcon`, `Sparkline`, `UptimeBars`, `Logo`.

## Motion
150–200 ms ease-out on hover/press; the status pulse is the only ambient
animation and respects `prefers-reduced-motion`.

## Voice
Short, active, specific. "api.acme.dev is down — HTTP 503" not "An error has occurred".
