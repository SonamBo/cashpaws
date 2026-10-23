# Shorts

Videos waiting for YouTube go in `queue/`, and `.github/workflows/youtube.yml`
uploads one a day, oldest name first. Once a video is up, it moves to
`posted/` with a `.json` holding its link. Set-up, metadata fields and limits
are in `tools/marketing/YOUTUBE.md`.

| In the queue | What it is |
|---|---|
| `001-can-you-sort-this` | 24.5 s. A four-move combo banks $80, $40, $200 and $20, levels up, and a new-coins drop lands. Purple banner captions, game music and effects |
| `002-sorting-cash-with-cats` | 29.5 s. The showcase trailer inside a phone frame, with captions and game music |

Check the order and titles before pushing:

```bash
node tools/marketing/youtube-upload.mjs --dry-run
```
