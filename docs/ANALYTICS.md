# Analytics

Firebase Analytics and Crashlytics, on whenever `android/app/google-services.json`
is present. The Firebase project needs two Android apps:

- the `applicationId` from `www/app.config.js`: real players (release builds);
- the same with `.debug` on the end: your testing (debug builds).

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

Most events below come from the shell and work for any game. `board_stuck`,
`stuck_choice`, `sort_used` and `undo_used` are Money Sort's own, sent with
`host.track()`; a new game defines its own the same way and lists them here.

Firebase collects some events itself: `first_open`, `session_start`,
`user_engagement` and `app_update`. Ours:

**Progress**

| Event | Parameters | When |
|---|---|---|
| `app_boot` | load_ms (since the WebView started the page), new_player | The page's first event, before the game loads. Installs with `first_open` but no `app_boot` never got the page running. |
| `app_ready` | coins, best_level, quest, load_ms, start_screen (`game` for a player still on level 1, else `lobby`) | The app has loaded. |
| `screen_view` | screen_name: `lobby`, `game`, `daily`, `cats`, `progress`, `shop` | Each screen or tab. |
| `level_up` | level (just reached), kind (`normal`/`hard`/`breather`), modifiers (`locked`, `frozen`, `lucky`, comma-separated, or `none`), beat_hard, coins, moves, seconds, quest_step | A level is beaten. `moves` and `seconds` are for the level just beaten; `seconds` counts only time on the board. |
| `level_lost` | level, to, modifiers, moves, seconds | The player drops a level. |
| `board_stuck` | level, kind, can_sort, free, coins, price, ad_offer, buy_offer | The stuck card appears. |
| `stuck_choice` | level, choice: `sort`/`free-sort`/`drop` (a Sort after buying coins counts as `sort`) | The player's answer to the stuck card. |
| `sort_used` | level, how: `paid`/`free`/`ad`, where: `button`/`stuck`, price | Each Sort. |
| `undo_used` | level | Each Undo. |

**Economy.** These are Firebase's standard events, so they show up in its
built-in reports.

| Event | Parameters |
|---|---|
| `earn_virtual_currency` | virtual_currency_name `coins`, value, source (`levelup`, `daily`, `box`, `quest`, `gift`, `safety-net`, `bank`, `purchase`), balance |
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
| `quest_claim` | share, finishers, where (`game` when claimed right after the level-up) |
| `quest_knockout` | step |
| `quest_give_up_prompt` | step, gave_up (the "Give up your quest?" answer) |
| `quest_over_seen` | reason (`lost`/`expired`), step, again |
| `cat_select`, `cosmetic_select` | cat / item |
| `do_not_sell` | on |
| `ftue_step` | step: `move`, `stack`, `bank` (each beat of the first-time tutorial as it starts) |
| `ftue_complete` | (the player tapped Got it on the progress-bar spotlight) |
| `gift_offer` | level, coins, remind (whether "Remind me tomorrow" was offered): tomorrow's gift, once after level 3 |
| `gift_claim` | coins, days (local days since the offer; 1 = next day), from_reminder |
| `reminders_offer` | reason (`gift`/`box`/`quest`), yes (the in-game ask, or the gift card's buttons) |
| `reminders_permission` | granted (Android's own prompt), reason |
| `reminders_toggle` | on (the Settings switch) |
| `reminder_open` | id (`gift`/`box`/`quest`): the app was opened from a reminder |
| `progress_erased` | best_level |

**Ads**

| Event | Parameters |
|---|---|
| `ad_rewarded_start` | placement (`rescue-sort`, `box-early`) |
| `ad_rewarded_result` | placement, earned |
| `ad_interstitial_show` | placement `ad-break`, level (the level just reached; when the Ad break screen hands over to the ad, at a level's end) |
| `ad_load_failed` | format (`rewarded`/`interstitial`), code (AdMob's error code: 3 = no fill, 1 = bad request/ID, 2 = network, 0 = internal), message. Once per format and code per session. |
| `ad_interstitial_result` | placement, shown (whether an ad actually played) |
| `ad_impression` | Logged by the AdMob SDK itself once AdMob is linked to Firebase (AdMob → Settings → Linked services): ad revenue per impression. This drives Firebase's ad revenue reports. |

**Purchases** (coin packs, since 1.16.0; only in builds with `coinPacks` in
`www/app.config.js`)

| Event | Parameters |
|---|---|
| `iap_view` | from: `tab` (the Shop tab), `pill` (the + on the coin counter), `short` ("Get coins" when something cost too much). Only once Play has returned prices. |
| `iap_start` | product, coins (the player tapped a price) |
| `iap_result` | product, status: `purchased`, `pending`, `cancelled`, `owned` (an earlier purchase being finished), `error` |
| `coins_short` | what (`a Sort`, a cat or chip set), need, buy (coin packs offered), ad (an ad offered): the "Not enough coins" card. Coin packs come first, then the ad. |
| `iap_granted` | product, coins, quantity, order (`yes`/`no`): coins actually added, once per purchase |
| `in_app_purchase` | Logged by Firebase itself for every Google Play purchase, with the price and currency. **Revenue reports come from this one**; the shell sends no revenue of its own, so nothing is counted twice. |

The funnel is `iap_view` → `iap_start` → `iap_result` → `iap_granted`.
Bought coins also send `earn_virtual_currency` with source `purchase`; they
don't count towards `coinsEarned`, which reveals cats.

**Cloud save, share, rating** (since 1.18.0)

| Event | Parameters |
|---|---|
| `cloud_signed_in` | (signed in to Play Games, automatically or from Settings) |
| `cloud_restore_offer` | level (the cloud save's), local_level ("Continue from level N?" shown) |
| `cloud_restore` | restored (true: took the cloud save; false: started fresh) |
| `share_open` | from: `lobby`, `settings`, `levelup` (the share sheet opened; whether they sent it is unknown) |
| `review_request` | at: 3, 11 or 26 (the level just reached: after clearing 2, 10, 25) |
| `review_done` | at, asked (Google's sheet finished; it never says whether it showed or they rated) |

**User properties** are attached to every event: `game`, `best_level`,
`cat_worn`, `cats_owned`, `days_played` and `quest_wins`.

## Set up once in the Firebase console

1. **Register the custom parameters** you want in reports: Analytics → Custom
   definitions → Create custom dimension (event scope). Start with `level`,
   `kind`, `placement`, `source`, `item_name`, `how`, `choice`, `step` and
   `reason`, plus the metrics `seconds`, `moves` and `load_ms`.
   (Cash Paws has `level`, `step`, `choice` and `reason` registered since
   24 Oct 2026; data from before a dimension is registered stays unbroken.) Unregistered parameters are still
   recorded, but reports can't break down by them. The free tier allows 50
   dimensions and 50 metrics.
2. **Register user properties** the same way: `best_level`, `days_played`,
   `cat_worn` and `quest_wins`.
3. **Mark key events:** `level_up`, `quest_win` and `ad_rewarded_result`.
4. **Data retention:** Admin → Data settings → Data retention → 14 months. The
   default is 2 months, which is too short to compare seasons. Match the
   privacy policy's «retention» placeholder to whatever you choose.

## Watching events live (DebugView)

With a debug build on a phone connected by USB:

```
adb shell setprop debug.firebase.analytics.app <your applicationId>.debug
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
