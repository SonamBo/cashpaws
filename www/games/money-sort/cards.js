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
 * Resolves 'sort', 'buy', 'ad' or 'drop'. Sort is offered only when it can
 * change anything. A player who can't afford it is offered, in this order,
 * coin packs (`buyOffer`, where the build sells them) and a free Sort for
 * watching an ad (`adOffer`, once an ad is actually available).
 */
export function stuckCard(host, e, vm, sortCost, adOffer = false, buyOffer = false) {
  return new Promise((resolve) => {
    const reason = !vm.sortCanHelp ? 'Sorting won\'t help'
      : !vm.canAffordSort ? 'Not enough coins'
        : vm.freeSorts > 0 ? (vm.level > 1 ? 'This Sort is free' : 'First Sort is free') : 'Sort groups every value';

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
          ${buyOffer
            ? `<button class="ovl-btn primary" data-buy-coins>${host.art.coin(18)} Get coins</button>`
            : ''}
          ${adOffer
            ? `<button class="ovl-btn ${buyOffer ? 'alt' : 'primary'}" data-ad-sort>${ICON_AD} Watch an ad &middot; free Sort</button>`
            : ''}
          <button class="ovl-btn ${e.canSort || adOffer || buyOffer ? 'ghost' : 'primary'}" data-drop>Drop a level</button>
        </div>
      </div>`, 'locked');

    const pick = async (choice) => { await host.cards.dismiss(card); resolve(choice); };
    const body = card.querySelector('.ovl-card');
    const original = body.innerHTML;

    // One listener for both faces of the card, so swapping content never
    // leaves a button without one.
    card.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.matches('[data-do-sort]')) pick('sort');
      else if (b.matches('[data-ad-sort]')) pick('ad');
      else if (b.matches('[data-buy-coins]')) pick('buy');
      else if (b.matches('[data-drop]')) {
        // Dropping would cost something running, such as Bell Quest: say so in
        // this same card, and let the player take it back.
        const w = host.levelLossWarning?.();
        if (!w) { pick('drop'); return; }
        warning = w;
        body.innerHTML = warningHtml(host, w);
      } else if (b.matches('[data-drop-anyway]')) { warning.answer(true); pick('drop'); }
      else if (b.matches('[data-keep]')) { warning.answer(false); body.innerHTML = original; }
    });
    let warning = null;
  });
}

function warningHtml(host, w) {
  return `
    <p class="ovl-kicker">${w.kicker}</p>
    <h2 class="ovl-h">${w.title}</h2>
    <p class="ovl-sub">${w.line}</p>
    ${w.stat ? `<div class="ovl-stat"><span>${w.stat.label}</span><b>${w.stat.value}</b></div>` : ''}
    <button class="ovl-btn primary" data-keep>${w.cancel}</button>
    <button class="ovl-btn ghost" data-drop-anyway>${w.ok}</button>`;
}
