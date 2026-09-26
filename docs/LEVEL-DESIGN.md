# Level design

How Money Sort's levels are paced, and why. Written for 1.6.0, after comparing
the game against a published 300-level deconstruction of Pixel Flow.

## What the comparison found

Pixel Flow's first 300 levels are catalogued level by level in Gamigion's
[Pixel Flow deconstruction](https://gamigion.substack.com/p/pixel-flow-1-300)
(free, with a public spreadsheet). Its pattern:

- **Quick early wins.** The first 10 levels take about 7 minutes in total.
- **A sawtooth, not a ramp.** 74% of levels are normal. Hard levels come about
  every 4 levels, never more than 8 apart. The first is at level 24.
- **Something new every 6–15 levels**, and later every 15–30. Boosters one at a
  time at 7, 12, 15, 18.
- **Nothing new on a hard level.** Each new obstacle arrives on a normal level;
  a hard level often tests it a few levels later.

Measured the same way, Money Sort 1.5 had:

- 16% of new players jammed on level 1 around their 12th move, with 50 coins
  against a 150-coin Sort, and were forced back to $0 before ever levelling up.
- About 37 minutes for the first 10 levels, and levels that kept lengthening.
- A pure ramp: runs getting stuck rose from 18% to 86% by level 16.
- Nothing new after level 7.
- Level 5 added a tube and the $50 chip at once; runs getting stuck tripled.

## What 1.6 changed

| | 1.5 | 1.6 |
|---|---|---|
| First Sort | 150 coins | free, once |
| Level target | 200 × level | 150 + 50 × (level − 1) |
| Sort price | 150 + 60 a level | 150 + 25 a level |
| New tubes | levels 3, 5, 7 | levels 2, 4, 6 |
| New chips | levels 3, 5 | levels 3, 5 (unchanged) |
| Hard levels | none | 7, 11, 15, … |
| After a Hard level | — | a breather, flow one turn slower |
| New mechanic | none after 7 | face-down chips from level 9 |

**Hard levels** run the flow one turn faster and add 20% more junk chips, and
pay double coins on completion. They are marked in the header and the FLOW strip
turns red. No Hard level introduces anything. The level-up card before one warns
of it; the one after says the next is gentler.

**Face-down chips** are the first mechanic after level 7. From level 9 the flow
buries chips: each chip a drop lands on has an 8% chance of turning face down,
and some buried chips on a fresh board start that way. A face-down chip turns
over when it becomes a tube's top. Until then it matches nothing, so a tube
holding one cannot bank. Sort turns every chip face up. Introduced on level 9,
a normal level, and first tested by Hard level 11.

## Results, simulated

Bot play at about 2.5 seconds a move. Returning players: two weeks, coins
carried over, daily tasks and two Rewards Boxes a day.

| | 1.5 | 1.6 |
|---|---|---|
| New players forced back to $0 on level 1 | 17.6% | 0.0% |
| First 10 levels | ~37 min | ~13 min |
| Minutes at level 10 / 16 | 5.2 / 8.7 | 1.5 / 2.3 |
| Hard levels lost vs normal | — | 10% vs 1% |
| Returning players, days losing a level | 4% | 10% |
| Level reached after two weeks | ~23 | ~42 |

The rise from 4% to 10% is the cost of having Hard levels at all, and is
concentrated in them. It was a choice among measured options:

| Sort per level | face-down odds | days lost |
|---|---|---|
| +20 | 10% | 2.6% |
| +25 | 5% | 8.9% |
| **+25** | **8%** | **10.0%** |
| +25 | 10% | 12.1% |
| +30 | 5% | 17.7% |

The response is steep: small changes to either swing the result a lot.

## The cats under the new pacing

Two perks had to change. Level-ups became three times as frequent, so Pepper's
level-up bonus tripled in value; it is now 70, not 100. And every perk that
touches flow speed turned out to be all-or-nothing: a floor of 5 turns, or Hard
levels without the speed-up, both took two-week losses to 0%, while a slower
start did nothing. Marmalade's perk is now a reward instead.

| Cat | Perk | Days lost |
|---|---|---|
| Patch | none | 10.0% |
| Mittens | Undo costs 10 | 10.0%* |
| Soot | 3-turn warning | 10.0%* |
| Marmalade | Hard levels pay triple | 8.4% |
| Pepper | Level-ups pay 70 | 6.9% |
| Biscuit | Sort costs 50 less | 6.1% |

\* The bot cannot value undoing or heeding a warning; people can.

## Saves

`saveVersion` 2. An older save keeps its level and its progress through it:
halfway through level 7 stays halfway. The raw net worth would otherwise
cascade through several level-ups on load. Old saves have used their free Sort.

## Next, following the same principles

One new thing every 10–15 levels, each on a normal level, each tested by the
next Hard level. Candidates: a locked tube that opens after a bank, a frozen
chip that needs two moves, a tube that only takes one value.

## Tools

- `tools/tune.mjs` — the harness that produced every number here.
- `test/sim.js` — rules, including the rhythm and face-down chips.
- `test/rhythm.mjs`, `test/newplayer.mjs` — both in the running app.
