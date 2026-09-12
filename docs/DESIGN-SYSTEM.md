# Cash Paws — design system

Every colour here was sampled out of the source mockup rather than invented, so
the build matches the art you approved. Tokens live in `www/css/tokens.css`;
this file explains the reasoning behind them.

## Colour

| Token | Hex | Job |
|---|---|---|
| `--ground` | `#fcf5e6` | page |
| `--surface` | `#fdf7ea` | tubes, pills, nav |
| `--surface-sunk` | `#f4ecd8` | the board during a telegraph |
| `--rule` | `#e4dbc8` | borders, empty-slot markers |
| `--ink` | `#373f45` | text |
| `--ink-soft` / `--ink-faint` | `#6b7480` / `#a2a8ae` | secondary, tertiary |
| `--green` | `#497b51` | progress, primary actions, active nav |
| `--orange` | `#eb7a29` | threat only — telegraph, and Stage 3's inflow card |
| `--sage` / `--taupe` | `#cfd6b2` / `#a89688` | level-up and level-lost grounds |

Orange is reserved for danger. If it starts appearing on buttons or decoration,
the telegraph stops meaning anything.

## Chips

The chips are the mockup's currency artwork. The denomination is printed on the
art, so **the art sets the ladder**: 1 / 5 / 10 / 20 / 50, not the original
5 / 10 / 20 / 50 / 100.

| Value | Art | Unlocks |
|---|---|---|
| $1 | blue coin | LV 1 |
| $5 | silver coin | LV 1 |
| $10 | copper coin | LV 1 |
| $20 | green bill | LV 3 |
| $50 | purple coin | LV 5 |

Chosen across both rows of the source card for maximum hue separation — blue,
grey, orange, green, purple. The card's printed values do not always match its
own captions: the purple coin is captioned $20 but reads $50 on the art, which
is what makes a complete ladder possible at all.

The Shop's second set (teal $5, pink $10, yellow $20, grey $50, sharing the
blue $1) is the only other complete ladder in the source.

**This changed the economy.** The new denominations pay roughly 45% of the old
ones, so level thresholds were rescaled from `500 + 400(n-1)` to `200n` —
floors of $0, $200, $600, $1,200, $2,000, $3,000. Tuned against `test/pace.js`
until median turns-to-level matched the previous build: LV2 at 55 turns against
58 before, LV3 at 151 against 144.

## Artwork

The cats are cut out of the source mockup, not redrawn. Six assets live in
`www/img/`, extracted with an edge flood fill and a component filter that drops
confetti, paw prints and stray leaves.

| Asset | Where it appears |
|---|---|
| `cat-avatar` | header, 36px square face crop |
| `cat-peek` | rear view, bottom of the board |
| `cat-cheer` | level-up banner, full panel width |
| `cat-sad` | stuck-board and level-lost cards |
| `cat-hero` | with the money pile; reserved for the lobby |
| `coin` | the paw coin, in the balance pill and action costs |

`cat-cheer` is the one that could not be cut: the card behind it is the same
cream as the cat's fur, so no tolerance separates them. It keeps its sage
ground instead, cropped at exactly the card's top edge (y=256 in the source)
and shown full-bleed so its own vignette does not read as a seam. Our card
butts onto it, which reproduces the mockup's composition rather than
approximating it.

The inflow card has no cat. The mockup has no alarmed pose, and a hand-drawn
stand-in next to the real illustrations looked worse than nothing.

**Resolution.** The mockup is roughly 1x for a 402pt screen, so every asset is
displayed at or below its native size. On a 3x phone they will look soft. The
fix is a re-export of the cats at 3x from whatever produced the mockup;
dropping them into `www/img/` at the same names is the whole change.

## Type

One family, personality carried by weight and tracking rather than a second
face. Net worth is 40px/800 with `-0.025em` tracking and tabular figures; chips
15px/800; labels 11–13px/800 with `0.08em` tracking.

**Open item:** there is no webfont. The build container has no network, so this
is currently the system rounded stack — `ui-rounded` on iOS, Roboto on Android.
Android will look flatter than your mockup's rounded logotype. Stage 6 bundles a
real face; drop a `.ttf` into `www/fonts/` and it is a one-line change.

## Layout

402×874, four bands: header 194, board 540, footer 70, nav 70.

Columns sit on one row up to five, then split into two balanced rows — 6 becomes
3+3, 7 becomes 4+3, 8 becomes 4+4. At 66px per tube with 10px gaps, five tubes
come to exactly the 370px content width, so the grid never needs to reflow.

Every empty slot carries a visible marker so a column always reads as a four-cell
grid even when it holds one chip. That is the spec's ghost-cell rule, translated
out of the modernist ruled-line treatment into something that suits a soft tube.

## Motion

Declared in tokens, applied in Stage 3. Chips animate in on arrival; the rail
fill and telegraph transition; everything else answers a tap. No ambient motion —
the only thing that should move on its own is the flow, because that is the
threat.

`prefers-reduced-motion` collapses all durations to 1ms.
