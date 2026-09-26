/**
 * The lobby: where the app opens, where the tabs live, and where Play drops
 * into whichever game is installed.
 */

import { coinIcon, icons, logo, tagline, catHero } from './art.js';
import { bell } from './questui.js';

export class LobbyView {
  constructor(root) {
    this.root = root;
    this.handlers = {};
    root.innerHTML = `
      <header class="lobby-top">
        <div class="coins" data-coin-pill>
          ${coinIcon(22)}
          <span class="coins-n" data-coins>0</span>
          <span class="coins-add">+</span>
        </div>
        <span class="hdr-spacer"></span>
        <button class="icon-btn box-btn" data-box aria-label="Rewards box">
          ${icons.gift(22)}<i class="nav-dot" data-box-dot hidden></i>
        </button>
        <button class="icon-btn" data-settings aria-label="Settings">${icons.gear(22)}</button>
      </header>
      <button class="quest-btn" data-quest hidden aria-label="Bell Quest">
        <span class="quest-disc">${bell(40)}<i class="quest-badge" data-quest-badge hidden></i></span>
        <span class="quest-pill" data-quest-pill></span>
      </button>
      <main class="lobby-main">
        ${logo(222)}
        ${tagline(190)}
        ${catHero(252)}
        <button class="play" data-play>
          <span data-play-label>Play</span>
          <small data-play-sub></small>
        </button>
      </main>
      <nav class="nav" data-nav>
        <button class="on" data-tab="home">${icons.home(22)}<span>Home</span></button>
        <button data-tab="daily">${icons.daily(22)}<span>Daily</span><i class="nav-dot" data-daily-dot hidden></i></button>
        <button data-tab="cats">${icons.cat(22)}<span>Cats</span></button>
        <button data-tab="progress">${icons.bars(22)}<span>Progress</span></button>
        <button data-tab="shop">${icons.shop(22)}<span>Shop</span></button>
      </nav>`;

    const $ = (s) => root.querySelector(s);
    this.el = {
      coins: $('[data-coins]'), playLabel: $('[data-play-label]'),
      playSub: $('[data-play-sub]'), nav: $('[data-nav]'),
    };
    $('[data-play]').addEventListener('click', () => this.fire('play'));
    $('[data-settings]').addEventListener('click', () => this.fire('settings'));
    $('[data-box]').addEventListener('click', () => this.fire('box'));
    $('[data-quest]').addEventListener('click', () => this.fire('quest'));
    this.el.nav.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) this.fire('tab', b.dataset.tab);
    });
  }

  on(name, fn) { this.handlers[name] = fn; }
  fire(name, ...a) { this.handlers[name]?.(...a); }

  /** A run in progress says Continue, with the game's own summary under it. */
  update({ coins, summary }) {
    this.el.coins.textContent = coins;
    this.el.playLabel.textContent = summary ? 'Continue' : 'Play';
    this.el.playSub.textContent = summary || '';
  }

  /** The gift glows, with a dot, when a box is ready to open. */
  setBoxReady(on) {
    this.root.querySelector('[data-box]').classList.toggle('ready', on);
    this.root.querySelector('[data-box-dot]').hidden = !on;
  }

  /**
   * The Bell Quest icon. Hidden until the quest unlocks. `pill` is the line
   * under it (a timer, New!, Claim!), `badge` the step count, and `news`
   * makes it wiggle when something is waiting to be seen.
   */
  setQuest({ visible, pill = '', badge = '', news = false }) {
    const b = this.root.querySelector('[data-quest]');
    b.hidden = !visible;
    b.classList.toggle('news', news);
    this.root.querySelector('[data-quest-pill]').textContent = pill;
    const badgeEl = this.root.querySelector('[data-quest-badge]');
    badgeEl.textContent = badge;
    badgeEl.hidden = !badge;
  }

  /** A dot on the Daily tab when a task or the bonus is waiting to be claimed. */
  setDailyBadge(on) { this.root.querySelector('[data-daily-dot]').hidden = !on; }

  setNavTab(tab) {
    [...this.el.nav.children].forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  }
}
