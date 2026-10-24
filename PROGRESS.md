# Cash Paws — build progress

**Read this first when resuming.** It is the single source of truth for what is
done, what is next, and what has already been decided.

---

## How to resume

The build container wipes itself between sessions, so:

1. Start a new chat.
2. Upload `cashpaws.zip` (the latest one I sent you).
3. Say: **"Resume Cash Paws from Stage N"**, using the next stage below.

I read this file, restore the project, and continue. No re-deciding, no rework.
If you lose the zip, the last one is still attached to whichever chat produced
it — scroll back and re-download.

---

## Stage status

| Stage | What it delivers | Status |
|---|---|---|
| 1 | Game engine, rules, verification suite | **Done** |
| 2 | Board screen, Cash Paws visual system | **Done** |
| 3 | Interaction, overlays, Shop / Cats / Progress tabs | **Done** |
| 4 | Android wrapper | **Done** |
| 5 | APK build pipeline | **Done** |
| 6 | Lobby, balance and polish | **Done** |

**All six stages complete.**

---

## Locked decisions

- **Stack:** HTML/CSS/JS engine + Capacitor shell. Not Unity — this game has no
  renderer needs, and the web path is ~4 MB instead of ~25 MB and testable in
  the build container.
- **Rules:** Money Flow Sort, exactly as specced.
- **Look:** Cash Paws — cat mascot, warm cream ground, rounded forms.
- **In scope for v1:** undo, coin balance with priced actions, bottom nav
  (Home / Cats / Progress / Shop).
- **APK:** GitHub Actions cloud build, with local Android Studio as the fallback.
- Four rule conflicts between the mockup and the spec are resolved in
  `docs/DESIGN.md`. That file wins any future argument.

---

## Stage 1 — done

`src/engine.js` — every rule, no DOM, no timers, deterministic given a seed.
Board state, legal moves, auto-banking, lifetime net worth, level thresholds and
column unlocks, inflow with escalation and both safety rules, deadlock
detection, shuffle, undo, level loss, save/load.

`test/sim.js` — 41 rule tests plus a greedy bot that plays full games while
auditing nine invariants after every action. `test/pace.js` — progression and
board-pressure curves.

Result: 41/41 rule tests pass; 5,000 games, ~7.5 million moves, zero invariant
violations.

Run it yourself with Node 18+:

```bash
cd cashpaws
node test/sim.js 5000
node test/pace.js 400
```

### Engine API, for Stage 2

```js
import { Game } from './src/engine.js';
const g = new Game({ seed: 42 });

g.tap(i)            // the only input the board screen needs
g.undo()            // costs coins, cleared by an inflow
g.shuffle()         // costs coins, refused when the board is full
g.loseLevel()       // take the loss
g.restartBoard()    // re-seed, net worth falls to the level floor
g.on(fn)            // events: lift, move, bank, levelup, inflow, lock,
                    //         shuffle, undo, level-lost, restart, reject
g.serialize()       // save string for localStorage
```

Read-only view for rendering: `columns`, `level`, `netWorth`, `coins`,
`levelProgress`, `turnsUntilDrop`, `telegraphing`, `status`, `canUndo`,
`canAffordShuffle`, `shuffleCanHelp`, `openSlots`.

---

## Stage 2 — done

The board screen at 402×874, rendering live engine state. Palette sampled from
the mockup; full reasoning in `docs/DESIGN-SYSTEM.md`.

`www/css/tokens.css` — colour, type scale, spacing, radii, motion.
`www/css/board.css` — header, career rail, tubes, chips, footer, nav.
`www/js/render.js` — reconciles DOM against state by pushing and popping chips
per column, so chip elements stay stable for Stage 3's animation.
`www/js/art.js` — placeholder cat in two poses, plus the icon set.
`www/js/app.js` — inspection harness: step the bot, force an inflow or a level
up, change flow interval / capacity / starting columns, watch the event log.
`serve.js` — dependency-free static server.

Verified in headless Chromium at 2x with no console errors. Screenshots in
`docs/shots/`.

Three things the first render got wrong and are now fixed: gold 5s and copper
20s were nearly the same colour on a real board, the tubes floated in dead space
instead of sitting centred, and the empty-slot markers were invisible.

### Project restructure

`src/` is gone. The engine now lives at `www/js/engine.js` and `www/` is the
app root Capacitor will ship in Stage 4. Tests import from the new path.


---

## Stage 3 — done

The game is playable end to end in a browser.

`www/js/app.js` — controller: input, the overlay sequencer, purchases, saving.
`www/js/overlays.js` — inflow, milestone, stuck-board, level-lost, confirm.
`www/js/tabs.js` — Cats, Progress, Shop.
`www/css/overlays.css` — cards, panels, board feedback, chip skins.

**How the sequencer works.** The engine resolves a whole turn synchronously, so
the controller records each event together with a snapshot of the state at that
instant, then replays the queue at human speed. Applying a choice from the
stuck-board card appends to that same live queue, so the drain loop picks it up
without recursing. Input is locked while a sequence plays.

Tap to lift, tap to place; an illegal target shakes rather than doing nothing.
Chips fly from where they were lifted. Banking pulses the tube green and floats
the amount. Undo and shuffle are wired to the footer and spend coins. Saving is
`localStorage`, written after every resolved turn, and a board saved mid-lock
puts the card back in front of the player on reload.

### Verified in headless Chromium

Tap-to-move, banking, the inflow card, the milestone card, tab rendering,
buying a chip skin, and save survival across a reload — all pass with no
console errors. The stuck board was tested through a real move on a board with
exactly one legal move left: the card appears, shuffle escapes for 30 coins,
and with no coins the shuffle button is correctly hidden, leaving only the
level drop, which returns the player to level 1 with the guaranteed 30 coins.

### Bugs found and fixed this stage

The 6-to-8 column layouts overflowed 874px and pushed the bottom nav off
screen; two-row boards now use shorter cells. The cheering cat's paws rendered
as detached circles. A first attempt at the layout check silently passed
because `window.view` was never exposed, so the board never actually changed —
worth knowing that the earlier green result was meaningless.


---

## Stage 4 — done

`android/` is a hand-written native WebView shell. Full notes in
`android/README.md`.

**Capacitor was the plan and is not what shipped.** npm is blocked in the build
container, so it could not be installed. On inspection it also buys little for
this game — one HTML screen, no native APIs beyond vibration — so the shell is
about 250 lines with no JavaScript toolchain and a smaller APK. The cost is the
plugin ecosystem: AdMob or in-app purchases would now mean the native SDKs, or
migrating to Capacitor at that point. Nothing in `www/` would change either way.

**The decision that shaped it.** The game uses ES modules and `localStorage`,
and both break on a `file://` origin in a WebView — modules are refused as
cross-origin and storage gets an opaque origin. Assets are therefore served
through `WebViewAssetLoader` from `https://appassets.androidplatform.net/`,
a real origin reading straight out of the APK with no network involved.

`www/` stays the only copy of the game; Gradle's `copyWebApp` task syncs it
into assets before each build and that folder is gitignored.

Portrait locked, zoom and system font scaling disabled, edge to edge with the
WebView padded by system-bar and cutout insets natively. Adaptive launcher icon
and splash drawn from the same cat, converted by hand to VectorDrawable paths.

### Added to the web layer

`window.CashPaws.onBack()` and `.flush()`, plus haptics on banking, levelling
and a refused move. All verified in a browser: back returns false on an idle
board, closes an open panel, and is swallowed by an open decision card so a
choice cannot be skipped; flush writes the save and a reload restores it.

### Responsive fix, after Stage 4

Fixed cell heights only fitted the 402x874 design target. On a 360x800 phone —
and on a Pixel 7 once the status and gesture bars are subtracted — the board
pushed the bottom nav off screen. Two causes: `.board` was a flex item without
`min-height: 0`, so it refused to shrink below its content, and chip metrics
were constants.

`BoardView.fitBoard()` now measures the space actually left and sizes cells
between 30px and 58px, adding a `tight` class that drops the mascot and a
`short` class that trims header spacing. It reruns on resize, so rotation and
split screen are covered. Verified from 360x592 up to 430x842 with insets
subtracted, at the full eight columns: nothing clipped, nothing cut off.

### Checked, and what could not be

All 10 Android XML files parse. The launcher icon was converted back to SVG and
rendered to confirm the paths actually draw a cat — the first version had
whiskers that crossed the face, now removed. Two Gradle risks were removed: the
deprecated `packagingOptions` name, and a `clean` hook that would have failed
the whole build if the task type were not what I assumed.

The Kotlin is **not compiled** — that needs the Android SDK, which this
container cannot download. First real compile happens in Stage 5.


### Real artwork, after Stage 4

