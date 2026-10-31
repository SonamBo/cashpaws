# Game modules

Cash Paws is a shell and a game. The shell is everything a player keeps between
games: coins, cats, the lobby, the shop, the save, settings, and the plumbing for
ads and daily tasks. The game is whatever happens on the board.

A game can be anything — a sort puzzle, merge, match-3, a word game, an endless
runner. The shell never learns what the game is. It does not know about tubes,
chips, levels, net worth or undo buttons; it only knows what the game chooses to
tell it through the contract below.

## Swapping the game

One line, in `www/games/active.js`:

```js
export { default } from './money-sort/index.js';
```

Point it at another folder and rebuild. The lobby, cats, shop, progress tab,
settings, save and back button all keep working.

## A game folder

```
www/games/<id>/
  index.js     the module: exports the definition below
  style.css    its styles, listed in `styles` and loaded by the shell
  img/         its art, addressed with host.asset('img/…')
  …            anything else it needs, imported relatively
```

**The folder name must equal the game's `id`.** The shell finds a game's assets,
styles and save slot by it, and the pre-flight fails if they differ.

A game may import only from its own folder. It must never import from
`www/shell/`; everything it needs from the shell arrives through `host`. That
rule is what keeps games swappable, and `test/preflight.js` enforces it.

## What a game exports

```js
export default {
  id: 'money-sort',        // permanent — it namespaces the save; equals the folder
  name: 'Money Sort',
  saveVersion: 1,          // bump when this game's save format changes
  styles: ['style.css'],   // loaded before create(), so the first layout is styled

  // All optional. Read by the shell without starting the game.
  perks: {                 // what each cat does in THIS game
    mittens: { text: 'Undo costs 10 instead of 20.', config: { undoCost: 10 } },
  },
  cosmetics: [             // sold in the Shop, applied with setCosmetic()
    { id: 'classic', name: 'Coin chips', price: 0, note: '…', preview: 'img/chip-20.png' },
  ],
  tasks: [                 // the daily-task catalogue, driven by host.stat()
    { id: 'bank-8', tier: 'easy', text: 'Bank 8 tubes', stat: 'banks', target: 8 },
  ],
  quest: { unlockLevel: 8, steps: 7 },   // optional: opts in to Bell Quest
  analytics: { batch: ['bank'] },        // coin reasons too frequent to send one by one
  remote: {                // tuning values Firebase Remote Config may change (docs/REMOTE-CONFIG.md)
    free_sort_through: { default: 5, type: 'int', min: 1, max: 50, about: 'Levels up to this one start with a free Sort.' },
  },
  sounds: {                // the game's own effects, played with host.sound(name)
    meow: (t, { ctx, bus, tone, noise }) => { /* Web Audio nodes into bus, from time t */ },
  },

  create(host, root) { return instance; },
};
```

A cat with no entry in `perks` is purely cosmetic in that game, and the Cats tab
says so. A game with no `cosmetics` shows an empty Shop section.

## What `create()` returns

| method | required | purpose |
|---|---|---|
| `start(saved, version)` | yes | begin, from `saved` or fresh when it is `null`; `version` is the `saveVersion` it was written with, so the game can migrate its own data |
| `serialize()` | yes | JSON-safe state for the save |
| `show()` / `hide()` | no | the game screen became visible or hidden |
| `pause()` / `resume()` | no | app backgrounded, or a card is covering the game |
| `onBack()` | no | return `true` if the game handled the back press |
| `restart()` | no | if present, the pause menu offers Restart |
| `setPerk(config)` | no | the worn cat changed |
| `setCosmetic(id)` | no | a cosmetic was bought or worn |
| `progressRows()` | no | a table for the Progress tab |
| `canOffer(task)` | no | return `false` to keep a task out of today's draw, e.g. one the player cannot do yet |
| `rewardValue()` | no | coins a reward is worth right now; the Rewards Box pays about half of it. Money Sort returns its Sort price. Default 150 |
| `relayout()` | no | the screen size or orientation changed |
| `openFromLobby(id)` | no | the player tapped the game's own lobby button `id` (`host.lobbyButton`); called just before the game screen shows |
| `dev` | no | `{ buttons: [{ id, label, run }], readout() }` for `?dev=1` |

## What the shell hands in: `host`

