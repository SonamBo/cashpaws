import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const errs = [];

// Sizes chosen to straddle every layout threshold.
const CASES = [
  ['5 cols, roomy',   393, 851, 5],
  ['5 cols, short',   360, 700, 5],
  ['8 cols, roomy',   412, 900, 8],
  ['8 cols, short',   360, 700, 8],
  ['8 cols, tiny',    320, 560, 8],
  ['6 cols, boundary',384, 820, 6],
];

console.log('case                cells seen           stable');
for (const [name, w, h, cols] of CASES) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => errs.push(`${name}: ${e.message}`));
  await p.goto('http://localhost:8080/?dev=1', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500);
  await p.click('[data-play]');
  await p.waitForTimeout(400);
  await p.evaluate((n) => {
    game.level = n <= 5 ? 1 : n === 6 ? 3 : 7;
    game.netWorth = game.floor + 100;
    game.columns = Array.from({ length: n }, (_, i) => [1, 5, 10, 20].slice(0, (i % 4) + 1));
    view.update();
  }, cols);
  await p.waitForTimeout(350);

  const seen = new Set();
  const cell = () => p.evaluate(() =>
    getComputedStyle(document.querySelector('.board')).getPropertyValue('--cell-h').trim());
  seen.add(await cell());

  // real taps, the way a player produces them
  for (let i = 0; i < 10; i++) {
    const m = await p.evaluate(() => { const x = game.legalMoves(); return x.length ? x[0] : null; });
    if (!m) break;
    await p.click(`.tube[data-col="${m[0]}"]`).catch(() => {});
    await p.waitForTimeout(90);
    await p.click(`.tube[data-col="${m[1]}"]`).catch(() => {});
    await p.waitForTimeout(420);
    seen.add(await cell());
  }
  const list = [...seen].join(', ');
  console.log(`${name.padEnd(19)} ${list.padEnd(20)} ${seen.size === 1 ? 'yes' : 'NO — resizes'}`);
  await p.close();
}
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await b.close();
