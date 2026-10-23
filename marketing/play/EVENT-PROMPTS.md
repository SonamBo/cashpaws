# Play promotional content: Bell Quest event image

The image Play shows on an event card (Play Console → Grow users →
Promotional content). It should be a painted scene, like the event cards of
other cat games on Play: warm light, depth, and the cats doing something.
Stickers on a plain background look flat beside them.

## Play's rules (stricter than the store covers)

| Rule | What it means here |
|---|---|
| 1920 × 1080, 16:9, JPG or 24-bit PNG | `make-covers.py play-event` sizes it |
| 1 MB or less to be eligible for Spotlight | The tool saves a JPG under 1 MB |
| **No text at all** | No "Cash Paws" title, no "Bell Quest", no numbers, no $ signs. Unlike the covers, not even the title |
| No buttons, badges, store icons, border frames or rounded corners | Nothing that looks tappable |
| Safe zone | Keep the important parts inside the middle: Play crops 15% from the top, 10% from each side and 20% from the bottom on some phones |

## Steps

1. In ChatGPT (or Gemini), send the brief with the references attached, then
   one scene prompt. Ask for **1536 × 1024**. If one doesn't land, try another
   scene in the same chat.
2. Size and check it:
   ```bash
   python3 tools/marketing/make-covers.py play-event chatgpt-image.png
   ```
   This writes `marketing/play-event/covers/event-1920x1080.jpg`. The 3:2 image
   loses a strip at the top and bottom, which is why the prompts keep
   everything important in the middle.
3. Check by eye before uploading:
   - no letters or numbers anywhere, coins included;
   - the bell and the cats inside the safe zone.

## Attach these with the brief

From `marketing/references/`:

| File | What it shows the image model |
|---|---|
| `ref-cats.png` | All five cats: Patch, Biscuit, Marmalade, Mittens, Pepper |
| `ref-cat-hero.png` | Patch, the hero, up close |
| `ref-bell-prize.png` | The Bell Quest prize: a mountain of gold coins with a golden bell and red ribbon on top |
| `ref-bell-stones.png` | The quest path stones: grey (ahead), green (done), gold (where you are) |

---

## Brief (send first, with the four references)

```
I'm making an event banner for my mobile game "Cash Paws" for the Google Play
store. The event is "Bell Quest": you must beat 7 levels in a row; the cats
race up a path of 7 stepping stones, and whoever reaches the top shares a
mountain of gold coins topped with a golden bell.

STYLE: a rich, painted storybook illustration for a cosy mobile game, the
kind of key art used for seasonal events on Google Play. Warm golden-hour
light with soft light rays, a glowing treasure, depth (blurred foreground
details, the characters in the middle, scenery fading into the distance),
floating sparkles and tumbling coins for excitement. Saturated but soft
colours: honey gold, warm cream, sage green, sunset orange, a touch of sky
blue.

CHARACTERS: the cats must look exactly like the attached ref-cats.png and
ref-cat-hero.png: the same faces, colours, markings, rosy cheeks and kawaii
proportions. Patch is grey-and-white, Biscuit cream, Marmalade an orange
tabby, Mittens black-and-white, Pepper a grey tabby. Show them as full-body
cats in motion, happy and excited.

THE PRIZE AND PATH: the gold coin mountain, the bell with its red ribbon, and
the stepping stones look like ref-bell-prize.png and ref-bell-stones.png.

STRICT RULES (Google Play rejects the image otherwise):
- ABSOLUTELY NO TEXT: no words, letters, numbers, $ signs, logos or titles
  anywhere. Coins are plain gold with an embossed paw print, nothing written.
- No buttons, badges, icons, UI, borders, frames or rounded corners. Fill the
  canvas edge to edge.
- Keep the bell, the coin mountain and the cats' faces in the central area.
  The outer edges, especially the bottom fifth, may be cropped: put only
  scenery there.

Reply "ready" and wait for the scene.
```

## Scene A: The race to the bell (start here)

```
Landscape, 1536 x 1024.

A sunny meadow at golden hour. A winding path of 7 round stepping stones
climbs a gentle hill from the lower left to a glowing mountain of gold coins
just right of centre, with the big golden bell and red ribbon on its peak,
shining like a sun with soft rays behind it.

The five cats race up the stones, full body and mid-leap: Marmalade in the
lead, two stones from the top, paws reaching for the gold; Mittens and Pepper
bounding right behind; Biscuit hopping happily with her tail up; Patch on the
gold stone in the middle, looking back with a big grin. Far down the path in
the hazy distance, lots of tiny cats follow, so you feel the race of a
hundred cats.

Gold coins bounce and roll down the hill. Sparkles and a few red ribbon
streamers float in the air. A blurred tuft of grass and a few big coins sit
in the bottom corners for depth. The stones at the bottom are green (done),
then one gold, then grey ahead, as in ref-bell-stones.png.

No text, no numbers, no $ signs anywhere.
```

## Scene B: The treasure hill

```
Landscape, 1536 x 1024.

Late-afternoon sun behind a huge mountain of gold coins in the centre, topped
with the golden bell and red ribbon, glowing and sending warm rays across the
sky. The five cats stand together on the last stepping stones at its foot,
seen from slightly behind and to the side so we see their happy faces turned
up in wonder: Patch in the middle with paws raised, Marmalade jumping, Mittens
and Pepper pointing their noses up, Biscuit hugging a giant coin.

A few coins tumble down the slope towards them. Soft clouds, distant green
hills, floating sparkles and dust lit by the sun. Blurred flowers in the
foreground corners for depth.

No text, no numbers, no $ signs anywhere.
```

## Scene C: Victory on top

```
Landscape, 1536 x 1024.

The moment of winning. On top of a glowing mountain of gold coins in the
centre, the five cats celebrate around the golden bell with its red ribbon:
Patch rings the bell with both paws, Marmalade throws coins in the air,
Mittens and Pepper hug, Biscuit slides down the coins laughing. A shower of
gold coins and confetti-like sparkles fills the sky. Behind: a sunset sky,
soft clouds, the winding stone path down the hill below, light rays fanning
out from the bell.

Keep the cats and the bell in the middle; only sky at the top and coins and
hillside at the bottom edge.

No text, no numbers, no $ signs anywhere.
```
