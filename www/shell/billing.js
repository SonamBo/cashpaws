/**
 * Coin packs bought with real money. The packs are listed in www/app.config.js
 * (coinPacks); an app without that list sells nothing, and says so.
 *
 * Three situations, like ads:
 *  - The Android app: window.CashPawsBilling (Billing.java) talks to Google
 *    Play. Prices come from Play, in the player's own currency.
 *  - Any browser, CrazyGames included: no bridge, nothing for sale.
 *  - ?dev=1: a stub with made-up prices, so the Shop can be built and tested.
 *
 * Paying exactly once. Play reports a purchase; this adds the coins, writes
 * the purchase token into the save and saves, and only then consumes it (tells
 * Play the coins arrived). A purchase that is reported again (the app closed
 * between saving and consuming) has a token already in the save, so it is
 * consumed without paying a second time. Purchased coins don't count as
 * coins earned, which reveal cats: those stay a reward for playing.
 */

let nextId = 0;
const KEEP_TOKENS = 50;

function nativeBridge() {
  const b = globalThis.CashPawsBilling;
  return b && typeof b.start === 'function' ? b : null;
}

/** Made-up prices for ?dev=1: roughly what the packs cost in the US store. */
const DEV_PRICES = [0.99, 1.99, 4.99, 9.99, 19.99, 49.99];

export function createBilling({ packs = [], dev, confirm, track = () => {}, wallet, ledger, save, notice = () => {}, onChange = () => {} }) {
  const native = packs.length ? nativeBridge() : null;
  const stub = !native && dev && packs.length > 0;
  const byId = Object.fromEntries(packs.map((p) => [p.id, p]));
  const waiting = new Map();          // request id -> resolve
  const pendingSeen = new Set();      // tokens reported pending, so the note shows once
  let products = {};                  // id -> { price, micros, currency }
  let state = native ? 'loading' : stub ? 'ready' : 'off';

  if (stub) {
    packs.forEach((p, i) => {
      const usd = DEV_PRICES[i] ?? 99.99;
      products[p.id] = { price: `$${usd.toFixed(2)}`, micros: Math.round(usd * 1e6), currency: 'USD' };
    });
  }

  /* ---------------- paying out ---------------- */

  function coinsFor(ids, quantity) {
    return ids.reduce((sum, id) => sum + (byId[id]?.coins || 0), 0) * Math.max(1, quantity || 1);
  }

  /** A completed purchase: pay once, save, then let Play know. */
  function grant({ token, products: ids = [], quantity = 1, orderId = '' }) {
    if (!token) return 0;
    if (ledger.granted.includes(token)) {     // paid before the app last closed
      native?.consume(token);
      return 0;
    }
    const coins = coinsFor(ids, quantity);
    if (!coins) return 0;                     // not one of this app's packs: leave it alone
    wallet.earn(coins, 'purchase');
    ledger.granted = [...ledger.granted, token].slice(-KEEP_TOKENS);
    ledger.purchases += 1;
    ledger.coins += coins;
    save();                                   // the coins and the token, before Play is told
    native?.consume(token);
    pendingSeen.delete(token);
    track('iap_granted', { product: ids.join(','), coins, quantity, order: orderId ? 'yes' : 'no' });
    notice('granted', { coins, pack: byId[ids[0]] });
    onChange();
    return coins;
  }

  globalThis.__billing = (e) => {
    if (!e || typeof e !== 'object') return;
    if (e.type === 'products') {
      try {
        const list = JSON.parse(native?.products() || '[]');
        products = Object.fromEntries(list.map((p) => [p.id, p]));
      } catch { products = {}; }
      state = Object.keys(products).length ? 'ready' : 'unavailable';
      onChange();
    } else if (e.type === 'purchase') {
      if (e.state === 'purchased') grant(e);
      else if (e.state === 'pending' && !pendingSeen.has(e.token)) {
        pendingSeen.add(e.token);
        notice('pending', { pack: byId[(e.products || [])[0]] });
      }
    } else if (e.type === 'result') {
      const resolve = waiting.get(String(e.id));
      waiting.delete(String(e.id));
      resolve?.(e.status);
    }
  };

  if (native) {
    try { native.start(JSON.stringify(packs.map((p) => p.id))); } catch { state = 'unavailable'; }
  }

  /* ---------------- what the Shop shows ---------------- */

  /** Extra coins per unit of money, against the smallest pack: "+20%". */
  function bonusOf(pack) {
    const base = packs.map((p) => ({ p, pr: products[p.id] })).find((x) => x.pr?.micros);
    const pr = products[pack.id];
    if (!base || !pr?.micros || base.p === pack || pr.currency !== base.pr.currency) return 0;
    const rate = (pack.coins / pr.micros) / (base.p.coins / base.pr.micros);
    const pct = Math.round((rate - 1) * 100);
    return pct >= 5 ? pct : 0;
  }

  return {
    /** Coin packs exist in this build (Android, or the dev stub). */
    get enabled() { return !!native || stub; },
    /** 'off' (nothing for sale), 'loading', 'ready', or 'unavailable' (Play unreachable or not set up). */
    get state() { return state; },

    packs() {
      return packs.map((p) => ({
        ...p,
        price: products[p.id]?.price || null,
        bonus: products[p.id] ? bonusOf(p) : 0,
      }));
    },

    /** Resolves to 'purchased', 'pending', 'cancelled', 'owned' or 'error'. */
    async buy(id) {
      const pack = byId[id];
      if (!pack || !products[id]) return 'error';
      track('iap_start', { product: id, coins: pack.coins });
      let status;
      if (stub) {
        const yes = await confirm({
          kicker: 'Purchase (stub)',
          title: `${pack.name}: ${pack.coins.toLocaleString('en-US')} coins`,
          line: `Google Play would ask for ${products[id].price} here.`,
          ok: 'Pay', cancel: 'Cancel',
        });
        status = yes ? 'purchased' : 'cancelled';
        if (yes) grant({ token: `dev-${Date.now()}-${++nextId}`, products: [id], quantity: 1 });
      } else {
        status = await new Promise((resolve) => {
          const rid = String(++nextId);
          waiting.set(rid, resolve);
          try { native.buy(id, rid); } catch { waiting.delete(rid); resolve('error'); }
        });
      }
      track('iap_result', { product: id, status });
      return status;
    },

    /** Look again for purchases that completed while the app was away. */
    refresh() { try { native?.refresh(); } catch { /* no bridge */ } },

    /** For the testing card. */
    status() {
      if (!native) return stub ? { state: 'dev stub' } : null;
      try { return { ...JSON.parse(native.status?.() || '{}'), shown: state }; } catch { return { shown: state }; }
    },
  };
}
