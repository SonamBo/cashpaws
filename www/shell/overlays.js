/**
 * Cards over the whole app. Each returns a promise that settles when the
 * player acts. Nothing here knows which game is running: celebrations and
 * setbacks take their words from the game, and the art is the worn cat.
 */

import { cat, icons } from './art.js';
import APP from '../app.config.js';

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const PRIVACY_URL = APP.privacyUrl;

let layer = null;
export function mountOverlays(root) {
  layer = document.createElement('div');
  layer.className = 'overlays';
  root.appendChild(layer);
}

/** Put a card up. `tone` picks the colour: milestone, locked or menu. */
export function show(html, tone = 'locked') {
  const card = document.createElement('div');
  card.className = `ovl ovl-${tone}`;
  card.innerHTML = html;
  layer.appendChild(card);
  requestAnimationFrame(() => card.classList.add('in'));
  return card;
}

export async function dismiss(card) {
  card.classList.remove('in');
  await wait(220);
  card.remove();
}

export const anyCardOpen = () => !!layer?.querySelector('.ovl');

const button = (card, sel) => new Promise((resolve) => {
  card.querySelector(sel).addEventListener('click', async () => { await dismiss(card); resolve(); });
});

/** Sage, the worn cat cheering. A level, a record, whatever the game calls a win. */
export function celebrate({ kicker = 'Well done', title, figure = '', reward = '', go = 'Keep going' }) {
  const card = show(`
    <div class="ovl-stack">
      ${cat('cheer', 210, 'ovl-cheer')}
      <div class="ovl-card">
        <p class="ovl-kicker">${kicker}</p>
        <h2 class="ovl-h">${title}</h2>
        ${figure ? `<p class="ovl-figure">${figure}</p>` : ''}
        ${reward && reward.length ? `<ul class="ovl-gains">${[].concat(reward).map((r) => `<li>${r}</li>`).join('')}</ul>` : ''}
        <button class="ovl-btn primary" data-go>${go}</button>
      </div>
    </div>`, 'milestone');
  return button(card, '[data-go]');
}

/** Taupe, the worn cat slumped. Whatever the game calls a loss. */
export function setback({ kicker = 'Unlucky', title, figure = '', line = '', go = 'Try again' }) {
  const card = show(`
    <div class="ovl-stack">
      ${cat('slump', 210, 'cat-lying')}
      <div class="ovl-card">
        <p class="ovl-kicker">${kicker}</p>
        <h2 class="ovl-h">${title}</h2>
        ${figure ? `<p class="ovl-figure">${figure}</p>` : ''}
        ${line ? `<p class="ovl-sub">${line}</p>` : ''}
        <button class="ovl-btn primary" data-go>${go}</button>
      </div>
    </div>`, 'locked');
  return button(card, '[data-go]');
}

/** Two buttons. Resolves true on confirm, false on cancel. */
export function confirm({ kicker, title, line, ok, cancel = 'Back' }) {
  return new Promise((resolve) => {
    const card = show(`
      <div class="ovl-body">
        <p class="ovl-kicker">${kicker}</p>
        <p class="ovl-title">${title}</p>
        <p class="ovl-sub">${line}</p>
        <button class="ovl-btn primary" data-ok>${ok}</button>
        <button class="ovl-btn ghost" data-cancel>${cancel}</button>
      </div>`, 'locked');
    const pick = async (v) => { await dismiss(card); resolve(v); };
    card.querySelector('[data-ok]').addEventListener('click', () => pick(true));
    card.querySelector('[data-cancel]').addEventListener('click', () => pick(false));
  });
}

/**
 * A friendly two-button question, in the same card as a celebration: the worn
 * cat cheering over a cream card. Resolves true on `ok`, false on `cancel`.
 */
