# Cash Paws

A money-sorting puzzle. Chips are numbers; four of a kind banks itself into a
career net worth that never resets. Every few turns the flow drops a chip into
every column at once, and it gets nastier each time.

## Run it

```bash
node serve.js          # then open http://localhost:8080
```

ES modules need `http://`, so opening `index.html` directly will not work.
`serve.js` has no dependencies and needs no network.

## Verify it

```bash
node test/sim.js 5000  # rule tests + invariant auditing over full games
node test/pace.js 400  # progression and board-pressure curves
```

## Layout

- `PROGRESS.md` — build status and how to resume. Start here.
- `docs/DESIGN.md` — rules as implemented, and why.
- `docs/DESIGN-SYSTEM.md` — tokens, chip language, layout.
- `www/js/engine.js` — the game. No DOM, no timers, deterministic.
- `www/js/render.js` — state to DOM.
- `www/js/art.js` — placeholder cat and icons.
- `www/js/app.js` — Stage 2 inspection harness (dropped at Stage 4).

Needs Node 18+. No dependencies, no install step.
