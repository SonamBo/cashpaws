# Game starter

An Android game shell with everything except the game: Firebase analytics and
crash reports, AdMob (rewarded ads and timed Ad breaks, with Google's consent
message), a coin economy, collectible cats with perks, a Shop, daily tasks, a
Rewards Box, Bell Quest (a streak event), reminders, a first-time tutorial
system, saves, and a GitHub Actions pipeline that builds a Play-ready bundle.

The game is one folder, `www/games/<id>/`. A tiny placeholder, Coin Catch
(`www/games/template/`), is installed so it all runs from day one.

- **Setting up your app** (accounts, keys, Play): `SETUP.md`
- **Writing your game** (and instructions for Claude): `CLAUDE.md`, then
  `docs/GAME-MODULE.md`
- **Releasing**: `RELEASING.md`

```bash
node serve.js 8080       # then open http://localhost:8080/?dev=1
node test/preflight.js   # checks before every push
node test/run.js         # rule tests
```

Shell updates: `git pull upstream main` (see `SETUP.md`). `SHELL-VERSION` says
which release you have.
