# Cash Paws — design decisions

Money Flow Sort rules wearing the Cash Paws skin. This file is the tiebreaker
whenever the two source documents disagree. Everything here is reversible; the
config knobs that control it live in `DEFAULTS` at the top of `src/engine.js`.

## Where the two briefs conflicted, and what won

**Fail state.** The mockup fails you for "not enough money"; the spec fails you
for deadlock. Deadlock wins, because it is the only fail state the rules can
actually produce — there is no timer and no target to miss. The mockup's Level
Failed card stays, re-worded to say the board is stuck.

**Shuffle economy.** The spec earns one shuffle charge per three banked columns.
The mockup prices shuffle at 30 coins. These are the same thing if a bank pays
10 coins, so that is the rate: bank pays 10, shuffle costs 30. The coin counter
in the header is the charge counter, wearing a nicer hat.

**Chip count.** The mockup shows ten currency types across five values; the spec
shows five. Five wins — matching has to read at a glance, and two skins sharing
a value would be a legibility trap. The other five skins become Shop cosmetics,
which gives the Shop tab something real to sell.

**Undo.** Not in the spec, requested from the mockup. Costs 20 coins, restores
the full previous state, and is wiped by an inflow. That last rule matters: an
undoable inflow would defuse the entire threat.

**Reset.** The spec's footer reset button has no stated cost, which would make
deadlock meaningless — any stuck player just resets. Reset now re-seeds the
board and drops net worth to the current level's floor. You keep your level and
your columns; you lose the run's progress. Not exploitable, not devastating.

## Three rules changed after play on device

**A whole run moves at once.** Tapping a source lifts every identical chip on
top of it, and as many travel as the destination has room for. It still costs
one turn. This roughly doubled banks per game — 43 to 101 — and pushed the
reachable ceiling from level 2.8 to level 4.4 in a 400-turn session.

**The flow comes early when nothing useful is left.** If no legal move can
change the board's prospects — no stack to grow, nothing to uncover, only
uniform columns sliding between empty ones — the drop fires immediately rather
than making the player spend turns on moves that do nothing. Deadlock still
takes priority: a board with no legal move at all locks as before.

**The flow no longer takes the screen.** It fires often enough that a
full-bleed card was an interruption. The columns flash orange and a count rises
off the FLOW label instead.

Together these made the game both faster and more dangerous: locks rose from
2.06 to 3.03 a session and level losses from 27% to 38% of runs, because the
early drops fill the board sooner. The level thresholds were left alone —
faster progress against a sharper threat is a better curve, not a broken one.

Coin surplus was the one thing that needed correcting: banks doubling took
leftover coins from about 94 a session to about 535. Cat and skin prices were
roughly doubled to match, so the collection still takes half a session to four
and a half sessions rather than becoming free.

## Rules as implemented

Values 1 / 5 / 10 / 20 / 50, printed on the chip artwork. Four to a column.
Four identical banks automatically and pays value × 4. A move carries the whole
run of matching top chips, capped by the space available.

Level `n` needs `500 + 400 × (n−1)` more net worth than the level before, so the
floors run 0, 500, 1,400, 2,700, 4,400, 6,500. Net worth is lifetime and never
resets except on a loss. Columns start at 5, gain one every two levels, cap at 8.
Pool is 5/10/20 at levels 1–2, adds 50 at 3–4, adds 100 at 5+.

Inflow every 7 turns, one chip into every column with space. Drops 1–2 use only
values already on the board, 3–4 use the level's whole pool, 5+ mix in junk 5s
at 40%. The interval shortens by one turn every third drop, floor 4. Two safety
rules: a drop may never leave zero open slots (the last chip is taken back), and
a drop with nowhere to go is skipped in silence.

Losing drops a level, floors net worth, seeds a new board, and guarantees enough
coins for one shuffle.

## What the simulator says about balance

41 rule tests and 5,000 full games, roughly 7.5 million moves, zero invariant
violations. Pacing over a 400-turn session:

| | LV 2 | LV 3 | LV 4 | LV 5 |
|---|---|---|---|---|
| reached by | 76% | 57% | 21% | 4% |
| median turn | 58 | 144 | 221 | 314 |

Board fill climbs from 51% at turn 50 to 95% at turn 350, so the rising tide
works — the flow genuinely wins ground over a long session.

**One open balance question for Stage 6.** A competent player banks about 43
columns per long game, earning roughly 430 coins, against about 2.5 locks. At 30
coins a shuffle that is fourteen rescues for two emergencies, so deadlock almost
never actually ends a run (0.14 level losses per game). The spec's own charge
rate has the same property, so this may be intended for a casual audience. Three
levers if it should bite harder: raise `shuffleCost`, lower `coinsPerBank`, or
let Shop and undo spending drain the pool, which the bot never does and a real
player will. I'd wait for real play data before touching it.

## Still open

The mascot. You have one cat illustration; the game wants it in several poses
(idle, banking, level-up, stuck). Stage 2 builds against a placeholder cat drawn
as inline SVG so nothing blocks, and swaps in real art whenever you have it.