export function ask({ kicker, title, line, ok, cancel }) {
  return new Promise((resolve) => {
    const card = show(`
      <div class="ovl-stack">
        ${cat('cheer', 210, 'ovl-cheer')}
        <div class="ovl-card">
          <p class="ovl-kicker">${kicker}</p>
          <h2 class="ovl-h">${title}</h2>
          <p class="ovl-sub">${line}</p>
          <button class="ovl-btn primary" data-ok>${ok}</button>
          <button class="ovl-btn ghost" data-cancel>${cancel}</button>
        </div>
      </div>`, 'milestone');
    const pick = async (v) => { await dismiss(card); resolve(v); };
    card.querySelector('[data-ok]').addEventListener('click', () => pick(true));
    card.querySelector('[data-cancel]').addEventListener('click', () => pick(false));
  });
}

/**
 * A card with several ways out, best first: [{ id, label, primary }], then a
 * plain cancel. Resolves the chosen id, or null.
 */
export function choose({ kicker, title, line, choices, cancel = 'Not now' }) {
  return new Promise((resolve) => {
    const card = show(`
      <div class="ovl-stack">
        ${cat('slump', 210, 'cat-lying')}
        <div class="ovl-card">
          <p class="ovl-kicker">${kicker}</p>
          <h2 class="ovl-h">${title}</h2>
          <p class="ovl-sub">${line}</p>
          ${choices.map((c) => `<button class="ovl-btn ${c.primary ? 'primary' : 'alt'}" data-choice="${c.id}">${c.label}</button>`).join('')}
          <button class="ovl-btn ghost" data-cancel>${cancel}</button>
        </div>
      </div>`, 'locked');
    const pick = async (v) => { await dismiss(card); resolve(v); };
    card.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      pick(b.matches('[data-cancel]') ? null : b.dataset.choice);
    });
  });
}

/**
 * "Ad break": the worn cat, a title, and a bar that fills over `ms`. It says
 * an ad is coming before it comes. Returns { done, close }: `done` resolves
 * when the bar is full; `close` takes the card down after the ad.
 */
export function adBreak(ms = 2000) {
  const card = show(`
    <div class="ovl-stack">
      ${cat('cheer', 210, 'ovl-cheer')}
      <div class="ovl-card ad-break" role="status" aria-live="assertive">
        <p class="ovl-kicker">Thanks for playing</p>
        <h2 class="ovl-h">Ad break</h2>
        <p class="ovl-sub">Back in a moment</p>
        <div class="ad-break-bar"><i style="animation-duration:${ms}ms"></i></div>
      </div>
    </div>`, 'milestone');
  return { done: wait(ms), close: () => dismiss(card) };
}

function pickMenu(kicker, title, items, note = '') {
  return new Promise((resolve) => {
    const card = show(`
      <div class="ovl-stack">
        <div class="ovl-card">
          <p class="ovl-kicker">${kicker}</p>
          <h2 class="ovl-h">${title}</h2>
          <div class="menu">${items.join('')}</div>
          ${note}
        </div>
      </div>`, 'menu');
    card.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-pick]');
      if (!b) return;
      await dismiss(card);
      resolve(b.dataset.pick);
    });
  });
}

/** The pause menu. Restart only appears if the game says it can restart. */
export function pauseMenu({ canRestart, title }) {
  return pickMenu('Paused', title, [
    `<button class="primary" data-pick="resume">${icons.play(20)}<span>Resume</span></button>`,
    `<button data-pick="progress">${icons.bars(20)}<span>Progress</span></button>`,
    `<button data-pick="cats">${icons.cat(20)}<span>Cats</span></button>`,
    `<button data-pick="shop">${icons.shop(20)}<span>Shop</span></button>`,
    canRestart ? `<button data-pick="restart">${icons.restart(20)}<span>Restart</span></button>` : '',
    `<button data-pick="lobby">${icons.home(20)}<span>Back to lobby</span></button>`,
  ]);
}

/**
 * Settings, from the lobby gear. The privacy policy is a plain link: a browser
 * opens a tab, and the Android shell hands any outside address to the phone's
 * browser, since the app itself has no internet permission.
 */