The cats and the coin are now cut from the source mockup rather than drawn by
hand. Six assets in `www/img/`, 220KB total. The milestone and stuck-board
overlays were rebuilt around them: a cat over a cream card, as the mockup
composes them, instead of a figure floating on a flat field.

Details and the two open art questions — source resolution, and whether to
adopt the mockup's chip denominations — are in `docs/DESIGN-SYSTEM.md`.

Bugs caught while wiring it up: a class-name mismatch (`cat-lying` versus
`ovl-lying`) meant the slumped cat was never positioned; card text inherited
the overlay's white and went invisible on cream; the replacement gear icon read
as a sun; and the first two crop boxes clipped the cats' ears, which let the
flood fill escape into the fur and erase the whole animal.

`cat-hero` — the cat with the money pile — is extracted and unused, waiting for
the lobby screen.

### Currency art, icons, and no navbar

The chips are now the mockup's currency artwork rather than CSS. Because the
denomination is printed on the art, the ladder changed to 1/5/10/20/50 and the
level thresholds were rescaled to `200n` so pacing matches the previous build
(LV2 at 55 turns against 58, LV3 at 151 against 144). Two complete chip sets
exist in the source, so the Shop's second skin is real art, not a recolour.

Undo and shuffle were redrawn as SVG to match the mockup's circular arrow and
crossed arrows. The source icons are ~34px solid rasters: they would be soft at
3x and could not grey out when undo is unavailable.

The bottom nav is gone from the board, as in the source, which shows it only on
the lobby. The pause button now opens a menu carrying Resume, Progress, Cats,
Shop and Restart board, and the tab sheets gained a close button. Tubes are
top-aligned under the header with the cat below, matching the source layout.

Re-verified after the change: 41/41 rule tests, no invariant violations, every
device size from 360x592 to 430x842 fits, the back bridge still routes through
panel and card, and both deadlock paths still work.

---

## Stage 5 — done

`.github/workflows/android.yml` builds the APK in the cloud. Two jobs: the
engine's rule tests run first in plain Node with no dependencies and fail fast,
then the Android job installs the SDK, generates the Gradle wrapper, builds, and
uploads `cashpaws-debug` as an artifact.

Release signing reads four values from the environment, so no key is ever in the
repo. With `KEYSTORE_BASE64` set as a secret the workflow also builds and
uploads `cashpaws-release`; without it those steps are skipped, so a fork or a
fresh clone still builds. Locally the same four environment variables work, and
with none set the release build is unsigned rather than failing.

`BUILDING.md` covers all three routes — Actions, Android Studio, command line —
plus keystore generation and both signing paths.

### Static review, since the Kotlin still cannot be compiled here

No Android SDK and no network, so the first real compile is the first CI run.
What could be checked was: brace and paren balance, no unused imports, no
unimported symbols, every `@drawable` / `@color` / `@style` / `@xml` / `@mipmap`
reference resolving to a real resource, Gradle's SDK and JVM levels agreeing
across files, the workflow YAML parsing, and `rootProject.file('../www')`
resolving to the real web root. All clean.

That is not the same as compiling. `BUILDING.md` lists the three failures most
likely on the first run — a moved dependency version, an AGP or Kotlin version
mismatch, or a compileSdk not yet on the runner — each a one-line fix.


---

## Stage 6 — done

**The lobby exists.** `www/js/lobby.js`, built from the source mockup: the
logotype and tagline cut from the artwork, the hero cat with its money pile, a
Play button that reads Continue with your level and net worth once a run is
under way, and the bottom nav — which lives here, not on the board. The app
opens here. The pause menu gained Back to lobby, and the gear offers a full
erase.

Back now routes sheet, then card, then board to lobby, then out of the app.

**The deadlock worry was wrong, and the measurement was the problem.** Stage 1
reported 0.14 level losses per game and I flagged the fail state as toothless.
That probe never spent coins. A bot that also uses undo — as a person does —
loses a level in **27% of 400-turn sessions**, with 2.06 locks and 1.70
rescues. The threat is real and the shipped numbers stand. Tested alternatives
for the record: shuffle at 60 pushes it to 37%, and 5 coins a bank with shuffle
at 60 reaches 63%, which is punishing. No change made.

**The inflow card is now skippable.** A fixed hold is wrong for everybody — too
quick the first time, too slow the fiftieth. It holds one second, then a tap
dismisses it.

**Shop pricing checked against measured earn rate**: about 643 coins a session,
roughly 94 left after shuffles and undos. The cat ladder of 150 to 1,200 works
out at about two to thirteen sessions, which is a fair collectible curve. No
change made.

### Verified after all of it

41/41 rule tests and no invariant violations over 2,000 games. Every device
size from 360x592 to 430x842 still fits at eight columns. Back routes correctly
through all four states. Both deadlock escapes work. Chips, skins and the pause
menu all behave. No console errors anywhere.

Six test scripts needed updating because the board is no longer the first
screen, and two buttons had both been marked `data-settings`; the board's is
now `data-menu`.

### Still open, and both need you

**No bundled typeface.** There is no network in the build environment, so the
type is still the system rounded stack — close on iOS, Roboto on Android, which
reads flatter than the mockup. Drop a `.ttf` into `www/fonts/` and it is a
one-line change.

**Artwork is roughly 1x.** Every asset is displayed at or below native size, so
nothing is stretched, but it will look soft on a 3x screen. Re-export at 3x to
the same filenames and nothing else changes.


---

## After device testing

Three changes, all requested after playing the first APK.

**Multi-chip moves.** `movableCount()` moves the whole run of matching top
chips, capped by destination space, for one turn. Chips fly with the bottom one
leaving first so the stack reads as a stack.

**The flow comes early when nothing useful is left.** `hasMeaningfulMove()`
asks whether any legal move can change the board's prospects: growing a
matching stack, or uncovering something different underneath. Sliding a uniform
column into an empty one is legal but pointless, so it does not count. When
nothing meaningful remains, `resolve()` fires the drop immediately instead of
making the player burn turns. Deadlock still takes priority.

**The flow stopped taking the screen.** `inflowCard` is gone. The columns flash
orange and a count rises off the FLOW label.

### What it did to balance

Banks per game doubled, 43 to 101. Peak level in a 400-turn session went from
2.8 to 4.4, and level 5 from 1% of sessions to 38%. The threat rose with it —
locks 2.06 to 3.03, runs losing a level 27% to 38% — because the early drops
fill the board sooner. Thresholds unchanged.

Coin surplus needed correcting: leftovers went from ~94 a session to ~535, so
cat and skin prices were roughly doubled.

### Verified

Pre-flight clean, 41/41 rule tests, no invariant violations over 2,000 games,
every device size still fits, back routing and both deadlock escapes intact, no
console errors. The balance probe was updated to use multi-move, since a
single-chip bot would have measured a game nobody plays.


---

## After the second device test

**The stuck board is auto-detected.** The screenshot showed a board that was not
deadlocked — a $5 could slide between two columns forever — so every bounce
looked like progress to the engine and the player had to tap until the drop
arrived. `move()` now records the position before mutating, and `resolve()`
checks whether the board has returned to exactly where it stood two moves ago.
That is a back-and-forth, not progress, so the flow comes forward. If the board
is too full for a drop to land, the no-sealing rule would undo it anyway, so the
board ends instead and the card says "Nothing left to do".

A first attempt treated any repeated position as cycling. That fired constantly
during ordinary play: locks went from 3.0 to 13.6 a session and 73% of runs lost
a level. Narrowing it to an exact reversal within the last two moves brought it
to 6.2 locks and 47%. That is still above the 38% before this change, and it is
honest — a player reduced to ping-ponging really is nearly dead.

**The board was rebuilt to the reference screen.** Glass tubes with coloured
caps, a centred level title, a single progress bar with a cat-head knob, the
absolute figure and "next level at", labelled Undo and Shuffle pills in olive
and violet, a cream ledge with the cat and heart cut from the reference, and paw
prints in the background. Palette sampled from the reference, not guessed.

Two things deliberately not copied. The reference sorts by currency symbol with
ten tube types; this game sorts by denomination, because net worth, banking at
value x 4 and every level threshold are built on values. And the big flush-left
net worth figure is gone, replaced by the centred figure the reference uses.

Verified after all of it: pre-flight clean, 41/41 rule tests, no invariant
violations over 1,500 games, all six device sizes fit, back routing, both
deadlock escapes, chips, skins and the pause menu all intact, no console errors.


---

## Supplied art: room background and glass tube

Both dropped in as given.

**Background.** `www/img/bg-room.jpg`, on both screens, cover-positioned to the
bottom so the ledge lands under the buttons. It carries the paw prints, plant,
shelf, picture frame, window and ledge, so the CSS that faked all of those is
gone. Shipped as JPEG: as a PNG it was 431KB even quantised to 48 colours,
because the source has enough noise to defeat run-length compression. JPEG at
quality 82 is 21KB and visually identical on a flat illustration.

