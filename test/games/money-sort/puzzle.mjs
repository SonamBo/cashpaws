#!/usr/bin/env node
/**
 * Puzzle of the Day in the browser (1.20.0): the lobby button, running out of
 * moves, Undo and Restart, solving it, the reward and streak, the solved day,
 * the share clip, the save, and the main board left as it was.
 * Needs the dev server: node serve.js 8080, then node test/games/money-sort/puzzle.mjs
 */
import { chromium } from 'playwright';
import { applyMove, canMove, puzzleFor, localDateKey } from '../../../www/games/money-sort/puzzle.js';
import data from '../../../www/games/money-sort/puzzles.js';

const URL = 'http://localhost:8080/?dev=1&lobby=1';
let pass = 0;
const fails = [];
const check = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); cond ? pass++ : fails.push(name); };

const P = puzzleFor(localDateKey(), data);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await p.goto('http://localhost:8080/css/tokens.css');
await p.evaluate(() => localStorage.clear());
await p.goto(URL);
await p.waitForTimeout(1200);
await p.evaluate(() => { shell.gift.status = 'claimed'; });

const btn = '[data-extra="daily-puzzle"]';
const pill = () => p.evaluate((s) => document.querySelector(`${s} .quest-pill`)?.textContent, btn);
const coins = () => p.evaluate(() => Number(document.querySelector('[data-coins]').textContent));
const left = () => p.evaluate(() => Number(document.querySelector('.potd [data-left]')?.textContent));
const tube = (i) => p.locator('.potd .tube').nth(i);
const idle = () => p.waitForFunction(() => !document.body.classList.contains('busy'));
async function play(f, t) { await idle(); await tube(f).click(); await tube(t).click(); await p.waitForTimeout(60); await idle(); }

check('the lobby shows the puzzle button', await p.locator(btn).isVisible());
check('waving for attention before today\'s solve', (await pill()) === 'Puzzle' && await p.evaluate((s) => document.querySelector(s).classList.contains('news'), btn));

const mainBefore = await p.evaluate(() => JSON.stringify(game.columns));
const coins0 = await coins();
await p.click(btn);
await p.waitForTimeout(800);
check('it opens on the game screen', await p.evaluate(() => document.getElementById('app').classList.contains('on-game')));
check('with today\'s number, day and moves', (await p.textContent('.potd [data-title]')) === `#${P.number} · ${P.day}` && (await left()) === P.par);
check('the header says Puzzle of the Day', (await p.textContent('[data-header]')).includes('Puzzle of the Day'));
check('the board is today\'s', await p.locator('.potd .tube').count() === P.board.length);

// A wrong line: legal moves that don't solve it, until the moves run out.
let cols = P.board.map((c) => [...c]);
for (let k = 0; k < P.par; k++) {
  let m = null;
  for (let f = 0; f < cols.length && !m; f++) for (let t = 0; t < cols.length && !m; t++) if (canMove(cols, f, t) && !cols[t].length) m = [f, t];
  for (let f = 0; f < cols.length && !m; f++) for (let t = 0; t < cols.length && !m; t++) if (canMove(cols, f, t)) m = [f, t];
  if (k === 1) {
    await play(...m);
    check('a move counts down', (await left()) === P.par - 2);
    await p.click('.potd [data-undo]');
    await p.waitForTimeout(150);
    check('Undo gives the move back, free', (await left()) === P.par - 1 && (await coins()) === coins0);
  }
  await play(...m);
  cols = applyMove(cols, ...m).cols;
}
await p.waitForSelector('.ovl [data-again]', { timeout: 5000 }).catch(() => {});
check('out of moves, a card offers another go', await p.locator('.ovl [data-again]').isVisible());
await p.click('.ovl [data-again]');
await p.waitForTimeout(500);
check('trying again resets the board and the moves', (await left()) === P.par);

// The right line.
for (const [f, t] of P.solution) await play(f, t);
await p.waitForSelector('.ovl [data-go]', { timeout: 8000 });
check('solving it opens the celebration', await p.locator('.cel-headline').textContent() === 'SOLVED!');
await p.waitForTimeout(1500);
await p.click('.ovl [data-go]');
await p.waitForTimeout(500);
check(`it pays ${P.coins} coins`, (await coins()) === coins0 + P.coins);
check('then offers to share the solve', await p.locator('.ovl [data-share]').isVisible());

const dl = p.waitForEvent('download', { timeout: 60000 });
await p.click('.ovl [data-share]');
const file = await dl;
check('the clip is made and shared (a download in a browser)', /^cash-paws-puzzle-\d+\.(mp4|webm|png)$/.test(file.suggestedFilename()));
await p.waitForTimeout(500);
await p.click('.ovl [data-done]');
await p.waitForTimeout(800);
check('Done goes back to the lobby', await p.evaluate(() => document.getElementById('app').classList.contains('on-lobby')));
check('the button now says Solved, and stops waving', (await pill()) === 'Solved' && !(await p.evaluate((s) => document.querySelector(s).classList.contains('news'), btn)));
check('the main board is as it was', (await p.evaluate(() => JSON.stringify(game.columns))) === mainBefore);

// Saved: after a reload the day stays solved and pays nothing again.
await p.waitForTimeout(400);
await p.reload();
await p.waitForTimeout(1200);
check('a reload remembers today is solved', (await pill()) === 'Solved');
const coins1 = await coins();
await p.click(btn);
await p.waitForSelector('.ovl [data-again]', { timeout: 4000 }).catch(() => {});
check('opening a solved day says so', (await p.locator('.ovl .ovl-h').first().textContent()) === 'Solved today');
await p.click('.ovl [data-again]');
await p.waitForTimeout(500);
for (const [f, t] of P.solution) await play(f, t);
await p.waitForSelector('.ovl [data-done]', { timeout: 8000 }).catch(() => {});
check('playing it again pays nothing', (await coins()) === coins1);
await p.click('.ovl [data-done]');
await p.waitForTimeout(700);

// Back on the main game, nothing of the puzzle shows.
await p.click('[data-play]');
await p.waitForTimeout(700);
check('Play shows the main board, not the puzzle', await p.evaluate(() => !document.querySelector('.ms-root').classList.contains('potd-on')
  && getComputedStyle(document.querySelector('.ms-root > .board')).visibility === 'visible'));
check('and the header is the level again', /Level/.test(await p.textContent('[data-header]')));

check('no page errors', errs.length === 0);
if (errs.length) console.log(errs);
await b.close();
console.log(`\npuzzle: ${pass}/${pass + fails.length} passed`);
if (fails.length) { console.log('failed:', fails); process.exit(1); }
console.log('all passed');
