/**
 * Full-bleed overlay cards. Each returns a promise: timed cards resolve
 * themselves, the stuck-board card resolves with the player's choice.
 */

import { catCheer, catSad, coinIcon, icons } from './art.js';
import { money } from './render.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CHARACTER = {
  familiar: 'Values already on your board.',
  wide: 'Anything from this level.',
  junk: 'Junk 5s in the mix now.',
};

let host = null;
export function mountOverlays(root) {
  host = document.createElement('div');
  host.className = 'overlays';
  root.appendChild(host);
}

function show(html, tone) {
  const card = document.createElement('div');
  card.className = `ovl ovl-${tone}`;
  card.innerHTML = html;
  host.appendChild(card);
  requestAnimationFrame(() => card.classList.add('in'));
  return card;
}

async function dismiss(card) {
  card.classList.remove('in');
  await wait(220);
  card.remove();
}

/** Orange. The flow landing. Auto-dismisses. */
export async function inflowCard(e) {
  const card = show(`
    <div class="ovl-body">
      <p class="ovl-kicker">Flow drop ${e.drop}</p>
      <p class="ovl-huge">+${e.count}</p>
      <p class="ovl-line">${CHARACTER[e.character]}</p>
      <p class="ovl-foot">Next drop every ${e.interval} turns</p>
    </div>`, 'flow');

  // A fixed hold is wrong for everyone: too quick the first time, too slow the
  // fiftieth. Hold for a beat, then let a tap skip the rest.
  await new Promise((resolve) => {
    const done = () => { clearTimeout(timer); card.removeEventListener('click', done); resolve(); };
    const timer = setTimeout(done, 1000);
    setTimeout(() => card.addEventListener('click', done), 220);
  });
  await dismiss(card);
}

/** Sage. A new level. Waits for the button. */
export function milestoneCard(e) {
  return new Promise((resolve) => {
    const gains = [];
    if (e.gainedColumn) gains.push(`<li>${icons.check ? '' : ''}+1 column &middot; now ${e.columns}</li>`);
    if (e.poolGrew) gains.push('<li>A bigger chip joins the pool</li>');
    gains.push(`<li>+${e.coins} coins</li>`);

    const card = show(`
      <div class="ovl-stack">
        ${catCheer()}
        <div class="ovl-card">
          <p class="ovl-kicker">Level up</p>
          <h2 class="ovl-h">Level ${String(e.level).padStart(2, '0')} unlocked</h2>
          <p class="ovl-figure">${money(e.netWorth)}</p>
          <ul class="ovl-gains">${gains.join('')}</ul>
          <button class="ovl-btn primary" data-go>Keep going</button>
        </div>
      </div>`, 'milestone');

    card.querySelector('[data-go]').addEventListener('click', async () => {
      await dismiss(card);
      resolve();
    });
  });
}

/**
 * Taupe. No legal move left. Resolves 'shuffle' or 'drop'.
 * Shuffle is only offered when it could actually change anything.
 */
export function lockedCard(e, vm, shuffleCost) {
  return new Promise((resolve) => {
    const reason = !vm.shuffleCanHelp
      ? 'Every column is full, so a shuffle would change nothing.'
      : !vm.canAffordShuffle
        ? `A shuffle costs ${shuffleCost} coins. You have ${vm.coins}.`
        : 'A shuffle redeals every chip on the board.';

    const card = show(`
      <div class="ovl-stack">
        ${catSad(210)}
        <div class="ovl-card">
        <p class="ovl-kicker">Board stuck</p>
        <h2 class="ovl-h">No legal moves left</h2>
        <p class="ovl-sub">${reason}</p>
        <div class="ovl-stat">
          <span>Level ${String(vm.level).padStart(2, '0')}</span>
          <b>${money(vm.netWorth)}</b>
        </div>
        ${e.canShuffle
          ? `<button class="ovl-btn primary" data-do-shuffle>
               ${icons.shuffle(18)} Shuffle
               <span class="ovl-cost">${coinIcon(16)}${shuffleCost}</span>
             </button>`
          : ''}
        <button class="ovl-btn ${e.canShuffle ? 'ghost' : 'primary'}" data-drop>
          Drop a level
        </button>
        </div>
      </div>`, 'locked');

    const pick = async (choice) => { await dismiss(card); resolve(choice); };
    card.querySelector('[data-do-shuffle]')?.addEventListener('click', () => pick('shuffle'));
    card.querySelector('[data-drop]').addEventListener('click', () => pick('drop'));
  });
}

/** Taupe. The level is gone. Waits for the button. */
export function levelLostCard(e) {
  return new Promise((resolve) => {
    const card = show(`
      <div class="ovl-stack">
        ${catSad(210)}
        <div class="ovl-card">
          <p class="ovl-kicker">Level lost</p>
          <h2 class="ovl-h">Back to level ${String(e.to).padStart(2, '0')}</h2>
          <p class="ovl-figure">${money(e.netWorth)}</p>
          <p class="ovl-sub">A fresh board of ${e.columns} columns.</p>
          <button class="ovl-btn primary" data-go>Try again</button>
        </div>
      </div>`, 'locked');
    card.querySelector('[data-go]').addEventListener('click', async () => {
      await dismiss(card);
      resolve();
    });
  });
}

export { wait };

/** Generic two-button sheet. Resolves true on confirm, false on cancel. */
export function confirmCard({ kicker, title, line, ok, cancel = 'Back' }) {
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
 * Pause menu. With no bottom nav on the board, this is the way into the
 * other screens. Resolves the chosen destination, or 'resume'.
 */
export function menuCard() {
  return new Promise((resolve) => {
    const card = show(`
      <div class="ovl-stack">
        <div class="ovl-card">
          <p class="ovl-kicker">Paused</p>
          <h2 class="ovl-h">Cash Paws</h2>
          <div class="menu">
            <button class="primary" data-pick="resume">${icons.play(20)}<span>Resume</span></button>
            <button data-pick="progress">${icons.bars(20)}<span>Progress</span></button>
            <button data-pick="cats">${icons.cat(20)}<span>Cats</span></button>
            <button data-pick="shop">${icons.shop(20)}<span>Shop</span></button>
            <button data-pick="restart">${icons.undo(20)}<span>Restart board</span></button>
            <button data-pick="lobby">${icons.home(20)}<span>Back to lobby</span></button>
          </div>
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
