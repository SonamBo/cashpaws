# Level modifier art: prompts for ChatGPT

Seven images for the five proposed modifiers. Paste them into ChatGPT **one at
a time, in the same chat**, starting with the brief. They're written so you
can drop any modifier we decide not to build: each prompt stands on its own
after the brief.

| # | File name | Modifier | Shown at |
|---|---|---|---|
| 1 | `lucky-paw.png` | Lucky Paw coin (counts as any value) | chip size, about 50 px |
| 2 | `ice.png` | Frozen coin, full ice | over a chip, about 56 px |
| 3 | `ice-cracked.png` | Frozen coin, one crack left | over a chip, about 56 px |
| 4 | `padlock.png` | Locked tube | on a tube, about 40 px |
| 5 | `piggy.png` | Piggy-bank tube | above a tube, about 48 px |
| 6 | `mouse.png` | Mouse thief, sneaking | on a tube, about 48 px |
| 7 | `mouse-caught.png` | Mouse thief, caught | on a tube, about 48 px |

## Attach these with the brief

They're in `modifier-art-kit/references/`:

| File | What it shows ChatGPT |
|---|---|
| `ref-chips.png` | the five coins and the note: the style for **images 1–3** |
| `ref-cat-peek.png` | outline, shading and face: the style for **images 4–7** |
| `ref-bell.png` | the Bell Quest bell: an object already drawn in that style |
| `ref-board.png` | the game board, so it knows where these sit |

## The two styles, and which image uses which

**Chip style (images 1–3): soft and glossy, no dark outline.**
- Round, slightly domed coins, with a bevelled rim a shade darker than the
  face, a soft highlight at the top left and a gentle shadow at the bottom.
- The value is embossed in the same colour family, a little darker than the
  face.
- No black or dark brown outline. The coins in `ref-chips.png` are the exact
  target.

**Character style (images 4–7): the cats' style.**
- Flat vector illustration, kawaii mobile-game art.
- **Thick dark brown outline, `#3f3a37`**, the same weight as the cat. A
  thinner outline is the most common drift.
- Soft cel shading: one shadow tone and one small white highlight per shape.
  No texture or grain, and no glossy 3D.
- Chunky, rounded and simple. These are shown only 40–48 px wide, so any fine
  detail disappears.
- Faces, where there is one, match the cats: closed happy eyes drawn as
  upward arcs, a small pink nose and pink blush.

**Palette.** Stay close to these:

| Use | Hex |
|---|---|
| Outline (character style) | `#3f3a37` |
| Gold, light / mid / shadow | `#ffe58a` / `#f2bb34` / `#c98a14` |
| Ice, body / edge / highlight | `#cdebfa` / `#8cc6e8` / `#ffffff` |
| Pig pink, and its shadow | `#f4a9b8` / `#d9788d` |
| Mouse grey, and its shadow | `#b9b4ae` / `#8f8984` |
| Blush and inner ears | `#f7b6c2` |
| Padlock steel, and its shadow | `#c9ccd1` / `#8e949c` |
| Cream | `#fdf7ea` |

## Background: read this before you generate

ChatGPT draws "transparent" as a grey checkerboard, which would show up in the
game as a literal grid. So every image goes on:

> **A flat, solid pure green background, #00FF00, edge to edge, nothing else.**

I remove the green myself. None of these objects contain green, so nothing
gets lost with it. (The $20 note is green, but it isn't in any of these
images.) **No green anywhere in the object itself.**

**Canvas:** square, 1024 × 1024, with the object centred and at least 10%
margin on every side. Don't crop tight. I trim and resize everything.

**Never include** text, numbers or letters. The game draws "$20" on the
piggy bank and the "2" on the padlock itself, because those numbers change
from level to level.

---

## Message 1: the brief (attach the four references)

```
I'm making art for a cosy mobile puzzle game called Cash Paws: you sort coins
into glass tubes, and cats run the place. I'll ask for seven small game
pieces, one image at a time. Please don't draw anything yet; just confirm you
understand the two styles.

CHIP STYLE (for coins and ice): exactly like the attached coins. Round,
slightly domed, a bevelled rim a shade darker than the face, a soft highlight
top-left, a gentle shadow bottom-right. No dark outline. Glossy but flat
colours, not realistic metal.

CHARACTER STYLE (for the padlock, piggy bank and mouse): exactly like the
attached cat and bell. Flat vector kawaii mobile-game art, thick dark brown
outline #3f3a37 at the same weight as the cat, soft cel shading with one
shadow tone and one small white highlight. No texture or grain. Chunky and
simple; each is shown only 40 to 48 pixels wide. Faces match the cat: closed
happy eyes as upward arcs, a small pink nose, pink blush.

EVERY IMAGE: a flat, solid pure green #00FF00 background filling the whole
canvas, with nothing else in it. Never a checkerboard or transparency pattern.
No green anywhere in the object. No text, numbers or letters. Square 1024x1024,
object centred with at least 10% empty margin on every side. One object per
image.
```

## Message 2: Lucky Paw coin

A gold coin that counts as any value. It sits among the other coins, so it
must look like one of them, but special.

