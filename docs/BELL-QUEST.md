# Bell Quest

Cash Paws' take on Royal Match's Lava Quest, added in 1.7.0. Beat seven levels
in a row without dropping one, and share a grand prize with every cat who also
makes it.

## The loop

1. **Unlock.** Offered once the player's best level reaches 8, right after the
   first Hard level (7). Lava Quest starts the same way, just after a hard level,
   so the player comes in on the high of a win.
2. **Offer.** A card with the prize, the rule and the time limit, plus **Start**.
3. **Rounding up.** A counter runs to 100/100 as cat faces pile up.
4. **The path.** Levels n/7, Cats n/100, the timer, and seven stepping stones up
   to the prize, with your cat on the stone you have reached. The first time,
   three rules sit underneath:
   - 100 cats start the quest.
   - Use a Sort when stuck. Dropping a level knocks you out.
   - The prize is shared equally by every cat who finishes.
5. **Each level beaten** is a step. A toast in the game shows it:
   "Bell Quest 3/7 · 30 cats left".
6. **Dropping a level** knocks you out. The stuck card's "Drop a level" first asks
   "Give up your quest?", which names your step and the prize. "Back" returns to
   the stuck card, where Sort (or a Sort paid for with an ad) is still on offer.
   This is our version of Lava Quest's "spend boosters to protect your streak".
7. **The result:** Claim, Knocked out, or Time ran out. The next quest is offered
   straight away; "Start a new quest" on the knockout card goes directly in.

## When the card appears

| | Pops up? |
|---|---|
| App opened (cold start) | always, once unlocked |
| Back to the lobby with a new step, a win, a knockout or an expiry | yes |
| Back to the lobby with a new quest not yet offered this session | yes, once |
| Back to the lobby with nothing new | no; the icon is enough |
| App brought back from the background | same rules as returning to the lobby |

The lobby icon sits top left, under the coins: a gold bell with a step badge
(3/7) and a pill underneath: **New!**, a countdown (1d 23h), **Claim!** or
**Over**. It wiggles when something is waiting.

## The other cats

The app has no server, so the other 99 are simulated. They are shown and
described as **cats**, never as players, so nothing claims they are real
people. At the start of each quest, a seeded draw decides how many survive each
step. The survival rates are tuned to the published Lava Quest results (five
runs, in the article you sent):

| Step | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| Lava Quest, average of 5 runs | 100 | 71 | 44 | 30 | 23 | 14 | 10 | 7 |
| Bell Quest, average of 5,000 draws | 100 | 70 | 45 | 30 | 22 | 13 | 9 | 7 |

Most finishing fields are between 4 and 10 cats. About one quest in 200 ends
with nobody else left: "The whole prize is yours!"

## What we changed from Lava Quest, and why

**48 hours, not 24.** Lava Quest's day assumes levels that take two minutes.
Mid-game Money Sort levels take about 3.5, so a player on ten minutes a day
clears three or four. Simulated at 24 hours, 84% of that player's quests simply
ran out of time.

**Grand prize: ten Sorts.** It is fixed when the quest starts, at ten times the
current Sort price, rounded to 100. That is 3,300 coins at level 8 and 11,300 at
level 40. A typical win, split seven ways, pays about two Sorts.

Simulated over two weeks, with quests back to back from level 8, 7 steps and
48 hours. For the ten-minute player, 57% of quests still run out of time, 9%
end in a knockout, and 22% are won:

| Grand prize | Quests won | Avg win | Days losing a level (10 min/day) |
|---|---|---|---|
| none | — | — | 10.0% |
| 8 × Sort | 22% | 600 | 6.1% |
| **10 × Sort** | **22%** | **754** | **5.3%** |
| 12 × Sort | 22% | 900 | 4.6% |
| 20 × Sort | 23% | 1,500 | 3.1% |

Coins from the quest make the game easier: every win buys Sorts. At ten Sorts,
difficulty for a casual player falls from 10% to 5.3% of days, roughly
back to where it was in 1.5. `GRAND_SHARES` in `www/shell/quest.js` is the
single dial.

**No ad to stay in.** A Sort, bought with coins or paid for with an ad, is the
way to protect a streak, so the stuck card already carries the ad placement.

## Flagged, not changed

Simulating a heavier player (about 20 minutes a day, 500 moves) turned up
something that has nothing to do with the quest: without it, they lose a level
on **79% of days**. The 1.6 tuning only modelled the 10-minute player. The
bot's income per minute seems not to keep pace with a Sort price that rises
every level. The quest helps a little (61%), but the real fix is Money Sort's
economy for long sessions, and deserves its own pass.

## Files

- `www/shell/quest.js`: the rules (pure, no DOM).
- `www/shell/questui.js`: the cards and the bell art.
- `www/shell/main.js`: when cards appear, toasts, and the drop confirmation.
- `tools/quest-sim.mjs`: the simulation behind every number here.
  `STEPS=7 HOURS=48 PERDAY=250 node tools/quest-sim.mjs 0 10 20`
- `test/quest.js`: 51 rule checks, run in CI.
- `test/quest.mjs`: 45 checks in the running app.

## Art

Made in Gemini from `docs/BELL-QUEST-ART-PROMPTS.md` (1.7.1). The originals
are in `tools/art-src/`; `python3 tools/process-quest-art.py` turns them into
`www/img/quest-*.png` and `quest-path.jpg`. The script:

- removes Gemini's sparkle watermark by reversing its blend, so the coin
  under it on the prize survives;
- keys out the magenta, including the purple fringe along outlines;
- splits the stones apart;
- scales each to three times its largest on-screen size, in 256 colours.

The six files come to about 100 KB. To replace a piece, drop a new original into
`tools/art-src/` under the same name and rerun the script.
