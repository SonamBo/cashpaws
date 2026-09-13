/**
 * Artwork.
 *
 * The cats are cut out of the source artwork rather than redrawn. Each cat has
 * four poses at img/cat-{id}-{pose}.png: peek, cheer, slump, face. Which cat is
 * drawn follows the one being worn; see cats.js.
 *
 * Source art is roughly 1x for a 402pt screen, so it is displayed at or below
 * native size everywhere. See PROGRESS.md for what that costs on a 3x phone.
 *
 * Icons stay as SVG: they are interface, not illustration, and need to inherit
 * colour and stay crisp at any size.
 */

import { catById } from './cats.js';

const IMG = 'img/';
const art = (file, w, cls = '') =>
  `<img class="art ${cls}" src="${IMG}${file}.png" width="${w}" alt="" draggable="false">`;

/* Which cat the art functions should draw. Set by the controller. */
let worn = 'patch';
export const setWornCat = (id) => { worn = id || 'patch'; };
export const wornCat = () => worn;

/**
 * A cat in a given pose. If that cat's file is missing — art for the newer
 * cats may not exist yet — the image quietly falls back to Patch rather than
 * showing a broken icon.
 */
const catPose = (pose, w, cls, want = worn) => {
  const id = catById(want).hasArt ? want : 'patch';
  return `<img class="art ${cls}" src="${IMG}cat-${id}-${pose}.png" width="${w}" alt=""
        draggable="false" onerror="this.onerror=null;this.src='${IMG}cat-patch-${pose}.png'">`;
};

/** The hero's head, for the header. */
export const catAvatar = (w = 36, id) => catPose('face', w, 'cat-avatar', id);
/** The face that rides the progress bar. */
export const knobCat = (w = 34, id) => catPose('face', w, 'knob-cat', id);
/** Rear view, sitting at the bottom of the board. */
export const catPeek = (w = 104) => art('cat-peek', w, 'cat-peek');
/** Slumped. Stuck-board and level-lost cards. */
export const catSad = (w = 200, id) => catPose('slump', w, 'cat-lying', id);
/** With the money pile. Reserved for the lobby screen. */
export const catHero = (w = 260) => art('cat-hero', w, 'cat-hero');
/** Paws up over the card. Full-width banner, sage ground baked in. */
export const catCheer = (w = 200, id) => catPose('cheer', w, 'ovl-cheer', id);
/** The peeking cat and heart, cut from the reference screen. */
export const refCat = (w = 150, id) => catPose('peek', w, 'corner-cat', id);
export const refHeart = (w = 26) => art('ref-heart', w, 'corner-heart');

/** The paw coin from the balance pill. */
export const coinIcon = (s = 22) => art('coin', s, 'coin-art');

const stroke = (d, size = 22) => `
<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
     stroke="currentColor" stroke-width="2.1" stroke-linecap="round"
     stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const icons = {
  pause:   (s) => stroke('<path d="M9.5 5v14"/><path d="M14.5 5v14"/>', s),
  play:    (s) => stroke('<path d="M7 4.8 19 12 7 19.2Z"/>', s),
  undo:    (s) => stroke('<path d="M4.6 12a7.4 7.4 0 1 1 2.6 5.6"/><path d="M4.4 5.2v5.1h5.1"/>', s),
  sort:    (s) => stroke('<path d="M4 6.5h13"/><path d="M4 12h9"/><path d="M4 17.5h5"/><path d="M18 10v10"/><path d="M15 17l3 3 3-3"/>', s),
  shuffle: (s) => stroke('<path d="M3 6.5h3.6a4 4 0 0 1 3.3 1.8l4.2 6.4a4 4 0 0 0 3.3 1.8H21"/><path d="M3 17.5h3.6a4 4 0 0 0 3.3-1.8l4.2-6.4a4 4 0 0 1 3.3-1.8H21"/><path d="M18.2 4.2 21 7l-2.8 2.8"/><path d="M18.2 14.7 21 17.5l-2.8 2.8"/>', s),
  gear:    (s) => stroke('<circle cx="12" cy="12" r="3.1"/><path d="M18.9 14.2a1.6 1.6 0 0 0 .32 1.77l.06.06a1.94 1.94 0 1 1-2.74 2.74l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.46v.17a1.94 1.94 0 0 1-3.88 0v-.09a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a1.94 1.94 0 1 1-2.74-2.74l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.46-.97H2.9a1.94 1.94 0 0 1 0-3.88h.09a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.94 1.94 0 1 1 2.74-2.74l.06.06a1.6 1.6 0 0 0 1.77.32h.08a1.6 1.6 0 0 0 .97-1.46V2.9a1.94 1.94 0 0 1 3.88 0v.09a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.94 1.94 0 1 1 2.74 2.74l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.46.97h.17a1.94 1.94 0 0 1 0 3.88h-.09a1.6 1.6 0 0 0-1.46.97Z"/>', s),
  home:    (s) => stroke('<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/>', s),
  cat:     (s) => stroke('<path d="M4 6.5 5 2.5l4.5 3"/><path d="M20 6.5 19 2.5l-4.5 3"/><path d="M4 6.5v6a8 8 0 0 0 16 0v-6"/><path d="M9.5 12h.01"/><path d="M14.5 12h.01"/><path d="M10.5 15.5q1.5 1.4 3 0"/>', s),
  bars:    (s) => stroke('<path d="M5 20V11"/><path d="M12 20V4"/><path d="M19 20v-6"/>', s),
  shop:    (s) => stroke('<path d="M3.5 8h17l-1 3.2a3 3 0 0 1-5.6.4 3 3 0 0 1-5.8 0 3 3 0 0 1-5.6-.4Z"/><path d="M4.5 4.5h15"/><path d="M5 12.5V20h14v-7.5"/>', s),
};

export const pauseIcon = (s) => stroke('<path d="M9.5 5v14"/><path d="M14.5 5v14"/>', s);

export const moreIcons = {
  check: (s) => stroke('<path d="M4 12.5 9.5 18 20 6.5"/>', s),
  lock:  (s) => stroke('<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>', s),
  close: (s) => stroke('<path d="M6 6l12 12"/><path d="M18 6 6 18"/>', s),
};
