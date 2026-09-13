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
