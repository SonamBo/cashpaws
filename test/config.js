#!/usr/bin/env node
/**
 * Remote Config (1.19.0), tested without a browser: values from Firebase are
 * strings typed into a console, so every bad one must fall back to the default.
 * Run: node test/config.js
 */
import { createConfig, parseValue, checkSpecs, SHELL_KEYS } from '../www/shell/config.js';
import { createAds } from '../www/shell/ads.js';
import { giftCoins, shouldOffer, emptyGift } from '../www/shell/gift.js';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

/* ---- the shell's own keys are well formed ---- */
ok('shell keys: valid names, defaults inside their limits', checkSpecs(SHELL_KEYS).length === 0);

/* ---- parsing ---- */
const int = { default: 11, type: 'int', min: 2, max: 200 };
ok('int: a plain number', parseValue(int, '14').value === 14);
ok('int: rounded', parseValue(int, '13.6').value === 14);
ok('int: clamped low', parseValue(int, '-5').value === 2);
ok('int: clamped high', parseValue(int, '9999').value === 200);
ok('int: junk is rejected', !parseValue(int, 'eleven').ok && parseValue(int, 'eleven').value === 11);
ok('int: empty is rejected', !parseValue(int, '').ok);
const bool = { default: true, type: 'bool' };
ok('bool: false', parseValue(bool, 'false').value === false);
ok('bool: 0 and off', parseValue(bool, '0').value === false && parseValue(bool, 'OFF').value === false);
ok('bool: true', parseValue(bool, 'TRUE').value === true);
ok('bool: junk is rejected', !parseValue(bool, 'maybe').ok);
const num = { default: 0.4, type: 'num', min: 0, max: 0.8 };
ok('num: decimals', parseValue(num, '0.25').value === 0.25);
ok('num: clamped', parseValue(num, '3').value === 0.8);

/* ---- no Firebase: every default ---- */
let c = createConfig();
ok('no bridge: defaults, source default', c.source === 'default' && !c.enabled && c.get('ads_interstitial_from') === 11);
ok('no bridge: nothing changed', Object.keys(c.changed).length === 0);
let threw = false;
try { c.get('nope'); } catch { threw = true; }
ok('unknown key throws (a typo in code is caught by the tests)', threw);

/* ---- values from Firebase ---- */
c = createConfig({
  raw: { source: 'remote', waited: 420, values: {
    ads_interstitials: 'false', ads_free_days: '5', gift_value_share: '3',
    ads_interstitial_gap_s: 'soon', unknown_key: '1',
  } },
});
ok('remote values apply', c.get('ads_interstitials') === false && c.get('ads_free_days') === 5 && c.get('gift_value_share') === 3);
ok('a bad value falls back and is reported', c.get('ads_interstitial_gap_s') === 180 && c.rejected.includes('ads_interstitial_gap_s'));
ok('keys nobody declared are ignored', !c.has('unknown_key'));
ok('changed lists what differs', c.changed.ads_free_days === 'remote' && !('ads_interstitial_from' in c.changed));
ok('source and wait come through', c.source === 'remote' && c.waited === 420);
c = createConfig({ raw: { values: { ads_free_days: '2' } } });
ok('a remote value equal to the default is not "changed"', !('ads_free_days' in c.changed));

/* ---- a game's own keys ---- */
const gameKeys = {
  free_sort_through: { default: 5, type: 'int', min: 1, max: 50 },
  ads_free_days: { default: 9, type: 'int', min: 0, max: 30 },     // clashes with a shell key
};
c = createConfig({ gameKeys, raw: { values: { free_sort_through: '8' } } });
ok('game keys are read', c.get('free_sort_through') === 8);
ok('a shell key wins a name clash', c.get('ads_free_days') === 2);
ok('checkSpecs catches a bad default', checkSpecs({ x: { default: 99, type: 'int', min: 0, max: 10 } }).length === 1);
ok('checkSpecs catches a bad name', checkSpecs({ '9lives': { default: 1, type: 'int' } }).length === 1);

/* ---- the bridge itself (as Android hands it over) ---- */
globalThis.CashPawsConfig = {
  isEnabled: () => true,
  getAll: () => JSON.stringify({ values: { ads_interstitial_from: '21' }, source: 'cached', fetched: 1, waited: 3 }),
  status: () => JSON.stringify({ last: 'success' }),
};
c = createConfig();
ok('bridge: values read', c.enabled && c.source === 'cached' && c.get('ads_interstitial_from') === 21);
ok('bridge: status', c.status().last === 'success');
globalThis.CashPawsConfig = { isEnabled: () => true, getAll: () => 'not json' };
c = createConfig();
ok('bridge: broken JSON gives defaults', c.get('ads_interstitial_from') === 11);
globalThis.CashPawsConfig = { isEnabled: () => { throw new Error('gone'); } };
ok('bridge: throwing gives defaults', createConfig().get('gift_after_level') === 1);
delete globalThis.CashPawsConfig;

/* ---- the values reach the rules ---- */
globalThis.CashPawsAds = {
  isEnabled: () => true, rewardedReady: () => true, interstitialReady: () => true,
  showRewarded: (p, id) => globalThis.__adResult(id, true),
  showInterstitial: (p, id) => globalThis.__adResult(id, true),
};
let now = 1e12;
const old = { firstDay: '2026-01-01', today: '2026-10-25' };
let ads = createAds({ dev: false, confirm: async () => true, clock: () => now, rules: { interstitials: false } });
now += 3600000;
ok('interstitials switched off: never due', !ads.interstitialDue(40, old));
ads = createAds({ dev: false, confirm: async () => true, clock: () => now, rules: { fromLevel: 21, gapMs: 60000 } });
now += 60000;
ok('from level 21: not at 15', !ads.interstitialDue(15, old));
ok('from level 21: due at 21, 60 s gap', ads.interstitialDue(21, old));
ads = createAds({ dev: false, confirm: async () => true, clock: () => now, rules: { freeDays: 0 } });
now += 3 * 60000;
ok('no ad-free days: a new player can see one', ads.interstitialDue(12, { firstDay: '2026-10-25', today: '2026-10-25' }));
ads = createAds({ dev: false, confirm: async () => true, clock: () => now, rules: { freeDays: 7 } });
now += 3 * 60000;
ok('7 ad-free days: none on day 5', !ads.interstitialDue(12, { firstDay: '2026-10-20', today: '2026-10-25' }));
ok('ads expose the rules in force', ads.rules.freeDays === 7 && ads.rules.gapMs === 180000);

ok('gift: value share applies', giftCoins(225, 3) === 700 && giftCoins(225) === 450);
ok('gift: bad share falls back', giftCoins(225, NaN) === 450);
ok('gift: after level 5', !shouldOffer(emptyGift(), 5, 5) && shouldOffer(emptyGift(), 6, 5));

console.log(`Remote Config tests: ${pass}/${pass + fails.length} passed`);
if (fails.length) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
