# Cat artwork spec

Four poses per cat. Patch already has all four, so the outstanding commission is
**five cats × four poses = 20 pieces**, plus Patch's cheer pose if you want to
replace the one cut from the mockup.

## The poses

| Pose | Where it appears | Canvas (3x) | Anchor |
|---|---|---|---|
| `peek` | leaning on the ledge, board screen | 450 × 360 | paws touching the bottom edge, head centred |
| `cheer` | level-up card, over a sage ground | 600 × 420 | paws at the bottom edge |
| `slump` | stuck board and level lost | 630 × 400 | body resting on the bottom edge |
| `face` | progress-bar knob (38px) and Cats list (44px) | 360 × 360 | head centred, fills most of the frame |

The canvas and the anchor must be **identical across all six cats for a given
pose**, or the cat will jump when the player switches.

## File requirements

- PNG-24 with a **real alpha channel**. Not a painted checkerboard — one earlier
  asset had transparency painted in as a grey grid, which renders as a literal
  grid. Not on a white background either.
- Named `cat-{id}-{pose}.png`, e.g. `cat-mittens-peek.png`.
- Soft contact shadow is fine; keep it inside the canvas.
- Same line weight and palette family across the set so they read as one family.

The ids are `mittens`, `soot`, `marmalade`, `pepper`, `biscuit`.

## Dropping art in

1. Put the four files in `www/img/`.
2. In `www/js/cats.js`, set that cat's `hasArt: true`.
3. `node test/preflight.js` — it fails if a cat is flagged but missing a pose.

Until the flag is flipped, that cat plays with Patch's art. Nothing else to
change.

## What does not change

The lobby hero with the money pile, and the app icon, always stay Patch. They
are the app's face, and swapping them makes its identity wobble.
