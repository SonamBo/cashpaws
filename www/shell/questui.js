/**
 * Bell Quest's screens: the lobby icon's art and the cards. The rules live in
 * quest.js; main.js decides when each card appears.
 *
 * Art: img/quest-*.png, made in Gemini from docs/BELL-QUEST-ART-PROMPTS.md
 * and cleaned up by tools/process-quest-art.py. The rival cats are the
 * roster's own faces.
 */

import { cat, catFace, coinIcon, icons } from './art.js';
import { asset } from './assets.js';
import { show, dismiss, wait } from './overlays.js';
import { catsLeft, formatLeft, RIVALS } from './quest.js';

const RIVAL_FACES = ['mittens', 'marmalade', 'pepper', 'biscuit', 'patch'];
const fmt = (n) => Number(n).toLocaleString('en-US');

/** A cat's collar bell. `size` is its width; it is a touch taller than wide. */
export const bell = (size = 40) =>
  `<img class="art bell-art" src="${asset('img/quest-bell.png')}" width="${size}" alt="" draggable="false">`;

/** The grand prize: a heap of coins under the bell, and its sign. */
function prizePile(grand, size = 150) {
  return `
<div class="q-prize" style="width:${size}px">
  <img class="art" src="${asset('img/quest-prize.png')}" width="${size}" alt="" draggable="false">
  ${grand ? `<div class="q-sign">${coinIcon(14)}<b>${fmt(grand)}</b></div>` : ''}
</div>`;
}

const STONE = { start: 'ahead', done: 'done', here: 'here', '': 'ahead' };
const stone = (s) => `<img class="q-stone ${s.cls}" style="left:${s.x}%;top:${s.y}%"
  src="${asset(`img/quest-stone-${STONE[s.cls]}.png`)}" alt="" draggable="false">`;

const face = (i, w = 30) =>
  `<span class="q-face" style="--i:${i}">${cat('face', w, 'cat-avatar', RIVAL_FACES[i % RIVAL_FACES.length])}</span>`;
const faces = (n, w = 30) => Array.from({ length: n }, (_, i) => face(i, w)).join('');

function card(html, pickSel = '[data-pick]') {
  return new Promise((resolve) => {
    const el = show(html, 'quest');
    el.addEventListener('click', async (ev) => {
      const b = ev.target.closest(pickSel);
      if (!b) return;
      await dismiss(el);
      resolve(b.dataset.pick);
    });
  });
}

const head = (sub) => `
  <div class="q-head">
    <span class="q-head-bell">${bell(34)}</span>
    <h2 class="q-title">Bell Quest</h2>
    <button class="q-close" data-pick="close" aria-label="Close">${icons.close(18)}</button>
  </div>
  ${sub ? `<p class="q-lead">${sub}</p>` : ''}`;

/** A new quest on offer. Resolves 'start' or 'close'. */
export function introCard({ grand, steps, hours }) {
  return card(`
    <div class="q-card">
      ${head('')}
      <div class="q-hero">
        ${prizePile(grand, 170)}
        ${cat('cheer', 150, 'q-hero-cat')}
      </div>
      <p class="q-kicker">Grand prize</p>
      <p class="q-lead"><b>Beat ${steps} levels in a row</b> without dropping one.
        Every cat who makes it shares the prize.</p>
      <p class="q-timer">${icons.daily(14)} ${hours} hours</p>
      <button class="ovl-btn primary" data-pick="start">Start</button>
    </div>`);
}

/** The field fills up: a counter and a growing heap of faces. Resolves on tap. */
export async function findingCard({ grand }) {
  const el = show(`
    <div class="q-card q-finding" data-pick="go">
      <p class="q-kicker">Bell Quest</p>
      ${prizePile(grand, 170)}
      <p class="q-lead">Rounding up cats on your level</p>
      <p class="q-count"><b data-n>1</b>/${RIVALS + 1}</p>
      <div class="q-heap" data-heap></div>
      <p class="q-tap" data-tap hidden>Tap to continue</p>
    </div>`, 'quest');
  const n = el.querySelector('[data-n]');
  const heap = el.querySelector('[data-heap]');
  const total = RIVALS + 1;
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 1500);
      const v = Math.max(1, Math.round(total * (1 - (1 - k) ** 2)));
      n.textContent = v;
      const want = Math.min(14, Math.ceil(v / 7));
      while (heap.children.length < want) heap.insertAdjacentHTML('beforeend', face(heap.children.length, 34));
      if (k < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
  el.querySelector('[data-tap]').hidden = false;
  await new Promise((resolve) => el.addEventListener('click', resolve, { once: true }));
  await dismiss(el);
}

