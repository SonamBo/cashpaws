# Remote Config

Since 1.19.0, tuning values can be changed from the Firebase console without
an app update, per country or per group of players, and compared with
Firebase A/B Testing. The app ships with defaults for every value, so it
plays exactly as built until a value is set in the console.

## How it behaves

- **Read once, at launch.** Values stay fixed for the session, so nothing
  changes under a player mid-level. A change in the console reaches a player
  the next time they open the app.
- **New installs wait briefly.** A first launch waits up to 1.5 s for its
  first fetch, so a new player's very first session already uses the values
  meant for them. That matters for A/B tests on first-day retention. Offline
  or slow: the defaults are used.
- **Bad values can't break the game.** Every key has a type and limits in
  code. A value that doesn't parse is ignored (the default is used and
  `config_ready` counts it as `rejected`); a number outside its limits is
  clamped to them.
- **Release builds fetch at most hourly; debug builds every launch**, so
  console changes can be tried on a debug build straight away.
- **On the web (CrazyGames) and in a browser:** always the defaults.

Code: `www/shell/config.js` (the shell's keys, parsing), Android
`RemoteConfig.java` (bridge `window.CashPawsConfig`). A game declares its own
keys in its manifest's `remote` field and reads them with `host.remote(key)`
(`docs/GAME-MODULE.md`).

## The shell's keys (every game)

| Key | Default | Limits | What it does |
|---|---|---|---|
| `ads_interstitials` | `true` | true/false | Ad breaks at all. `false`: rewarded ads only. |
| `ads_interstitial_from` | `11` | 2–200 | First level reached that can have an Ad break (11 = after level 10). |
| `ads_interstitial_gap_s` | `180` | 30–3600 | Seconds between two Ad breaks, counted from the app opening too. |
| `ads_free_days` | `2` | 0–30 | First local days of play with no Ad breaks (2 = install day and the next). |
| `ads_after_rewarded_s` | `60` | 0–600 | No Ad break this many seconds after a rewarded ad. |
| `gift_enabled` | `true` | true/false | Tomorrow's gift for new players. |
| `gift_after_level` | `3` | 1–100 | The gift is offered once this level is beaten. |
| `gift_value_share` | `2` | 0.25–20 | The gift is worth this many of the game's reward value. |

A game's own keys are listed in its folder (Cash Paws:
`www/games/money-sort/REMOTE.md`).

## Changing a value

1. Firebase console → your project → **Run → Remote Config**.
2. **Add parameter**: the key exactly as above, data type to match (Boolean,
   Number, or String), and a default value. Only add the keys you want to
   change; anything not in the console uses the app's own default.
3. **Publish changes.** Players get it on their next launch.

To see what a phone is using: in a debug build, Settings → Ad status shows
"Remote Config: values remote/cached/default", the last fetch, and every key
that differs from its default.

## Per country

Add a **condition** (Remote Config → Conditions → Country/Region is …), then
give a parameter a conditional value. Example: no Ad breaks in India, where
interstitials earn very little:

- condition `India`: Country/Region is India
- `ads_interstitials`: default `true`, `India` → `false`

## A/B tests

Firebase console → **Run → A/B Testing → Create experiment → Remote Config**.

1. **Targeting:** the Android app. For first-day tests, target new users with
   the activation event `first_open`, so only players who install during the
   test are counted.
2. **Goals:** primary `Retention (1 day)`; add `Retention (7 days)` and
   `Estimated total revenue` (ads plus purchases) as secondary goals.
3. **Variants:** the baseline (no change) and one or two variants, each
   setting one or more keys.
4. Leave it running until the console says a leader is found. Firebase
   records each player's variant itself, so every event and report can be
   split by it.

**Sample size:** telling D1 20% from 30% needs roughly 300 new players per
variant. At a few hundred installs a month, run one test at a time, test
large changes only, and expect a test to take weeks.

## Trying a value without the console

With the dev server: `http://localhost:8080/?dev=1&cfg=ads_free_days:0,gift_after_level:1`
(comma-separated `key:value`), or in the dev console
`localStorage.setItem('cashpaws.dev.config', JSON.stringify({ ads_free_days: 0 }))`
and reload.
