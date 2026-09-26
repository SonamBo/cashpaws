/**
 * The one card that is Money Sort's own: the board has jammed, and the player
 * chooses between a Sort and dropping a level. Built on the shell's card
 * primitives, with the worn cat from host.art, so it matches every other card.
 */

import { money } from './board.js';

const ICON_SORT = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4 6.5h13"/><path d="M4 12h9"/><path d="M4 17.5h5"/><path d="M18 10v10"/><path d="M15 17l3 3 3-3"/></svg>`;

const ICON_AD = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5Z"/></svg>`;

/**
 * Resolves 'sort', 'ad' or 'drop'. Sort is offered only when it can change
 * anything. `adOffer` adds a free Sort for watching an ad — only shown to a
 * player who cannot afford one, and only once an ad is actually available.
 */
export function stuckCard(host, e, vm, sortCost, adOffer = false) {
  return new Promise((resolve) => {
    const lead = e.nothingLeft
      ? 'Every move just slides chips about, and the board is too full for the flow to land. '
      : '';
    const reason = lead + (!vm.sortCanHelp
      ? 'Every tube already holds a single value, so sorting would change nothing.'
      : !vm.canAffordSort
        ? `A sort costs ${sortCost} coins. You have ${host.wallet.coins}.`
          + (adOffer ? ' Watch a short ad and this one is free.' : '')
        : vm.freeSorts > 0
          ? 'Your first Sort is free. It gathers every value into its own tube, and complete sets bank.'
          : 'A sort gathers every value into its own tube, and complete sets bank.');

    const card = host.cards.show(`
      <div class="ovl-stack">
        ${host.art.cat('slump', 210, 'cat-lying')}
        <div class="ovl-card">
          <p class="ovl-kicker">Board stuck</p>
          <h2 class="ovl-h">${e.nothingLeft ? 'Nothing left to do' : 'No legal moves left'}</h2>
          <p class="ovl-sub">${reason}</p>
          <div class="ovl-stat">
            <span>Level ${String(vm.level).padStart(2, '0')}</span>
            <b>${money(vm.netWorth)}</b>
          </div>
          ${e.canSort
            ? `<button class="ovl-btn primary" data-do-sort>
                 ${ICON_SORT} Sort
                 <span class="ovl-cost">${sortCost === 'Free' ? '' : host.art.coin(16)}${sortCost}</span>
               </button>`
            : ''}
          ${adOffer
            ? `<button class="ovl-btn primary" data-ad-sort>${ICON_AD} Watch an ad &middot; free Sort</button>`
            : ''}
          <button class="ovl-btn ${e.canSort || adOffer ? 'ghost' : 'primary'}" data-drop>Drop a level</button>
        </div>
      </div>`, 'locked');

    const pick = async (choice) => { await host.cards.dismiss(card); resolve(choice); };
    card.querySelector('[data-do-sort]')?.addEventListener('click', () => pick('sort'));
    card.querySelector('[data-ad-sort]')?.addEventListener('click', () => pick('ad'));
    card.querySelector('[data-drop]').addEventListener('click', () => pick('drop'));
  });
}