**Tube.** `www/img/tube.png`, nine-sliced with `border-image` so one asset
stretches to any column height without distorting the rim or the rounded base.
The first version supplied had its transparency painted on as a checkerboard
rather than stored as alpha; the second was on white and keyed out cleanly, with
a median filter over the alpha to clear the speckled edge the flood fill left.

The coloured caps are gone, since the supplied tube has none.

**What it cost.** The tube art's rim and base are tall, and rendering them at
true proportion shrank chips from 39px to 30px on the design target. Compressing
that chrome to about 70% of its natural height brought chips back to 34px. The
art is very slightly squashed top and bottom as a result; the alternative was
noticeably smaller chips on every phone.

Verified after: pre-flight clean, 41/41 rule tests, no invariant violations over
1,200 games, all six device sizes fit, back routing, both deadlock escapes,
chips, skins and the pause menu intact, and the single-file build loads from
file:// with all 22 images inlined and no console errors. The pre-flight now
scans CSS as well as JS, since the background is only referenced from a
stylesheet and the old check would have missed it going missing.

---

## Supplied cat face and app icon

**Progress-bar knob** is now the supplied cat face, keyed off white and median
filtered. Checked at 120, 56, 36 and 28px; it still reads at the smallest.

**App icon.** The supplied artwork is a rounded green square, which is wrong for
an adaptive icon: scaled into the safe zone it showed its own edge as a seam
against any flat background. So the green was cut away and the cat, cash and
coins placed on a gradient backdrop matching the original (#deeaba to #c9d6a4).
Foreground sits at 72dp inside the 108dp canvas, so no mask clips it. Generated
at all five densities, plus square legacy icons for pre-26 launchers, with the
old hand-drawn vector kept for the monochrome layer.

## Resolution audit

Eight real phone sizes, system bars subtracted, both screens, at the full eight
columns. Chip sizes: 320x524 and 360x592 and 360x708 give 24px; Pixel 4a and
Galaxy S24 Ultra 32px; Pixel 8 38px; iPhone 15 Pro Max 39px; foldable inner 49px.

Two real failures found and fixed: at 320x524 and 360x592 the tubes ran over the
buttons, because the cell size hit its 30px floor and the board could not shrink
any further. The floor is now 24px, and an `xshort` mode below 660px drops the
"next level" line, shrinks the title and bar, and stands the corner cat down.
All eight now pass with nothing clipped, no horizontal overflow, and tap targets
of 46px or more.

---

## Three fixes after the second APK

**Clearing the board locked the game.** With every chip banked there are no
legal moves, so `isDeadlocked()` was true and the game declared a deadlock —
after the player had just done the best possible thing. Level 1 hit it most
because its board is small enough to clear outright. `refill()` now reseeds the
board, keeping the flow's drop count and clock, and `resolve()` calls it before
any lock check. Found by stress-testing 4,000 games for states with no way out:
79 hit it, all with an empty board.

**Shuffle became Sort.** It gathers every value into its own tube, largest group
first; any tube holding a complete set banks immediately, which is most of what
you pay for. When there are more values than tubes, the remainder shares — the
rule test allows at most two shared tubes.

Sort is far stronger than the random redeal it replaces. At the old 30 coins it
took locks from 6.2 a session to 1.1 and level losses from 47% to 10%. Priced
at 150 it settles at 19%, so it stays a real decision. Raising it further barely
moves the number — at 220 it is 23% — because the power is structural, not
priced. Say the word if 19% feels too soft.

**Android was drawing under the status and gesture bars.** The inset listener
was registered after insets had already been dispatched, so it never fired and
the padding never applied. It now calls `requestApplyInsets` and, rather than
padding the WebView — which would cut the room background off at the status bar
— hands the insets to the page as `--safe-top` and `--safe-bottom`. The header,
lobby, ledge and nav all pad by them, so the art still runs edge to edge.

### Resolution audit, now with system bars simulated

Re-run with 34dp top and 20dp bottom taken out. Two real failures appeared and
were fixed: Play sat under the lobby nav at 320x524 and 360x592, and the tubes
ran over the buttons at 320x524. The cell floor is now 20px and `xshort` shrinks
the logo, hides the tagline and stands the cat down. All eight sizes pass.

One audit bug worth recording: the board check was selecting the lobby's coin
pill, which is hidden and reports zeros, so it flagged every device as drawing
under the status bar. The fix was in the test, not the app.

---

## Tube size changed on every tap

Reported from the HTML build; it would have done the same in the APK, since it
is the same web layer. Three separate feedback loops, each found by measuring
rather than guessing.

**The `tight` class was derived from the computed cell size**, and it changed
the board's bottom padding — the very space the cell size was computed from. So
each update laid out with the previous frame's padding. Every layout switch now
comes from stable inputs, screen height and row count, applied before measuring.

**`.board` used `flex: 1 1 auto`**, so its own height depended on its content.
Sizing the chips to fit changed the space they were being fitted into. A zero
basis makes the board take the leftover space regardless of what is in it.

**The flow badge grew the header.** The `+N` that drops in beside FLOW is inline,
so for its one second on screen the header was 4px taller and the whole board
resized under the player. That row now has a fixed height.

`test/stable.mjs` covers it: six viewports straddling every threshold, ten real
tap-pairs each, asserting the cell size never changes. All six hold now; three
were resizing before.

Re-auditing afterwards showed the new `tight` thresholds had cost the two
smallest screens their fit. The `xshort` header now gives up more, the corner
cat stands aside, and the cell floor is 16px. Nothing overlaps at any of the
eight sizes. Chips do fall to 18px on a 4-inch screen at the full eight columns,
which is the worst case in the game and worth knowing about.

---

## Cat overlap and disabled buttons

**The cat sat on the tubes and the Undo button** because its height and the
space the board kept clear for it were two independent numbers. They are now one
value, `--cat-reserve`, which sets the board's bottom padding and the cat's
height together; the cat dips only 5px into the ledge, less than the footer's
own top padding, so it can never reach a button. It also sits behind the footer
rather than over it.

Two rules had been quietly defeating the reserve: `.board.rows-2` set its own
bottom padding, which outranked it, so two-row boards never kept the space
clear at all. And tying the tighter reserve to a height threshold meant a taller
phone could end up with smaller chips than a shorter one — a Pixel 8 showed 25px
where a Pixel 4a showed 32px. Two-row boards now always reclaim the space, since
eight tubes need it more than the cat does.

The cat is noticeably smaller on two-row boards as a result. That is the trade:
bigger chips, smaller cat.

**Disabled Undo and Sort** were just the coloured button at 45% opacity, which
read as washed out rather than unavailable. They now go properly grey, with the
cost pill and its coin desaturated too.

The audit gained checks for the cat overlapping either a tube or a button; both
were failing on most devices before this and pass on all eight now. Chips fall
to 18–20px only on 320x524 and 360x592 at the full eight columns.

---

## Cats: perks and art swapping

The tab was a stub — six cats you could buy that changed nothing. Now:

**Milestone reveals, then coins.** Each cat is hidden behind a milestone drawn
from stats already tracked: bank 25 tubes, survive 15 drops, reach level 4, bank
100 tubes, reach level 6. Locked cats show `???` with a progress bar and cannot
be bought at any price. Once revealed they cost 300 to 2,400 coins.

**One cat worn at a time**, so a perk is a choice rather than something that
accumulates. `Game.setPerk()` rebuilds the config from defaults each time, so
perks can never stack. `telegraphTurns` became a config value to support Soot.

**Measured, not asserted.** `test/perks.js` plays every cat over identical
seeds. The spread on losing a level is 17–19% against a 18% baseline, so nothing
runs away with it. Where they actually differ is elsewhere: Mittens and Pepper
leave ~330 and ~480 more coins a session, and Marmalade is the real trade — the
calmest tempo but the lowest net worth, $2,610 against $2,781, because fewer
drops means fewer chips to bank.

Two perks the simulation cannot value: Soot's extra warning turn is pure
information, and Mittens' cheap undo only pays off if you undo deliberately. A
bot does neither, so both are likely worth more in a human's hands than the
table shows.

**Art follows the worn cat** across peek, cheer, slump and face. Cats flagged
`hasArt: false` draw Patch instead, so the roster plays today and real art drops
in by adding four files and flipping a flag. Spec in `docs/CAT-ART-SPEC.md`;
pre-flight fails if a cat is flagged but missing a pose.

Patch's cheer pose was re-cut with transparency by flooding only the sage edges,
leaving the cream card alone — seeding from the bottom eats the animal, since
the card and the fur are the same colour. The milestone card now composes cat
over sage rather than shipping the ground inside the image, so it works for any
cat.

### Found while testing

Opening a tab from the lobby covered the bottom nav, so you could not move
between tabs without closing the sheet first. On the lobby the sheet now stops
above the nav.

Five superseded assets were deleted, and the missing-art fallback was changed
from an `onerror` handler to a declared flag — the handler worked but fired
thirteen 404s on every screen.

---

## Cat art imported

Four of five cats are in: Mittens, Marmalade, Pepper, Biscuit. Soot has no
artwork yet and plays as Patch until it arrives.

`tools/import_cat.py` turns a green-screen 2x2 collage into the four assets.
Three things it has to handle, each found by getting it wrong first:

- **Panels are found by projection, not by connected regions.** A cat that
  touches the top and bottom of its panel splits that panel's green into three
  pieces, so "take the four largest blobs" picks the wrong four.
- **Quadrant splitting does not work** either: a top-row panel overhangs the
  halfway line, dragging the row below's caption into the crop.
- **Every green pixel is removed, not just those a flood fill can reach.** Green
  gets trapped in enclosed gaps — between a tail and a body — and a border flood
  leaves those as bright slivers. The fringe is then despilled, or the
  anti-aliased edge reads as a lime halo on cream.

Captions printed inside the panel are dropped when they are a separate mark.
Pepper's touched the cat's chest, so it was one shape and no filter could split
it; `--trim cheer=0.15` shaves the bottom instead, which costs nothing because
that edge sits behind the level-up card.

Cat art was quantised to 64 colours: 3.59 MB to 1.74 MB with no visible change
on flat vector art. The single-file build is 3.08 MB.

Perk balance re-checked with the full roster: 17–19% against a 19% baseline.

### Still open

Soot's four poses. And the peek pose across all cats is a full body where
Patch's is a chest crop, so worn cats sit smaller on the ledge than Patch does —
the art is taller than it is wide and that slot is sized by height.


---

## Targeting API 36 for Play

Play rejected the upload at API 35. Raising it is three coordinated changes, not
one: compileSdk and targetSdk to 36, AGP 8.7.3 to 8.9.2, Gradle 8.9 to 8.11.1.
compileSdk 36 needs AGP 8.9+, and that AGP needs Gradle 8.11.1+.

Two behaviour changes came with it.

**Predictive back** is declared explicitly with
`android:enableOnBackInvokedCallback="true"`. The existing
`OnBackPressedDispatcher` callback is compatible.

**Orientation locks are ignored on screens 600dp and wider**, so landscape
stopped being optional. Testing it exposed a real bug that had nothing to do
with the API level: the device frame in `index.html` was gated on
`max-width: 760px`, so any wide viewport — a tablet, or a phone Android 16
refuses to hold in portrait — rendered the game inside a fixed 402x874 box
instead of filling the screen. It is now gated on `pointer: coarse`, so any
touch device fills regardless of width.

With that fixed, a phone in landscape put the tubes over the buttons. `rowsFor`
now lays all eight tubes in a single row when the screen is wide and short and
the width allows, and a rotate triggers a relayout rather than only a refit.

`test/landscape.mjs` covers both orientations. Portrait sizes are unchanged and
tube sizing is still stable across all six viewport cases.


---

## Privacy policy link

Added to a new Settings sheet on the lobby gear, alongside Erase all progress,
which previously was the only thing the gear did.

The app has no internet permission, so the WebView cannot load the policy page
itself. `shouldOverrideUrlLoading` in `MainActivity.kt` now hands any address
outside the game to the phone's browser via `ACTION_VIEW`. In a browser the link
opens a new tab. Tested: the policy opens in a separate page and the game is
never navigated away.

Pre-flight guards three things: the link is present, the browser hand-off is
present, and the manifest has not gained `INTERNET` — because the store listing
promises it has none, and that is only true while the manifest agrees.

Version bumped to 3 / 1.0.2.


---

## Workflow deprecations

GitHub warned that actions targeting Node 20 are deprecated, setup-java v4 is
end of life, and `ubuntu-latest` moves to Ubuntu 26 on 19 October 2026. All were
annotations on runs that still succeeded, not failures.

Bumped checkout, setup-node and setup-java to v5. Pinned the runner to
`ubuntu-24.04`, since a new OS image can change the preinstalled Java and
Android tooling underneath a build that works. setup-android stays on v3: it
still warns, but there was no newer release to move it to, and naming a
version that does not exist would fail the run outright.


---

## 1.1.0: a shell and a swappable game

The app is now a shell (`www/shell/`) and a game module (`www/games/<id>/`),
joined by a written contract in `docs/GAME-MODULE.md`. Swapping games is one
line in `www/games/active.js`. The shell owns coins, cats, the header, lobby,
tabs, pause, settings, the save and the back button; a game owns its own screen
and talks to the shell only through a `host` object.

**The currency moved out of the engine.** Coins used to live on the Game, so a
replacement game would have had to reimplement the wallet. The engine now takes
an injected wallet. Doing this exposed a live exploit: undo restored the
absolute coin balance from before the move, so buying a 600-coin cat and then
undoing refunded 580 coins. Undo now only takes back what its own move paid.
Three regression tests cover it.

**Cat unlocks use lifetime coins earned**, not levels or tubes, because a game
without those could never unlock the cats. Thresholds were calibrated from
simulation so Money Sort's pace is unchanged: 300, 500, 800, 1,200, 1,500.

**Proof it is game-agnostic.** `www/games/template/` is Coin Catch — real-time,
no levels, no progress bar, nothing for sale. With only `active.js` changed it
runs in the unchanged shell, and `test/swap.mjs` checks 18 things including
both games' saves surviving each other. It found a real shell bug straight
away: the pause menu resumed the game underneath an open Cats or Shop sheet.
Money Sort, being turn-based, never showed it.

**Saves.** Version 2: one record for the shell and a slot per game. 1.0.x saves
migrate on first launch; `test/migrate.mjs` loads a real save captured from the
1.0.2 build and checks board, level, net worth, coins, cats, the worn cat's
perk, the chip set and stats all survive. The old save is left in place.

**Bundler.** `build-single.mjs` now wraps each module in its own scope. The old
one pasted everything into one scope and only worked because no two files
shared a name; with games written separately that was bound to break.

**Pre-flight** enforces the boundaries: a game imports only from its own folder,
the shell reaches games only through `active.js`, each folder's `id` matches its
name, and the app's version matches Gradle's. Each rule was tested by breaking it.

**Unchanged:** layout is pixel-identical to 1.0.2, element by element; chip
sizes match on all eight phone sizes; perk balance is the same 17–19%.


---

## 1.2.0: daily tasks

The first roadmap feature, built entirely in the shell. A game only declares a
tiered `tasks` catalogue and reports stats; the shell draws, tracks, rewards
and saves. It works unchanged in Coin Catch, the template game.

- **Three a day, one per tier**, seeded from the date so reopening never
  reshuffles. Progress counts from a snapshot taken at the draw.
- **Claimed, not auto-paid**: 20, 35, 50 coins, plus 50 for all three.
- **A seven-stamp streak** of consecutive full days, visual only.
- **A toast** when a task finishes mid-board. Never a full-screen card.
- **A fifth lobby tab** with a dot badge. Fits at 320pt with 64px tap targets.

**The day is the phone's local date.** The existing day counter used UTC, so in
India the day rolled over at 05:30. Fixed for both. `test/daily.mjs` runs in the
Asia/Kolkata timezone and checks that 00:10 local starts a new day while UTC
still says the day before.

**Money Sort's catalogue was rewritten.** "Use Sort once" was dropped: it cost
150 coins to earn less. Chip-specific tasks are held back by the new optional
`canOffer(task)` until those chips can appear — $20s from level 3, $50s from 5.
The game reports two finer stats for them, and a move count.

Tests: 40 rule tests in `test/daily.js`, run in CI; 26 browser checks in
`test/daily.mjs` stepping the clock through midnights, a missed day, and a clock
wound backwards. Pre-flight validates every game's task tiers, stats and targets.

**Economy.** Measured over two simulated weeks with coins carried between days:
daily rewards barely move difficulty, because the economy is already saturated
for returning players — see ROADMAP.md for the pre-existing coin-sink problem.


---

## 1.3.0: Sort's price rises with level, and the perks were retuned

**The problem.** Over two simulated weeks with coins carried between days, a
returning player banked 10,000+ coins and lost a level on ~1% of days. Sort,
Money Sort's difficulty lever, had become free.

**Four sinks simulated** (returning players, days losing a level):

| option | new players | returning | coins after 2 weeks |
|---|---|---|---|
| flat 150 (was) | 0% | 0% | 12,909 |
| doubles on each use per level | 0% | 0% | 10,152 |
| wallet capped at 2,000 | 0% | 0% | 1,994 |
| +25 per level | 0% | 0.5% | 3,968 |
| **+35 per level (chosen)** | **0%** | **8.7%** | **1,916** |
| +50 per level | 0.3% | 26% | 1,280 |

Doubling never triggers because players use about one Sort per level. The cap
only deletes coins; Sort stays affordable. The response to level scaling is
steep between +25 and +50.

Sort costs 150 at level 1, 290 at 5, 465 at 10, 815 at 20. The engine exposes
`sortPrice`; the button, the stuck card and the safety net all use it, and the
level-up card now says "Sort now costs …".

**The perks were measured over two weeks too, and three of them erased the fix.**
Marmalade (flow never faster than every 5 turns) gave 0% losses and used 3 Sorts
in a fortnight. Pepper (+40% per bank) and any percentage discount on Sort did
nearly the same. The single-session perk test could not see it. Retuned so each
helps early and tapers late:

| cat | was | now | returning days lost |
|---|---|---|---|
| Patch | — | — | 9.2% |
| Marmalade | flow floor 5 | flow starts one turn slower | 6.3% |
| Pepper | 14 coins a bank | level-ups pay 100, not 50 | 5.9% |
| Biscuit | Sort 100 (flat) | Sort 50 less, at every level | 5.5% |

Mittens and Soot are unchanged; they help human judgement — undoing, heeding a
warning — which a bot cannot value, so the simulation shows them equal to Patch.

**Side effect, intended:** a first session with no daily rewards now loses a
level in about 23% of runs, up from 19%, since Sort gets dearer from level 2.

Rule tests 61/61, including the price per level, Biscuit's discount, and the
safety net covering a Sort at the level just dropped to.


---

## 1.4.0: the Rewards Box, and an ad-paid Sort on the stuck card

**Box.** A gift button in the lobby's top bar glows when a box is ready. Every
4 hours, the first at once. Pays coins only — about half the current Sort price
on average, a whole Sort one time in eight — so a box means the same at level 20
as at level 1. The game reports the value through `rewardValue()`; the shell
knows nothing about Sort. An earlier draft paid Sort/Undo tokens; dropped in
favour of coins scaled to the price, which gets the same benefit with one less
system. `shell/rewards.js`, 19 rule tests; `test/box.mjs`, 13 browser checks
including the refill after four hours and a clock wound back a month.

**Sort now rises 60 per level**, up from 35, because the box pays in proportion
to it and would otherwise cancel the sink. Chosen from:

| box | Sort per level | returning days lost |
|---|---|---|
| 2 a day, ~quarter Sort | +50 | 8.7% |
| 2 a day, ~half Sort | +60 | 4.2% |
| 3 a day, ~half Sort | +60 | 0.1% |

The box is load-bearing: 0 a day → 37%, 1 → 16.5%, 2 → 4.2%, 3+ → ~0%.
Cats under it, opening 2 a day: Patch 4.2%, Marmalade 2.7%, Pepper 3.5%,
Biscuit 3.6%.

**Stuck and broke.** When a player is stuck and cannot afford Sort, the card
offers "Watch an ad · free Sort" as the primary button. Skipping the ad costs
nothing and brings the choice back. A player who can pay sees the paid Sort, not
the ad. `engine.sort({ free: true })`. `test/rescue.mjs`, 13 checks.

**Ads.** Both placements — `box-early` and `rescue-sort` — go through
`host.rewarded`, which reports nothing available in the real app until an ad
network is integrated. Tested: no ad button appears outside dev.


---

## 1.5.0: AppLovin MAX, rewarded ads only

Decisions from you: target audience 13+ (apps for children may not use AppLovin
at all), US and India only for now (so no European consent flow yet), and the
store listing updated to say ads are present.

**Native.** `Ads.java` — a bridge exposed to the page as `window.CashPawsAds`.
Written in Java deliberately: the MAX listener's nullability annotations differ
between AppLovin's own samples, and Kotlin fails the build on a mismatch while
Java does not. SDK pinned at 13.6.3, the current release, whose minimum Android
version (24) matches this app. Uses `MaxRewardedAd.getInstance(id)` — the
Context-taking forms are deprecated in 13.x — `AppLovinPrivacySettings
.setDoNotSell`, and the `AppLovinSdkInitializationConfiguration` builder, all
checked against AppLovin's current docs. Compiled here with `-Xlint:all` against
stubs of those documented signatures; the real SDK is first seen by CI.

**Keys** in `android/ads.properties`, read into `BuildConfig`. Blank keys build
an app with no ads, no opt-out switch, and a Settings note saying so.

**Web.** `shell/ads.js` picks the native bridge when present and enabled, else
the stub. Results come back through `window.__adResult`; a reward is paid only
when the ad was finished. Games did not change — the two placements built in
1.4.0 simply start working.

**US privacy.** "Do not sell or share my personal information" in Settings,
stored natively so it applies before the SDK starts on the next launch.

**Honesty guard.** The pre-flight used to fail if the manifest requested
INTERNET, protecting the "no internet" claim. Retired on purpose; it now fails
if the listing or the Play guide still claims the app is ad-free. It caught four
stale claims the moment it ran, including in my own documentation.

**Docs.** Store listing rewritten around "ads only when you want one", which is
true while every ad is an opt-in rewarded ad. Data safety guidance, flagged as
typical categories to confirm, since AppLovin publishes no definitive list. A
draft privacy policy naming AppLovin, with placeholders.

**Tests.** `test/ads.mjs`, 14 checks against a mock of the bridge, including
that an ad closed early pays nothing and that a keyless build shows no ads.


---

## 1.5.1: tubes clipped on narrower phones

Reported on a OnePlus: level 1's outer tubes cut off at both screen edges.

**Cause.** Tubes were a fixed 66px, so a row of five needed a screen at least
375px wide. Many Android phones report less — anything with the Display size
setting turned up does. The layout audit never caught it because it only tested
eight-tube boards, which split into two rows of four; the widest single row is
the very first board a new player sees.

**Fix.** `fitBoard()` now fits the widest row to the space: first using the
board's side padding down to a 2px edge (what 375px phones always had), then
shrinking tubes, never above the 66px design size. The rim-and-base allowance
and the chip size scale with the tube, and a chip is capped to the glass's inner
width so the wider $20 note never pokes through. Below a 44px tube, five tubes
split onto two rows — only reachable in split-screen.

**Nothing else moved.** On 375, 393, 402, 412, 430 and 480px-wide phones, every
tube, chip, the footer and the cat were compared against the 1.5.0 build at 5,
6 and 8 tubes: pixel-identical.

`test/fit.mjs` covers every board size on 13 screens from 280px to landscape
tablets, checking overflow, overlapping tubes and chips outside the glass.

## 1.6.0: level pacing, after comparing against published deconstructions

Full write-up and numbers in `docs/LEVEL-DESIGN.md`. In short:

- **Level 1 cannot be lost.** The first Sort is free (`freeSorts: 1`); the
  stuck card and the Sort button say "Free". New players forced back to $0 on
  level 1: 17.6% → 0%.
- **Shorter levels.** Target is 150 + 50 × (level − 1) net worth per level;
  Sort costs 150 + 25 a level. First 10 levels: ~37 min → ~13 min.
- **One new thing at a time.** Tubes arrive at 2, 4, 6; chips at 3, 5. A sim
  test fails if any level adds both.
- **Hard levels** at 7, 11, 15, …: flow one turn faster, +20% junk, double
  coins. The level after is a breather, flow one turn slower. Header says
  "Hard" and the FLOW strip turns red.
- **Face-down chips** from level 9: 8% of covered chips turn face down; they
  flip when they reach the top, and Sort reveals all.
- **Save v2 → money-sort saveVersion 2.** Old saves keep their level and their
  fraction through it, and start with no free Sort.
- **Perks retuned:** Marmalade — Hard levels pay triple; Pepper — level-ups
  pay 70.
- Returning players lose a level on 10% of days (was 4%); almost all of it on
  Hard levels, by design.
- New tests: `test/newplayer.mjs`, `test/rhythm.mjs`, `test/fit.mjs`.
  Tuning harness moved to `tools/tune.mjs`.

## 1.7.0: Bell Quest

Royal Match's Lava Quest, adapted. Full design and numbers in
`docs/BELL-QUEST.md`.

- **Decided with the user:** rivals are shown as cats, never as players; the
  quest is always on from level 8; no ad to stay in (a Sort protects the
  streak, and "Drop a level" asks "Give up your quest?" first); art drawn in
  code for now.
- **Decided by simulation:** 48 hours, not 24, because at 24 hours 84% of a
  casual player's quests ran out. The grand prize is ten Sort prices. The
  rival curve matches the published Lava Quest data.
- Built in the shell, so any game can use it by declaring `quest` and calling
  `host.levelWon()`, `host.levelLost()` and `host.confirmLevelLoss()`.
- The card pops up on app open, and on lobby return when there's news.
- Also fixed: two toasts at once now stack instead of overlapping.
- **Flagged:** a player on about 20 minutes a day loses a level on 79% of days
  in the simulation, with or without the quest. The 1.6 tuning only modelled
  10 minutes a day. This needs its own pass.

## 1.7.1: Bell Quest art

The Gemini art replaces the code-drawn placeholders: bell, prize, three
stones and the path scene. It is processed by `tools/process-quest-art.py`
(watermark removed, magenta keyed out, about 100 KB in total). The layout is
unchanged, apart from a smaller prize on the path, because the art's heap is
taller than the placeholder was.

## 1.8.0: Firebase Analytics and Crashlytics

- Project cash-paws-prod, with release and .debug apps registered.
  `google-services.json` is committed; it identifies the project, it isn't a
  secret.
- Versions: Firebase BoM 34.19.0, google-services 4.5.0, Crashlytics plugin
  3.0.8.
- Native bridge `Analytics.java` (`window.CashPawsAnalytics`); shell
  `analytics.js`; game events through `host.track()`,
  `host.levelWon(info)` and `host.levelLost(info)`.
- AppLovin ad revenue goes to Firebase as `ad_impression`.
- The "Do not sell" switch also denies Firebase ad personalisation.
- The Settings note, privacy policy and Play Data safety guidance are updated.
  **Republish the policy before releasing.**
- Event reference: `docs/ANALYTICS.md`. Test: `test/analytics.mjs` (25 checks).
- Couldn't compile the Android side here (no SDK). The first CI build is the
  compile check.

## 1.9.0: first-time tutorial, and Bell Quest in the game

- **Tutorial** (`www/games/money-sort/ftue.js`, coach marks in
  `www/shell/coach.js`). On a player's very first board: a hand taps the best
  move; "Put 4 of the same coin in one tube to cash it in"; then, on the first
  cash-in, a spotlight on the progress bar and figure: cashing in grows net
  worth, and filling the bar levels you up. Tips never block; only the last
  waits for "Got it". Skipped by anyone past level 1 or who has banked.
  Remembered in `shell.flags`. Tracked as `ftue_step` and `ftue_complete`.
- **Give up your quest?** is now the stuck card itself with its content
  swapped. Same cat, same layout. "Keep my quest" is the green button and puts
  the stuck card back.
- **Bell Quest in the game.** After the level-up card, the path card shows the
  new step (the cat hops across) with Continue. A win is claimed on the spot.
  The step toast is gone. New host hooks: `levelBreak()` and
  `levelLossWarning()`.
- Tests: `test/ftue.mjs` (16 checks); `test/quest.mjs` now plays real
  level-ups (52 checks).

## 1.10.0: reminders, and a lighter header

- The "Next level at $X" line is gone from the game header; the figure
  "$20 / $150" already says it. The header drops the line whenever a game
  sends none.
- **Local reminders** (`www/shell/notify.js`; native `Notify.java`,
  `ReminderWorker.java` on WorkManager 2.10.0):
  - Rewards Box ready: at the box's refill time.
  - Bell Quest daily, at 7 pm local time and at least 4 hours after the
    player was last in the app. It says the step and cats left, "prize is
    waiting", or "a new Bell Quest is ready". If the quest would end first,
    it comes 2 hours before the end instead.
  - Never posted while the app is open. Rescheduled every time the app goes
    to the background.
- **Permission.** The game asks first with the cheering-cat card, after the
  first Rewards Box or the first Bell Quest start. Only a yes leads to
  Android 13's system prompt. "Not now" is never repeated. Settings has a
  Reminders switch.
- Tests: `test/notify.js` (14 checks, in CI) and `test/reminders.mjs` (12).
- The Android side is not compiled here; the first CI build checks it.

## 1.11.0: level modifiers

- **Lucky Paw** (a coin that counts as any value) on every breather from 12;
  **locked tube** from 17 (tested on 19); **frozen coins** from 25 (tested on
  27). Rules, schedule and balance: `docs/LEVEL-DESIGN.md`.
- Engine: `WILD` chip value (999), `game.locked`, `game.ice`, and
  `levelModifiers(level)`, which is deterministic per level. Saves from before
  1.11 load with no modifiers.
- Level-up card: the full rule the first time, then "This level: a locked
  tube", and so on. Tapping a frozen coin or a locked tube shakes it.
- `level_up` and `level_lost` carry `modifiers` for analytics.
- Simulation: difficulty-neutral (days lost 10.0% becomes 9.1%). Late Hard
  levels are still the real wall.
- Tests: `test/modifiers.js` (38, in CI), `test/modifiers.mjs` (11), and sim
  invariants for all three.
- Art from ChatGPT: padlock, ice, cracked ice, Lucky Paw. The piggy bank and
  mouse are still to come.

## 1.11.1: the lock that didn't appear

Reported: level 17 announced a locked tube, but none appeared. The lock
needed two empty tubes at the level-up, and a real board usually has one, so
23% of level-ups to 17 and 19 got no lock while the card still promised one.
The lock now takes the least-full tube when no spare empty one exists, and
its coins wait inside (Sort leaves them there). It lands on 99% of level-ups.
The card only announces modifiers that actually landed. Regression tests
cover the busy-board case in `test/modifiers.js` and `test/modifiers.mjs`.
Balance: days losing a level are 11.0% (10.0% without modifiers).

## 1.12.0: Google AdMob instead of AppLovin MAX

- AppLovin MAX was never live: its keys were always blank, so every build
  until now shipped with ads off.
- `Ads.java` now uses the Google Mobile Ads SDK 25.5.0, with UMP 4.0.0 for
  consent. The JS bridge (`window.CashPawsAds`) keeps its shape, so the game,
  the stuck card, the Rewards Box and analytics are unchanged.
- One rewarded unit, Rewarded_admob, serves both placements; the placement
  name only goes to analytics. IDs are in `android/ads.properties` (app
  `ca-app-pub-5379524261124242~4778314769`, unit `…/4914046139`) and apply to
  release builds. Debug builds always use Google's test IDs.
- Consent: UMP runs at launch and shows AdMob's Privacy & messaging message if
  this user needs one; ads start only when it allows. Settings' "Do not sell
  or share" row now opens Google's privacy form, shown only when UMP says it's
  required. It replaces the old switch.
- Ad revenue: AdMob logs `ad_impression` to Firebase itself once linked; the
  manual AppLovin revenue event is gone.
- Chose the established SDK over Google's Next-Gen SDK: its API is fully
  documented, and this code can't be compiled here. Migrating later is
  confined to `Ads.java`.
- No mediation yet (no AppLovin contract). Adding a network later is an
  adapter dependency plus AdMob console setup.
- Pre-flight checks: the SDK is pinned; the manifest has the app ID; the IDs
  are well-formed and from the same account; release builds don't use test
  IDs; debug builds do; no AppLovin anywhere. Docs updated: privacy policy,
  Data safety, app-ads.txt, store listing, releasing.

## 1.13.0: interstitial ads, with an Ad break screen

- Unit `ca-app-pub-5379524261124242/7986846311` (`interstitialAdUnit` in
  `android/ads.properties`); debug builds use Google's test interstitial.
- **When:** past level 10, once per 2.5 minutes of actual play. The clock runs
  only with the board on screen, nothing over it, and the app in the
  foreground. Watching a rewarded ad restarts it too, so ads never come back
  to back.
- **How:** an "Ad break" screen (the worn cat, "Ad break", a 2-second bar),
  then the ad, then straight back to the board. It starts only between moves,
  never during a move or bank animation, or under a card or the tutorial
  spotlight. The game is paused throughout. If an ad fails to show, it tries
  again after 30 more seconds of play.
- Settings, privacy policy and store listing now say so: the "ads only when
  you want one" promise is gone. Pre-flight fails if it comes back while an
  interstitial unit is configured.
- Tests: `test/interstitial.mjs` (15 checks).

## 1.13.1: Kotlin 2.0.21 → 2.3.21 (CI build fix)

The 1.13.0 debug build failed in `:app:compileDebugKotlin` with 25 errors
like "Module was compiled with an incompatible version of Kotlin. The binary
version of its metadata is 2.3.0, expected version is 2.0.0". Google's ad SDK
25.5.0 ships Kotlin 2.3 metadata and Firebase 2.2, and a Kotlin compiler only
reads one version ahead. The engine job had passed; nothing in the game code
was wrong.

- Kotlin plugin raised to 2.3.21: it reads up to 2.4, and supports this
  project's AGP 8.7.3 and Gradle 8.9 (2.3.20–2.3.21 cover AGP 8.2.2–9.0 and
  Gradle 7.6.3–9.3), so nothing else moves.
