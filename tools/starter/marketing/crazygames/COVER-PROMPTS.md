# CrazyGames covers: prompts for an image model

CrazyGames needs three covers with the same artwork:

| # | ChatGPT size to ask for | Becomes | Shape |
|---|---|---|---|
| 1 | 1536 × 1024 (landscape) | 1920 × 1080 | 16:9, trimmed from the top and bottom |
| 2 | 1024 × 1536 (portrait) | 800 × 1200 | 2:3 |
| 3 | 1024 × 1024 (square) | 800 × 800 | 1:1 |

Their rules: the **only text is the title**. No "Play", "New" or
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

Every reference listed in `../BRAND.md` (`marketing/references/`).

## Brief (send first, with the references)

```
I'm making store covers for my game "«Game name»". I'll ask for three images,
one at a time. All three must look like one set.

THE GAME: «the game in one line, from BRAND.md».

STYLE: match the attached references exactly: «style from BRAND.md». The
characters must look exactly like the references (same faces, markings,
outlines).

TITLE: the words "«Game name»" exactly as lettered in «title reference»:
«lettering description from BRAND.md». Spelled exactly «G-a-m-e».

RULES FOR EVERY IMAGE:
- The title is the ONLY text. No other words, numbers, labels, buttons,
  badges, logos or icons anywhere.
- No border or frame. Fill the whole canvas edge to edge.
- Crisp and clean, nothing blurry.
- Bright and readable even when shown small.

Reply "ready" and wait for the first image prompt.
```

## 1. Landscape (1536 × 1024)

```
Image 1, landscape, 1536 × 1024.
Left half: the title, large. Right half: «hero» big and happy, «doing the
game's core action», with «a few game pieces» around.
Keep the title and everything important inside the middle 80% of the height:
the top and bottom 10% will be trimmed.
```

## 2. Portrait (1024 × 1536)

```
Image 2, portrait, 1024 × 1536. Same set as image 1.
Top third: the title. Middle: «hero». Bottom third: «game pieces», with
«other characters» peeking in.
```

## 3. Square (1024 × 1024)

```
Image 3, square, 1024 × 1024. Same set.
Top: the title, about 70% of the width. Below: «hero», big and centred.
Simple and bold: this one is shown as a small thumbnail.
```

## If something comes out wrong

- Title misspelled or a different font: "Redo it with the title lettered
  exactly as in «title reference», spelled «Game name»."
- Extra words or badges: "Remove all text except the title."
- Character doesn't match: "«hero» must look exactly like «hero reference»."
- A border appears: "No border; fill the canvas edge to edge."
