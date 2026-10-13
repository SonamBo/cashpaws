/**
 * Upgrading from 1.0.x must keep everything a player had.
 *
 * fixtures/v1-save.json is a real save, written by the 1.0.2 build after
 * playing a board, reaching level 3 with 1,234 coins, buying Mittens and the
 * Paper set. Coins lived inside the game back then; this checks they, and
 * everything else, arrive intact in the 1.1 shell.
 *
 * Needs the dev server: node serve.js 8080
 */
import pw from 'playwright';
import { readFileSync } from 'node:fs';

const v1 = readFileSync(new URL('./fixtures/v1-save.json', import.meta.url), 'utf8');
const old = JSON.parse(v1);
const oldGame = JSON.parse(old.game).state;

const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 1160, height: 1060 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));

// Write the old save from a page that runs no app code, as a real upgrade would find it.
await p.goto('http://localhost:8080/css/tokens.css');
await p.evaluate((raw) => { localStorage.clear(); localStorage.setItem('cashpaws.save.v1', raw); }, v1);
await p.goto('http://localhost:8080/?dev=1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(900);

const got = await p.evaluate(() => ({
  cols: JSON.stringify(game.columns), level: game.level, net: game.netWorth, coins: wallet.coins,
  cats: shell.cats, cosmetic: shell.cosmetics['money-sort'], gameStats: shell.gameStats['money-sort'],
  v2: !!localStorage.getItem('cashpaws.save.v2'), v1: !!localStorage.getItem('cashpaws.save.v1'),
}));

let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
};
check('board is identical', got.cols === JSON.stringify(oldGame.columns));
check('level kept', got.level === oldGame.level, `${oldGame.level} -> ${got.level}`);
// 1.6 shortened levels, so net worth is rescaled to keep the same progress
// through the level; the raw figure would level the player up several times.
const oldFrac = (oldGame.netWorth - 100 * oldGame.level * (oldGame.level - 1)) / (200 * oldGame.level);
const lo = await p.evaluate(() => game.floor), hi = await p.evaluate(() => game.nextFloor);
const newFrac = (got.net - lo) / (hi - lo);
check('progress through the level kept', Math.abs(newFrac - oldFrac) < 0.01,
  `${(oldFrac * 100).toFixed(0)}% of level ${oldGame.level} -> ${(newFrac * 100).toFixed(0)}%`);
check('coins moved into the shell wallet', got.coins === oldGame.coins, `${oldGame.coins} -> ${got.coins}`);
check('owned and worn cat kept', got.cats.owned.includes('mittens') && got.cats.worn === 'mittens');
check('chip set kept', got.cosmetic?.active === 'notes');
check('game stats carried over', got.gameStats?.banks === old.stats.banks);
check('new save written, old one kept as a safety net', got.v2 && got.v1);

await p.click('[data-play]');
await p.waitForTimeout(600);
check('paper chips drawn', /chipb-/.test(await p.evaluate(() => document.querySelector('.chip')?.getAttribute('src') || '')));
check("Mittens' perk active", (await p.locator('[data-undo-cost]').textContent()) === '10');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);
