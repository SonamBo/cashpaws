# Marketing

Everything this game shows outside the game: store art, trailers, listing
text. Start with `BRAND.md`.

| Path | What |
|---|---|
| `BRAND.md` | Name, title lettering, characters, palette, voice, references |
| `references/` | Images to attach when asking an image model for art |
| `showcase.mjs` | The trailer: what the game does on screen while the video records |
| `<store>/LISTING.md` | Text for that store's form |
| `<store>/COVER-PROMPTS.md` | Image-model prompts for that store's art |
| `<store>/covers/` | Finished, exact-size art (from `tools/marketing/make-covers.py`) |
| `out/` | Generated videos (not committed) |
| `shorts/` | YouTube Shorts: `queue/` is posted one a day by `.github/workflows/youtube.yml`, `posted/` keeps the links. See `shorts/README.md` |

Tools, shared by every game on this shell:

```bash
python3 tools/marketing/make-covers.py <store> <images…>      # exact sizes, with checks
node platforms/crazygames/build.mjs                          # the web build the recorder plays
node tools/marketing/record-preview.mjs [--preset crazygames] [--cover-landscape …] [--cover-portrait …]
node tools/marketing/youtube-upload.mjs --dry-run           # the Shorts queue (set-up: tools/marketing/YOUTUBE.md)
```
