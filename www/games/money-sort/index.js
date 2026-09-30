/**
 * Money Sort — the sorting game, as a module the shell can install.
 *
 * Everything the shell needs to know is declared on the object below. The
 * controller in create() replays each turn at human speed: the engine resolves
 * a whole turn at once, so events are queued with a snapshot of the board as
 * they fire, then drained with animations and cards in between.
 */

import { Game, poolForLevel, DEFAULTS, levelKind, levelModifiers, netWorthFloor, legacyFloor } from './engine.js';
import { BoardView, vmOf, money } from './board.js';
import { stuckCard } from './cards.js';
import { createTutorial } from './ftue.js';

const pad = (n) => String(n).padStart(2, '0');

/**
 * 1.6 shortened levels, so a saved net worth no longer fits its level. Keep the
 * level and the progress through it: halfway through level 7 stays halfway.
 * Without this, an old save would cascade through several level-ups on load.
 */
export function migrateV1(saved) {
  const st = { ...saved.state };
  const L = st.level;
  const span = legacyFloor(L + 1) - legacyFloor(L);
  const frac = Math.max(0, Math.min(0.999, (st.netWorth - legacyFloor(L)) / span));
  const lo = netWorthFloor(L), hi = netWorthFloor(L + 1);
  st.netWorth = Math.floor(lo + frac * (hi - lo));
  return { ...saved, state: st, freeSorts: 0 };
}

