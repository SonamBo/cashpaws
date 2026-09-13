# Cat art prompts

Twenty images: five cats × four poses. Paste these into ChatGPT one at a time.

**Attach the matching Patch image as a style reference every time.** The four
are in this folder as `cat-patch-peek.png`, `-cheer.png`, `-slump.png`,
`-face.png`. Consistency across the set matters far more than any single image
being good, and a reference does more for that than any amount of description.

## Two things that will go wrong if you don't ask

**Never ask for a transparent background.** ChatGPT paints transparency as a
grey checkerboard, which renders in the game as a literal grey grid — that
already happened with the tube asset. Ask for a **flat solid green background,
pure #00FF00**. There is no green anywhere on these cats, so I can key it out
cleanly. A white background is worse than useless here: the cats are mostly
white, and the fill bleeds through the fur and eats the animal.

**Don't worry about canvas size or framing.** I crop, scale and anchor all four
poses myself so they line up when the player switches cats. Just ask for a
square image with the cat centred and a comfortable margin.

## The style block — put this at the top of every prompt

> Flat vector illustration, kawaii mobile game art. Thick dark brown outline
> (#3f3a37), soft cel shading, no gradients beyond a gentle one, no texture, no
> background scenery. Rounded friendly proportions, large head, small body.
> Closed happy eyes drawn as upward arcs, small triangular pink nose, pink oval
> blush on each cheek, three thin whiskers per side. Flat solid pure green
> background, #00FF00, nothing else in the frame. Square image, character
> centred with margin on all sides.

## The five cats

Keep every other feature identical to Patch — same face, same eyes, same blush,
same outline weight. **Only the coat changes.**

| id | Name | Coat |
|---|---|---|
| `mittens` | Mittens | Tuxedo. Glossy black back, head and ears; clean white chest, muzzle and four white paws. Pink inner ears. |
| `soot` | Soot | Solid charcoal grey all over, slightly lighter grey muzzle and chest. Darker grey inner-ear edges, pink inner ear. |
| `marmalade` | Marmalade | Ginger tabby. Warm orange coat with soft darker orange stripes on the head and back, cream muzzle, chest and paws. |
| `pepper` | Pepper | Silver tabby. Pale cool grey coat with scattered darker grey spots, white muzzle and chest. |
| `biscuit` | Biscuit | Cream and tan. Soft beige coat with warmer tan patches over one ear and one side of the back, cream face and chest. |

## The four poses

Append one of these to the style block and the coat description.

**peek** — attach `cat-patch-peek.png`

> Pose: the cat leaning over the top of an unseen ledge, seen from the front.
> Head and upper chest visible, both front paws resting forward over the edge,
> tail curling up on the left. Cropped just below the chest. Cheerful, mouth
> open in a small smile.

**cheer** — attach `cat-patch-cheer.png`

> Pose: the cat peeking up from behind an unseen edge, delighted. Head and the
> tops of both raised front paws visible, one paw either side of the face, as
> if it has just popped up. Cropped just below the chin. Eyes closed and
> smiling.

**slump** — attach `cat-patch-slump.png`

> Pose: the cat lying down flat, seen from the front and slightly above, chin
> resting on its front paws. Whole body visible, curled and low. Glum,
> disappointed expression: eyes closed as downward arcs and a small frown.
> This is the only pose where the cat is unhappy.

**face** — attach `cat-patch-face.png`

> Pose: head only, front on, filling the frame. No body, no paws, no neck. Ears
> fully inside the image with margin above them. Cheerful, eyes closed and
> smiling. This is shown at 38 pixels wide, so keep it simple and bold — no
> fine detail will survive.

## When you send them to me

Name them `mittens-peek.png`, `mittens-cheer.png` and so on — I'll rename to the
internal convention. Don't crop or resize; send whatever ChatGPT produces.

I'll key out the green, clean the edges, crop each pose to its canvas with a
consistent anchor, generate them at three densities, and flip the `hasArt` flag.
Pre-flight then fails if any cat is flagged but missing a pose.

Send them a cat at a time if you like — each one works independently, and any
cat without art simply plays as Patch until its four files arrive.

## Worth checking before you send

- Is the background flat pure green with nothing else in it?
- Does the face match Patch's — same eyes, same blush, same nose?
- Is the outline the same weight? A thinner outline is the most common drift.
- In `face`, are the ear tips fully inside the frame?
- In `slump`, is the expression actually glum? It tends to come back cheerful.
