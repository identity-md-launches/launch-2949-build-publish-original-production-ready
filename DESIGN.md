# Squeekstr Desk design system

## Overview

Squeekstr Desk is a working paper protocol desk for people learning SQUEEKSTR. A near-black, slightly green surface system holds dense vault controls; warm amber identifies the main action. Cream tracker receipts make the user's reward claim visually distinct from the darker shared vault. Original hamster portraits and a technical wheel drawing give the desk its Squeekchain identity without copying the reference products.

The product opens as a usable desk with a compact starter strip. There is no marketing page or separate onboarding route. After one click, the strip disappears and the deposit action moves up. Controls, preview data and consequences stay together. `src/App.tsx` is the composition; `src/styles.css` defines the system.

## Colors

Canonical colors are hexadecimal CSS custom properties in `src/styles.css:8`. Use role tokens in UI styles; the isolated SVG portraits have their own six decorative palettes.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#10120f` | Page, input wells, receipt notches |
| `--surface` | `#191c17` | Main panels and activity icon backgrounds |
| `--surface-raised` | `#22261f` | Neutral buttons, segments and counts |
| `--surface-hover` | `#2a2e25` | Selected/hovered neutral controls |
| `--line` / `--line-soft` | `#34392e` / `#292e24` | Panel outlines / internal separators |
| `--text` | `#f1f0e5` | Main cream text |
| `--muted` / `--quiet` | `#a7ad9d` / `#929b87` | Supporting labels / tertiary metadata |
| `--accent` / `--accent-hover` | `#ebc483` / `#f6d49b` | Main action / hover |
| `--accent-soft` | `#302c20` | Starter strip background |
| `--ink` | `#24281f` | Dark text on amber and cream |
| `--green` | `#bdd39c` | Live status and positive growth, always with text |
| `--danger` | `#f3a8a0` | Errors and reset confirmation |
| `--paper` / `--paper-muted` | `#e9e7d7` / `#555a49` | Receipt surface / receipt secondary text |
| `--focus` | `#eac483` | 2px keyboard outline with 4px offset |

The wheel surface is `#1b2017`, a deliberate illustration backdrop. Receipt claim buttons use `#343d2c`; their secondary trade buttons use `#d9dcc8`. A receipt button's focus ring is `#4d582e` so it is visible on cream. Forced-colors mode uses system `Highlight` and `ButtonText`.

Measured by the rendered taste probe: heading text on the page is **16.44:1**; the starter CTA text on amber is **9.12:1**; community-power labels on their surface are **7.47:1**. The minimum ratio among the probe's measured initial-page text boxes was **5.36:1**. Active receipts and modal states had no axe contrast violations. This is not a claim about every possible browser/state or a full accessibility certification.

## Typography

Manrope is served locally from `public/fonts/manrope-latin.woff2`, with `Arial, sans-serif` fallbacks. The variable file supplies weights 200–800; the UI uses **400, 600 and 700**. `font-display: swap` avoids invisible text. A browser font-loading check confirmed Manrope loaded. There are no remote font requests.

| Token | Size at a 16px root | Use |
| --- | ---: | --- |
| `--size-xs` | 12px | Dense labels, metadata, action text |
| `--size-sm` | 14px | Body text, secondary headings, modal prose |
| `--size-base` | 16px | Panel headings, trade input, mobile wallet balances |
| `--size-lg` | 20px | Brand, modal heading, mobile totals, receipt accrual |
| `--size-xl` | 28px | Page heading, desktop metrics, receipt power, amount inputs |
| `--size-display` | 36px | Desktop wheel RPM |

Body line-height is 1.5; prose is 1.6, and instructional list text is 1.65. Short headings use 1.2–1.35. The page heading uses `-0.035em`; large totals use up to `-0.05em`; small text has natural tracking. Numbers use `font-variant-numeric: tabular-nums`. Only short API field names in About use system monospace. Inputs are at least 16px, including on phones. Heading text wraps with `text-wrap: balance`; critical values are neither ellipsized nor hidden.

The six-size scale is constant across breakpoints; components choose another existing step rather than inventing a new size. Compact 12px labels are intentional for this desk, not a long-form reading surface.

## Layout

The desktop shell is at most 1660px wide. Its sidebar is 206px and the desk padding is 34px. The main workspace has a flexible vault/receipt column and a 330px wheel/wallet/market column, separated by 24px. Panel padding is 16–20px; repeated cards use 12–16px gaps; major groups use 24–30px. Stats are three equal columns.

Implemented breakpoints in `src/styles.css`:

- **1500px and above:** desk horizontal padding becomes 42px, side column 350px, portraits slightly larger.
- **1230px and below:** sidebar 178px, side column 300px, vault selection grid two columns, primary row may stack.
- **1000px and below:** sidebar disappears, header and desk padding reduce; vault grid can fit three columns temporarily.
- **840px and below:** side column becomes 280px, collection returns to two columns, receipts one column.
- **680px and below:** workspace becomes one column in DOM order: vault, receipts, wheel, paper wallet, market, activity. Header, starter and action rows adapt; stats retain three compact cells. Wheel becomes a horizontal art/reading composition. Reset is available in the footer.
- **440px and below:** collection is two columns, receipts one column, receipt actions remain side by side.
- **350px and below:** the deposit row stacks, padding reduces, wheel artwork scales down. The main page title still names the paper vault.

