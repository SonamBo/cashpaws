# CrazyGames covers: prompts for ChatGPT

CrazyGames needs three covers with the same artwork:

| # | ChatGPT size to ask for | Becomes | Shape |
|---|---|---|---|
| 1 | 1536 × 1024 (landscape) | 1920 × 1080 | 16:9, trimmed from the top and bottom |
| 2 | 1024 × 1536 (portrait) | 800 × 1200 | 2:3 |
| 3 | 1024 × 1024 (square) | 800 × 800 | 1:1 |

Their rules: the **only text is the title "Cash Paws"**. No "Play", "New" or
other words, no app or store icons, no borders, nothing blurry.

Paste the brief first, attach the references with it, then send the three
prompts **one at a time, in the same chat**. Then size them exactly, and put
the landscape and portrait covers at the start of the preview videos:

```bash
python3 tools/marketing/make-covers.py crazygames landscape.png portrait.png square.png
node tools/marketing/record-preview.mjs --cover-landscape marketing/crazygames/covers/cover-1920x1080.png \
                                        --cover-portrait  marketing/crazygames/covers/cover-800x1200.png
```

## Attach these with the brief

They're in `marketing/references/`:

| File | What it shows ChatGPT |
|---|---|
| `ref-feature-graphic.png` | your Play feature graphic: the **title lettering**, Patch, cash and coins. The main style target. |
| `ref-cats.png` | all five cats cheering: Patch, Biscuit, Marmalade, Mittens, Pepper |
| `ref-cat-hero.png` | Patch hugging the money: the hero pose |
| `ref-gameplay.png` | the game: glass tubes of coins and banknotes |
| `ref-room.jpg` | the cosy room behind the game |

---

## Brief (send first, with all five references)

```
I'm making store covers for my mobile puzzle game "Cash Paws". I'll ask for
three images, one at a time. All three must look like one set.

THE GAME: you sort coins and banknotes between glass tubes; four of the same
in a tube "banks" and the money is added to your total. Cats are the
characters.

STYLE: match the attached references exactly: flat vector, kawaii mobile-game
art, thick dark-brown outlines on characters, soft cel shading, rosy cheeks,
warm cream / sage green / orange palette. The cats must look exactly like the
ones in ref-cats.png and ref-cat-hero.png (same faces, markings and outline),
and the coins and notes like ref-gameplay.png and ref-feature-graphic.png.

TITLE: the words "Cash Paws" exactly as lettered in ref-feature-graphic.png:
"Cash" in rounded charcoal letters, "Paws" below in rounded orange letters,
with a white paw print in place of the "a". Spelled exactly C-a-s-h P-a-w-s.

RULES FOR EVERY IMAGE:
- The title is the ONLY text. No other words, numbers, labels, buttons,
  badges, logos or icons anywhere (the coins may show $ values like the game).
- No border or frame around the picture. Fill the whole canvas edge to edge.
- Crisp and clean, nothing blurry; no photographic textures.
- Bright, happy, readable even when shown small.

Reply "ready" and wait for the first image prompt.
```

## 1. Landscape (1536 × 1024)

```
Image 1, landscape, 1536 × 1024.

Scene: a cosy cream room with a soft sage-green wall (like ref-room.jpg).
Left half: the "Cash Paws" title, large, readable at a glance.
Right half: Patch (the grey-and-white cat from ref-cat-hero.png), big and
happy, hugging a stack of green banknotes, with coins tumbling into three
glass tubes of sorted coins beside it, like the tubes in ref-gameplay.png.
Two or three of the other cats (Marmalade the orange tabby, Mittens the
black-and-white cat) peek in from the lower corners, cheering.
A few gold coins and notes flying in the air for energy.

IMPORTANT: keep the title, Patch's whole head and all the important things
inside the middle 80% of the height; the top and bottom 10% will be trimmed.
```

## 2. Portrait (1024 × 1536)

```
Image 2, portrait, 1024 × 1536. Same set as image 1.

Top third: the "Cash Paws" title, large and centred.
Middle: Patch hugging a stack of banknotes, as in image 1, centred and big.
Bottom third: a row of three or four glass tubes of sorted coins, with
Marmalade and Mittens peeking over them, cheering, and coins flying up.
Same room background and colours as image 1.
```

## 3. Square (1024 × 1024)

```
Image 3, square, 1024 × 1024. Same set as images 1 and 2.

Top: the "Cash Paws" title, centred, filling about 70% of the width.
Below it: Patch hugging the banknotes, big and centred, with two glass tubes
of coins either side and a few coins flying.
Keep it simple and bold: this one is shown small, as a thumbnail.
```

## If something comes out wrong

- **Title misspelled or in a different font:** "Redo it with the title
  lettered exactly as in ref-feature-graphic.png, spelled Cash Paws."
- **Extra words or badges:** "Remove all text except the title."
- **Cat doesn't match:** "Patch must look exactly like ref-cat-hero.png:
  same grey patches, same face, same thick brown outline."
- **A frame or border appears:** "No border; fill the canvas edge to edge."
