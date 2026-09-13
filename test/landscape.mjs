import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b = await chromium.launch();
// Android 16 ignores portrait locks on screens 600dp and wider, so a tablet
// or unfolded foldable will run the game in landscape whether we like it or not.
for (const [name, w, h] of [['phone landscape', 780, 380], ['tablet landscape', 1000, 640]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  await p.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(450);
  await p.click('[data-play]').catch(() => {});
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    game.level = 7; game.netWorth = game.floor + 200;
    game.columns = Array.from({ length: 8 }, (_, i) => [1,5,10,20].slice(0, (i % 4) + 1));
    view.update();
  });
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const app = document.getElementById('app').getBoundingClientRect();
    const foot = document.querySelector('.foot').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.row')];
    const chip = document.querySelector('.chip');
    return {
      appW: Math.round(app.width), appH: Math.round(app.height),
      chip: chip ? Math.round(chip.getBoundingClientRect().width) : 0,
      footCut: foot.bottom > app.bottom + 1,
      tubesOverFoot: rows.some(r => r.getBoundingClientRect().bottom > foot.top + 1),
      rowClipX: rows.some(r => { const b = r.getBoundingClientRect(); return b.left < app.left - 1 || b.right > app.right + 1; }),
    };
  });
  console.log(`${name.padEnd(18)} ${m.appW}x${m.appH}  chip ${m.chip}px  ` +
    `footerCut=${m.footCut} tubesOverButtons=${m.tubesOverFoot} clippedX=${m.rowClipX}`);
  await p.screenshot({ path: `/home/claude/shots/land-${w}.png` });
  await p.close();
}
await b.close();
