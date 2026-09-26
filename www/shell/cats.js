/**
 * The cat roster: who they are, what they look like, and how you earn them.
 *
 * What a cat *does* is not here. That depends on the game being played, so each
 * game declares its own perks, keyed by these ids. A cat with no perk in the
 * current game is simply cosmetic there.
 *
 * Unlocks use lifetime coins earned, because every game earns coins. Tying them
 * to levels or tubes would make some cats unreachable in a game without those.
 * The thresholds were calibrated against Money Sort so its pace did not change:
 * 300 coins is where a player had banked 25 tubes, 800 where they reached
 * level 4, 1,500 where they reached level 6.
 *
 * Art lives at img/cat-{id}-{pose}.png for peek, cheer, slump and face. A cat
 * with hasArt: false draws Patch instead, so it still plays before its art exists.
 */

export const POSES = ['peek', 'cheer', 'slump', 'face'];

export const CATS = [
  { id: 'patch', name: 'Patch', hasArt: true, price: 0,
    note: 'The one who got you started.', unlock: null },
  { id: 'mittens', name: 'Mittens', hasArt: true, price: 300,
    note: 'Quick paws, quicker regrets.',
    unlock: { stat: 'coinsEarned', need: 300, label: 'Earn 300 coins' } },
  { id: 'soot', name: 'Soot', hasArt: false, price: 600,
    note: 'Hears trouble coming.',
    unlock: { stat: 'coinsEarned', need: 500, label: 'Earn 500 coins' } },
  { id: 'marmalade', name: 'Marmalade', hasArt: true, price: 1000,
    note: 'Unhurried, on principle.',
    unlock: { stat: 'coinsEarned', need: 800, label: 'Earn 800 coins' } },
  { id: 'pepper', name: 'Pepper', hasArt: true, price: 1600,
    note: 'Counts everything twice.',
    unlock: { stat: 'coinsEarned', need: 1200, label: 'Earn 1,200 coins' } },
  { id: 'biscuit', name: 'Biscuit', hasArt: true, price: 2400,
    note: 'Tidies without being asked.',
    unlock: { stat: 'coinsEarned', need: 1500, label: 'Earn 1,500 coins' } },
];

export const catById = (id) => CATS.find((c) => c.id === id) || CATS[0];

/** How far along an unlock is. Patch has none, so it is always revealed. */
export function unlockProgress(cat, stats) {
  if (!cat.unlock) return { revealed: true, have: 0, need: 0 };
  const have = stats[cat.unlock.stat] || 0;
  return { revealed: have >= cat.unlock.need, have, need: cat.unlock.need };
}

/** The perk a cat carries in a given game, or null if it is cosmetic there. */
export const perkIn = (game, catId) => (game.perks && game.perks[catId]) || null;