The first 390×844 screen includes the product and starter action; after starting it includes the deposit action and selected collection cards. Neither depends on scrolling through a hero. Both were inspected in screenshots. Reflow was measured at 320, 390, 768, 1024 and 1440px, plus 390px with 200% text enlargement. The header wraps under enlarged text rather than overflowing. Native browser zoom, physical-device layouts and translated/RTL variants are not claimed as tested; English is the implemented language.

Navigation uses anchors with scroll margins. There is no sticky header or bottom navigation covering the desk. Toasts are dismissible and inset from mobile edges. Content and buttons retain the page's mobile margins.

## Elevation & depth

Panels use a 1px structural border and tonal fill, without a shadow. Selected Squeeks add an amber outline. Receipt cards use cream fill and a dashed tear line with small page-colored circular notches. These are decorative pseudo-elements with no hidden text.

Only the notification uses a shadow (`0 8px 30px #0005`). Native dialogs enter the browser top layer with a dark translucent backdrop and 5px backdrop blur. The interface avoids gradients, texture overlays and decorative glow.

## Shapes

The shared panel radius is `--radius: 12px`. Buttons and inputs use 7px; Squeek and receipt cards use 8px; dialogs use 14px; compact segment backgrounds use 4–6px. Status dots and token markers are circular. SVG icon strokes are 1.6px, round-capped, using `currentColor`.

## Components

- **Brand and art** (`src/Art.tsx`): `BrandMark`, six-variant `Hamster`, `Wheel`, and the local `Icon` path set. All decorative SVGs are `aria-hidden`. The wheel uses a rotating outer group; the hamster stays inside the wheel. It is a visual response to status, not a hardware camera feed.
- **Buttons** (`src/styles.css`, `.button`): `primary` amber for the current vault/start/confirmation action; `secondary` neutral for swaps and alternatives; `danger` for confirmed reset. Base min-height is 44px. Disabled actions remain visibly labelled, with an adjacent explanation or selection state.
- **SqueekTile** (`src/App.tsx`): a native toggle button using `aria-pressed`, an explicit name/level/power label, selected checkmark and optional cooldown text. The wrapper itself is the hit target. The kit is labelled as a preview before start.
- **Vault view buttons**: two native pressed-state buttons, not partially implemented ARIA tabs. Each reaches a real action surface. Merge previews show total before/after and the two exact power allocations before confirmation.
- **Tracker receipt**: cream article with immutable receipt ID, current mining power, proportional reward share, owner, current accrual, Claim and Trade. Receipt details stay separate from the mutable merged vault tip.
- **Paper wallet / swap**: You and Friend pressed-state controls; a labelled amount input, visible fixed rate, net proceeds, tax and auto-buy progress. Invalid amounts have nearby errors, `aria-invalid`, `aria-describedby` and focus returned to the amount field.
- **Live wheel panel**: text state, RPM, full day/time in UTC, confirmed height or Practice tick, live-source link, stale label, retry and explicit Practice controls. Spin Rush is a native checkbox with a custom track, a visible focus perimeter, a checked preference and an explicit active/base-rate description.
- **Modal** (`src/App.tsx:32`): native `dialog.showModal()`, labelled title, background inertness, explicit Tab/Shift+Tab wrapping, Escape/close, backdrop-only dismissal and trigger focus return. When trading removes the original trigger, focus returns to the receipt section heading. Reset is a separate confirmation; dismissing it preserves state.
- **Activity / notifications**: eight recent entries displayed from a bounded 40-entry local ledger. A stable polite `role=status` region communicates completed actions. Notifications stay dismissible; field errors stay near their inputs. A storage warning truthfully changes the footer to “Session only”.

Hover styles run only on hover-capable devices. Color/opacity transitions last 150ms with `cubic-bezier(.2,0,0,1)`; named properties are used, never `transition: all`. Press feedback scales to 0.96. Wheel animation only runs under `prefers-reduced-motion: no-preference`, can be paused independently, and is replaced by the same static state text under reduced motion. No page-load entrance animation delays interaction.

## Do's and don'ts

Use `.panel`, `.panel-heading`, `.button`, the six type tokens and the existing gaps for a new desk section. Prefer a labelled native control to custom keyboard behavior. Keep a calculation and its action together, with paper units in context. Expose a mobile entry point and an empty-state next action. Put per-field recovery text beside the field.

Do not style simulated readings as live, invent market prices, hide a critical number with ellipsis, add wallet signing, or replace data with decorative charts. Keep dark surfaces for the common vault and cream for owned receipt claims. Use amber sparingly for the next action; a positive value still needs a descriptive label.

A new section should be an anchor-addressable section in the existing workspace or normal desk flow, with a descriptive heading, the relevant action, a native form where needed, and explicit empty/error states. Verify it at 390 and 320px and with enlarged text before extending this document.
