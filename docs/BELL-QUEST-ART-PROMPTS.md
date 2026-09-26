# Bell Quest art: prompts for Gemini

Four images replace the placeholder art drawn in code. Paste them into Gemini
**one at a time, in the same chat**, starting with the brief below. Keeping one
chat keeps the style consistent from image to image.

## Before you start: attach the style references

These are in `bell-quest-art-kit/references/`. Attach all four with the first
message (the brief):

| File | What it shows Gemini |
|---|---|
| `ref-cat-cheer.png` | outline weight, shading, how "cute" we are |
| `ref-coin.png` | our gold coin: the exact gold, the rim, the outline |
| `ref-room.png` | the lobby background: soft, muted, no outlines |
| `ref-current-screens.png` | where each piece sits today, in placeholder form |

## The art style, in detail

Cash Paws uses **two styles**, and each asset belongs to one of them.

**1. Objects and characters (the bell, the coin pile, the stones)**
- Flat vector illustration, kawaii mobile-game art.
- **Thick dark brown outline, `#3f3a37`**, the same weight as the cat. The outline
  is the most common thing to drift; thinner looks wrong next to the cats.
- Soft cel shading: one flat shadow tone and one small white highlight per
  shape. At most a very gentle gradient. No texture, noise, grain or glossy 3D.
- Rounded, chunky, friendly shapes. No sharp corners, no fine detail. These are
  shown small, from 20 to 190 pixels wide.
- Front-on view, or a slight three-quarter view from above. No dramatic
  perspective.

**2. Backgrounds (the path scene)**
- Soft, muted pastel shapes with **no outlines**. Low contrast, so everything
  drawn on top stays readable.
- Cream ground, dusty sage greens, pale peach and blush. It should sit next to
  `ref-room.png` as though it were the next room over.

**Palette.** Stay inside these colours:

| Use | Hex |
|---|---|
| Outline | `#3f3a37` |
| Gold (bell, coins), light / mid / shadow | `#ffe58a` / `#f2bb34` / `#c98a14` |
| Collar strap red, and its shadow | `#dd5b57` / `#b5423f` |
| Cream ground | `#fdf7ea`, `#f6eedf` |
| Warm peach | `#fbe3ce`, `#f6e3bd` |
| Sage green | `#cfd6b2`, `#96a96f` |
| Stone, and its shadow | `#d8c4a3` / `#b9a07c` |
| Cocoa (dark accents) | `#54393e` |

**What not to do**, in any of the images:
- **No text, numbers or letters.** The game draws "Bell Quest", the prize and
  the timer itself, so any lettering in the art would clash with it.
- **No banknotes and no dollar signs.** Coins only.
- **No cats or characters.** The game puts the player's own chosen cat in.
- No frames, borders, drop shadows onto the background, or vignettes.

## Transparency: read this before you generate

Gemini, like ChatGPT, often "draws" transparency as a grey checkerboard, which
would show up in the game as a literal grid. So for every object (images 1–3):

> **Flat solid magenta background, pure #FF00FF, edge to edge, nothing else.**

I remove the magenta myself. Magenta, not the green used for the cat art,
because the stones have moss and green would get keyed out along with the
background. So **there must be no pink, magenta or purple anywhere in the
object itself.** The red strap is fine; it's a warm tomato red, not pink.

The background scene (image 4) is a full picture with no transparency.

Canvas: **square, 1024 × 1024**, with the object centred and at least 10%
margin on every side. Don't crop tight. I'll trim, scale and export each image
at three sizes myself.

---

## Message 1: the brief (attach the four references with this one)

```
I'm making art for a cosy mobile puzzle game called Cash Paws. I'll ask for
four images, one at a time. Please don't generate anything yet; just confirm
you understand the style.

STYLE (for objects): flat vector illustration, kawaii mobile-game art, exactly
matching the attached cat and coin. Thick dark brown outline #3f3a37, the same
weight as the cat's. Soft cel shading: one flat shadow tone and one small white
highlight per shape. No texture, no grain, no glossy 3D, no realistic lighting.
Rounded, chunky, friendly shapes with no fine detail; everything must read
clearly when shown only 40 pixels wide. Front-on view.

PALETTE: gold #ffe58a / #f2bb34 / #c98a14, collar red #dd5b57 with shadow
#b5423f, cream #fdf7ea, peach #fbe3ce, sage #cfd6b2 / #96a96f, stone #d8c4a3 /
#b9a07c, dark accents #54393e.

NEVER include: text, letters, numbers, banknotes, dollar signs, cats or any
character, frames, borders or vignettes.

BACKGROUND for every object: flat solid pure magenta #FF00FF filling the
entire canvas, with nothing else in it. Do not draw a checkerboard or
transparency pattern. No pink, magenta or purple anywhere in the object.

CANVAS: square 1024x1024, object centred with at least 10% empty margin on
every side.

The feature is called Bell Quest. Its symbol is a cat's collar bell: a small
round golden jingle bell on a red collar strap.
```

