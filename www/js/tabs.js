/**
 * Cats / Progress / Shop. Panels slide over the board; the nav stays put.
 * Everything sold here is cosmetic — nothing bought changes the rules.
 */

import { netWorthFloor, columnsForLevel, poolForLevel } from './engine.js';
import { catAvatar, coinIcon, moreIcons } from './art.js';
import { money } from './render.js';
import { CATS, unlockProgress } from './cats.js';

export const SKINS = [
  { id: 'classic', name: 'Mint set',  price: 0,   note: 'Blue, silver, copper, green, purple.' },
  { id: 'notes',   name: 'Paper set', price: 800, note: 'More bills, fewer coins. Same values.' },
];

const lockRow = (owned, price) =>
  owned
    ? `<span class="tag on">${moreIcons.check(14)} Owned</span>`
    : `<span class="tag">${coinIcon(14)} ${price}</span>`;

function catsPanel(wallet, stats) {
  return `
    <h2>Cats</h2>
    <p class="panel-sub">One cat at a time. Each changes the game a little, and
    they pull in different directions — none is simply the best.</p>
    <ul class="cards">
      ${CATS.map((c) => {
        const owned = wallet.cats.includes(c.id);
        const active = wallet.activeCat === c.id;
        const { revealed, have, need } = unlockProgress(c, stats);
        const state = !revealed ? 'locked' : active ? 'active' : '';

        const tag = active ? '<span class="tag on">Wearing</span>'
          : !revealed ? `<span class="tag">${moreIcons.lock(14)}</span>`
          : lockRow(owned, c.price);

        const line = !revealed
          ? `<span class="cat-lock">${c.unlock.label} &middot; ${Math.min(have, need)}/${need}</span>`
          : `<span class="cat-perk">${c.perkText}</span>`;

        const bar = !revealed
          ? `<span class="cat-bar"><i style="width:${Math.min(100, (have / need) * 100).toFixed(0)}%"></i></span>`
          : '';

        return `
        <li class="card ${state}" ${revealed ? `data-buy-cat="${c.id}"` : ''}>
          <span class="card-art">${catAvatar(44, revealed ? c.id : 'patch')}</span>
          <span class="card-main">
            <b>${revealed ? c.name : '???'}</b>
            ${line}
            ${bar}
          </span>
          ${tag}
        </li>`;
      }).join('')}
    </ul>`;
}

function shopPanel(wallet) {
  return `
    <h2>Shop</h2>
    <p class="panel-sub">Chip skins change how values look, never what they are worth.</p>
    <ul class="cards">
      ${SKINS.map((s) => {
        const owned = wallet.skins.includes(s.id);
        const active = wallet.activeSkin === s.id;
        return `
        <li class="card ${active ? 'active' : ''}" data-buy-skin="${s.id}">
          <span class="card-art"><img class="art" src="img/${s.id === 'notes' ? 'chipb' : 'chip'}-20.png" width="34" alt=""></span>
          <span class="card-main">
            <b>${s.name}</b>
            <span>${s.note}</span>
          </span>
          ${active ? '<span class="tag on">In use</span>' : lockRow(owned, s.price)}
        </li>`;
      }).join('')}
    </ul>
    <h3>Coins</h3>
    <p class="panel-sub">Coins come from banking columns — 10 a time — and from levelling up.
    Nothing here is for sale for real money.</p>`;
}

function progressPanel(game, stats) {
  const from = Math.max(1, game.level - 2);
  const rows = [];
  for (let lv = from; lv < from + 7; lv++) {
    const cols = columnsForLevel(lv, game.cfg);
    const pool = poolForLevel(lv, game.cfg);
    const state = lv < game.level ? 'done' : lv === game.level ? 'now' : '';
    rows.push(`
      <tr class="${state}">
        <td>${String(lv).padStart(2, '0')}</td>
        <td>${money(netWorthFloor(lv))}</td>
        <td>${cols}</td>
        <td>${pool[pool.length - 1]}</td>
      </tr>`);
  }

  return `
    <h2>Progress</h2>
    <p class="panel-sub">Net worth is lifetime. It only ever falls if you lose a level.</p>
    <div class="stat-grid">
      <div><b>${money(game.netWorth)}</b><span>net worth</span></div>
      <div><b>${String(game.level).padStart(2, '0')}</b><span>level</span></div>
      <div><b>${stats.banks}</b><span>columns banked</span></div>
      <div><b>${stats.bestLevel}</b><span>best level</span></div>
    </div>
    <table class="career">
      <thead><tr><th>LV</th><th>Needs</th><th>Cols</th><th>Top chip</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;
}

export class Panels {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'panel-sheet';
    root.appendChild(this.el);
    this.open = null;
    this.onBuy = () => {};
    this.onClose = () => this.hide();
    this.el.addEventListener('click', (e) => {
      const cat = e.target.closest('[data-buy-cat]');
      if (cat) return this.onBuy('cat', cat.dataset.buyCat);
      const skin = e.target.closest('[data-buy-skin]');
      if (skin) return this.onBuy('skin', skin.dataset.buySkin);
    });
  }

  show(tab, game, wallet, stats) {
    if (!tab || tab === 'home') return this.hide();
    const html =
      tab === 'cats' ? catsPanel(wallet, stats)
      : tab === 'shop' ? shopPanel(wallet)
      : progressPanel(game, stats);
    this.el.innerHTML = `
      <div class="panel-head">
        <button data-close aria-label="Back to the board">${moreIcons.close(20)}</button>
      </div>
      <div class="panel-inner">${html}</div>`;
    this.el.querySelector('[data-close]').addEventListener('click', () => this.onClose());
    this.el.classList.add('in');
    this.open = tab;
  }

  hide() {
    this.el.classList.remove('in');
    this.open = null;
  }
}
