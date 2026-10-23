/**
 * The Cats, Progress and Shop sheets.
 *
 * Cats and their unlocks are the shell's; what each cat does comes from the
 * installed game. Progress shows the shell's lifetime numbers, then whatever
 * the game adds. The Shop sells the game's cosmetics, bought with shell coins,
 * and coin packs for real money where the build has them (billing.js).
 */

import { CATS, unlockProgress, perkIn } from './cats.js';
import { cat, coinIcon, icons } from './art.js';
import { asset } from './assets.js';
import { progressOf, isDone, allDone, REWARD, BONUS, STREAK_SHOWN } from './daily.js';

const priceTag = (owned, price) => owned
  ? `<span class="tag on">${icons.check(14)} Owned</span>`
  : `<span class="tag">${coinIcon(14)} ${price}</span>`;

const fmt = (n) => Number(n).toLocaleString('en-US');

function catsPanel({ game, shell }) {
  return `
    <h2>Cats</h2>
    <p class="panel-sub">Wear one at a time. Each tweaks the game.</p>
    <ul class="cards">
      ${CATS.map((c) => {
        const owned = shell.cats.owned.includes(c.id);
        const active = shell.cats.worn === c.id;
        const { revealed, have, need } = unlockProgress(c, shell.stats);
        const perk = perkIn(game, c.id);
        const state = !revealed ? 'locked' : active ? 'active' : '';
        const tag = active ? '<span class="tag on">Wearing</span>'
          : !revealed ? `<span class="tag">${icons.lock(14)}</span>`
          : priceTag(owned, c.price);
        const line = !revealed
          ? `<span class="cat-lock">${c.unlock.label} &middot; ${fmt(Math.min(have, need))}/${fmt(need)}</span>`
          : `<span class="cat-perk">${perk ? perk.text : c.id === 'patch' ? 'No perk. Classic play.' : 'Looks only'}</span>`;
        const bar = !revealed
          ? `<span class="cat-bar"><i style="width:${Math.min(100, (have / need) * 100).toFixed(0)}%"></i></span>`
          : '';
        return `
        <li class="card ${state}" ${revealed ? `data-buy-cat="${c.id}"` : ''}>
          <span class="card-art">${cat('face', 44, 'cat-avatar', revealed ? c.id : 'patch')}</span>
          <span class="card-main"><b>${revealed ? c.name : '???'}</b>${line}${bar}</span>
          ${tag}
        </li>`;
      }).join('')}
    </ul>`;
}

function shopPanel({ game, shell, billing }) {
  const mine = shell.cosmetics[game.id] || { owned: [], active: null };
  const items = game.cosmetics || [];
  const list = items.length ? `
    <ul class="cards">
      ${items.map((s) => {
        const owned = s.price === 0 || mine.owned.includes(s.id);
        const active = (mine.active || game.defaultCosmetic) === s.id;
        return `
        <li class="card ${active ? 'active' : ''}" data-buy-cosmetic="${s.id}">
          <span class="card-art">${s.preview ? `<img class="art" src="${asset(game.path + s.preview)}" width="34" alt="">` : ''}</span>
          <span class="card-main"><b>${s.name}</b><span>${s.note || ''}</span></span>
          ${active ? '<span class="tag on">In use</span>' : priceTag(owned, s.price)}
        </li>`;
      }).join('')}
    </ul>` : '<p class="panel-sub">Nothing here yet</p>';
  return `
    <h2>Shop</h2>
    <p class="panel-sub">${game.shopBlurb || 'Looks only'}</p>
    ${list}
    ${coinsSection(billing)}`;
}

/* A stack of 1–4 coins, bigger packs taller. */
const stack = (i) => `<span class="pack-art n${Math.min(4, i + 1)}">${
  Array.from({ length: Math.min(4, i + 1) }, () => coinIcon(26)).join('')}</span>`;

function coinsSection(billing) {
  if (!billing?.enabled) {
    return `
    <h3 data-coins-section>Coins</h3>
    <p class="panel-sub">Earned by playing. Nothing sold for real money.</p>`;
  }
  const packs = billing.packs();
  const body = billing.state === 'loading'
    ? '<p class="panel-sub">Loading prices…</p>'
    : billing.state !== 'ready'
      ? '<p class="panel-sub">Unavailable right now. Check your connection.</p>'
      : `<ul class="cards packs">
      ${packs.map((p, i) => `
        <li class="card pack ${p.tag ? 'tagged' : ''}">
          ${p.tag ? `<span class="pack-tag">${p.tag}</span>` : ''}
          <span class="card-art">${stack(i)}</span>
          <span class="card-main"><b>${fmt(p.coins)} coins</b><span>${p.name || ''}${p.bonus ? ` &middot; <em class="pack-bonus">+${p.bonus}% extra</em>` : ''}</span></span>
          ${p.price ? `<button class="buy" data-buy-pack="${p.id}">${p.price}</button>` : '<span class="tag">Unavailable</span>'}
        </li>`).join('')}
    </ul>`;
  return `
    <h3 data-coins-section>Get coins</h3>
    ${body}
    <p class="panel-sub small">Paid via Google Play. Coins stay on this phone.</p>`;
}

