#!/usr/bin/env node
/**
 * The string tables, tested without a browser: every language has every key,
 * with the same {placeholders}, and English reads as it always did.
 * Run: node test/i18n.js
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tr, trOr, num, useLocale, languages, locale, LANGUAGE_NAMES } from '../www/shell/i18n.js';
import APP from '../www/app.config.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../www/shell/strings');
let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

const tables = {};
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
  tables[f.replace('.js', '')] = (await import(join(DIR, f))).default;
}
const en = tables.en;
const holes = (v) => [...String(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const forms = (v) => (typeof v === 'object' ? Object.values(v) : [v]);

ok('English is the source and has keys', Object.keys(en).length > 150);
for (const [lang, table] of Object.entries(tables)) {
  ok(`${lang} has a name for the picker`, !!LANGUAGE_NAMES[lang]);
  for (const key of Object.keys(en)) {
    if (table[key] === undefined) { fails.push(`${lang} is missing "${key}"`); continue; }
    pass++;
    if (typeof en[key] === 'object') ok(`${lang} "${key}" has one and other`, typeof table[key] === 'object' && table[key].other && table[key].one);
    for (const v of forms(table[key])) {
      ok(`${lang} "${key}" keeps its placeholders`, holes(v) === holes(forms(en[key])[0]));
      ok(`${lang} "${key}" is not empty`, String(v).trim().length > 0);
    }
  }
  for (const key of Object.keys(table)) ok(`${lang} "${key}" exists in English`, en[key] !== undefined);
}

/* ---- English reads as it did before the tables ---- */
const offered = APP.languages || ['en'];
ok('the app offers what its config lists, English only without `languages`', languages().join() === offered.filter((l) => tables[l]).join());
ok('the language in use is one the app offers', languages().includes(locale()));
useLocale('en');
ok('plain text', tr('settings.erase') === 'Erase all progress');
ok('placeholders fill', tr('quest.stepOf', { step: 3, steps: 7 }) === 'Step 3 of 7');
ok('plural: one', tr('quest.sharedWith', { n: 1 }) === 'Shared with 1 other cat');
ok('plural: other', tr('quest.sharedWith', { n: 4 }) === 'Shared with 4 other cats');
ok('numbers group the English way', num(12500) === '12,500');
ok('an unknown key returns itself', tr('no.such.key') === 'no.such.key');
ok('trOr falls back for an app\'s own words', trOr('pack.name.my_pack', 'Starter') === 'Starter');
ok('trOr uses the table when it has the key', trOr('pack.tag.Best value', 'Best value') === 'Best value');
ok('the web wording is off outside the web build', tr('quest.tap') === 'Tap to continue');
ok('an unfilled placeholder is left alone', tr('settings.note.noAds') === 'No ads. {buy} Progress saved on this phone.');

/* ---- another language ---- */
useLocale('de');
ok('German table is used', tr('settings.erase') === 'Gesamten Fortschritt löschen');
ok('German numbers', num(12500) === '12.500');
useLocale('fr');
ok('French plural: one', tr('quest.sharedWith', { n: 1 }) === 'Partagé avec 1 autre chat');
useLocale('en');

console.log(`i18n tests: ${pass}/${pass + fails.length} passed`);
if (fails.length) { fails.slice(0, 30).forEach((f) => console.log(`  ✗ ${f}`)); process.exit(1); }
