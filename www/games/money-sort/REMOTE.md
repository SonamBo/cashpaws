# Money Sort: Remote Config keys

Declared in `index.js` (`REMOTE`), read through `host.remote()`, and passed
to the engine as config. Every default equals the engine's own
(`test/games/money-sort/difficulty.js` checks). How to change them, per
country and in A/B tests: `docs/REMOTE-CONFIG.md`.

| Key | Default | Limits | What it does |
|---|---|---|---|
| `free_sort_through` | `5` | 1–50 | Levels up to this one start with a free Sort. |
| `flow_interval` | `7` | 4–12 | Turns between inflows at the start of a level. More is easier. |
| `junk_chance` | `0.4` | 0–0.8 | Odds a drop-5+ chip is a junk 5 on a normal level. Less is easier. |
| `level_difficulty` | `7/4:2, 8/4:0` | text | Difficulty points per level (below). |
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
- **0.5 or less is a breather:** gets the Lucky Paw coin from level 12.
- Anything between is a normal level, just harder or easier.

Entries are `levels:points`, separated by commas. Later entries win;
unlisted levels are 1. Points are kept between 0 and 4.

| Entry | Means |
|---|---|
| `9:1.5` | level 9 only |
| `3-5:0.5` | levels 3 to 5 |
| `20-:1.2` | level 20 and every level after |
| `7/4:2` | levels 7, 11, 15, 19… (every 4th from 7) |

The default, `7/4:2, 8/4:0`, is the 1.18 rhythm: a Hard level every fourth
level from 7 at 2, the level after it a breather at 0. **A value set in the
console replaces the whole table**, so keep those two entries in it unless
you mean to drop the rhythm. For example, to make levels 1–3 gentler and
everything from 30 a little harder:

```
7/4:2, 8/4:0, 1-3:0.7, 30-:1.2
```

Careful: `30-:1.2` comes last, so it also overrides the Hard levels and
breathers from 30 on (they all become 1.2). To keep them, list the rhythm
again after it: `1-3:0.7, 30-:1.2, 7/4:2, 8/4:0`.

Changing this changes which levels are Hard, so it moves Bell Quest's
difficulty, rewards and level modifiers with it.

## Help when stuck

Each stuck board on a level counts. After `assist_after_stuck` of them, the
level plays `assist_ease` points easier from the next drop until it's beaten.
The count is kept across a drop (stuck on 13, dropped to 12: back on 13 the
count carries on) and saved with the game. Nothing is shown to the player;
the level keeps its label and pay.

Analytics: `assist_on` (level, stuck, difficulty) when help switches on, and
`assisted` on `level_up` for a level beaten with help.
