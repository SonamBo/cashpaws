#!/usr/bin/env node
/**
 * Tomorrow's gift and the first-days ad rules (1.17.0), tested without a
 * browser. Run: node test/gift.js
 */
import * as G from '../www/shell/gift.js';
import { createAds, inAdFreeDays, INTERSTITIAL_GAP_MS } from '../www/shell/ads.js';
import { freshShell } from '../www/shell/save.js';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));
const H = 3600000;
const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).getTime();   // October 2026, local time

/* ---- offering ---- */
let g = G.emptyGift();
ok('not before the first level is beaten', !G.shouldOffer(g, 1));
ok('offered on reaching level 2', G.shouldOffer(g, 2));
ok('a later level can be set (Remote Config)', !G.shouldOffer(G.emptyGift(), 3, 3) && G.shouldOffer(G.emptyGift(), 4, 3));
ok('offer goes through', G.offer(g, { now: at(20, 18, 30), value: 225 }));
ok('worth two Sorts, rounded to 50', g.coins === 450);
ok('only once', !G.shouldOffer(g, 9) && !G.offer(g, { now: at(20, 19), value: 225 }));
ok('fresh saves carry an empty gift', freshShell().gift.status === 'none');
ok('no value: falls back sensibly', G.giftCoins(undefined) === 300 && G.giftCoins(10) === 50);

/* ---- opening ---- */
ok('not ready the same evening', !G.isReady(g, at(20, 23, 59)));
ok('cannot be claimed the same day', G.claim(g, at(20, 22)) === 0 && g.status === 'waiting');
ok('ready just after midnight', G.isReady(g, at(21, 0, 1)));
ok('days since offer: next day is 1', G.daysSinceOffer(g, at(21, 10)) === 1);
ok('days since offer: across a month end', G.daysSinceOffer({ day: '2026-10-31' }, at(33, 10)) === 2);
ok('claim pays the coins', G.claim(g, at(21, 10)) === 450 && g.status === 'claimed');
ok('claimed: nothing more', G.claim(g, at(22, 10)) === 0 && !G.isReady(g, at(23, 10)));

/* ---- reminders ---- */
g = G.emptyGift();
G.offer(g, { now: at(20, 18, 30), value: 225 });
let r = G.giftReminder(g, at(20, 19));
ok('reminder: next day, an hour before they played', r.at === at(21, 17, 30));
ok('reminder: says it is ready, names the coins', /ready/.test(r.title) && /450/.test(r.body));
r = G.giftReminder(g, at(21, 20));
ok('first passed, unopened: a nudge two days on', r.at === at(23, 17, 30) && /still waiting/.test(r.title));
ok('within 4 hours of now: pushed on', G.reminderAt(g, at(21, 15)) === at(23, 17, 30));

g = G.emptyGift();
G.offer(g, { now: at(20, 1, 15), value: 225 });
ok('played at 1 am: reminder not before 9 am', G.reminderAt(g, at(20, 1, 20)) === at(21, 9));
g = G.emptyGift();
G.offer(g, { now: at(20, 23, 40), value: 225 });
ok('played late: reminder by 9 pm', G.reminderAt(g, at(20, 23, 45)) === at(21, 21));
ok('claimed: no reminder', (() => { G.claim(g, at(21, 9)); return G.giftReminder(g, at(21, 9)) === null; })());
ok('never offered: no reminder', G.giftReminder(G.emptyGift(), at(20, 9)) === null);

/* ---- first two days without ad breaks ---- */
ok('install day: ad-free', inAdFreeDays('2026-10-20', '2026-10-20'));
ok('next day: ad-free', inAdFreeDays('2026-10-20', '2026-10-21'));
ok('third day: ads allowed', !inAdFreeDays('2026-10-20', '2026-10-22'));
ok('across a month end', inAdFreeDays('2026-10-31', '2026-11-01') && !inAdFreeDays('2026-10-31', '2026-11-02'));
ok('unknown first day: no exemption', !inAdFreeDays(null, '2026-10-20'));

/* ---- the gap between ad breaks ---- */
globalThis.CashPawsAds = {
  isEnabled: () => true, rewardedReady: () => true, interstitialReady: () => true,
  showRewarded: (p, id) => globalThis.__adResult(id, true),
  showInterstitial: (p, id) => globalThis.__adResult(id, true),
};
let now = at(25, 10);
const ads = createAds({ dev: false, confirm: async () => true, clock: () => now });
const old = { firstDay: '2026-10-01', today: '2026-10-25' };
ok('not in a session\'s first 3 minutes', !ads.interstitialDue(12, old));
now += INTERSTITIAL_GAP_MS;
ok('due 3 minutes in, past level 10', ads.interstitialDue(12, old));
ok('not before level 11', !ads.interstitialDue(10, old));
ok('not on a new player\'s second day', !ads.interstitialDue(12, { firstDay: '2026-10-24', today: '2026-10-25' }));
await ads.showInterstitial('ad-break', { level: 12 });
now += 90000;
ok('not 90 s after the last one', !ads.interstitialDue(13, old));
now += 90000;
ok('due again 3 minutes after it', ads.interstitialDue(13, old));
await ads.rewarded.show('rescue-sort');
now += 30000;
ok('not right after a rewarded ad', !ads.interstitialDue(14, old));

console.log(`Gift and ad-rule tests: ${pass}/${pass + fails.length} passed`);
if (fails.length) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
