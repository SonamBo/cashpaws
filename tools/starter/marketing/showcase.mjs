/**
 * The trailer, played by tools/marketing/record-preview.mjs while it records.
 * This one plays Coin Catch, the template game: replace it with your game's.
 *
 * setup({ page }) puts the game in a good-looking state first (dev mode is on,
 * so the game's debugging handles are available). play(api) then plays until
 * api.timeLeft() runs out. api.tap(selector) clicks without moving a pointer;
 * api.idle() waits for animations; api.key('Enter') presses a key.
 *
 * What makes a good trailer: start mid-action (no menus), show the core loop
 * paying off within 3 seconds, one big moment around two-thirds in (a
 * level-up, a combo), and keep moving to the last frame.
 */

export async function setup({ page }) {
  // Nothing to arrange for Coin Catch.
}

export async function play({ page, tap, key, wait, timeLeft }) {
  await wait(600);
  while (timeLeft() > 0) {
    if (await page.locator('.overlays .ovl').count()) {   // a celebration card: let it be seen, then continue
      await wait(1800);
      await key('Enter');
      await wait(400);
      continue;
    }
    await tap('.cc-cell.on');
    await wait(420);
  }
}
