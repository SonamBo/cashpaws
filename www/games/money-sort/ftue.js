/**
 * First-time tutorial: three beats, on the first board a new player sees.
 *
 *   1. move   A hand taps the best move: lift from this tube, drop on that one.
 *   2. stack  If that move didn't cash in: "Four of the same cash in." The hand
 *             keeps pointing at the best move.
 *   3. bank   On the first cash-in, the progress bar is spotlit: cashing in
 *             grows net worth, and filling the bar levels you up. "Got it" ends it.
 *
 * Tips never block play: the player can ignore the hand. Only the last beat
 * waits for a tap. Anyone past level 1, or who has already banked, never sees
 * it; nor does anyone who finished it once (host.flag('ftue')).
 *
 * Level 1 deals one set of four coins across two tubes with one tube empty,
 * so the suggested move usually cashes in at once.
 */

const TEXT = {
  move: 'Tap a tube to lift its top coin, then tap another tube to drop it there.',
  stack: 'Put <b>4 of the same coin</b> in one tube to cash it in.',
  bank: 'Cashed in! Every tube you cash in grows your <b>net worth</b>.<br>Fill this bar to <b>level up</b>.',
};

export function createTutorial({ host, getGame, getView, suggest }) {
  let step = null;          // null: not running
  let moved = false;
  let banked = false;
  let spotlit = false;

  const tube = (i) => getView()?.tubes?.[i];

  function begin() {
    if (step || host.flag('ftue')) return;
    const game = getGame();
    if (game.level > 1 || (host.stats.banks || 0) > 0) { host.setFlag('ftue'); return; }
    step = 'move';
    host.track('ftue_step', { step: 'move' });
    refresh();
  }

  /** Point at the move to make now: both taps, or just the drop once lifted. */
  function refresh() {
    if (!step || step === 'bank') return;
    const game = getGame();
    if (game.status !== 'playing') { host.coach.clear(); return; }
    const m = suggest(game);
    const hand = !m ? null
      : game.selected === m[0] ? tube(m[1])
        : game.selected !== null ? tube(game.selected)     // put it back down first
          : [tube(m[0]), tube(m[1])];
    host.coach.tip({ at: getView().el.rows, text: TEXT[step], hand });
  }

  async function finish() {
    step = 'bank';
    spotlit = true;
    host.track('ftue_step', { step: 'bank' });
    await host.coach.spotlight({ at: 'progress', text: TEXT.bank, ok: 'Got it' });
    step = null;
    host.setFlag('ftue');
    host.track('ftue_complete', {});
  }

  return {
    /** Engine events, as they happen. */
    onEvent(e) {
      if (!step) return;
      if (e.type === 'move') moved = true;
      if (e.type === 'bank') banked = true;
    },

    /** The board is idle again: move on, or refresh the hand for the new board. */
    update() {
      if (!step || spotlit) return;
      if (banked) { finish(); return; }
      if (step === 'move' && moved) {
        step = 'stack';
        host.track('ftue_step', { step: 'stack' });
      }
      refresh();
    },

    /** The board came on screen: start, if this player needs it. */
    show() { if (!step) begin(); else refresh(); },
    hide() { if (step !== 'bank') host.coach.clear(); },
    get running() { return !!step; },
  };
}
