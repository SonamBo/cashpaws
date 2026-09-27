# Analytics

Firebase Analytics and Crashlytics, added in 1.8.0. Project **cash-paws-prod**,
with two Android apps:

- `com.pixelartgames.cashpaw`: real players (release builds).
- `com.pixelartgames.cashpaw.debug`: your testing (debug builds).

In the console, filter by app so testing never mixes with real data.

## How it's wired

- **Game → shared layer:** `host.levelWon(info)`, `host.levelLost(info)` and
  `host.track(name, params)`.
- **Shared layer → Firebase:** `www/shell/analytics.js` cleans each event to
  Firebase's rules, then passes it to `window.CashPawsAnalytics`, the native
  bridge (`Analytics.java`).
- **In a browser:** nothing is sent.
- **Under `?dev=1`:** every event is logged to the console and kept in
  `window.__events`. `test/analytics.mjs` checks them.

Crashlytics receives native crashes, plus JavaScript errors from the game as
non-fatal reports. Every event is also a Crashlytics breadcrumb, so a crash
report shows what the player was doing just before.

## Events

Firebase collects some events itself: `first_open`, `session_start`,
`user_engagement` and `app_update`. Ours:

**Progress**

| Event | Parameters | When |
|---|---|---|
| `app_ready` | coins, best_level, quest | The app has loaded. |
| `screen_view` | screen_name: `lobby`, `game`, `daily`, `cats`, `progress`, `shop` | Each screen or tab. |
| `level_up` | level (just reached), kind (`normal`/`hard`/`breather`), beat_hard, coins, moves, seconds, quest_step | A level is beaten. `moves` and `seconds` are for the level just beaten; `seconds` counts only time on the board. |
| `level_lost` | level, to, moves, seconds | The player drops a level. |
| `board_stuck` | level, kind, can_sort, free, coins, price, ad_offer | The stuck card appears. |
| `stuck_choice` | level, choice: `sort`/`free-sort`/`drop` | The player's answer to the stuck card. |
| `sort_used` | level, how: `paid`/`free`/`ad`, where: `button`/`stuck`, price | Each Sort. |
| `undo_used` | level | Each Undo. |

**Economy.** These are Firebase's standard events, so they show up in its
built-in reports.

| Event | Parameters |
|---|---|
| `earn_virtual_currency` | virtual_currency_name `coins`, value, source (`levelup`, `daily`, `box`, `quest`, `safety-net`, `bank`), balance |
| `spend_virtual_currency` | virtual_currency_name `coins`, value, item_name (`sort`, `undo`, `cat`, `cosmetic`), balance |

Banks happen dozens of times per level, so they're summed and sent as one
`earn_virtual_currency` (source `bank`) when the level ends or the app goes
to the background.

**Features**

| Event | Parameters |
|---|---|
| `daily_claim` / `daily_bonus` | coins, task, tier / coins, streak |
| `box_open` | coins, via_ad, big |
| `quest_offer`, `quest_start` | level / grand, quest_number |
| `quest_step`, `quest_win` | step, cats_left |
| `quest_claim` | share, finishers |
| `quest_knockout` | step |
| `quest_give_up_prompt` | step, gave_up (the "Give up your quest?" answer) |
| `quest_over_seen` | reason (`lost`/`expired`), step, again |
| `cat_select`, `cosmetic_select` | cat / item |
| `do_not_sell` | on |
| `progress_erased` | best_level |

**Ads**

| Event | Parameters |
|---|---|
| `ad_rewarded_start` | placement (`rescue-sort`, `box-early`) |
| `ad_rewarded_result` | placement, earned |
| `ad_impression` | Sent natively from AppLovin's revenue callback: ad_platform, ad_source, ad_format, ad_unit_name, value, currency USD. This drives Firebase's ad revenue reports. |

**User properties** are attached to every event: `game`, `best_level`,
`cat_worn`, `cats_owned`, `days_played` and `quest_wins`.

## Set up once in the Firebase console

1. **Register the custom parameters** you want in reports: Analytics → Custom
   definitions → Create custom dimension (event scope). Start with `level`,
   `kind`, `placement`, `source`, `item_name`, `how`, `choice` and `step`, plus
   the metrics `seconds` and `moves`. Unregistered parameters are still
   recorded, but reports can't break down by them. The free tier allows 50
   dimensions and 50 metrics.
2. **Register user properties** the same way: `best_level`, `cat_worn` and
   `quest_wins`.
3. **Mark key events:** `level_up`, `quest_win` and `ad_rewarded_result`.
4. **Data retention:** Admin → Data settings → Data retention → 14 months. The
   default is 2 months, which is too short to compare seasons. Match the
   privacy policy's «retention» placeholder to whatever you choose.

## Watching events live (DebugView)

With a debug build on a phone connected by USB:

```
adb shell setprop debug.firebase.analytics.app com.pixelartgames.cashpaw.debug
```

Then open Analytics → DebugView. Events appear within seconds, instead of the
usual few hours. To switch it off:

```
adb shell setprop debug.firebase.analytics.app .none.
```

## Questions this answers

- **Where do players quit?** Compare `level_up` counts by level: a sharp drop
  after a level is a wall.
- **Are Hard levels fair?** Compare `level_lost` and `board_stuck` rates on
  `kind = hard` with normal levels. The simulator predicts 10% against 1%.
- **Does Bell Quest bring players back?** Retention for users with
  `quest_start` against those without.
- **Is the economy working?** Compare `earn_virtual_currency` by source with
  `spend_virtual_currency` by item. The simulator's worry is Sort price outrunning
  income in long sessions.
- **Which ads pay?** `ad_impression` revenue by placement, and the
  `ad_rewarded_result` earned rate. A low rate means ads are being cut short.
