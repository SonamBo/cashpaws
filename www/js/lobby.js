/**
 * Lobby. The screen the app opens on, and where the bottom nav lives now that
 * the board has none. Play drops into the board; the nav opens the same tab
 * sheets the pause menu reaches.
 */

import { coinIcon, icons } from './art.js';
import { money } from './render.js';

export class LobbyView {
  constructor(root) {
    this.root = root;
    this.handlers = {};
    this.build();
  }

  on(name, fn) { this.handlers[name] = fn; }
  fire(name, ...a) { this.handlers[name]?.(...a); }

  build() {
    this.root.innerHTML = `
      <header class="lobby-top">
        <div class="coins" data-coin-pill>
          ${coinIcon(22)}
          <span class="coins-n" data-coins>0</span>
          <span class="coins-add">+</span>
        </div>
        <span class="hdr-spacer"></span>
        <button class="icon-btn" data-settings aria-label="Settings">${icons.gear(22)}</button>
      </header>

      <main class="lobby-main">
        <img class="art logo" src="img/logo.png" width="222" alt="Cash Paws" draggable="false">
        <img class="art tagline" src="img/tagline.png" width="190" alt="Sort, earn, level up" draggable="false">
        <img class="art lobby-hero" src="img/cat-hero.png" width="252" alt="" draggable="false">
        <button class="play" data-play>
          <span data-play-label>Play</span>
          <small data-play-sub></small>
        </button>
      </main>

      <nav class="nav" data-nav>
        <button class="on" data-tab="home">${icons.home(22)}<span>Home</span></button>
        <button data-tab="cats">${icons.cat(22)}<span>Cats</span></button>
        <button data-tab="progress">${icons.bars(22)}<span>Progress</span></button>
        <button data-tab="shop">${icons.shop(22)}<span>Shop</span></button>
      </nav>
    `;

    const $ = (s) => this.root.querySelector(s);
    this.el = {
      coins: $('[data-coins]'),
      coinPill: $('[data-coin-pill]'),
      playLabel: $('[data-play-label]'),
      playSub: $('[data-play-sub]'),
      nav: $('[data-nav]'),
    };

    $('[data-play]').addEventListener('click', () => this.fire('play'));
    $('[data-settings]').addEventListener('click', () => this.fire('settings'));
    this.el.nav.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) this.fire('tab', b.dataset.tab);
    });
  }

  /** A run in progress says Continue; a fresh one says Play. */
  update(game) {
    this.el.coins.textContent = game.coins;
    const started = game.netWorth > 0 || game.turn > 0 || game.level > 1;
    this.el.playLabel.textContent = started ? 'Continue' : 'Play';
    this.el.playSub.textContent = started
      ? `Level ${String(game.level).padStart(2, '0')} · ${money(game.netWorth)}`
      : '';
  }

  setNavTab(tab) {
    [...this.el.nav.children].forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  }
}
