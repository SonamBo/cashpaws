/**
 * Shell artwork: the cats, the coin, and the interface icons.
 *
 * A game never reaches in here. It asks for the worn cat through host.art,
 * which is why a replacement game gets the player's chosen cat for free.
 */

import { catById } from './cats.js';
import { asset } from './assets.js';

const img = (path, w, cls = '', alt = '') =>
  `<img class="art ${cls}" src="${asset(path)}" width="${w}" alt="${alt}" draggable="false">`;

let worn = 'patch';
export const setWornCat = (id) => { worn = id || 'patch'; };
export const wornCat = () => worn;

/** A cat in a pose: peek, cheer, slump or face. Falls back to Patch without art. */
export function cat(pose, w, cls = '', want = worn) {
  const id = catById(want).hasArt ? want : 'patch';
  return img(`img/cat-${id}-${pose}.png`, w, cls);
}

export const catFace = (w = 36, id) => cat('face', w, 'cat-avatar', id);
export const catHero = (w = 252) => img('img/cat-hero.png', w, 'lobby-hero');
export const coinIcon = (s = 22) => img('img/coin.png', s, 'coin-art');
export const logo = (w = 222) => img('img/logo.png', w, 'logo', 'Cash Paws');
export const tagline = (w = 190) => img('img/tagline.png', w, 'tagline', '');

const stroke = (d, size = 22) => `
<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
     stroke="currentColor" stroke-width="2.1" stroke-linecap="round"
     stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const icons = {
  lock:     (s) => stroke('<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>', s),
  external: (s) => stroke('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', s),
  pause:    (s) => stroke('<path d="M9.5 5v14"/><path d="M14.5 5v14"/>', s),
  play:     (s) => stroke('<path d="M7 4.8 19 12 7 19.2Z"/>', s),
  undo:     (s) => stroke('<path d="M4.6 12a7.4 7.4 0 1 1 2.6 5.6"/><path d="M4.4 5.2v5.1h5.1"/>', s),
  restart:  (s) => stroke('<path d="M4.6 12a7.4 7.4 0 1 1 2.6 5.6"/><path d="M4.4 5.2v5.1h5.1"/>', s),
  check:    (s) => stroke('<path d="M4 12.5 9.5 18 20 6.5"/>', s),
  close:    (s) => stroke('<path d="M6 6l12 12"/><path d="M18 6 6 18"/>', s),
  gear:     (s) => stroke('<circle cx="12" cy="12" r="3.1"/><path d="M18.9 14.2a1.6 1.6 0 0 0 .32 1.77l.06.06a1.94 1.94 0 1 1-2.74 2.74l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.46v.17a1.94 1.94 0 0 1-3.88 0v-.09a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a1.94 1.94 0 1 1-2.74-2.74l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.46-.97H2.9a1.94 1.94 0 0 1 0-3.88h.09a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.94 1.94 0 1 1 2.74-2.74l.06.06a1.6 1.6 0 0 0 1.77.32h.08a1.6 1.6 0 0 0 .97-1.46V2.9a1.94 1.94 0 0 1 3.88 0v.09a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.94 1.94 0 1 1 2.74 2.74l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.46.97h.17a1.94 1.94 0 0 1 0 3.88h-.09a1.6 1.6 0 0 0-1.46.97Z"/>', s),
  home:     (s) => stroke('<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/>', s),
  cat:      (s) => stroke('<path d="M4 6.5 5 2.5l4.5 3"/><path d="M20 6.5 19 2.5l-4.5 3"/><path d="M4 6.5v6a8 8 0 0 0 16 0v-6"/><path d="M9.5 12h.01"/><path d="M14.5 12h.01"/><path d="M10.5 15.5q1.5 1.4 3 0"/>', s),
  bars:     (s) => stroke('<path d="M5 20V11"/><path d="M12 20V4"/><path d="M19 20v-6"/>', s),
  shop:     (s) => stroke('<path d="M3.5 8h17l-1 3.2a3 3 0 0 1-5.6.4 3 3 0 0 1-5.8 0 3 3 0 0 1-5.6-.4Z"/><path d="M4.5 4.5h15"/><path d="M5 12.5V20h14v-7.5"/>', s),
  daily:    (s) => stroke('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="m9 15 2 2 4-4"/>', s),
  gift:     (s) => stroke('<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20h14v-7.5"/><path d="M12 8.5V20"/><path d="M12 8.5C10 4 6.5 5 8 7.4 9 8.5 12 8.5 12 8.5Z"/><path d="M12 8.5c2-4.5 5.5-3.5 4-1.1-1 1.1-4 1.1-4 1.1Z"/>', s),
};
