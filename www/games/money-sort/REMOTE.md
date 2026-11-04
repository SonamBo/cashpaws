# Money Sort: Remote Config keys

Declared in `index.js` (`REMOTE`), read through `host.remote()`, and passed
to the engine as config (all but `tutorial_skip`, which the tutorial reads
itself). Every engine default equals the engine's own
(`test/games/money-sort/difficulty.js` checks). How to change them, per
country and in A/B tests: `docs/REMOTE-CONFIG.md`.

| Key | Default | Limits | What it does |
|---|---|---|---|
| `free_sort_through` | `5` | 1–50 | Levels up to this one start with a free Sort. |
| `sort_free_through` | `10` | 0–50 | Every Sort is free on levels up to this one (1.22.0). `0` = off. |
| `gentle_through` | `10` | 0–50 | Levels up to this one can't jam: a stuck board sorts itself, free, with no stuck card (fresh coins if sorting can't help). `0` = off. |
| `starter_pay` | `1:3, 2-7:3, 8-10:2.5, 11-12:1.8, 13-14:1.4` | text | Cash-ins pay this many times their value on early levels (1 to 4), so they finish in fewer moves. Same format as `level_difficulty`; unlisted levels pay 1×. |
| `tutorial_skip` | `false` | true/false | Show "Skip tutorial" in the first tips. Off: the tips stay until the first cash-in; they never block play. |
| `flow_interval` | `7` | 4–12 | Turns between inflows at the start of a level. More is easier. |
| `junk_chance` | `0.4` | 0–0.8 | Odds a drop-5+ chip is a junk 5 on a normal level. Less is easier. |
| `level_difficulty` | `15/4:2, 16/4:0` | text | Difficulty points per level (below). |
| `hard_junk_bonus` | `0.2` | 0–0.5 | Junk odds added per difficulty point above 1, removed per point below. |
| `hard_flow_speedup` | `1` | 0–3 | Flow turns faster per point above 1, slower per point below. |
| `assist_after_stuck` | `2` | 0–20 | Stuck boards on one level before it quietly plays easier until beaten. `0` = off. |
| `assist_ease` | `1` | 0–3 | Difficulty points taken off a level once help is on. |

Left out on purpose: Sort's price and level-up pay. Cat perks (Biscuit,
Pepper) set those too, and their wording would stop being true.

## Difficulty per level

One number per level: **1 is a normal level.** Each point above 1 adds
`hard_junk_bonus` to the junk odds and takes `hard_flow_speedup` turns off
the flow; each point below 1 does the opposite. Flow never runs faster than
every 3 turns; junk odds stay between 0 and 0.9.

- **1.5 or more is a Hard level:** labelled "Hard", red flow strip, pays 2×,
  counts as Hard for level modifiers.
- **0.5 or less is a breather:** gets the Lucky Paw coin from level 16.
- Anything between is a normal level, just harder or easier.

Entries are `levels:points`, separated by commas. Later entries win;
unlisted levels are 1. Points are kept between 0 and 4.

| Entry | Means |
|---|---|
| `9:1.5` | level 9 only |
| `3-5:0.5` | levels 3 to 5 |
| `20-:1.2` | level 20 and every level after |
| `15/4:2` | levels 15, 19, 23, 27… (every 4th from 15) |

The default, `15/4:2, 16/4:0`, is the 1.18 rhythm started later: a Hard
level every fourth level from 15 at 2, the level after it a breather at 0
(1.18–1.21 started it at 7: `7/4:2, 8/4:0`). **A value set in the console
replaces the whole table**, so keep those two entries in it unless you mean
to drop the rhythm. For example, to make level 13–14 gentler and everything
from 30 a little harder:

```
15/4:2, 16/4:0, 13-14:0.7, 30-:1.2
```

Careful: `30-:1.2` comes last, so it also overrides the Hard levels and
breathers from 30 on (they all become 1.2). To keep them, list the rhythm
again after it: `13-14:0.7, 30-:1.2, 15/4:2, 16/4:0`.

Changing this changes which levels are Hard, so it moves Bell Quest's
difficulty, rewards and level modifiers with it.

## The first levels (1.22.0)

Of 104 new players (Oct 31–Nov 4 2026), 29% never beat level 1 and 72% were
gone before level 4. Levels 1–10 took 25–37 moves each for a bot that plays
every move well, a board could jam from level 1, and a jam asked for coins.
Four keys make the first ten levels quick and impossible to lose:

- `starter_pay`: cash-ins pay up to 3×, so a level needs fewer of them. Net
  worth targets don't change, so saves don't either. It eases off over
  levels 8–14, so level 15, the first Hard level, isn't a cliff.
- `gentle_through`: a jammed board sorts itself (a "Shuffled for you" note on
  the flow strip), or deals fresh coins if sorting can't help. No stuck card,
  no lost level, and it doesn't count toward help when stuck.
- `sort_free_through`: the Sort button costs nothing, so "Not enough coins"
  can't happen there.
- `tutorial_skip`: off, so a new player can't skip the only explanation of
  the game. 22 of the 104 skipped it, and almost none of them beat level 1.

Bot, median moves per level (a 30%-careless bot in brackets):

| Levels | 1.21 | 1.22 |
|---|---|---|
| 1 | 23 (25) | 6 (8) |
| 2–10, each | 24–37 (28–42) | 8–16 (8–16) |
| 1–10, total | 317 (338) | 114 (122) |
| Stuck cards on 1–10, per 100 players | 234 (387) | 0 (0) |

Analytics: `auto_rescue` (level, how: sort or refill) each time a gentle level
sorts itself; it stands for a stuck card that would have shown.

## Help when stuck

Each stuck board on a level counts. After `assist_after_stuck` of them, the
level plays `assist_ease` points easier from the next drop until it's beaten.
The count is kept across a drop (stuck on 13, dropped to 12: back on 13 the
count carries on) and saved with the game. Nothing is shown to the player;
the level keeps its label and pay.

Analytics: `assist_on` (level, stuck, difficulty) when help switches on, and
`assisted` on `level_up` for a level beaten with help.
