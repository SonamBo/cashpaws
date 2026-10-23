# Play feature graphic: prompt

The 1024 × 500 banner at the top of the store page. It's also the cover of
the preview video, and it's used in large app collections and ads. Same
painted style as the Bell Quest event image (`art/bell-quest-event-chatgpt.png`),
so the store page and the event look like one game.

## Play's rules for the feature graphic

| Rule | What it means here |
|---|---|
| 1024 × 500, JPG or 24-bit PNG, no transparency | `make-covers.py play-feature` sizes it |
| Focal point near the centre; logo and title out of the edges | Play cuts the edges in some layouts |
| A video play button sits in the middle when there's a preview video | Keep faces and the title off the exact centre |
| No "Free", "New", "#1", "Best", "Top", sale or ranking words | The title is the only text |
| No phones or devices, no store badges, no other games' characters | |
| Vibrant colours, not white, black or dark grey edges | It sits on Play's white or dark background |

## Steps

1. In ChatGPT, attach the references below, paste the prompt, and ask for
   **1536 × 1024**. The banner is about 2:1, so the tool keeps the middle
   band and drops the top and bottom. The prompt keeps everything important
   in that band.
2. Size it:
   ```bash
   python3 tools/marketing/make-covers.py play-feature chatgpt-image.png
   ```
   This writes `marketing/play-feature/covers/feature-1024x500.png`.
3. Check by eye: is "Cash Paws" spelled right, and is there no other text
   apart from the values on the coins?

## Attach these

| File | Why |
|---|---|
| `art/bell-quest-event-chatgpt.png` | The style to match: painted, golden light |
| `../references/ref-feature-graphic.png` | The title lettering, exactly |
| `../references/ref-cats.png` | The five cats |
| `../references/ref-cat-hero.png` | Patch, the hero |
| `../references/ref-gameplay.png` | The glass tubes, coins and notes |

## Prompt

```
Make the main store banner for my mobile game "Cash Paws" on Google Play.
Landscape 1536 x 1024, but it will be cropped to a wide 2:1 strip: put
everything important in the middle band (between 20% and 80% of the
height). Only background at the very top and bottom.

THE GAME: a cosy puzzle where you sort coins and banknotes between glass
tubes. Four of the same in a tube bank into your fortune. Cats run it.

STYLE: exactly the painted storybook style, warm golden light and glow of
the attached Bell Quest image. The cats must look exactly like ref-cats.png
and ref-cat-hero.png (same faces, colours, markings, rosy cheeks).

SCENE: a cosy, sunlit cream room with a sage-green wall, a big window with
golden afternoon light and a few plants, softly blurred behind.

LEFT THIRD: the title "Cash Paws", big and readable, lettered exactly like
ref-feature-graphic.png: "Cash" in rounded charcoal letters, "Paws" below in
rounded orange letters with a white paw print in place of the "a". A soft
cream glow behind it so it stands out. Spell it exactly C-a-s-h P-a-w-s.

RIGHT THIRD: Patch (the grey-and-white hero cat) sitting on a heap of gold
coins, hugging a stack of green banknotes with a huge happy grin. Beside him
three glass tubes of neatly sorted coins like ref-gameplay.png (blue $1,
silver $5, orange $10, purple $50), with coins tumbling into them.
Marmalade (orange tabby) and Mittens (black and white) peek out from behind
the tubes, cheering.

MIDDLE: lighter and calmer, coins and a banknote flying through the air
with sparkles, linking the title and the cats. No faces or letters in the
exact centre (a video play button goes there).

RULES: the title is the ONLY text. No other words, slogans, "Free", "New",
numbers (except the values on the coins), badges, logos, phones, borders or
rounded corners. Fill the canvas edge to edge with warm, vibrant colour.
```