- `kotlinOptions { jvmTarget = '17' }` (an error since Kotlin 2.2) becomes
  `kotlin { compilerOptions { jvmTarget.set(JvmTarget.JVM_17) } }`.
- Pre-flight now fails on a Kotlin plugin older than 2.2, or on any
  `kotlinOptions {}`.
- The RELEASING.md toolchain table was corrected: AGP 8.7.3 and Gradle 8.9,
  not 8.9.2 and 8.11.1.


## 1.13.2: release lint fix (CI build fix)

- The debug build now compiles. The release build stopped at `lintVitalRelease`:
  `InvalidFragmentVersionForActivityResult`. The ad SDK pulls in an old
  `androidx.fragment` (before 1.3), and the notification permission ask uses
  `registerForActivityResult`, which needs 1.3 or newer.
- Fix: `androidx.fragment:fragment-ktx:1.8.5` pinned in `app/build.gradle`.
- Pre-flight now fails if fragment isn't pinned at 1.3+, and warns about any
  `.kt`/`.java` file outside `com/pixelartgames/cashpaw/`. The CI log showed a
  leftover `MainActivity.kt` from an old package name still being compiled.
- versionCode 21, versionName 1.13.2.

## 1.13.3: Ad status readout (ads not showing on the phone)

- Tested the game side with a realistic native stand-in (ads that take a few
  seconds to load, human-paced play at level 12): the Ad break fired at exactly
  2.5 minutes of counted play (about 3m20s of wall time, since time spent
  animating or on cards doesn't count). Rescue-Sort and Rewards Box ads pass too.
  So "no ads" on the phone is the native side or AdMob, not the game logic.
- New: **Settings → tap "Version 1.13.3" five times** opens an Ad status card:
  build type, consent status, whether the SDK started, and the last load
  result for each ad unit, with AdMob's error code explained.
- Ads.java logs load failures to Logcat (tag `CashPawsAds`) and once per
  session to Firebase as `ad_load_failed` (format, code, message).
- versionCode 22, versionName 1.13.3.

## 1.14.0: the starter (this shell for other games)

- **One config file for the app's identity:** `www/app.config.js` holds the
  name, applicationId, versionCode, versionName, privacy URL and contact email.
  - Gradle reads it: applicationId, version, and app_name via `resValue`.
    `strings.xml` no longer defines app_name.
  - The shell reads it: page title, Settings title and version, privacy link,
    logo alt text.
  - The version is now set in one place instead of two.
- **Firebase is optional:** the google-services and Crashlytics plugins apply
  only when `app/google-services.json` exists. MainActivity attaches the
  analytics bridge only if Firebase started.
- **`host.busy(on)`:** a game marks moves and animations so no Ad break cuts
  in. Money Sort still sets the class directly. The Ad break rules are now
  written up in `docs/GAME-MODULE.md`.
- **Tests split:**
  - Shell rule tests stay in `test/*.js`.
  - Money Sort's tests (node and browser) and the v1 save fixture moved to
    `test/games/money-sort/`.
  - New runner: `test/run.js`, used by CI, runs the shell tests plus the
    installed game's (a `// ci-args:` line passes arguments).
  - New `test/shell.mjs` checks the shell with any installed game.
- **Pre-flight:**
  - Validates `app.config.js` exactly as Gradle parses it.
  - Treats missing `ads.properties` and `google-services.json` as "off", not
    errors.
  - Fails an app that isn't Cash Paws if it still carries any Cash Paws ID:
    name, privacy URL, email, AdMob publisher or Firebase project.
- **Starter export and sync:**
  - `tools/export-starter.mjs` copies the shared files byte for byte.
  - Money Sort, keys, store docs and history stay private.
  - Placeholders come from `tools/starter/`: config, Coin Catch installed,
    logo, icons, README and privacy policy template.
  - The export refuses to run if a Cash Paws ID would leak.
  - `.github/workflows/starter.yml` pushes the export after each green build.
- **Tested here:** I built a starter repo, made an app from it and pushed a
  shell change through. `git pull upstream main` merged with no conflicts. The
  app kept its own name, game and config; Money Sort changes and Cash Paws'
  version bump stayed out.
- **Renames:**
  - CI artifacts: `app-debug`, `app-release-apk`, `app-release-aab`.
  - Single-file build output: `game.html`.
- **Docs:** `CLAUDE.md` (rules for any Claude working in either repo) and
  `SETUP.md` (accounts, keys and Play for a new app).
- versionCode 23, versionName 1.14.0.

## Web platform and marketing tools (no app change; still 1.14.0)

Android is untouched: no file under `android/` changed, and the only
additions under `www/` are web-only files the app never loads (`web.json`,
`web.css` in the game folders). No versionCode bump needed.

- **`platforms/crazygames/`:** the CrazyGames build, moved from cashpaws-web
  and made game-agnostic.
  - `build.mjs` writes `dist/crazygames/<app>-crazygames-{basic,full}.zip`.
  - `page/` holds the SDK adapter, PC keyboard and mouse, and the web privacy
    page. `overrides.json` holds the shell's web wording.
  - Tests: a stand-in SDK, a harness, and a generic test that passed with
    both Money Sort and Coin Catch installed.
- **Per game, `www/games/<id>/web.json`:** keys, keysHelp, number labels, PC
  CSS, level pattern, must-be-visible selectors, wording overrides. Money
  Sort's and the template's are written.
- **`test/games/money-sort/crazygames.mjs`:** Money Sort's own web checks (17):
  - keys move coins, Z undoes;
  - the rescue Sort works through a rewarded ad, including unfilled;
  - a midgame ad plays only after a level-up;
  - tutorial wording, ad blocker, basic build.
- **CI:** `.github/workflows/crazygames.yml` runs separately from the Android
  build and attaches the zips.
- **Marketing:**
  - `tools/marketing/record-preview.mjs`: trailers from
    `marketing/showcase.mjs`, at store sizes, optionally opening on a cover.
    It suppresses dev-mode stand-in ads.
  - `tools/marketing/make-covers.py`: exact sizes, with crazygames and play
    presets.
  - Cash Paws' `marketing/` (private): BRAND.md, references, showcase,
    CrazyGames listing and cover prompts.
- **Starter:**
  - Gets `platforms/`, `tools/marketing/`, the template's `web.json`, and a
    `marketing/` template (BRAND, listing, cover prompts, a Coin Catch
    showcase).
  - Tested on an exported starter: build, generic test and template trailer
    all work.
  - A shell update pulled into an existing app merged with no conflicts.
  - Lesson: never edit files under `tools/starter/` after release. They
    belong to each app, so the README edit conflicted; it was reverted.
- **cashpaws-web:** now only pins which Cash Paws version goes to CrazyGames,
  and builds with Cash Paws' own `platforms/crazygames`.

## 1.15.0: sound, a bundled font, desktop presentation (after the CrazyGames rejection)

CrazyGames rejected the first submission as "overall quality does not yet
meet the expectations of our platform". Their quality guidelines, checked
against the game, pointed to: no audio at all, a phone layout lost in a big
desktop frame, a font that changed per device, a text-heavy unskippable
tutorial, and small inconsistencies. All in the shell, so Android, the
starter and future games get them too.

- **Sound** (`www/shell/sound.js`):
  - Synthesised with Web Audio, so there are no audio files and nothing to
    license.
  - 14 effects: tap, lift, drop, bank, levelup, celebrate, setback, flow,
    sort, undo, error, coin, open, unlock.
  - A cosy generated music loop: 84 bpm, four chords, a melody that varies.
  - `host.sound(name)` lets games add their own; Money Sort calls it on every
    moment.
  - Settings has Sound effects and Music switches, saved in `shell.audio`.
  - Silent until the first tap, and while hidden or during an ad. CrazyGames
    mutes only once the ad really starts (the adapter); Android mutes around
    every ad.
  - `tools/sound-preview.mjs` renders it all to a WAV and checks the levels:
    no clipping, effects peak −1 to −8 dB, music about 28 dB RMS under them.
  - `test/sound.mjs` checks unlocking, the switches (remembered), ad and
    background silence, and that only one audio context is used.
- **Font:** Nunito, bundled (`www/fonts/`, SIL OFL), so every device matches
  the rounded logo. It replaces the system rounded font, which only Apple
  devices have.
- **Web/desktop:**
  - The app lays out at about 960×560 and scales up to fill large windows
    (`--app-scale`, up to 2x). The board, coach, and the coordinates of the
    coin flight all account for the scale.
  - P pauses instead of Esc, which browsers use to leave fullscreen
    (CrazyGames' restricted keys); Backspace also goes back.
- **First minute:**
  - Shorter tutorial text, and a "Skip tutorial" button on each tip.
  - The tip finds a spot that covers no buttons: beside the board on wide
    screens, below it on phones.
- **Polish:**
  - The pause menu says the app's name (Cash Paws), not the game module's
    (Money Sort).
  - The flow meter reads "NEW COINS · in 4 moves" instead of "FLOW T004".
- **Not changed:** the level goals. Level 1 takes a median of 23 moves.
  Shortening it would move every later goal for existing players, so it's
  left as a decision for later.
- **Tests:** all of Cash Paws' node and browser tests, the generic CrazyGames
  test (plus a check that sound is held once a CrazyGames ad starts) and
  Money Sort's CrazyGames test pass.
- versionCode 24, versionName 1.15.0.

## 1.15.1: a clearer tube selection, AD_ID guard

- The selected tube now has a dark green outline (#2b6340), a tinted inside,
  lifts 10 px, and the coins that will move (the top run of one value) rise
  another 10 px. It stays visible while the board warns of or receives new
  coins (the old faint glow was overridden there).
- Play's "must declare AD_ID" error: the manifest already declares it. The
  message comes from an older release still active in some track, or from the
  Advertising ID answer in App content. Preflight now fails if the
  declaration is ever removed.
- versionCode 25, versionName 1.15.1.

## 1.15.2: high-contrast tube selection

- Selected tube: a solid 3 px near-black green ring (#123a22), a gold glow
  outside it, a deeper tint inside (30%), lifted 12 px; the coins that will
  move rise 12 px.
- AD_ID: the repo and the versionCode 25 bundle declare it. If Play still
  shows the error, an older bundle is still active (or retained in a draft)
  in some track; see the chat for the steps.
- versionCode 26, versionName 1.15.2.

## 1.16.0: coin packs (Google Play Billing)

- Players can buy coins in the Shop: four packs (500, 1,200, 3,500, 8,000),
  listed in `www/app.config.js` → `coinPacks`. Prices are Play Console's,
  shown in the player's currency; "+N% extra" is worked out from them.
- Android: `Billing.java` (Play Billing Library 9.1.0), bridge
  `window.CashPawsBilling`. Shell: `www/shell/billing.js`.
- Paid exactly once: coins and the purchase token are saved before the
  purchase is consumed; a purchase reported again (crash, restart) pays
  nothing. Pending payments pay when they clear. Bought coins don't count as
  coins earned (cat reveals stay a playing reward).
- The + on the coin counter opens the Shop's coin section; a cat or chip set
  that costs too much offers "Get coins".
- Settings, the privacy policy (new Purchases section), PLAY-STORE.md (content
  rating, Data safety: Purchase history) and SETUP.md 7b updated.
- Web (CrazyGames): no packs, the Shop still says nothing is for sale.
- `test/billing.mjs` (35 checks), preflight checks pack IDs and the billing
  library version.
- versionCode 27, versionName 1.16.0.
- Out of coins: one shell card (host.shortOf) offers coin packs first, then a
  rewarded ad, then "Not now". Money Sort's Sort button stays tappable when
  short and opens it; the stuck card lists Get coins, then the ad, then Drop
  a level. Buying enough goes straight on to the Sort.
- Ad breaks moved from every 2.5 minutes of play to the end of each level won
  once level 10 is beaten (after the level-up card and any Bell Quest card,
  before the next level). Skipped within a minute of a rewarded ad. The
  CrazyGames adapter keeps its own 3-minute minimum (their rule).
- Popups (cards, menus, level-ups, the stuck card) sit over the screen they
  came from: a tint and a light blur instead of a solid fill.
- Copy pass across the shell and Money Sort: short phrases instead of
  sentences ("Not enough coins", "Sort: 300", "Next: Hard level · faster,
  pays 2×", "New tasks in 4h 3m"). Tests updated to the new wording; the web
  build's text overrides too.
- Not changed: tools/starter/docs/PRIVACY-POLICY.md still says "every few
  minutes" (an owned starter file; editing it would conflict in every app).
- To do in Play Console: payments profile, upload to internal testing, create
  the four one-time products, license testers, test from the Play link.

## 1.17.0: first-day retention

Why: GA, Sep 26 – Oct 23 (148 installs). D1 ≈ 20%, D7 ≈ 10%: the D7/D1
ratio (~0.5) is fine, D1 is the gap (casual peers 30–40%). 52% uninstalled.
Losses before day 2: 11 never sent `app_ready`; 11 more reached the lobby but
never a board; 109 started the tutorial, 86 finished, 11 skipped. Only 46 of
148 were ever asked about reminders and 2 ever opened one. Past level 10, the
18 players there saw about 14 interstitials each.

- **Straight to the board.** A player still on level 1 opens on the game
  screen, not the lobby. From level 2 the app opens on the lobby as before.
- **Tomorrow's gift** (`www/shell/gift.js`, `giftCard` in overlays.js).
  Reaching level 4 shows a locked gift that opens tomorrow: two Sorts' worth
  of coins (450 at that point). The card offers "Remind me tomorrow", which
  goes straight to Android's permission prompt. The gift opens the next time
  the lobby appears on a later local day, before any Bell Quest card. Once
  per player, ever. The level-4 ad break is skipped when the card shows.
- **Gift reminder** (id `gift`): the next day, an hour before the time they
  played, kept between 9 am and 9 pm. If unopened, again every two days.
  The native side needed no change (WorkManager takes any reminder id).
- **Reminder ask** moved to the gift card for new players. The old ask (after
  a Rewards Box or a quest start) stays for anyone the gift didn't ask; its
  line now mentions the gift.
- **Ad breaks:** none on the first two local days of play, and at least
  3 minutes between two, counting from the app opening. The 1.16.0
  level-end timing is unchanged otherwise. Older saves don't know their
  first day: two or more days played counts as long past it; a one-day
  player starts counting from their last day.
- **Free Sorts, levels 2–5** (Money Sort, `freeSortThrough: 5`): each of
  these levels starts with one free Sort. Unused ones don't pile up. The
  level-up card says "Sort: free this level", the stuck card "This Sort is
  free".
- **Measurement:** new `app_boot` (load_ms, new_player) as the page's first
  event; `app_ready` adds load_ms and start_screen; `gift_offer`,
  `gift_claim`; `reminders_permission` adds reason. In GA, custom dimensions
  registered on 24 Oct: event `level`, `step`, `choice`, `reason`; user
  `best_level`, `days_played`.
- Tests: `test/gift.js` (34 checks: gift timing across midnight, month ends
  and late/early players; ad-free days; the 3-minute gap),
  `test/games/money-sort/freesort.js` (9 checks).
- Not run here: the Playwright browser tests (no Chromium in this
  environment) and a device build. `test/interstitial.mjs` still describes
  the pre-1.16 2.5-minute clock and needs updating separately.
- versionCode 28, versionName 1.17.0.

What to watch after release (GA, new users from the 1.17.0 date):
`first_open` → `app_boot` → `app_ready` → `ftue_complete` → `level_up`
(level 4) → `gift_offer` → `reminders_permission` granted →
`reminder_open` (gift) → `gift_claim`. D1 target 30%.
## 1.18.0: Play Games cloud save, rating, share, sharper tagline

- **Cloud save** through Google Play Games v2 (22.1.0): automatic sign-in,
  the whole save in one Saved Games slot. `CloudSave.java` (bridge
  `CashPawsPlay`), `www/shell/cloud.js`. Nothing is uploaded until the cloud
  copy has been read: a save from another install that is further along is
  offered ("Continue from level 24?"); restoring keeps purchases made on this
  install. Uploads at most once a minute and on going to the background.
  Settings shows "Backed up · <name>" or "Back up with Play Games". Off until
  `playGamesAppId` is set in `www/app.config.js` (SETUP.md 7c).
- **Rating:** Play In-App Review (2.0.2) at the level break after clearing
  levels 2, 10 and 25, once each; that break skips the Ad break.
- **Share:** the phone's share sheet with `shareText`, the Play link and
  `shareImage` (`www/img/share.jpg`, the user's cover). Lobby, Settings, and a
  small Share on every level-up card. Not on the web. `Social.java` (bridge
  `CashPawsSocial`, FileProvider for the image), `www/shell/social.js`.
- **Art:** the tagline is redrawn at 3× from Nunito. `docs/HIRES-ART-PROMPTS.md`
  has prompts for the rest that's too small (chips, coin icon, Patch, the
  lobby hero, logo).
- Privacy policy: Play Games backups, ratings and sharing. PLAY-STORE.md 4d,
  SETUP.md 7c/7d, ANALYTICS.md.
- Tests: `test/social.mjs`, `test/games/money-sort/rating.mjs`.
- Merged on top of 1.17.0 (first-day retention, from another session). At a
  level break: the gift card first, then the rating sheet, then the Ad break.
- Fixes for 1.17.0's own breakage: on CrazyGames, a new player opens on the
  board, so loading is reported at once (it waited 8 s for a lobby that never
  came; the CrazyGames workflow had been failing). Browser tests open the lobby
  with `?lobby=1` (test-only switch), age the player past the ad-free days,
  skip the gift where they test level breaks, and move time on for the
  3-minute gap. `swap.mjs` no longer writes to a hard-coded path.
- versionCode 29, versionName 1.18.0.
