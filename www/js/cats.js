/**
 * The cat roster: what each one looks like, how you unlock it, and what it
 * changes about the game.
 *
 * One cat is worn at a time, so a perk is a choice rather than something that
 * accumulates. Each bends a different lever — undo price, warning time, flow
 * floor, coin rate, sort price — so no cat is strictly better than another.
 * That is a claim worth re-checking with test/perks.js whenever a perk moves.
 *
 * Art lives at img/cat-{id}-{pose}.png for poses peek, cheer, slump and face.
 * A cat with `hasArt: false` draws Patch instead — that way a cat with no
 * artwork yet still plays, without a burst of 404s on every screen. Drop the
 * four files in, flip the flag, and it appears.
 */

export const FALLBACK_CAT = 'patch';
export const POSES = ['peek', 'cheer', 'slump', 'face'];

export const CATS = [
  {
    id: 'patch',
    hasArt: true,
    name: 'Patch',
    price: 0,
    note: 'The one who got you started.',
    perkText: 'No tricks. The game as designed.',
    unlock: null,
    perk: {},
  },
  {
    id: 'mittens',
    hasArt: true,
    name: 'Mittens',
    price: 300,
    note: 'Quick paws, quicker regrets.',
    perkText: 'Undo costs 10 instead of 20.',
    unlock: { stat: 'banks', need: 25, label: 'Bank 25 tubes' },
    perk: { undoCost: 10 },
  },
  {
    id: 'soot',
    hasArt: false,   // flip to true once cat-soot-*.png are in www/img
    name: 'Soot',
    price: 600,
    note: 'Hears the flow coming.',
    perkText: 'The board warns you three turns ahead instead of two.',
    unlock: { stat: 'drops', need: 15, label: 'Survive 15 flow drops' },
    perk: { telegraphTurns: 3 },
  },
  {
    id: 'marmalade',
    hasArt: true,
    name: 'Marmalade',
    price: 1000,
    note: 'Unhurried, on principle.',
    perkText: 'The flow never speeds past one drop every 5 turns.',
    unlock: { stat: 'bestLevel', need: 4, label: 'Reach level 4' },
    perk: { minFlowInterval: 5 },
  },
  {
    id: 'pepper',
    hasArt: true,
    name: 'Pepper',
    price: 1600,
    note: 'Counts everything twice.',
    perkText: 'Banking a tube pays 14 coins instead of 10.',
    unlock: { stat: 'banks', need: 100, label: 'Bank 100 tubes' },
    perk: { coinsPerBank: 14 },
  },
  {
    id: 'biscuit',
    hasArt: true,
    name: 'Biscuit',
    price: 2400,
    note: 'Tidies without being asked.',
    perkText: 'Sort costs 100 instead of 150.',
    unlock: { stat: 'bestLevel', need: 6, label: 'Reach level 6' },
    perk: { sortCost: 100 },
  },
];

export const catById = (id) => CATS.find((c) => c.id === id) || CATS[0];

/** Config overrides for the worn cat. */
export const perkFor = (id) => catById(id).perk || {};

/** How far along an unlock is. Patch has none, so it is always revealed. */
export function unlockProgress(cat, stats) {
  if (!cat.unlock) return { revealed: true, have: 0, need: 0 };
  const have = stats[cat.unlock.stat] || 0;
  return { revealed: have >= cat.unlock.need, have, need: cat.unlock.need };
}

/**
 * Art path for a cat and pose. `owned` art may not exist yet; the caller adds
 * an onerror fallback so a missing file quietly shows Patch instead.
 */
export const catArt = (id, pose) => `img/cat-${id}-${pose}.png`;
export const catArtFallback = (pose) => `img/cat-${FALLBACK_CAT}-${pose}.png`;