```js
host.wallet.coins                 // current balance
host.wallet.canAfford(n)
host.wallet.earn(n, reason)       // reason feeds stats and, later, analytics
host.wallet.spend(n, reason)      // false, and no change, if short

host.stat(key, n = 1)             // count something; this game's daily tasks read these
host.levelWon(info)               // a level beaten: one Bell Quest step, and a level_up event
host.levelLost(info)              // a level lost: knocks out of Bell Quest; a level_lost event
host.track(name, params)          // an analytics event of the game's own (see docs/ANALYTICS.md)
await host.levelBreak()           // between a level's celebration and the next level: Bell Quest shows its step here
host.levelLossWarning()           // before a chosen loss: { kicker, title, line, stat, ok, cancel, answer(yes) } or null
host.coach.tip / spotlight / clear  // tutorial coach marks; 'progress' targets the shared progress bar
host.flag(key), host.setFlag(key) // small remembered facts, such as a finished tutorial
host.remote(key)                  // a value declared in `remote`: Firebase's if set there, else the default; fixed for the session
await host.confirmLevelLoss()     // before a loss the player chose; false means don't

host.stats                        // this game's counters so far, read-only
host.progress({                   // drives the shared header and the lobby
  title,                          //   'Level 5'  or  'Score 1,240'
  fraction,                       //   0..1 for the bar, or null for no bar
  figure,                         //   '$2,480 / $3,000'
  sub,                            //   'Next level at $3,000'
  level,                          //   optional number; the shell tracks the best
  summary,                        //   the lobby's Continue line
})

host.celebrate({ kicker, title, figure, reward })   // the worn cat cheers
host.setback({ kicker, title, figure, line })       // the worn cat slumps
host.confirm({ kicker, title, line, ok })           // resolves true or false
host.cards.show(html, kind) / host.cards.dismiss(el)  // for game-specific cards

host.moment(kind)                 // a natural break: 'level-complete', 'setback'
host.busy(on)                     // true while a move or animation plays; no Ad break starts until false
host.rewarded.available(where)    // is a rewarded ad ready for this placement?
host.rewarded.show(where)         // resolves true if the player earned the reward

host.art.cat(pose, width, cls)    // the worn cat: 'peek' | 'cheer' | 'slump' | 'face'
host.art.logo(width)              // the app's title art, as an <img>, for a game's own cards or clips
host.art.coin(width)
host.asset(path)                  // this game's file, e.g. 'img/chip-5.png' — always
                                  // go through this; the single-file build depends on it

host.sound(name)                  // an effect: tap, lift, drop, bank, levelup, flow, sort,
                                  // undo, error, coin, open, unlock, or one of the game's own
                                  // `sounds`. Music and the shell's own sounds (buttons, cards,
                                  // rewards) need nothing from the game
host.haptic(pattern)
host.save()                       // save now, e.g. after something important
host.exit()                       // back to the lobby
host.dev                          // true under ?dev=1
```

## What the shell owns, so a game does not have to

Coins, and what they buy. Cats: art, unlocking, ownership, which one is worn.
The header across the top of the game screen. The lobby, Cats, Progress and Shop
tabs. Pause, settings, the privacy policy, and erasing progress. The save and its
migrations. The Android back button. Level-up and setback celebrations. Ads,
consent and daily tasks as they arrive.

## Daily tasks

The shell runs them; a game only declares a catalogue and reports stats.

Each day the shell draws one `easy`, one `medium` and one `hard` task from the
game's `tasks`, seeded by the date so a reload never reshuffles them. A task is
done when its `stat` has risen by `target` **since the day's tasks were drawn** —
the shell snapshots the counters at that moment. When a `host.stat()` call
finishes a task mid-play, the shell shows a small toast that never blocks the
game. Rewards are paid by the shell in coins: 20, 35 and 50 by tier, plus 50 for
all three.

Two rules for writing a catalogue:

- **Never reward spending.** A "use Sort once" task costs 150 coins to earn 50.
- **Only offer what is possible.** Use `canOffer(task)` to hold back tasks the
  player cannot do yet — Money Sort keeps "bank a tube of $50s" out until $50
  chips can appear. Extra fields on a task, like `chip: 50`, are the game's own.

The pre-flight checks every task has a known tier, a stat and a positive target.

## The Rewards Box

The shell runs it: a box every 4 hours, the first ready at once, paying coins in
proportion to `rewardValue()` — about half on average, a whole one about one
time in eight. A game that grows more expensive as it goes should report a
growing value, or its boxes will shrink into irrelevance. Ad placements for
opening early are built in the shell and hidden until an ad network exists.

## Bell Quest

A game that declares `quest` in its manifest gets Bell Quest: once the player's
best level reaches `unlockLevel`, a quest is offered; beating `steps` levels in
a row, within 48 hours, shares a grand prize (ten times `rewardValue()`) with
the simulated cats who also finish. The game only reports outcomes:
`host.levelWon()` for each level beaten and `host.levelLost()` for each lost.
Before a loss the player chooses, it awaits `host.confirmLevelLoss()`, which
asks "Give up your quest?" only while a quest is running. A game without
`quest` never shows the icon. Design and numbers: `docs/BELL-QUEST.md`.

## Ad breaks (interstitials)

