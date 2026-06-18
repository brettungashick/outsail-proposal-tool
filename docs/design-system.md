# OutSail Design System — Build Spec

Single source of truth for visual style. Don't invent colors, type, spacing, or
components that aren't grounded here. The tokens below are implemented in
`tailwind.config.ts` and `src/app/globals.css`.

**About OutSail:** HR Tech advisory & brokerage. We help companies (50–5,000
employees) select, implement, and optimize HR technology. Free to the buyer —
vendors pay the commission. The brand is a confident, sober, blue-anchored
identity built on a sailing metaphor (the "C-with-sail" mark) signaling trust,
clarity, and forward momentum.

**The feel:** modern, sophisticated, clean, technology-forward, calm. Crisp
straight lines, generous whitespace, blue + neutral only. Premium enterprise
software / consulting firm — never playful, neon, or startup-trendy.

---

## 1. Color

| Token | Hex | Use |
|---|---|---|
| Deep Harbor | `#1E3A6B` | headings, wordmark, primary-hover |
| OutSail Blue | `#4277C7` | PRIMARY action, links, accents |
| Sky Sail | `#7FA8DC` | highlights, gradient tip |
| Deep Navy | `#0F172A` | primary body text on light |
| Slate | `#334155` | secondary text |
| Cool Gray | `#64748B` | tertiary text, eyebrow labels |
| Light Gray | `#E2E8F0` | dividers, borders |
| Off White | `#F4F7FB` | page background, surfaces |
| White | `#FFFFFF` | cards/surfaces |
| Tint 25 / 50 / 100 | `#EEF6FE` / `#DCEAF7` / `#BFD5EE` | light-blue callouts/fills |

Tailwind names: `harbor`, `osblue`, `sky`, `cool`, `line`, `offwhite`,
`tint-{25,50,100}`. The default `blue-*` scale and the `outsail-*` aliases are
remapped to these brand values, so existing `bg-blue-600` / `bg-outsail-blue`
utilities are already on-brand.

- **Primary action / links:** OutSail Blue. Hover → Deep Harbor. Press → `#15295A`.
- **Headings:** Deep Harbor or Deep Navy. **Body:** Slate. **Muted/labels:** Cool Gray.
- **Page background:** Off White. **Cards/surfaces:** White. **Reverse sections:** Deep Harbor bg with Off-White text.
- **Gradient is decoration only** — isometric icons / illustration. Never fill buttons, text, progress bars, or page backgrounds with a gradient.
- Two-track palette only: one blue family + one neutral ramp. No greens/teals/purples or warm accents. No semantic red/green except minimal, muted status indicators when truly required.

## 2. Typography

Inter throughout (loaded in `globals.css`). Regular (400) body, Semibold (600)
UI labels/buttons, Bold (700) headings. Sentence case for almost everything.
All-caps **only** for ≤2-word eyebrow labels with `0.08em` letter-spacing in
Cool Gray. No serifs, no italics outside inline emphasis, no second display face.

## 3. Layout, shape, spacing

- **8px spacing system.** Page gutters 64–80px desktop, 24px mobile.
- **Corner radius: 0 everywhere.** Cards, buttons, inputs, badges, modals — all squared. `rounded-*` utilities are no-ops by config. No pills, no rounded corners.
- **Borders:** 1px Light Gray on cards/inputs. No thick/double borders. No left-accent-border cards.
- **Cards:** white surface, 1px Light Gray border, squared, `shadow-sm` at rest → `shadow-md` on hover.
- **Top nav:** 64–72px, white, 1px Light Gray bottom border, no shadow.
- **Content max-width:** 1200px (1440px for hero/marketing).

## 4. Components

- **Primary button:** OutSail Blue bg, white text, Semibold, squared, `shadow-sm`. Hover → Deep Harbor. Press → `#15295A`. Padding ~`12px 20px`.
- **Secondary button:** Off-White bg, OutSail Blue text, 1px Light Gray border, squared. Hover → `#EEF6FE` bg.
- **Input:** white bg, 1px `#CBD5E1` border, squared, 15px text. Focus → 2px OutSail Blue outline. Never remove focus styling.
- **Link:** OutSail Blue, underlined; hover → Deep Harbor, underline stays.
- **Badge/tag:** squared, `#EEF6FE` bg + Deep Harbor text, or Light Gray bg + Slate.
- **Disabled:** opacity 0.45, no pointer events — keep brand color, lower contrast.

## 5. Icons

- **UI icons:** vector SVG (Lucide-style), sizes 16 / 20 / 24px, `currentColor`.
- **No emoji. No Unicode icons. No icon fonts** (no FontAwesome / Material Icons).

## 6. Shadows & motion

- Shadows are warm-neutral, **never blue-tinted** (`shadow-sm/md/lg` in config).
- Standard easing `cubic-bezier(0.4,0,0.2,1)`; durations 180/240/360ms.

## 7. Voice & content

Calm, declarative, professional with a soft optimistic edge — a steady advisor,
not a sales hustle. Second person ("you" = client, "we" = OutSail). Confident,
not boastful; end on a period, not "!". No superlatives or hype verbs. Sentence
case for UI. Spell the company "OutSail"; the wordmark locks to "OUTSAIL".

## 8. Do / Don't

**Do:** blue + neutral only · squared corners · Inter · generous whitespace ·
subtle warm-neutral shadows · sentence case · vector icons · visible focus rings.

**Don't:** rounded corners or pills · gradient buttons / gradient page
backgrounds · emoji or icon fonts · warm tones / beige / wood textures · neon or
extra accent colors · exclamation-point hype copy · blue-tinted shadows ·
left-border accent cards · backdrop-blur / frosted glass.

---

*Logo files live in the OutSail brand kit. On dark/Deep-Harbor surfaces use the
Fog-White (`#F4F7FB`) logo; on light surfaces use Deep Harbor.*