```
Image 1 of 7: the Lucky Paw coin. CHIP STYLE, matching the attached coins
exactly in shape, size, bevel and shading.

A gold coin: face #f2bb34, rim #c98a14, highlight #ffe58a. Instead of a
number, a cat's paw print is embossed in the centre (one big pad and four
toe beans) in a slightly darker gold. Add a few small four-point sparkles
just touching the rim, in pale gold, so it reads as lucky and special.
It must be exactly as round and as big in the frame as the coins in the
reference.

Solid pure green #00FF00 background, edge to edge. Square, centred, 10% margin.
```

## Message 3: Ice, full

A block of ice laid over a coin. **I'll make the body see-through myself**, so
the coin shows underneath, which is why its colour must be one flat tone.

```
Image 2 of 7: an ice block, to be laid over a coin. CHIP STYLE (no heavy
outline).

A rounded square block of ice, slightly bigger than a coin, seen front-on.
The body is ONE flat pale ice-blue, #cdebfa, with no gradient and no pattern
inside, because I will make that colour see-through in the game. Around the
edge, a thicker rim of deeper ice-blue #8cc6e8. On top, a few crisp white
#ffffff shine streaks in the top-left corner and two or three small white
frost specks along the bottom edge. Nothing inside the block: no coin, no
bubbles.

Solid pure green #00FF00 background, edge to edge. Square, centred, 10% margin.
```

## Message 4: Ice, cracked

```
Image 3 of 7: the SAME ice block as image 2, identical in size, shape,
colours and shine, but cracked: three or four jagged white #ffffff crack
lines run from one corner across the block, and one small chip of ice is
missing from the top-right edge. The body stays the same single flat
#cdebfa. It should look one tap away from breaking.

Solid pure green #00FF00 background, edge to edge. Square, centred, 10% margin.
```

## Message 5: Padlock

Sits on top of a locked tube. The game draws the number of cash-ins needed
next to it.

```
Image 4 of 7: a padlock. CHARACTER STYLE, matching the attached bell's
outline and shading.

A chunky, friendly padlock, front-on: a rounded rectangular body in gold
(#f2bb34, shadow #c98a14) with a small dark keyhole, and a thick steel
shackle on top (#c9ccd1, shadow #8e949c), closed. A tiny paw print is
stamped on the body, just below the keyhole. Wider than tall overall, like a
real padlock. Thick #3f3a37 outline. Simple enough to read at 40 pixels.

Solid pure green #00FF00 background, edge to edge. Square, centred, 10% margin.
```

## Message 6: Piggy bank

Sits above a tube that only takes one value and pays triple. The game writes
the value ("$20") on a tag under it.

```
Image 5 of 7: a piggy bank. CHARACTER STYLE, matching the attached cat and bell.

A round, happy ceramic piggy bank seen three-quarters from the front, facing
left: pink body #f4a9b8 with a #d9788d shadow, a coin slot on its back with
a gold coin (#f2bb34) half dropped in, small pointed ears, a round snout with
two nostrils, four stubby legs and a little curly tail. Closed happy eyes as
upward arcs and pink blush, like the cat. Thick #3f3a37 outline.

Solid pure green #00FF00 background, edge to edge. Square, centred, 10% margin.
```

## Message 7: Mouse, sneaking

Pops up on a tube and takes the top coin unless the player taps it. It should
look cheeky, not scary, because the cats are the heroes.

```
Image 6 of 7: a mouse. CHARACTER STYLE, drawn to sit next to the attached cat
as its cheeky little rival.

A small round grey mouse (#b9b4ae, shadow #8f8984) peeking over an unseen
ledge, front-on: big round ears with pink insides (#f7b6c2), a pink nose,
whiskers, and two front paws resting over the ledge. It is clutching a small
gold coin (#f2bb34) against its chest and grinning mischievously, with one eye
open and one closed in a wink. A thin tail curls up beside it. Cropped just
below the paws, like the attached cat's peek pose. Thick #3f3a37 outline.

Solid pure green #00FF00 background, edge to edge. Square, centred, 10% margin.
```

## Message 8: Mouse, caught

```
Image 7 of 7: the SAME mouse as image 6, identical in size, colours and
framing, but caught: it has dropped the coin, both paws are raised in
surrender, its eyes are dizzy little spirals, and a small cartoon sweat drop
sits by its head. Still cute, not hurt.

Solid pure green #00FF00 background, edge to edge. Square, centred, 10% margin.
```

---

## Check each image before you send it

- Is the background flat pure green, with no checkerboard and no shadow on
  it?
- Images 1–3: do they sit comfortably next to the coins in `ref-chips.png`,
  with no heavy outline?
- Images 4–7: is the outline as thick as the cat's?
- Images 2 and 3: is the ice body one flat colour, with no gradient inside?
- Are pairs the same size and framing? Ice with cracked ice, and the mouse
  with the caught mouse.
- Any text or numbers? Ask ChatGPT to remove them.

If one drifts, reply in the same chat: *"Keep everything the same but make
the outline thicker, matching the cat."* It fixes one thing at a time better
than it redraws from scratch.

## When you send them to me

Use the file names from the table at the top, and don't crop or resize. I'll
key out the green, make the ice see-through, trim and size everything, and
put them into the game. Send only the ones for the modifiers we decide to
build.
