/**
 * Remote Config (1.19.0): tuning values that can change without an app update,
 * and the A/B tests that compare them. The native bridge
 * (window.CashPawsConfig, Firebase Remote Config) only hands over strings;
 * every default, type and limit lives here, so a typo in the Firebase console
 * can never break the game. A bad value is ignored and the default is used.
 *
 * Two sets of keys:
 *  - the shell's own (SHELL_KEYS below): ad rules, tomorrow's gift;
 *  - the installed game's, declared in its manifest as `remote` and read with
 *    host.remote(key). Same format.
 *
 * Values are read once, at boot, and stay put for the session. A value
 * changed in the console reaches a player on their next launch (a brand-new
 * install waits briefly for it on its first). See docs/REMOTE-CONFIG.md.
 *
 * Three situations, as with ads and analytics:
 *  - The Android app with Firebase: the console's values, else the defaults.
 *  - A browser, or the tests: the defaults.
 *  - ?dev=1: the defaults, overridden by ?cfg=key:value,key:value or by
 *    localStorage 'cashpaws.dev.config' ({ key: value }), to try a variant.
 */

/*
 * A key: { default, type: 'int' | 'num' | 'bool' | 'string', min, max, about }.
 * Firebase key names: letters, digits and underscores, starting with a letter.
 */
export const SHELL_KEYS = Object.freeze({
  ads_interstitials:         { default: true, type: 'bool', about: 'Ad breaks (interstitials) at all. Off: rewarded ads only.' },
  ads_interstitial_from:     { default: 11, type: 'int', min: 2, max: 200, about: 'First level reached that can have an Ad break (11 = after level 10).' },
  ads_interstitial_gap_s:    { default: 180, type: 'int', min: 30, max: 3600, about: 'Seconds between two Ad breaks, counted from the app opening too.' },
  ads_free_days:             { default: 2, type: 'int', min: 0, max: 30, about: 'First local days of play with no Ad breaks (2 = install day and the next).' },
  ads_after_rewarded_s:      { default: 60, type: 'int', min: 0, max: 600, about: 'No Ad break this many seconds after a rewarded ad.' },
  gift_enabled:              { default: true, type: 'bool', about: 'Tomorrow\'s gift for new players.' },
  gift_after_level:          { default: 3, type: 'int', min: 1, max: 100, about: 'The gift is offered once this level is beaten.' },
  gift_value_share:          { default: 2, type: 'num', min: 0.25, max: 20, about: 'The gift is worth this many of the game\'s reward value (Money Sort: Sorts).' },
});

const NAME = /^[a-zA-Z][a-zA-Z0-9_]{0,99}$/;

/** One raw value (a string from Firebase, or anything from dev overrides) checked against its spec. */
export function parseValue(spec, raw) {
  if (raw === undefined || raw === null || raw === '') return { ok: false, value: spec.default };
  const s = String(raw).trim();
  let v;
  switch (spec.type) {
    case 'bool':
      if (/^(true|1|yes|on)$/i.test(s)) v = true;
      else if (/^(false|0|no|off)$/i.test(s)) v = false;
      else return { ok: false, value: spec.default };
      return { ok: true, value: v };
    case 'int':
    case 'num':
      v = Number(s);
      if (!Number.isFinite(v)) return { ok: false, value: spec.default };
      if (spec.type === 'int') v = Math.round(v);
      if (Number.isFinite(spec.min)) v = Math.max(spec.min, v);
      if (Number.isFinite(spec.max)) v = Math.min(spec.max, v);
      return { ok: true, value: v };
    default:
      return { ok: true, value: s.slice(0, 500) };
  }
}

/** Check a set of key specs: names Firebase accepts, defaults that pass their own rules. */
export function checkSpecs(keys) {
  const problems = [];
  for (const [k, spec] of Object.entries(keys || {})) {
    if (!NAME.test(k)) problems.push(`${k}: not a valid Remote Config key`);
    if (!['int', 'num', 'bool', 'string'].includes(spec.type)) problems.push(`${k}: unknown type ${spec.type}`);
    const p = parseValue(spec, spec.type === 'bool' ? String(spec.default) : spec.default);
    if (!p.ok || p.value !== spec.default) problems.push(`${k}: default ${spec.default} is outside its own limits`);
  }
  return problems;
}

function nativeBridge() {
  const b = globalThis.CashPawsConfig;
  try { return b && b.isEnabled() ? b : null; } catch { return null; }
}

function devOverrides() {
  const out = {};
  try { Object.assign(out, JSON.parse(localStorage.getItem('cashpaws.dev.config') || '{}')); } catch { /* none */ }
  try {
    const q = new URLSearchParams(location.search).get('cfg');
    for (const pair of (q || '').split(',')) {
      const i = pair.indexOf(':');
      if (i > 0) out[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
    }
  } catch { /* none */ }
  return out;
}

/**
 * Read every value once. `gameKeys` is the installed game's `remote` manifest
 * field. A game key may not reuse a shell key's name.
 */
export function createConfig({ dev = false, gameKeys = {}, raw = null } = {}) {
  const keys = { ...gameKeys, ...SHELL_KEYS };       // the shell's win a clash
  const native = raw ? null : nativeBridge();

  let fetched = { values: {}, source: 'default', fetched: 0, waited: 0 };
  if (raw) fetched = { ...fetched, ...raw };
  else if (native) {
    try { fetched = { ...fetched, ...JSON.parse(native.getAll() || '{}') }; } catch { /* defaults */ }
  }
  const overrides = dev ? devOverrides() : {};

  const values = {};
  const changed = {};           // keys not at their default, and where from
  const rejected = [];
  for (const [k, spec] of Object.entries(keys)) {
    let value = spec.default;
    for (const [from, src] of [['remote', fetched.values], ['dev', overrides]]) {
      if (!src || !(k in src)) continue;
      const p = parseValue(spec, src[k]);
      if (p.ok) { value = p.value; if (value !== spec.default) changed[k] = from; }
      else rejected.push(k);
    }
    values[k] = value;
  }

  return {
    /** True when values can come from Firebase. */
    enabled: !!native,
    /** 'remote' (fetched this launch), 'cached' (fetched last launch), or 'default'. */
    source: Object.keys(overrides).length ? 'dev' : fetched.source,
    /** ms the app waited for a first fetch. */
    waited: fetched.waited || 0,
    get(key) {
      if (!(key in keys)) throw new Error(`Unknown config key: ${key}`);
      return values[key];
    },
    has: (key) => key in keys,
    /** Keys that differ from their defaults, as { key: 'remote' | 'dev' }. */
    changed,
    /** Keys whose remote or dev value was unusable (the default was used). */
    rejected,
    /** Every key with its value, default and description, for the testing card and docs. */
    describe: () => Object.entries(keys).map(([k, s]) => ({ key: k, value: values[k], default: s.default, about: s.about || '' })),
    status() { try { return native ? JSON.parse(native.status?.() || '{}') : null; } catch { return null; } },
  };
}