export function settings({ title, note, privacy = false, reminders = null, version = '', audio = null }) {
  // `version`: tapped 5 times, it resolves 'adstatus' (a tester's readout).
  // `privacy` only when Google's consent SDK says this player must be offered
  // their choices (the US "do not sell or share" link). The form is Google's.
  const picked = pickMenu('Settings', title, [
    `<a class="menu-link" href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer">
       ${icons.lock(20)}<span>Privacy Policy</span>${icons.external(16)}
     </a>`,
    !privacy ? '' : `
     <button data-pick="privacy">${icons.lock(20)}<span>Do not sell or share my info</span></button>`,
    audio === null ? '' : `
     <button class="menu-toggle" data-pick="sfx" role="switch" aria-checked="${audio.sfx}">
       ${icons.speaker(20)}<span>Sound effects</span>
       <i class="switch ${audio.sfx ? 'on' : ''}"></i>
     </button>
     <button class="menu-toggle" data-pick="music" role="switch" aria-checked="${audio.music}">
       ${icons.music(20)}<span>Music</span>
       <i class="switch ${audio.music ? 'on' : ''}"></i>
     </button>`,
    reminders === null ? '' : `
     <button class="menu-toggle" data-pick="reminders" role="switch" aria-checked="${reminders}">
       ${icons.daily(20)}<span>Reminders: Rewards Box and Bell Quest</span>
       <i class="switch ${reminders ? 'on' : ''}"></i>
     </button>`,
    `<button data-pick="erase">${icons.undo(20)}<span>Erase all progress</span></button>`,
    `<button class="primary" data-pick="close">${icons.play(20)}<span>Done</span></button>`,
  ], (note ? `<p class="ovl-sub settings-note">${note}</p>` : '')
    + (version ? `<p class="settings-version">Version ${version}</p>` : ''));
  const v = [...layer.querySelectorAll('.settings-version')].pop();
  let taps = 0;
  // Runs before the card's own click handler, so the 5th tap becomes a pick.
  v?.addEventListener('click', () => { if (++taps >= 5) v.dataset.pick = 'adstatus'; });
  return picked;
}

/**
 * A note that slides in over the game and leaves by itself. Never blocks play:
 * a task finishing mid-board should not interrupt the board.
 */
export function toast(html, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
  // Two at once (a daily task and a quest step, say) stack instead of overlapping.
  el.style.setProperty('--stack', layer.querySelectorAll('.toast').length);
  layer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, ms);
}

/**
 * The Rewards Box. Resolves 'open', 'ad' (open early for an ad) or 'close'.
 * The gift is an icon for now; an illustration can replace .box-art later.
 */
export function boxCard({ ready, wait: waitText, adOffer, adsLeft }) {
  return new Promise((resolve) => {
    const card = show(`
      <div class="ovl-stack">
        <div class="ovl-card box-card">
          <p class="ovl-kicker">Rewards box</p>
          <div class="box-art ${ready ? 'ready' : ''}">${icons.gift(64)}</div>
          <h2 class="ovl-h">${ready ? 'Your box is ready' : `Next box in ${waitText}`}</h2>
          <p class="ovl-sub">${ready
            ? 'Grows as you level up'
            : `New box every 4h${adOffer ? ` · ad opens it now (${adsLeft} left today)` : ''}`}</p>
          ${ready ? '<button class="ovl-btn primary" data-pick="open">Open it</button>' : ''}
          ${!ready && adOffer
            ? '<button class="ovl-btn primary" data-pick="ad">Watch an ad &middot; open now</button>'
            : ''}
          <button class="ovl-btn ghost" data-pick="close">${ready ? 'Later' : 'Close'}</button>
        </div>
      </div>`, 'menu');
    card.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-pick]');
      if (!b) return;
      await dismiss(card);
      resolve(b.dataset.pick);
    });
  });
}
