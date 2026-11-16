/**
 * The shell's words, in the player's language.
 *
 * Every piece of text the shell shows comes from a table in strings/<lang>.js,
 * looked up with tr('key', { vars }). English (strings/en.js) is the source:
 * a key missing from another table falls back to it.
 *
 * Which languages an app offers is its own choice: `languages` in
 * www/app.config.js, e.g. ["en", "es", "pt", "hi", "de", "fr"]. The first is
 * the default. Without that field the app is English only and nothing about
 * languages appears in Settings.
 *
 * The language is picked once, when the page loads: the player's saved choice,
 * else the phone's language if the app offers it, else the default. It is put
 * on <html lang> before the game's module runs, so a game reads it there (or
 * from host.locale()) to choose its own words. Changing it in Settings saves
 * the choice and reloads the page, so nothing has to redraw itself.
 *
 * A value is a string with {placeholders}, or { one, other } (and any other
 * plural category the language has) chosen by the `n` variable.
 */

import APP from '../app.config.js';
import en from './strings/en.js';
import es from './strings/es.js';
import pt from './strings/pt.js';
import hi from './strings/hi.js';
import de from './strings/de.js';
import fr from './strings/fr.js';

const TABLES = { en, es, pt, hi, de, fr };

/** Each language in its own words, for the picker. */
export const LANGUAGE_NAMES = { en: 'English', es: 'Español', pt: 'Português', hi: 'हिन्दी', de: 'Deutsch', fr: 'Français' };

/** How numbers are grouped: 1,200 or 1.200. Hindi keeps Western digits. */
const NUMBER_LOCALE = { en: 'en-US', es: 'es-ES', pt: 'pt-BR', hi: 'en-IN', de: 'de-DE', fr: 'fr-FR' };

// The web build swaps this line for its own wording (platforms/crazygames/overrides.json).
const PLATFORM = { variant: '', keys: '' };

const KEY = 'cashpaws.lang';

/** The languages this app offers, default first. */
export function languages() {
  const list = (APP.languages || ['en']).filter((l) => TABLES[l]);
  return list.length ? list : ['en'];
}

function pick() {
  const offered = languages();
  let saved = null;
  try { saved = globalThis.localStorage?.getItem(KEY); } catch { /* private mode */ }
  if (offered.includes(saved)) return saved;
  const phone = String(globalThis.navigator?.language || '').toLowerCase().split('-')[0];
  return offered.includes(phone) ? phone : offered[0];
}

let lang = pick();
if (globalThis.document?.documentElement) globalThis.document.documentElement.lang = lang;

export const locale = () => lang;

/** Save the choice. The caller reloads the page; until then the old words stay. */
export function setLocale(next) {
  if (!languages().includes(next)) return false;
  try { globalThis.localStorage?.setItem(KEY, next); } catch { /* private mode */ }
  return true;
}

/** Tests only: switch tables without a page. */
export function useLocale(next) { if (TABLES[next]) lang = next; }

function lookup(key) {
  const mine = TABLES[lang], base = TABLES.en;
  if (PLATFORM.variant) {
    const v = key + PLATFORM.variant;
    if (mine[v] !== undefined) return mine[v];
    if (base[v] !== undefined) return base[v];
  }
  if (mine[key] !== undefined) return mine[key];
  return base[key];
}

const rules = {};
function plural(forms, n) {
  let cat = 'other';
  try { cat = (rules[lang] ||= new Intl.PluralRules(lang)).select(Number(n)); } catch { /* keep other */ }
  return forms[cat] ?? forms.other;
}

/** The text for `key`, with {placeholders} filled from `vars`. An unknown key returns itself. */
export function tr(key, vars = {}) {
  let s = lookup(key);
  if (s === undefined) return key;
  if (typeof s === 'object') s = plural(s, vars.n);
  return s.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : name === 'keys' ? PLATFORM.keys : m)).trim();
}

/** The text for `key` if a table has it, else `fallback`: for words an app supplies itself (a coin pack's name). */
export function trOr(key, fallback, vars) {
  return lookup(key) === undefined ? fallback : tr(key, vars);
}

/** A number the way this language writes it: 1,200 or 1.200. */
export const num = (n) => Number(n).toLocaleString(NUMBER_LOCALE[lang] || 'en-US');
