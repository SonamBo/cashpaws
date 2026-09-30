/**
 * The bar across the top of the game screen: coins, pause, and whatever the
 * game reports as progress. A game with levels sends a title like "Level 5"
 * and a fraction for the bar; an endless game might send "Best 1,240" and no
 * bar at all. The header draws what it is given and nothing more.
 */

import { cat, coinIcon, icons } from './art.js';

export class Header {
  constructor(root, { onPause }) {
    this.root = root;
    root.innerHTML = `
      <header class="hdr">
        <div class="hdr-top">
          <div class="coins" data-coin-pill>
            ${coinIcon(26)}
            <span class="coins-n" data-coins>0</span>
            <span class="coins-add">+</span>
          </div>
          <span class="hdr-spacer"></span>
          <button class="pause-btn" data-menu aria-label="Menu">${icons.pause(20)}</button>
        </div>
        <h1 class="level-title" data-title></h1>
        <div class="bar" data-bar>
          <span class="bar-fill" data-fill></span>
          <span class="bar-knob" data-knob></span>
        </div>
        <p class="bar-figure" data-figure></p>
        <p class="bar-sub" data-sub></p>
      </header>`;
    const $ = (s) => root.querySelector(s);
    this.el = {
      coins: $('[data-coins]'), pill: $('[data-coin-pill]'), title: $('[data-title]'),
      bar: $('[data-bar]'), fill: $('[data-fill]'), knob: $('[data-knob]'),
      figure: $('[data-figure]'), sub: $('[data-sub]'),
    };
    $('[data-menu]').addEventListener('click', onPause);
    this.redrawCat();
  }

  /** The knob is the worn cat's face; redraw it when the cat changes. */
  redrawCat() { this.el.knob.innerHTML = cat('face', 38, 'knob-cat'); }

  setCoins(n) { this.el.coins.textContent = n; }

  setProgress(p = {}) {
    this.el.title.textContent = p.title || '';
    const hasBar = typeof p.fraction === 'number';
    this.el.bar.hidden = !hasBar;
    if (hasBar) {
      const pct = (Math.max(0, Math.min(1, p.fraction)) * 100).toFixed(1) + '%';
      this.el.fill.style.width = pct;
      this.el.knob.style.left = pct;
    }
    this.el.figure.textContent = p.figure || '';
    this.el.sub.textContent = p.sub || '';
    this.el.sub.hidden = !p.sub;        // no line, no gap: Money Sort's figure says it all
  }

  pulseCoins() {
    this.el.pill.classList.remove('pulse');
    void this.el.pill.offsetWidth;
    this.el.pill.classList.add('pulse');
  }
}
