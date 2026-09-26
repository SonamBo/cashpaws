# Roadmap

Written after 1.1.0, where the app became a shell plus a swappable game. Every
item below is built once, in the shell, and works for any installed game —
that was the point of doing the refactor first.

Order matters: each step can ship on its own, and the ones with policy
consequences come last.

## 1. Daily tasks — shipped in 1.2.0

Built as designed below: a Daily tab with a badge, three tiered tasks a day,
claim buttons, an all-three bonus and a seven-stamp streak. Rewards 20/35/50
plus 50. See `www/shell/daily.js`, `test/daily.js` and `test/daily.mjs`.

**What the balance work found.** Simulating two weeks of play with coins carried
between days, a returning player banks over 10,000 coins and loses a level on
only 1.4% of days — before any daily rewards. Daily tasks take that to 0%, a
marginal change. The real issue is pre-existing: **Money Sort's late game has
no coin sink**, so Sort, its difficulty lever, becomes effectively free once
the cats are bought.

**Resolved in 1.3.0:** Sort now costs 150 plus 35 per level. Of four sinks
simulated, only level scaling restored tension — doubling the price on repeat
use never triggered, and a wallet cap deleted the pile without making Sort any
dearer. See PROGRESS.md for the numbers.

The original design notes follow.

Fully offline. No store-listing or policy impact.

**Seams already in place.** Games declare a `tasks` catalogue and report
progress through `host.stat()`; the shell already stores those counters per
game, and records `daysPlayed` and the last day seen.

**To build.** A Daily sheet on the lobby: three tasks drawn from the installed
game's catalogue each day, progress bars, a Claim button, and a streak for
consecutive days. Reset at local midnight. Counters for a task are measured
from a snapshot taken at the start of the day, not from lifetime totals.

**Known limit.** With no server, the date comes from the phone's clock, so a
player can wind it forward to farm tasks. That is normal for offline casual
games. Winding it backwards already earns nothing — `markDay()` ignores a date
earlier than the last one seen.

## 2. Rewards box — shipped in 1.4.0

Coins only, sized as a share of the current Sort price, every 4 hours; the
first box is ready at once. Sort rises 60 per level to compensate. The stuck
card offers a broke player a free Sort for watching an ad. Both ad placements
are built and hidden until step 3.

**The box is load-bearing.** Days losing a level for a returning player, by
boxes opened per day: 0 → 37%, 1 → 16.5%, 2 → 4.2%, 3+ → ~0%. Difficulty now
tracks how often a player checks in. If that gap matters, let unopened boxes
stack up to two, so a once-a-day player is not penalised.

## 2. Rewards box — design notes

Now that Sort costs something again, rewards are worth having: a free Sort from
a rewarded ad is meaningful at 465 coins, where it was not at a flat 150 with
10,000 in the bank.

## 2. Rewards box (original notes)

**Built against the ad stub first**, so the economy is tuned before real ads
exist. `host.rewarded` already answers `available()` and `show()`; under
`?dev=1` the stub simulates a watched ad, and in the real app it reports
nothing available, so rewarded buttons stay hidden until step 3.

**The design.** A box on the lobby that refills on a timer, with a rewarded ad
to open it early or double it. The strongest placement, though, is the stuck
card: "watch an ad for a free Sort" rescues a player at the exact moment they
would otherwise quit. Coin Catch already shows the pattern with its
keep-your-streak offer.

**The economy warning.** Sort's price is Money Sort's main difficulty lever: at
30 coins, runs losing a level fell from 47% to 10%. Daily and ad coins would
flood the economy and make Sort effectively free. Rewards should grant capped
Sort and Undo *tokens* rather than raw coins, and `test/perks.js` and the
balance probes should be re-run before shipping.

## 3. AppLovin MAX — rewarded ads shipped in 1.5.0

Decided: target audience 13+, US and India only for now, store listing updated
to say ads are present. Built: `Ads.java` bridge, SDK 13.6.3, the two rewarded
placements live, a US "do not sell or share" switch in Settings, and a draft
privacy policy naming AppLovin. With blank keys the app builds with no ads.
Interstitials are not built; "ads only when you want one" in the listing is true
until they are.

Before entering Europe or the UK: add the consent flow. MAX automates Google UMP
for that (the "Terms and Privacy Policy Flow" in AppLovin's docs).

## 3. AppLovin MAX — original notes

Two rewarded placements already exist and only need a real provider in
`shell/ads.js`: `box-early` (open the box now, three a day) and `rescue-sort`
(a free Sort for a stuck player who cannot afford one).

The only step with policy consequences, and all of them land in one release.

**Things this breaks on purpose:**

- It needs the `INTERNET` and `AD_ID` permissions. `test/preflight.js`
  deliberately fails the build if `INTERNET` appears, because the listing
  promises the app has none. That guard is removed as a conscious step, in the
  same commit as the listing change.
- The store listing ("no ads, no internet, collects no data"), the Data safety
  form (advertising ID, device data, shared with ad networks), and the privacy
  policy (naming AppLovin and each mediated network) must all change in the
  same release. A mismatch between what the app does and what the listing says
  is a removal risk.
- The Settings note — "No ads, no purchases, and no internet access" — is
  passed in from `shell/main.js` and must change too.

**Decisions to make first:**

- **Play target audience.** If under-13s are in the declared audience, only
  Families-certified ad SDKs are allowed, which rules out much of a mediation
  stack. Decide this before integrating anything.
- **Consent.** EEA and UK users need consent before ads are served. MAX has a
  consent flow; Google adds its own requirements if its networks are in the
  stack.
- **`app-ads.txt`** at the root of the developer website on the Play listing.

**Architecture.** MAX is a native SDK and the game runs in a WebView, so this
needs a JavaScript-to-native bridge in `MainActivity.kt`. The shell's
`shell/ads.js` is the only file on the web side that changes: it swaps the stub
for a provider that calls the bridge. No game changes, because games only ever
talk to `host.moment()` and `host.rewarded`.

**Placement policy, owned by the shell.** Interstitials only at
`host.moment('level-complete')` and similar natural breaks, frequency-capped,
never in a player's first session, never after a setback, never mid-play.

**A tradeoff to weigh honestly.** "No ads" is currently the listing's strongest
line in a genre full of ad-heavy games. Launching with rewarded ads only keeps
most of that goodwill; interstitials are what drive one-star reviews.

## 4. Level pacing — shipped in 1.6.0

Free first Sort, shorter levels, Hard levels every 4th from 7 with a breather after, and face-down chips from level 9. Next mechanics are planned every 10–15 levels, each on a normal level. See `docs/LEVEL-DESIGN.md`.

## 5. Bell Quest — shipped in 1.7.0

Seven levels in a row, shared prize, from level 8. See `docs/BELL-QUEST.md`. Next: illustrated art, and a pass on Money Sort's economy for long sessions.

## Housekeeping carried forward

- **Soot has no artwork** and plays as Patch. Four poses, per
  `docs/CAT-ART-PROMPTS.md`, then `tools/import_cat.py` and `hasArt: true`.
- **The peek pose** for the newer cats is a full body where Patch's is cropped
  at the chest, so they sit smaller on the ledge.
- **No bundled font.** Android falls back to Roboto.
- **The heart sits on the cat's forehead** on single-row boards. Pre-existing;
  the offsets in the game's `.corner-heart` rule need a nudge.
