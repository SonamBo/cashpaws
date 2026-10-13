/**
 * The Cash Paws trailer, played by tools/marketing/record-preview.mjs.
 *
 * A level-6 board laid out so six moves bank $80, $20, $40, $4 and then $200,
 * which beats the level about 10 seconds in: the progress bar fills, the cat
 * cheers on the level-up card. Then free play on the next level (a Hard level,
 * 8 tubes) with good moves at human pace until the end.
 */

export async function setup({ page }) {
  await page.evaluate(() => {
    game.level = 6;
    game.netWorth = game.nextFloor - Math.min(300, game.nextFloor - game.floor - 10);
    game.columns = [[20, 20, 20], [5, 5, 5, 20], [10, 10, 10, 1], [1, 1, 1, 10], [50, 50, 50, 5], [50]];
    game.locked = null; game.ice = [];
    game.turnsUntilDrop = 8; game.status = 'playing'; game.selected = null; game.undoSnapshot = null;
    view.update();
  });
}

// A good move: complete a bank, else build on a matching run, else make room.
const BEST_MOVE = `(() => {
  const g = game, cap = g.cfg.capacity;
  const moves = g.legalMoves(); if (!moves.length) return null;
  const score = ([f, t]) => {
    const s = g.columns[f], d = g.columns[t], c = s[s.length - 1];
    let run = 0; for (let i = s.length - 1; i >= 0 && s[i] === c; i--) run++;
    if (d.length && d.every((v) => v === c) && d.length + run >= cap) return 1000 + d.length;
    if (d.length && d.every((v) => v === c)) return 500 + d.length * 10;
    if (run === s.length && d.length && d[d.length - 1] === c) return 400;
    if (d.length && d[d.length - 1] === c) return 300;
    if (!d.length) return run === s.length ? -100 : 50;
    return 10;
  };
  return moves.reduce((a, m) => (score(m) > score(a) ? m : a), moves[0]);
})()`;

export async function play({ page, tap, key, idle, wait, timeLeft }) {
  const tube = (i) => `.tube[data-col="${i}"]`;
  await wait(900);
  for (const [f, t] of [[1, 0], [4, 1], [2, 0], [3, 2], [0, 3], [5, 4]]) {
    await idle();
    await tap(tube(f)); await wait(450);
    await tap(tube(t)); await wait(1050);
  }
  let cardSince = 0;
  while (timeLeft() > 0) {
    if (await page.locator('.overlays .ovl').count()) {
      if (!cardSince) cardSince = Date.now();
      if (Date.now() - cardSince > 2800) { await key('Enter'); cardSince = 0; await wait(500); }
      await wait(150);
      continue;
    }
    await idle();
    const m = await page.evaluate(BEST_MOVE);
    if (!m) { await wait(200); continue; }
    await tap(tube(m[0])); await wait(300);
    await tap(tube(m[1])); await wait(700);
  }
}