/**
 * Where you are: two counters, the timer, and the path to the prize. `first`
 * adds the three rules, once, the first time a player sees a quest.
 * Resolves 'play' or 'close'.
 */
export function pathCard({ q, now, first = false, advanced = false }) {
  const steps = q.steps;
  const left = catsLeft(q);
  const stones = [];
  for (let i = 0; i <= steps; i++) {
    const y = 93 - (i * 58) / steps;                 // bottom (start) to top (just under the prize)
    const x = i === 0 ? 50 : (i % 2 ? 30 : 70);
    const cls = i === 0 ? 'start' : i < q.step ? 'done' : i === q.step ? 'here' : '';
    stones.push({ x, y, cls, i });
  }
  const here = stones[q.step];
  const lead = advanced && q.step > 0 ? 'You made it to the next step!' : `Beat ${steps} levels in a row. Don't drop one.`;
  return card(`
    <div class="q-card q-path-card">
      ${head(lead)}
      <div class="q-stats">
        <div><span>Levels</span><b>${q.step}/${steps}</b></div>
        <div><span>Cats</span><b>${left}/${RIVALS + 1}</b></div>
      </div>
      <p class="q-timer">${icons.daily(14)} ${formatLeft(q.endsAt - now)} left</p>
      <div class="q-path">
        <div class="q-path-prize">${prizePile(q.grand, 104)}</div>
        ${stones.map(stone).join('')}
        <div class="q-me" style="left:${here.x}%;top:${here.y}%">
          ${catFace(40)}
          ${left > 1 ? `<span class="q-with">+${left - 1}</span>` : ''}
        </div>
      </div>
      ${first ? `<ul class="q-rules">
        <li>${RIVALS + 1} cats start the quest</li>
        <li>Use a Sort when stuck. Dropping a level knocks you out.</li>
        <li>The prize is shared equally by every cat who finishes</li>
      </ul>` : ''}
      <button class="ovl-btn primary" data-pick="play">${icons.play(18)} Play</button>
    </div>`);
}

/** Finished. Resolves when the prize is claimed. */
export function wonCard({ share, grand, others }) {
  return card(`
    <div class="q-card q-won">
      <p class="q-kicker">Bell Quest complete</p>
      ${prizePile(grand, 190)}
      <p class="ovl-figure q-share">${coinIcon(28)} +${fmt(share)}</p>
      <p class="q-lead">${others
        ? `You share the prize with ${others} other cat${others === 1 ? '' : 's'}.`
        : 'No other cat made it. <b>The whole prize is yours!</b>'}</p>
      ${others ? `<div class="q-row">${faces(Math.min(others, 8), 30)}</div>` : ''}
      <button class="ovl-btn primary" data-pick="claim">Claim</button>
    </div>`);
}

/** Knocked out or out of time. Resolves 'again' or 'close'. */
export function overCard({ reason, step, steps, left }) {
  const expired = reason === 'expired';
  return card(`
    <div class="q-card q-over">
      ${head('')}
      ${cat('slump', 170, 'q-over-cat')}
      <h3 class="ovl-h">${expired ? 'Time ran out' : 'Knocked out'}</h3>
      <p class="q-lead">${expired
        ? `You reached step ${step} of ${steps} before the time ran out.`
        : `You dropped a level on step ${step + 1} of ${steps}. ${left - 1} cats are still going.`}</p>
      <button class="ovl-btn primary" data-pick="again">Start a new quest</button>
      <button class="ovl-btn ghost" data-pick="close">Later</button>
    </div>`);
}

export { wait };