function progressPanel({ game, shell, instance }) {
  const s = shell.stats;
  const owned = shell.cats.owned.length;
  const extra = instance?.progressRows?.() || null;
  const tiles = [
    { value: fmt(s.coinsEarned), label: 'coins earned' },
    { value: s.bestLevel, label: 'best level' },
    { value: `${owned}/${CATS.length}`, label: 'cats' },
    { value: s.daysPlayed, label: 'days played' },
    ...(extra?.tiles || []),
  ];
  const table = extra?.table ? `
    <table class="career">
      <thead><tr>${extra.table.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${extra.table.rows.map((r) => `
        <tr class="${r.state || ''}">${r.cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>` : '';
  return `
    <h2>Progress</h2>
    <p class="panel-sub">${extra?.blurb || 'Lifetime totals'}</p>
    <div class="stat-grid">
      ${tiles.map((t) => `<div><b>${t.value}</b><span>${t.label}</span></div>`).join('')}
    </div>
    ${table}`;
}

function untilMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(1, Math.round((next - now) / 60000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

const TIER_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

function dailyPanel({ game, shell, stats }) {
  const d = shell.daily;
  if (!d.tasks.length) {
    return `<h2>Daily</h2><p class="panel-sub">No daily tasks yet</p>`;
  }
  const rows = d.tasks.map((t, i) => {
    const have = progressOf(t, stats);
    const done = isDone(t, stats);
    const right = t.claimed
      ? `<span class="tag on">${icons.check(14)} Claimed</span>`
      : done
        ? `<button class="claim" data-claim="${i}">Claim ${coinIcon(14)} ${REWARD[t.tier]}</button>`
        : `<span class="tag">${coinIcon(14)} ${REWARD[t.tier]}</span>`;
    return `
      <li class="card task ${t.claimed ? 'claimed' : done ? 'done' : ''}">
        <span class="task-tier tier-${t.tier}">${TIER_LABEL[t.tier]}</span>
        <span class="card-main">
          <b>${t.text}</b>
          <span class="cat-bar"><i style="width:${((have / t.target) * 100).toFixed(0)}%"></i></span>
          <span class="task-count">${have} / ${t.target}</span>
        </span>
        ${right}
      </li>`;
  }).join('');

  const allClaimed = d.tasks.every((t) => t.claimed);
  const bonusRight = d.bonusClaimed
    ? `<span class="tag on">${icons.check(14)} Claimed</span>`
    : allDone(d, stats) && allClaimed
      ? `<button class="claim" data-claim-bonus>Claim ${coinIcon(14)} ${BONUS}</button>`
      : `<span class="tag">${coinIcon(14)} ${BONUS}</span>`;

  const shown = Math.min(d.streak, STREAK_SHOWN);
  const stamps = Array.from({ length: STREAK_SHOWN }, (_, i) =>
    `<span class="stamp ${i < shown ? 'on' : ''}">${i < shown ? cat('face', 30, 'stamp-cat') : ''}</span>`).join('');
  const streakLine = d.streak === 0
    ? 'Finish all 3 to start a streak'
    : d.bonusClaimed
      ? `${d.streak}-day streak · back tomorrow`
      : `${d.streak}-day streak · finish today's 3`;

  return `
    <h2>Daily</h2>
    <p class="panel-sub">New tasks in ${untilMidnight()}</p>
    <ul class="cards">${rows}
      <li class="card task bonus ${d.bonusClaimed ? 'claimed' : ''}">
        <span class="task-tier tier-bonus">${icons.gift(18)}</span>
        <span class="card-main"><b>All 3 done</b><span>Bonus</span></span>
        ${bonusRight}
      </li>
    </ul>
    <h3>Streak</h3>
    <div class="streak">${stamps}</div>
    <p class="panel-sub">${streakLine}</p>`;
}

export class Panels {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'panel-sheet';
    root.appendChild(this.el);
    this.open = null;
    this.onBuy = () => {};
    this.onClaim = () => {};
    this.onClose = () => this.hide();
    this.el.addEventListener('click', (e) => {
      const claim = e.target.closest('[data-claim]');
      if (claim) return this.onClaim(Number(claim.dataset.claim));
      if (e.target.closest('[data-claim-bonus]')) return this.onClaim('bonus');
      const c = e.target.closest('[data-buy-cat]');
      if (c) return this.onBuy('cat', c.dataset.buyCat);
      const s = e.target.closest('[data-buy-cosmetic]');
      if (s) return this.onBuy('cosmetic', s.dataset.buyCosmetic);
      const k = e.target.closest('[data-buy-pack]');
      if (k) return this.onBuy('pack', k.dataset.buyPack, k);
    });
  }

  show(tab, ctx, { focus } = {}) {
    if (!tab || tab === 'home') return this.hide();
    const body = tab === 'cats' ? catsPanel(ctx)
      : tab === 'shop' ? shopPanel(ctx)
      : tab === 'daily' ? dailyPanel(ctx)
      : progressPanel(ctx);
    const keep = this.open === tab ? this.el.scrollTop : 0;   // a redraw (a purchase, prices arriving) keeps the place
    this.el.innerHTML = `
      <div class="panel-head">
        <button data-close aria-label="Close">${icons.close(20)}</button>
      </div>
      <div class="panel-inner">${body}</div>`;
    this.el.querySelector('[data-close]').addEventListener('click', () => this.onClose());
    this.el.classList.add('in');
    this.open = tab;
    this.el.scrollTop = keep;
    if (focus) this.el.querySelector(`[data-${focus}-section]`)?.scrollIntoView({ block: 'start' });
  }

  hide() {
    this.el.classList.remove('in');
    this.open = null;
  }
}