## Message 2: the bell icon

Used in the lobby icon, the card headers and the in-game notes, from 20 to 58
pixels wide. It must read as "cat bell" even when tiny.

```
Image 1 of 4: the Bell Quest icon.

A single round golden jingle bell, the kind on a cat's collar, hanging from a
short curved red collar strap that arcs across the top of the image like a
smile turned upside down. The bell is a sphere: gold #f2bb34 with a lighter
top-left (#ffe58a), a darker lower-right (#c98a14), and one small white
highlight at the top left. A thin horizontal groove runs around its middle.
The classic jingle-bell slot runs from the groove down to the bottom, ending in
a small round hole. A small metal ring joins the bell to the strap. The strap
is red #dd5b57, with a slightly darker underside.

Thick #3f3a37 outline around everything. Bold and simple: it will be shown as
small as 20 pixels, so no fine engraving, no pattern on the strap, no sparkles.

Flat solid pure magenta #FF00FF background, edge to edge. Square 1024x1024,
centred, 10% margin.
```

## Message 3: the grand prize

The heap at the top of the path and on the offer, rounding-up and win cards.
Shown 130–190 pixels wide.

```
Image 2 of 4: the grand prize.

A generous, rounded heap of gold coins, wider than it is tall, about 2:1. On
top of the heap sits a large version of the same golden collar bell from
image 1, with its red strap draped over the coins like a ribbon. The coins
match the attached coin exactly: gold, with a slightly raised rim and a
#3f3a37 outline. Mostly flat-lying coins in the heap, with a few standing on
their edge or tilted, and three or four loose coins at the foot of the pile.

Keep the top of the heap and the bell as the focus; nothing sticks out wider
than the pile itself. No banknotes, no chests, no gems. Leave the lower-left
corner of the heap fairly plain, because the game puts a small price label
over that spot.

Same outline and shading as image 1. Flat solid pure magenta #FF00FF
background, edge to edge. Square 1024x1024, centred, 10% margin.
```

## Message 4: the stepping stones

The seven steps up the path. The game places them itself and swaps between
these three looks.

```
Image 3 of 4: three stepping stones, side by side in one row, evenly spaced
with clear magenta gaps between them so they can be cut apart.

Each stone is a flat, rounded, slightly irregular oval slab, seen from the
front and a little above: about three times as wide as it is tall, with a
visible thicker front edge in a darker tone.

Left stone, "ahead": plain warm stone #d8c4a3, front edge #b9a07c.
Middle stone, "passed": the same stone with a soft cap of sage moss #96a96f
on top and a tiny white paw print pressed into it.
Right stone, "you are here": the same stone, but gold #f2bb34 with a #c98a14
edge and a small bright highlight, as if it's glowing.

All three are exactly the same size and shape, so they line up. Thick #3f3a37
outline. Flat solid pure magenta #FF00FF background, edge to edge. Square
1024x1024, stones in a horizontal row across the middle.
```

## Message 5: the path scene

The picture behind the stones. It sits inside the quest card, which is roughly
square.

```
Image 4 of 4: the Bell Quest path background. This one is a full scene, NOT on
magenta, and uses the SOFT BACKGROUND STYLE of the attached room instead of the
outlined object style: muted pastel shapes, no outlines, low contrast.

A cosy garden seen from above and ahead, rising gently away from the viewer.
The lower part is a soft sage meadow (#cfd6b2), the middle a winding band of
pale sandy ground where a path would go, and the top a warm glowing clearing
in peach and cream (#fbe3ce, #fdf7ea), as if lit by the prize waiting there.
A few simple rounded bushes and leaves hug the left and right edges, with two
or three faint paw prints in the sand.

Keep the CENTRE and the TOP THIRD calm and empty: the game draws stepping
stones zig-zagging up the middle and the prize at the top. Nothing important
in the middle 60% of the width.

No stones, no bell, no coins, no characters, no text. No hard edges, no dark
areas, no vignette. Square 1024x1024, filled edge to edge.
```

---

## Check each image before you send it

- Is the background pure magenta, with no checkerboard and no shadow on it?
  (Image 4 has no magenta.)
- Does the outline match the cat's weight? Hold them side by side.
- Is the gold the same gold as the coin reference?
- Any text, numbers, notes or dollar signs? Ask Gemini to remove them.
- Shrink the bell to thumbnail size on your phone. Can you still tell it's a
  bell?
- Are the three stones really the same size?

If one drifts, reply in the same chat: *"Keep everything the same, but make the
outline thicker, matching the cat"*. Gemini fixes one thing at a time better
than it redraws from scratch.

## When you send them to me

Name them `bell-icon.png`, `bell-prize.png`, `bell-stones.png` and
`bell-path-bg.png`. Don't crop or resize; send them exactly as Gemini made them.
I'll key out the magenta, clean the edges, cut the stones apart, make the three
sizes, and swap them in for the code-drawn versions. The layout won't change.
