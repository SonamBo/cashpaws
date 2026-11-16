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
import { tr, num } from './i18n.js';

const RIVAL_FACES = ['mittens', 'marmalade', 'pepper', 'biscuit', 'patch'];
const fmt = num;

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

function card(html, after = null, pickSel = '[data-pick]') {
  return new Promise((resolve) => {
    const el = show(html, 'quest');
    after?.(el);
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
    <h2 class="q-title">${tr('quest.name')}</h2>
    <button class="q-close" data-pick="close" aria-label="${tr('close')}">${icons.close(18)}</button>
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
      <p class="q-kicker">${tr('quest.grand')}</p>
      <p class="q-lead">${tr('quest.intro', { n: steps })}</p>
      <p class="q-timer">${icons.daily(14)} ${tr('quest.hours', { n: hours })}</p>
      <button class="ovl-btn primary" data-pick="start">${tr('quest.start')}</button>
    </div>`);
}

/** The field fills up: a counter and a growing heap of faces. Resolves on tap. */
export async function findingCard({ grand }) {
  const el = show(`
    <div class="q-card q-finding" data-pick="go">
      <p class="q-kicker">${tr('quest.name')}</p>
      ${prizePile(grand, 170)}
      <p class="q-lead">${tr('quest.finding')}</p>
      <p class="q-count"><b data-n>1</b>/${RIVALS + 1}</p>
      <div class="q-heap" data-heap></div>
      <p class="q-tap" data-tap hidden>${tr('quest.tap')}</p>
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
export function pathCard({ q, now, first = false, advanced = false, from = null, inGame = false }) {
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
  // Arriving from an earlier stone: start there, then hop (CSS eases the move).
  const start = from !== null && from < q.step ? stones[Math.max(0, from)] : here;
  const lead = advanced && q.step > 0 ? tr('quest.nextStep') : tr('quest.inARow', { n: steps });
  return card(`
    <div class="q-card q-path-card">
      ${head(lead)}
      <div class="q-stats">
        <div><span>${tr('quest.levels')}</span><b>${q.step}/${steps}</b></div>
        <div><span>${tr('quest.cats')}</span><b>${left}/${RIVALS + 1}</b></div>
      </div>
      <p class="q-timer">${icons.daily(14)} ${tr('quest.left', { time: formatLeft(q.endsAt - now) })}</p>
      <div class="q-path">
        <div class="q-path-prize">${prizePile(q.grand, 104)}</div>
        ${stones.map(stone).join('')}
        <div class="q-me" data-me style="left:${start.x}%;top:${start.y}%" data-to="${here.x},${here.y}">
          ${catFace(40)}
          ${left > 1 ? `<span class="q-with">+${left - 1}</span>` : ''}
        </div>
      </div>
      ${first ? `<ul class="q-rules">
        <li>${tr('quest.rule.start', { n: RIVALS + 1 })}</li>
        <li>${tr('quest.rule.out')}</li>
        <li>${tr('quest.rule.split')}</li>
      </ul>` : ''}
      <button class="ovl-btn primary" data-pick="play">${icons.play(18)} ${inGame ? tr('continue') : tr('play')}</button>
    </div>`, hop);
}

/** Move your cat to its new stone once the card is up. */
function hop(el) {
  const me = el.querySelector('[data-me]');
  if (!me) return;
  const [x, y] = me.dataset.to.split(',');
  setTimeout(() => { me.style.left = `${x}%`; me.style.top = `${y}%`; }, 450);
}

/** Finished. Resolves when the prize is claimed. */
export function wonCard({ share, grand, others }) {
  return card(`
    <div class="q-card q-won">
      <p class="q-kicker">${tr('quest.complete')}</p>
      ${prizePile(grand, 190)}
      <p class="ovl-figure q-share">${coinIcon(28)} +${fmt(share)}</p>
      <p class="q-lead">${others
        ? tr('quest.sharedWith', { n: others })
        : `<b>${tr('quest.allYours')}</b>`}</p>
      ${others ? `<div class="q-row">${faces(Math.min(others, 8), 30)}</div>` : ''}
      <button class="ovl-btn primary" data-pick="claim">${tr('claim')}</button>
    </div>`);
}

/** Knocked out or out of time. Resolves 'again' or 'close'. */
export function overCard({ reason, step, steps, left }) {
  const expired = reason === 'expired';
  return card(`
    <div class="q-card q-over">
      ${head('')}
      ${cat('slump', 170, 'q-over-cat')}
      <h3 class="ovl-h">${expired ? tr('quest.timeUp') : tr('quest.knockedOut')}</h3>
      <p class="q-lead">${expired
        ? tr('quest.reached', { step, steps })
        : tr('quest.outOn', { step: step + 1, steps })}</p>
      <button class="ovl-btn primary" data-pick="again">${tr('quest.new')}</button>
      <button class="ovl-btn ghost" data-pick="close">${tr('later')}</button>
    </div>`);
}

export { wait };