The shell runs them, at the end of a level (since 1.16.0). Once the player
has beaten level 10, every level won ends with a 2-second "Ad break" card
with the worn cat and then an ad, before the next level starts. One is
skipped within a minute of a rewarded ad. Never mid-board. Two things make
this work in a new game:

- **Report each win with `host.levelWon({ level })`**, `level` being the level
  just reached. No levels, no Ad breaks: a game without levels (like the
  template) only ever shows rewarded ads.
- **`await host.levelBreak()`** after the level's celebration and before the
  next level starts. Bell Quest shows its step there, then the Ad break plays.

The rules live in `www/shell/ads.js`. Since 1.19.0 each can be changed from
Firebase Remote Config without an app update (`ads_interstitials`,
`ads_interstitial_from`, `ads_interstitial_gap_s`, `ads_free_days`,
`ads_after_rewarded_s`; see `docs/REMOTE-CONFIG.md`), per country too. The
defaults are the same for every game built on this shell.

## Share, rating, cloud save

The shell does all three. A game only passes `share: true` to
`host.celebrate()` on the card worth sharing (Money Sort: every level-up),
which adds a small Share button where sharing works. The rating sheet is asked
at `host.levelBreak()` after levels 2, 10 and 25 are cleared (that break has no
Ad break), and the cloud save copies the whole save, the game's slot included,
through `serialize()`: nothing to do there.

## A button on the lobby, and sharing a file

A daily challenge or an event of the game's own can have a lobby button,
opposite Bell Quest, in the same gold disc:

```js
host.lobbyButton('daily-puzzle', {
  icon: 'img/puzzle-day.svg',     // in the game's folder
  label: 'Puzzle of the Day',     // for screen readers
  pill: 'Puzzle',                 // the line under it
  badge: '3🔥',                   // the corner badge, or ''
  news: true,                     // wiggle: something waits
});
host.lobbyButton('daily-puzzle', null);   // take it away
```

Call it again whenever what it says changes (the game's `start`, `hide` and
`resume` are good moments: the lobby shows after `hide`, and midnight may
pass in the background). A tap calls the instance's `openFromLobby(id)`, then
shows the game screen.

`await host.shareFile({ blob, name, text, from })` shares a file the game
made, such as a replay clip: the phone's share sheet in the Android app (the
store link is added to `text`), the browser's where it can share files, a
download otherwise. `host.canShareFile()` says whether to offer the button.

## Short of coins

When the player can't afford something, `await host.shortOf({ price, what,
ad, adLabel })` shows one card: coin packs first (where the build sells
them), then a rewarded ad for `ad`'s placement, then "Not now". It resolves
`'coins'` (they now have enough: go ahead and charge), `'ad'` (watched to the
end: give it free) or `null`. `host.shortHelps(ad)` says whether there is
anything to offer, so a button can stay tappable while the player is short.
Money Sort's Sort button and stuck card use it. `host.openCoins()` opens the
Shop's coin packs and resolves when it closes; `host.coinsForSale()` says
whether this build sells any.

## Stats: two kinds

The shell keeps a few stats for itself, whatever the game: `coinsEarned`,
`bestLevel` and `daysPlayed`. **Cat unlocks use only these**, so every cat can be
earned in any game.

Everything a game passes to `host.stat()` is stored under that game's id and
read by that game's daily tasks. Money Sort reports `banks`, `drops` and
`sorts`; a match-3 might report `matches` and `combos`.

## Pause means pause

`pause()` is called whenever anything covers the game — the pause menu, and any
Cats, Shop or Progress sheet opened from it — and `resume()` only once nothing
does. A real-time game must stop its clock in `pause()`. `resume()` may also
arrive while the game is off screen, so track visibility from `show()` and
`hide()`; the template shows how.

## The save

```js
{
  v: 2,
  shell: { coins, stats, cats: { owned, worn }, cosmetics: { [gameId]: … }, gameStats: { [gameId]: … } },
  games: { [gameId]: { v: saveVersion, data } },
}
```

Every game keeps its own slot, so switching games never loses the other one's
progress, and switching back resumes it. Saves from 1.0.x, where coins lived
inside the game, are migrated on first launch.

## Starting a new game

Copy `www/games/template/` — Coin Catch, a complete and deliberately tiny game
that implements the whole contract. Rename the folder, set `id` to the same
name, and point `active.js` at it. It will run inside the full shell immediately — lobby, cats, shop, save and
all — before you have written any real gameplay.

## What stops this from rotting

`node test/preflight.js`, run first in CI, enforces the boundaries: every game
folder has an `index.js` whose `id` matches its folder, its styles and asset
literals exist, it imports nothing outside its own folder, and the shell imports
no game except through `active.js`. `test/shell.mjs` checks the shell works with
whatever game is installed, and Cash Paws' `test/games/money-sort/swap.mjs` installs Coin Catch, plays
it inside the full shell, swaps back, and checks both saves survived.
