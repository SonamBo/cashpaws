/**
 * Horizontal fit, for every board size, on every width a phone can report.
 *
 * Exists because the layout audit only tested eight-column boards, which split
 * into two rows of four and fit easily. The widest single row is level 1's
 * five tubes — the first thing a new player sees — and it overflowed any
 * screen under 375px. Android's Display size setting makes that common.
 *
 * Needs the dev server: node serve.js 8080
 */
import pw from 'playwright';

const b = await pw.chromium.launch();
const LEVEL = { 5: 1, 6: 3, 7: 5, 8: 7 };
const SCREENS = [
  [280, 640], [320, 568], [340, 720], [360, 740], [375, 812], [384, 780],
  [393, 800], [402, 874], [412, 860], [430, 900], [480, 920],
  [780, 380], [1000, 640],                                    // landscape
];
let failed = 0;
const errs = [];
const bad = [];

for (const [w, h] of SCREENS) {
  const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  p.on('pageerror', (e) => errs.push(`${w}x${h}: ${e.message}`));
  await p.goto('http://localhost:8080/css/tokens.css'); await p.evaluate(() => localStorage.clear());
  await p.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(450);
  await p.click('[data-play]'); await p.waitForTimeout(250);
  const row = [];
  for (const cols of [5, 6, 7, 8]) {
    const r = await p.evaluate(({ n, lv }) => {
      game.level = lv; game.netWorth = game.floor;
      // full tubes, including the wider $20 note, are the hardest case
      game.columns = Array.from({ length: n }, () => [20, 10, 5, 1]);
      view.update();
      const app = document.getElementById('app').getBoundingClientRect();
      const tubes = [...document.querySelectorAll('.tube')].map((t) => t.getBoundingClientRect());
      const over = Math.max(0, app.left - Math.min(...tubes.map((t) => t.left)),
                            Math.max(...tubes.map((t) => t.right)) - app.right);
      const overlap = tubes.some((a, i) => tubes.some((c, j) => j > i && a.left < c.right - 1 && c.left < a.right - 1
                                                   && a.top < c.bottom - 1 && c.top < a.bottom - 1));
      const chipOut = [...document.querySelectorAll('.glass')].some((g) => {
        const gb = g.getBoundingClientRect();
        return [...g.querySelectorAll('.chip')].some((c) => {
          const cb = c.getBoundingClientRect();
          return cb.left < gb.left - 1 || cb.right > gb.right + 1;
        });
      });
      const rows = [...document.querySelectorAll('.row')].map((x) => x.children.length).join('+');
      return { over: Math.round(over), overlap, chipOut, rows, tube: Math.round(tubes[0].width) };
    }, { n: cols, lv: LEVEL[cols] });
    const problems = [];
    if (r.over > 0) problems.push(`overflows ${r.over}px`);
    if (r.overlap) problems.push('tubes overlap');
    if (r.chipOut) problems.push('chip outside glass');
    if (problems.length) { failed++; bad.push(`${w}x${h} ${cols} tubes: ${problems.join(', ')}`); }
    row.push(`${cols}:${r.rows}@${r.tube}`);
  }
  console.log(`${`${w}x${h}`.padEnd(10)} ${row.join('   ')}`);
  await p.close();
}
console.log(bad.length ? 'FAIL\n  ' + bad.join('\n  ') : 'PASS  every board fits every screen, chips inside the glass');
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);
