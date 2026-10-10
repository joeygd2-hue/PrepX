# PrepX design system — "Graphite & Volt"

Minimal, confident, and quiet until it matters. Warm paper and graphite neutrals do the work; one electric accent marks the "you are here" moments (active tab, progress fills, the single primary call to action on a screen, success marks). Type pairs Geist (UI), Geist Mono (numbers, labels) and an Instrument Serif italic for one or two words of emphasis in a headline.

Source of truth: tokens in `src/app/globals.css`, primitives in `src/components/ui/*`. Build screens from primitives first; reach for raw utilities only for layout.

## Tokens (Tailwind names)

| Token | Use |
|---|---|
| `bg`, `fg` | Page background and ink. |
| `muted` | Secondary text. |
| `subtle`, `subtle-2` | Quiet fills (tracks, chips, secondary panels). |
| `border`, `border-strong` | Hairlines; `border-strong` for inputs and outline buttons. |
| `card` | Raised surfaces. Pair with `shadow-card`. |
| `hero`, `hero-fg`, `hero-muted`, `hero-line` | The dark "feature" surface and the text/lines on it. |
| `primary`, `primary-fg` | Solid ink buttons and selected states. |
| `accent`, `accent-fg` | Volt. A fill, never body text on light surfaces. |
| `danger`, `success`, `warning` | Status. |
| `deca`, `fbla`, `hosa`, `tsa` | Organization dots only (via `OrgBadge`). |
| `shadow-card`, `shadow-float` | Resting card / floating element. |
| `font-mono`, `font-display` | Numbers and labels / serif italic accent. |

Dark mode and the level-unlocked accent colors are handled entirely by the tokens. Never hard-code colors (`bg-white`, `text-black`, `gray-*`, hex values). Exception: `text-white` on `bg-danger`.

**Contrast rule:** the accent is a light color. Never use `text-accent` on `bg`/`card`/`subtle` surfaces. Use it as a fill (`bg-accent text-accent-fg`) or as text only on `hero` surfaces.

## Primitives

| Need | Use |
|---|---|
| Page shell | `<Page>` (adds `main#main`, width, bottom padding for the dock). `wide` for 5xl. |
| Page heading | `<PageTitle eyebrow title subtitle right />`. Emphasize one or two words with `<Accent>` (serif italic). Sub-pages: `<BackHeader href title subtitle />`. |
| Card | `<Card>` (border, `bg-card`, `shadow-card`, `rounded-[24px]`, `p-5 sm:p-6`). `tone="subtle"` for a quiet panel. `tone="inverse"` for the dark feature surface: put `<HeroTexture />` first and wrap content in `<div className="relative">`. |
| Section label | `<SectionLabel>` (accent dot, mono caps, hairline). Small labels: `className="eyebrow"`. |
| Navigation list | `ListGroup` + `ListRow` (icon, title, subtitle, chevron). |
| Navigation grid | `TileGrid` + `Tile` (`tone`: plain, subtle, accent, hero). At most one `accent` and one `hero` tile per screen. |
| Stats | `StatStrip items={[{ value, label, icon? }]}`. |
| Icon square | `IconTile` (`inverse` for solid ink). |
| Buttons | `Button` / `ButtonLink` variants: `primary` (default ink), `accent` (the one hero CTA), `outline`, `subtle`, `ghost`, `danger`, `hero` (light button on a hero surface). Sizes `sm`, `md`, `lg`. `SubmitButton` for forms. |
| Chips | `Chip` tones `outline`, `inverse` (on hero), `warning`, `accent`. `OrgBadge org onHero?`. `VerificationChip`. |
| Progress | `ProgressBar` (`inverse` on hero), `Ring`. |
| Forms | `Label`, `Input`, `Textarea`, `Select`, `FieldError`, `Notice tone`. |
| Switches | `Toggle` (server-action backed) or `Switch` (controlled). Never hand-roll a switch. |
| Empty | `EmptyState icon title body action`. |

`cn()` uses tailwind-merge, so a `className` passed to a primitive overrides its defaults cleanly.

## Patterns

- **Radii:** cards `rounded-[24px]`, hero cards `rounded-[28px]`, inner panels/options `rounded-[16px]`, controls `rounded-[14px]`, small squares `rounded-[12px]`, pills `rounded-full`.
- **Feature surface (replaces old `bg-fg text-bg`):** `<Card tone="inverse">` + `<HeroTexture />`; secondary text `text-hero-muted`; dividers `border-hero-line`; CTA `variant="accent"` or `variant="hero"`; chips `tone="inverse"`; badges `onHero`.
- **Big numbers:** `font-mono font-medium tabular tracking-[-0.04em]` (countdowns, scores, stats). Units in `text-muted` / `text-hero-muted`.
- **Selectable options (radio/checkbox cards):** `rounded-[16px] border border-border bg-card p-4 transition-colors hover:border-border-strong has-[:checked]:border-fg has-[:checked]:ring-4 has-[:checked]:ring-accent/30`.
- **Segmented control / pressed state:** container `rounded-[14px] bg-subtle p-1`; active item `bg-card shadow-card` (or `bg-primary text-primary-fg` for strong emphasis).
- **Headings in cards:** `text-lg font-semibold tracking-[-0.02em]`; body `text-[15px]`; secondary `text-sm text-muted`.
- **Spacing:** stacks of cards `space-y-3`; `SectionLabel` brings its own top margin.
- **Link cards:** `transition-colors hover:border-border-strong` (or use `Tile`).

## Motion

- Every route group has a `template.tsx` that wraps the page in `.page-enter`: the page fades in and each direct child of `main` rises in with a short stagger on first load, refresh and every navigation. Nothing to add per page.
- To cascade a nested group (a list of cards inside one wrapper), add the `stagger` class to the wrapper.
- `.pop-in` for small success marks; `.skeleton` for loading placeholders.
- All motion is disabled under `prefers-reduced-motion`.
- Animations use fill-mode `backwards`, so hover transforms keep working after the entrance.

## Accessibility

- Keep visible labels, roles, `aria-*` attributes and heading text intact; tests and assistive tech depend on them.
- Focus rings come from `:focus-visible` globally; don't remove outlines.
- Touch targets ≥ 40px. Body text ≥ 13px.
