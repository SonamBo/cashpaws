import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
const errs = [];

// Real device widths in CSS px, with a plausible status + gesture bar removed.
const SAFE_TOP = 34, SAFE_BOTTOM = 20;   // status bar + gesture bar, in dp

const DEVICES = [
  ['iPhone SE / very small', 320, 568, 44],
  ['Android 5" legacy',      360, 640, 48],
  ['Galaxy A / budget',      360, 780, 72],
  ['Pixel 4a',               393, 851, 72],
  ['Pixel 8',                412, 915, 80],
  ['Galaxy S24 Ultra',       384, 854, 76],
  ['iPhone 15 Pro Max',      430, 932, 90],
  ['Foldable inner',         480, 1000, 80],
];

console.log('device                    viewport   chip   issues');
for (const [name, w, h, inset] of DEVICES) {
  const p = await b.newPage({ viewport: { width: w, height: h - inset }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push(`${name}: ${e.message}`));
  await p.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(300);
  await p.evaluate(([t, b]) => {
    document.documentElement.style.setProperty('--safe-top', t + 'px');
    document.documentElement.style.setProperty('--safe-bottom', b + 'px');
  }, [SAFE_TOP, SAFE_BOTTOM]);
  await p.waitForTimeout(350);

  const lobby = await p.evaluate(() => {
    const app = document.getElementById('app').getBoundingClientRect();
    const nav = document.querySelector('.nav').getBoundingClientRect();
    const play = document.querySelector('.play').getBoundingClientRect();
    const coins = document.querySelector('.lobby-top .coins').getBoundingClientRect();
    return { navCut: nav.bottom > app.bottom + 1, playCut: play.bottom > nav.top + 1,
             underStatus: coins.top < 34,
             overflowX: document.documentElement.scrollWidth > app.width + 1 };
  });

  await p.click('[data-play]');
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    game.level = 7; game.netWorth = game.floor + 300;
    game.columns = Array.from({ length: 8 }, (_, i) => [1, 5, 10, 20].slice(0, (i % 4) + 1));
    view.update();
  });
  await p.waitForTimeout(400);

  const board = await p.evaluate(() => {
    const app = document.getElementById('app').getBoundingClientRect();
    const foot = document.querySelector('.foot').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.row')];
    const chip = document.querySelector('.chip');
    const hdr = document.querySelector('.hdr').getBoundingClientRect();
    const firstRow = rows[0].getBoundingClientRect();
    return {
      footCut: foot.bottom > app.bottom + 1,
      rowClipX: rows.some(r => { const b = r.getBoundingClientRect(); return b.left < app.left - 1 || b.right > app.right + 1; }),
      rowUnderHeader: firstRow.top < hdr.bottom - 1,
      tubeOverFoot: rows.some(r => r.getBoundingClientRect().bottom > foot.top + 1),
      chip: chip ? Math.round(chip.getBoundingClientRect().width) : 0,
      tapTarget: Math.round(document.querySelector('.act').getBoundingClientRect().height),
      underStatus: document.querySelector('.hdr .coins').getBoundingClientRect().top < 34,
      catOverTubes: (() => {
        const cat = document.querySelector('.corner-cat');
        if (!cat || getComputedStyle(cat).display === 'none') return false;
        const c = cat.getBoundingClientRect();
        return [...document.querySelectorAll('.tube')].some(t => {
          const b = t.getBoundingClientRect();
          return c.left < b.right && c.right > b.left && c.top < b.bottom && c.bottom > b.top;
        });
      })(),
      catOverButtons: (() => {
        const cat = document.querySelector('.corner-cat');
        if (!cat || getComputedStyle(cat).display === 'none') return false;
        const c = cat.getBoundingClientRect();
        return [...document.querySelectorAll('.act')].some(a => {
          const b = a.getBoundingClientRect();
          return c.left < b.right && c.right > b.left && c.top < b.bottom && c.bottom > b.top;
        });
      })(),
      overGesture: document.querySelector('.foot').getBoundingClientRect().bottom
                   > document.getElementById('app').getBoundingClientRect().bottom - 20,
    };
  });

  const issues = [];
  if (lobby.navCut) issues.push('lobby nav cut');
  if (lobby.underStatus) issues.push('lobby under status bar');
  if (lobby.playCut) issues.push('play button under nav');
  if (lobby.overflowX || board.rowClipX) issues.push('horizontal overflow');
  if (board.footCut) issues.push('footer cut');
  if (board.rowUnderHeader) issues.push('tubes under header');
  if (board.tubeOverFoot) issues.push('tubes over buttons');
  if (board.chip < 22) issues.push(`chips tiny (${board.chip}px)`);
  if (board.tapTarget < 44) issues.push(`tap target ${board.tapTarget}px`);
  if (board.underStatus) issues.push('board under status bar');
  if (board.overGesture) issues.push('buttons under gesture bar');
  if (board.catOverTubes) issues.push('cat over tubes');
  if (board.catOverButtons) issues.push('cat over buttons');

  console.log(`${name.padEnd(24)} ${String(w).padStart(3)}x${String(h - inset).padEnd(4)}  ${String(board.chip).padStart(2)}px   ${issues.length ? issues.join(', ') : 'none'}`);
  if (w === 320 || w === 430) await p.locator('#app').screenshot({ path: `/home/claude/shots/audit-${w}.png` });
  await p.close();
}
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await b.close();
