# Sharper art: prompts

Some images in the game are smaller than the screen draws them, so phones
stretch them and they look soft or pixelated. These prompts replace them at a
proper size. Paste each one into ChatGPT, one image per message.

| What | File now | Drawn at | Needed |
|---|---|---|---|
| Coins and notes, Mint set (5) | 44 px | ~50 px | 150 px |
| Coins and notes, Paper set (5) | 44 px | ~50 px | 150 px |
| Coin icon (counter, prices) | 32 px | 22–26 px | 96 px |
| Patch, 4 poses | 160–230 px | up to 210 px | 600 px |
| Patch with the money (lobby) | 278 px | 252 px | 760 px |
| Logo | 199 px | 222 px | 670 px |

The tagline ("Sort • Earn • Level Up") is already fixed: it's redrawn from the
game's font. The other cats (600 px) and the tube are already sharp.

## Three rules for every image

1. **Attach the current image as a reference** (named under each prompt; they
   are in `www/img/` and `www/games/money-sort/img/`). Matching the look matters
   more than anything else.
2. **Never ask for a transparent background.** ChatGPT paints a grey
   checkerboard. Ask for the flat colour each prompt names; I key it out.
3. **Don't crop or resize.** Send what ChatGPT gives you. I cut, size and line
   everything up.

## The style line (already inside each prompt)

> Flat vector illustration, kawaii mobile game art, thick dark brown outline
> (#3f3a37), soft cel shading, gentle highlights, no texture, no scenery.

---

## 1. Coins and notes: Mint set (one image)

Attach: `chip-1.png`, `chip-5.png`, `chip-10.png`, `chip-20.png`, `chip-50.png`

> Flat vector illustration, kawaii mobile game art, thick dark brown outline
> (#3f3a37), soft cel shading, gentle highlights, no texture, no scenery.
> Five game pieces in one row, evenly spaced, all the same size, front view,
> matching the attached references exactly in shape, colour and lettering:
> 1) a round blue coin with "$1"; 2) a round silver coin with "$5"; 3) a round
> orange coin with "$10"; 4) a small stack of green banknotes, slightly tilted,
> with "$20"; 5) a round purple coin with "$50". Bold rounded numerals in a
> darker shade of each piece's colour, a thin inner rim on each coin, a soft
> highlight top left. Crisp clean edges. Flat solid pure magenta background,
> #FF00FF, nothing else in the frame. Wide image, generous space around and
> between the pieces.

## 2. Coins and notes: Paper set (one image)

Attach: `chipb-1.png`, `chipb-5.png`, `chipb-10.png`, `chipb-20.png`, `chipb-50.png`

> Flat vector illustration, kawaii mobile game art, thick dark brown outline
> (#3f3a37), soft cel shading, gentle highlights, no texture, no scenery.
> Five game pieces in one row, evenly spaced, all the same size, front view,
> matching the attached references exactly in shape, colour and lettering:
> 1) a round blue coin with "$1"; 2) a small stack of teal-green banknotes,
> slightly tilted, with "$5"; 3) a round pink coin with "$10"; 4) a small stack
> of golden-yellow banknotes with "$20"; 5) a small stack of silver-grey
> banknotes with "$50". Bold rounded numerals in a darker shade of each piece's
> colour, a soft highlight top left. Crisp clean edges. Flat solid pure magenta
> background, #FF00FF, nothing else in the frame. Wide image, generous space
> around and between the pieces.

If the pink $10 comes out close to magenta, ask again with "pure green
background, #00FF00" for that set instead (and say which you used).

## 3. Coin icon

Attach: `coin.png`

> Flat vector illustration, kawaii mobile game art, thick dark brown outline
> (#3f3a37), soft cel shading, gentle highlights, no texture, no scenery.
> A single round gold coin, front view, matching the attached reference: warm
> yellow-gold face, a slightly darker raised rim, a simple embossed cat paw
> print in the centre in a deeper gold, a soft white highlight top left. Bold
> and simple: it is shown very small, so no fine detail. Flat solid pure
> magenta background, #FF00FF. Square image, coin centred with margin.

## 4. Patch, four poses (four images)

Patch is the grey-and-white starting cat. Attach the matching current file each
time. Same face in all four: closed happy eyes as upward arcs, small pink
triangle nose, pink oval blush, three thin whiskers per side.

Start each prompt with:

> Flat vector illustration, kawaii mobile game art, thick dark brown outline
> (#3f3a37), soft cel shading, no texture, no scenery. A cute cat, exactly like
> the attached reference: white body with soft grey patches on the head, ears
> and back, pink inner ears, large round head, small body. Flat solid pure green
> background, #00FF00, nothing else in the frame. Square image, the cat centred
> with margin on all sides.

Then add one of these:

**cheer**: attach `cat-patch-cheer.png`
> Pose: the cat popping up from behind an unseen edge, delighted, both front
> paws raised either side of the face. Cropped just below the chin. Eyes closed
> and smiling.

**peek**: attach `cat-patch-peek.png`
> Pose: the cat leaning over the top of an unseen ledge, front view, head and
> upper chest visible, both front paws resting over the edge, tail curling up
> on the left. Cheerful, small open smile.

**slump**: attach `cat-patch-slump.png`
> Pose: the cat lying flat, front view from slightly above, chin resting on its
> front paws, whole body visible. Glum: eyes closed as downward arcs, a small
> frown. The only unhappy pose.

**face**: attach `cat-patch-face.png`
> Pose: head only, front on, filling the frame, ears fully inside with margin
> above. Cheerful, eyes closed and smiling, mouth open. Keep it bold and
> simple: it's also shown very small.

## 5. Patch with the money (lobby)

Attach: `cat-hero.png`

> Flat vector illustration, kawaii mobile game art, thick dark brown outline
> (#3f3a37), soft cel shading, no texture. The grey-and-white cat from the
> reference, sitting and happily hugging a pile of money: stacks of green
> banknotes and gold coins in front of it, a few soft sage-green leaves behind
> the pile. Eyes closed and smiling, rosy cheeks. Match the reference's layout
> and colours. Flat solid pure magenta background, #FF00FF, nothing else in the
> frame. Square image, centred with margin.

## 6. Logo

Attach: `logo.png` (and, if you like, the share image as a second reference)

> The game title "Cash Paws" as a logo, matching the attached reference
> exactly. Two lines, centred: "Cash" in heavy, very rounded dark charcoal
> letters (#3a3a3a); "Paws" below it in heavy, very rounded orange letters
> (#ec7a2a), where the "a" is replaced by a white cat paw print inside an
> orange rounded shape. Clean flat lettering, no outline, no shadow, no glow,
> no 3D. Flat solid pure green background, #00FF00, nothing else. Wide image,
> lettering centred with margin.

---

## When you send them

Send them here as they are, with a word saying which is which (for example
"mint coins", "patch cheer"). I'll key out the background, clean the edges,
cut the coin rows into single pieces, size everything to 3× the size it's
drawn at, and check them in the game next to the current ones before
replacing anything.
