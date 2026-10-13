# CrazyGames listing: «Game name»

Everything the CrazyGames submission form asks for, ready to paste. The
form's editor is rich text: paste plain text, then use its toolbar for bold.

## Basics

| Field | Value |
|---|---|
| Title | «Game name» |
| Category | «category» |
| Tags (max 5) | «up to 5 from CrazyGames' list» |
| Orientation | Both (the game fills any window) |
| Mobile | Yes, if it plays well by touch (the build prints its size; the mobile homepage limit is 20 MB) |
| Saves progress | Yes, through the CrazyGames Data module |
| Upload | `«app»-crazygames-basic.zip` for Basic Launch; `…-full.zip` at Full Launch (from `node platforms/crazygames/build.mjs` or the CrazyGames CI run) |

## Description

```
«One hooky line.»

«Two or three sentences: what the player does, what pays off, what to watch out for.»

Features:
- «feature»
- «feature»
- «the shell gives you these too: collectible cats, daily tasks, a Rewards Box, Bell Quest»

«A closing line.»
```

## Controls

```
Mouse: «click …»
Keyboard: «from your web.json keysHelp», P pause, Enter continue.
Touch: «tap …»
```

## Store links

| Field | Value |
|---|---|
| Google Play link | `https://play.google.com/store/apps/details?id=«applicationId»`, only once the listing is public |
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
- [ ] Submit `«app»-crazygames-basic.zip`
- [ ] Basic Launch: at least 7 days and 500 plays (21 days at most). Judged on playtime, how many visitors start playing, and retention
- [ ] If invited to Full Launch: upload `«app»-crazygames-full.zip` as the new version