export default {
  id: 'money-sort',
  name: 'Money Sort',
  saveVersion: 2,          // 2: shorter levels (1.6); older saves are rescaled on load
  // Bell Quest opens once level 7, the first Hard level, is beaten. A step is a
  // level-up; dropping a level knocks you out, a Sort does not.
  quest: { unlockLevel: 8, steps: 7 },
  // Coin reasons that fire many times a level; analytics sums them per level.
  analytics: { batch: ['bank', 'undo-reversal'] },
  styles: ['style.css'],

  /*
   * Perks are measured over two weeks of play, not one session: a perk that
   * looks mild in an evening can quietly remove all difficulty over a fortnight.
   * The good shape helps early and tapers late — a flat discount, a slower
   * start, a level-up bonus — rather than a percentage that grows with the game.
   */
  perks: {
    mittens:   { text: 'Undo costs 10 instead of 20.', config: { undoCost: 10 } },
    soot:      { text: 'The board warns you three turns ahead instead of two.', config: { telegraphTurns: 3 } },
    marmalade: { text: 'Beating a Hard level pays triple, not double.', config: { hardRewardMultiplier: 3 } },
    pepper:    { text: 'Level-ups pay 70 coins instead of 50.', config: { coinsPerLevelUp: 70 } },
    biscuit:   { text: 'Sort costs 50 less, at every level.', config: { sortCost: 100 } },
  },

  defaultCosmetic: 'classic',
  shopBlurb: 'Chip sets change how values look, never what they are worth.',
  cosmetics: [
    { id: 'classic', name: 'Mint set', price: 0, note: 'Blue, silver, copper, green, purple.', preview: 'img/chip-20.png' },
    { id: 'notes', name: 'Paper set', price: 800, note: 'More bills, fewer coins. Same values.', preview: 'img/chipb-20.png' },
  ],

  /*
   * The daily-task catalogue: one of each tier is drawn per day, and progress
   * comes from host.stat(). Nothing here asks the player to spend coins — a
   * "use Sort" task would cost 150 to earn less than that.
   * Tasks naming a chip value are only offered once that chip can appear.
   */
  tasks: [
    { id: 'bank-8', tier: 'easy', text: 'Bank 8 tubes', stat: 'banks', target: 8 },
    { id: 'survive-5', tier: 'easy', text: 'Survive 5 flow drops', stat: 'drops', target: 5 },
    { id: 'moves-30', tier: 'easy', text: 'Make 30 moves', stat: 'moves', target: 30 },
    { id: 'bank-20', tier: 'medium', text: 'Bank 20 tubes', stat: 'banks', target: 20 },
    { id: 'bank-twenties', tier: 'medium', text: 'Bank a tube of $20s', stat: 'bank20', target: 1, chip: 20 },
    { id: 'survive-12', tier: 'medium', text: 'Survive 12 flow drops', stat: 'drops', target: 12 },
    { id: 'level-up', tier: 'hard', text: 'Reach a new level', stat: 'levelups', target: 1 },
    { id: 'bank-fifties', tier: 'hard', text: 'Bank a tube of $50s', stat: 'bank50', target: 1, chip: 50 },
  ],

  create(host, root) {
    root.classList.add('ms-root');
    let game;
    let view;
    let frames = [];
    let busy = false;
    let perk = {};
    let chipSet = 'a';
    const tutorial = createTutorial({
      host, getGame: () => game, getView: () => view, suggest: (g) => greedy(g),
    });

    function attach(g) {
      game = g;
      frames = [];
      game.on((e) => {
        frames.push({ e, vm: vmOf(game) });
        tutorial.onEvent(e);
        if (e.type === 'move') host.stat('moves');
        if (e.type === 'bank') {
          host.stat('banks');
          if (e.value === 20) host.stat('bank20');
          if (e.value === 50) host.stat('bank50');
        }
        if (e.type === 'inflow') host.stat('drops');
        if (e.type === 'sort') host.stat('sorts');
        if (e.type === 'move') clock.moves += 1;
        if (e.type === 'levelup') {
          host.stat('levelups');
          // `level` is the level just reached; turns and seconds are for the one beaten.
          host.levelWon({
            level: e.level, kind: e.kind, beat_hard: !!e.beatHard, coins: e.coins, ...levelClock(),
            // the new level's modifiers, e.g. "locked,lucky", or "none"
            modifiers: Object.keys(e.mods || {}).filter((k) => e.mods[k]).join(',') || 'none',
          });
        }
        if (e.type === 'level-lost') {
          const m = levelModifiers(e.from, game.cfg);
          host.levelLost({ level: e.from, to: e.to, ...levelClock(),
            modifiers: Object.keys(m).filter((k) => m[k]).join(',') || 'none' });
        }
      });
      window.game = game;       // a debugging handle, as it always was
    }

    // How long a level took, for analytics. Seconds count only while the
    // board is on screen, so a phone left on the table does not skew them.
    let clock = { moves: 0, ms: 0, since: null };
    let onScreen = false;
    function levelClock() {
      const ms = clock.ms + (clock.since ? Date.now() - clock.since : 0);
      const out = { moves: clock.moves, seconds: Math.round(ms / 1000) };
      clock = { moves: 0, ms: 0, since: clock.since ? Date.now() : null };
      return out;
    }
    const clockOn = () => { if (!clock.since) clock.since = Date.now(); };
    const clockOff = () => { if (clock.since) { clock.ms += Date.now() - clock.since; clock.since = null; } };

    function report(vm = vmOf(game)) {
      const started = vm.netWorth > 0 || vm.turn > 0 || vm.level > 1;
      host.progress({
        title: vm.kind === 'hard' ? `Level ${vm.level} · Hard` : `Level ${vm.level}`,
        fraction: vm.levelProgress,
        figure: `${money(vm.netWorth)} / ${money(vm.nextFloor)}`,
        level: vm.level,
        summary: started ? `Level ${pad(vm.level)} · ${money(vm.netWorth)}` : '',
      });
    }

    function paint(vm) {
      view.update(vm);
      report(vm);
    }

    async function drain() {
      if (busy) return;
      busy = true;
      document.body.classList.add('busy');
      const { wait } = host.cards;

      while (frames.length) {
        const { e, vm } = frames.shift();
        switch (e.type) {
          case 'move':
            paint(vm);
            view.finishMove(e.to, e.count || 1);
            await wait(180);
            break;

          case 'bank':
            paint(vm);
            view.bankPop(e.column, e.amount);
            host.haptic(14);
            await wait(420);
            break;

          case 'levelup': {
            paint(vm);
            host.haptic([0, 18, 70, 26]);
            await wait(120);
            const gains = [];
            if (e.gainedColumn) gains.push(`+1 tube &middot; now ${e.columns}`);
            if (e.poolGrew) gains.push('A bigger chip joins the pool');
            if (e.mysteryArrives) gains.push('New: the flow can bury chips face down. They turn over when they reach the top.');
            // Level modifiers: explained in full the first time, named after that.
            const m = e.mods || {};
            if (e.lockArrives) gains.push('New: a locked tube. Cash in 2 tubes to open it. The flow skips it till then.');
            else if (m.locked && !e.gainedColumn) gains.push('This level: a locked tube');
            if (e.frozenArrives) gains.push('New: frozen coins can\'t be lifted. Each cash-in cracks the ice; the second frees them.');
            else if (m.frozen) gains.push('This level: frozen coins');
            if (e.luckyArrives) gains.push('New: a Lucky Paw coin! It counts as any coin, so it finishes any set.');
            else if (m.lucky) gains.push('A Lucky Paw coin is on the board');
            if (e.kind === 'hard') gains.push('Next up: a Hard level. Faster flow, and it pays double.');
            if (e.kind === 'breather') gains.push('Hard level beaten. This one is gentler.');
            gains.push(`Sort now costs ${vm.sortPrice}`);
            gains.push(`+${e.coins} coins${e.beatHard ? ' &middot; Hard bonus' : ''}`);
            await host.celebrate({
              kicker: 'Level up',
              title: `Level ${pad(e.level)} unlocked`,
              figure: money(e.netWorth),
              reward: gains,
            });
            // Before the new level starts: Bell Quest shows its step here.
            await host.levelBreak();
            await host.moment('level-complete');
            break;
          }

          case 'inflow':
            paint(vm);
            view.flowPulse(e.count);
            host.haptic(18);
            await wait(420);
            break;

          case 'sort':
            paint(vm);
            host.haptic(16);
            await wait(380);
            break;

          case 'refill':
            paint(vm);
            await wait(320);
            break;

          case 'lock': {
            paint(vm);
            let choice;
            for (;;) {
              // Broke and stuck: an ad can pay for the Sort instead.
              const adOffer = !vm.canAffordSort && vm.sortCanHelp && host.rewarded.available('rescue-sort');
              host.track('board_stuck', {
                level: vm.level, kind: vm.kind, can_sort: !!e.canSort, free: vm.freeSorts > 0,
                coins: host.wallet.coins, price: vm.sortPrice, ad_offer: !!adOffer,
              });
              choice = await stuckCard(host, e, vm, vm.freeSorts > 0 ? 'Free' : vm.sortPrice, adOffer);
              // A drop is already confirmed: the card itself warns if it would cost
              // an event such as Bell Quest (host.levelLossWarning).
              if (choice !== 'ad') break;
              if (await host.rewarded.show('rescue-sort')) { choice = 'free-sort'; break; }
              // Skipped the ad: nothing lost, the choice comes back.
            }
            // Each of these emits into the same live queue, so the loop carries on.
            host.track('stuck_choice', { level: vm.level, choice });
            if (choice === 'sort') { trackSort(vm.freeSorts > 0 ? 'free' : 'paid', 'stuck'); game.sort(); }
            else if (choice === 'free-sort') { trackSort('ad', 'stuck'); game.sort({ free: true }); host.stat('adSorts'); }
            else game.loseLevel();
            break;
          }

          case 'level-lost':
            paint(vm);
            await host.setback({
              kicker: 'Level lost',
              title: `Back to level ${pad(e.to)}`,
              figure: money(e.netWorth),
              line: `A fresh board of ${e.columns} tubes.`,
            });
            break;

          case 'unlock':
            paint(vm);
            view.unlockPop(e.column);
            host.haptic([0, 12, 40, 18]);
            await wait(520);
            break;

          case 'thaw':
          case 'lock-count':
            paint(vm);
            await wait(e.type === 'thaw' && e.freed.length ? 300 : 120);
            break;

          case 'restart':
          case 'undo':
            paint(vm);
            await wait(120);
            break;

          default:
            break;
        }
      }

      busy = false;
      document.body.classList.remove('busy');
      paint(vmOf(game));
      host.save();
      tutorial.update();
    }

    /** A board restored mid-lock puts the card back in front of the player. */
    async function resolveLock() {
      const vm = vmOf(game);
      frames = [{ e: { type: 'lock', canSort: vm.sortCanHelp && vm.canAffordSort }, vm }];
      await drain();
    }

    function onTap(col) {
      if (busy || game.status !== 'playing') return;
      const moving = game.selected !== null && game.canMove(game.selected, col);
      if (moving) view.prepareMove(game.selected);
      const res = game.tap(col);
      if (res.action === 'move') { drain(); return; }
      frames = [];
      if (!res.ok && ['illegal', 'frozen', 'locked'].includes(res.reason)) { view.shake(col); host.haptic(9); }
      view.update();
      tutorial.update();           // lifted or put down: point at the next tap
    }

    function onUndo() {
      if (busy || !game.canUndo) return;
      if (!game.undo().ok) { frames = []; return; }
      host.track('undo_used', { level: game.level });
      drain();
    }

    function trackSort(how, where) {
      host.track('sort_used', { level: game.level, how, where, price: how === 'paid' ? game.sortPrice : 0 });
    }

    function onSort() {
      if (busy || !(game.canAffordSort && game.sortCanHelp)) return;
      trackSort(game.freeSorts > 0 ? 'free' : 'paid', 'button');
      if (!game.sort().ok) { frames = []; return; }
      drain();
    }

    /* ---------------- dev harness, only under ?dev=1 ---------------- */

    function greedy(g) {
      const moves = g.legalMoves();
      if (!moves.length) return null;
      const cap = g.cfg.capacity;
      const score = ([f, t]) => {
        const src = g.columns[f], dst = g.columns[t], chip = src[src.length - 1];
        if (dst.length === cap - 1 && dst.every((v) => v === chip)) return 1000;
        if (dst.length > 0 && dst.every((v) => v === chip)) return 500 + dst.length * 10;
        if (src.length === 1 && dst.length > 0) return 300;
        if (dst.length > 0) return 100;
        if (src.length === 1) return -50;
        return src[src.length - 2] === chip ? 60 : 40;
      };
      return moves.reduce((b, m) => (score(m) > score(b) ? m : b), moves[0]);
    }

    async function botStep(n) {
      for (let i = 0; i < n; i++) {
        if (busy || game.status !== 'playing') break;
        const m = greedy(game);
        if (!m) break;
        view.prepareMove(m[0]);
        game.move(m[0], m[1]);
        await drain();
      }
    }

    return {
      start(saved, version) {
        const opts = { perk, wallet: host.wallet };
        if (saved && (version ?? 1) < 2) saved = migrateV1(saved);
        attach(saved ? Game.deserialize(saved, opts) : new Game(opts));
        view = new BoardView(root, game, host);
        view.chipSet = chipSet;
        view.on('tap', onTap);
        view.on('undo', onUndo);
        view.on('sort', onSort);
        window.view = view;
        frames = [];
        paint(vmOf(game));
      },

      serialize: () => game.serialize(),

      /** What a reward is worth right now: the Sort price, so boxes grow with the game. */
      rewardValue: () => game.sortPrice,

      /** Rule out tasks the player cannot do yet, such as $50s before level 5. */
      canOffer(task) {
        if (!task.chip) return true;
        return poolForLevel(game.level, { ...DEFAULTS, ...perk }).includes(task.chip);
      },

      show() {
        onScreen = true;
        clockOn();
        view.relayout();
        report();
        if (game.status === 'locked') resolveLock();
        requestAnimationFrame(() => tutorial.show());   // after layout, so the hand lands on the tubes
      },

      // Turn-based: nothing runs underneath, so these only stop the level clock.
      hide() { onScreen = false; clockOff(); tutorial.hide(); },
      pause() { clockOff(); },
      resume() { if (onScreen) clockOn(); },

      async restart() {
        const yes = await host.confirm({
          kicker: 'Restart',
          title: 'Restart this board?',
          line: `You keep level ${pad(game.level)} and its tubes. `
              + `Net worth falls back to ${money(game.floor)}, the floor for this level.`,
          ok: 'Restart board',
        });
        if (!yes) return;
        game.restartBoard();
        drain();
      },

      setPerk(config) {
        perk = { ...config };
        if (!game) return;
        game.setPerk(perk);
        view.rebuild();
        view.update();
      },

      setCosmetic(id) {
        chipSet = id === 'notes' ? 'b' : 'a';
        if (view) { view.chipSet = chipSet; view.update(); }
      },

      relayout() { view?.relayout(); },

      progressRows() {
        const rows = [];
        const from = Math.max(1, game.level - 2);
        for (let lv = from; lv < from + 7; lv++) {
          const probe = new Game({ level: lv, seed: 1 });
          const pool = probe.pool;
          rows.push({
            state: lv < game.level ? 'done' : lv === game.level ? 'now' : '',
            cells: [pad(lv), money(probe.floor), probe.columnCount, '$' + pool[pool.length - 1]],
          });
        }
        return {
          blurb: 'Net worth is lifetime. It only ever falls if you lose a level.',
          tiles: [
            { value: money(game.netWorth), label: 'net worth' },
            { value: host.stats.banks || 0, label: 'tubes banked' },
          ],
          table: { head: ['LV', 'Needs', 'Tubes', 'Top chip'], rows },
        };
      },

      dev: {
        buttons: [
          { id: 'step', label: 'Step', run: () => botStep(1) },
          { id: 'step10', label: 'Step ×10', run: () => botStep(10) },
          { id: 'telegraph', label: 'To warning', run: async () => {
            for (let i = 0; i < 40 && !game.telegraphing; i++) await botStep(1);
          } },
          { id: 'inflow', label: 'Force flow', run: async () => { game.turnsUntilDrop = 1; await botStep(1); } },
          { id: 'levelup', label: 'Level up', run: () => { game.netWorth = game.nextFloor; game.checkLevelUp(); drain(); } },
        ],
        readout: () => `
          <dl>
            <dt>status</dt><dd>${game.status}</dd>
            <dt>level</dt><dd>${game.level} &middot; ${game.columnCount} tubes</dd>
            <dt>net worth</dt><dd>${money(game.netWorth)}</dd>
            <dt>pool</dt><dd>${game.pool.join(' / ')}</dd>
            <dt>next drop</dt><dd>in ${game.turnsUntilDrop} of ${game.currentInterval}</dd>
            <dt>legal moves</dt><dd>${game.legalMoves().length}</dd>
          </dl>`,
      },
    };
  },
};
