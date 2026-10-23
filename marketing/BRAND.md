# Cash Paws: brand kit

What any store art, trailer or listing for Cash Paws must match. The
`marketing-creatives` skill reads this first.

## Name and title

- **Cash Paws.** Two words, both capitalised. Never "CashPaws" in anything a
  player sees.
- Title lettering, as in `references/ref-feature-graphic.png`:
  - "Cash" in rounded charcoal letters;
  - "Paws" below it in rounded orange letters, with a white paw print in place
    of the "a".

## Characters

Five cats with artwork, all in `references/ref-cats.png`:

| Cat | Look |
|---|---|
| **Patch** (the hero) | Grey-and-white, as in `references/ref-cat-hero.png` |
| **Biscuit** | Cream |
| **Marmalade** | Orange tabby |
| **Mittens** | Black and white |
| **Pepper** | Grey tabby |

Style:
- flat vector, kawaii mobile-game art;
- thick dark-brown outlines, soft cel shading, rosy cheeks;
- poses: peek, cheer, slump, face.

## The game in one line

Sort coins and banknotes between glass tubes; four of the same value bank into
your fortune; every few moves new money drops into every tube.

## Palette

- Cream backgrounds (`#fbf7f0`, `#f4ecdc`) and sage green (`#c9d6a4`, `#deeaba`).
- Primary green `#3f7a52` for buttons.
- Coins: $1 blue, $5 silver, $10 orange, $20 green note, $50 purple.
- Lucky Paw coin: gold.

## Voice

- Cosy, warm, a little playful.
- Short sentences.
- Never pushy: no "Play now!", no countdowns.

## References (`references/`)

| File | Use |
|---|---|
| `ref-feature-graphic.png` | The Play feature graphic: title lettering, Patch with cash. The main style target |
| `ref-cats.png` | All five cats cheering |
| `ref-cat-hero.png` | Patch hugging the money |
| `ref-gameplay.png` | The board: glass tubes, coins, notes |
| `ref-room.jpg` | The cosy room behind the game |
| `ref-bell-prize.png` | Bell Quest's prize: the gold coin mountain with the bell and red ribbon |
| `ref-bell-stones.png` | Bell Quest's path stones: grey (ahead), green (done), gold (you are here) |

## Where things are

| Folder | What |
|---|---|
| `crazygames/` | CrazyGames: `LISTING.md` (form text), `COVER-PROMPTS.md`, `covers/` (finished) |
| `play/` | Google Play: `FEATURE-PROMPTS.md` (the feature graphic), `EVENT-PROMPTS.md` (promotional content images, where no text is allowed), `art/` (the generated originals). Finished, sized art: `play-feature/covers/`, `play-event/covers/` |
| `showcase.mjs` | The trailer the video recorder plays |
| `out/` | Generated videos; not committed, re-made with `tools/marketing/record-preview.mjs` |
