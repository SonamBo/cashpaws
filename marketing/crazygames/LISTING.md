# CrazyGames listing: Cash Paws

Everything the CrazyGames submission form asks for, ready to paste. The
form's editor is rich text: paste plain text, then use its toolbar for bold.

## Basics

| Field | Value |
|---|---|
| Title | Cash Paws |
| Category | Puzzle |
| Tags (max 5) | 1 Player, Sorting, Relaxing, Skill, Cat. "Money" or "Brain" could replace "Skill". |
| Orientation | Both (the game fills any window) |
| Mobile | Yes (about 2.3 MB; the mobile homepage limit is 20 MB) |
| Saves progress | Yes, through the CrazyGames Data module |
| Upload | `cash-paws-crazygames-basic.zip` for Basic Launch; `…-full.zip` at Full Launch (from `node platforms/crazygames/build.mjs` or the CrazyGames CI run) |

## Description

```
Sort the cash, bank the stacks, and help a crew of cats get rich!

Cash Paws is a cozy money-sorting puzzle. Click a tube to lift its top coins and drop them onto matching ones. Fill a tube with four of the same value and it banks straight into your fortune. But keep an eye on the flow: every few moves, new money drops into every tube at once, so plan ahead before the board fills up.

Features:
- Hundreds of levels that build from easy warm-ups to tricky Hard levels with bigger payouts
- New twists as you climb: Lucky Paw coins that match anything, locked tubes and frozen coins
- Collect five cats, each with its own perk, from cheaper Undo to slower coins
- Bell Quest: win levels in a row to share a big prize with the cats who make it
- Daily tasks and a free Rewards Box every few hours
- Stuck? Undo a move or Sort the whole board

Relaxing to play, satisfying to master, and full of cats.
```

Check before pasting: "Hundreds of levels" could be "Endless levels"; "five
cats" is the number with artwork today.

## Controls

```
Mouse: click a tube to lift its top coins, then click another tube to drop them there.
Keyboard: 1–9 pick a tube, Z undo, S sort, P pause, Enter continue.
Touch: tap a tube, then tap where to drop.
```

## Store links

| Field | Value |
|---|---|
| Google Play link | `https://play.google.com/store/apps/details?id=com.pixelartgames.cashpaw`, only once the listing is public |
| Google Play downloads | the total from Play Console (optional) |
| iOS App Store, Steam | blank |
| Marketing creatives URL | optional: a shared folder with the covers and videos |

## Covers (3) and videos (2)

| Asset | Size | How |
|---|---|---|
| Landscape cover | 1920 × 1080 | `COVER-PROMPTS.md`, then `tools/marketing/make-covers.py crazygames …` → `covers/` |
| Portrait cover | 800 × 1200 | same |
| Square cover | 800 × 800 | same |
| Landscape video | 1920 × 1080, 18 s, no sound | `node tools/marketing/record-preview.mjs` → `marketing/out/crazygames-16x9.mp4` |
| Portrait video | 1080 × 1620, 18 s, no sound | same → `marketing/out/crazygames-2x3.mp4` |

The videos play `marketing/showcase.mjs`. Build the web version first
(`node platforms/crazygames/build.mjs`). Covers: only the title as text, no
"Play now", no store icons, no borders. Videos: 15–20 s, no sound, no cursor,
no black bars, opening on the cover.

## Submission checklist

- [ ] Developer account at developer.crazygames.com (payout details too)
- [ ] Preview the basic zip in the portal's Preview/QA tool: opens in the game, clicks and keys work, progress survives a reload
- [ ] Three covers, two videos
- [ ] Form filled from this page
- [ ] Submit `cash-paws-crazygames-basic.zip`
- [ ] Basic Launch: at least 7 days and 500 plays (21 days at most). Judged on playtime, how many visitors start playing, and retention
- [ ] If invited to Full Launch: upload `cash-paws-crazygames-full.zip` as the new version
