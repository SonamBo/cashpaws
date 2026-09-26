/**
 * Coin Catch — the template game.
 *
 * Deliberately nothing like Money Sort: no levels, no progress bar, no
 * cosmetics, and a timer instead of turns. A coin lands on a 3x3 grid; tap it
 * before it hops. Every catch pays, streaks pay more, and a miss ends the
 * streak. It exists to prove the shell assumes nothing about the game, and to
 * be copied as the starting point for a new one.
 *
 * To start a new game: copy this folder, change `id` (it must match the folder
 * name), and point www/games/active.js at it.
 */

export default {
  id: 'template',
  name: 'Coin Catch',
  saveVersion: 1,
  styles: ['style.css'],

  // Only one cat does anything here; the rest are cosmetic in this game.
  perks: {
    marmalade: { text: 'The coin waits half a second longer before it hops.', config: { slowdown: 500 } },
  },

  // One of each tier is drawn per day. Progress comes from host.stat().
  tasks: [
    { id: 'catch-20', tier: 'easy', text: 'Catch 20 coins', stat: 'catches', target: 20 },
    { id: 'catch-60', tier: 'medium', text: 'Catch 60 coins', stat: 'catches', target: 60 },
    { id: 'streak-10', tier: 'hard', text: 'Reach a streak of 10', stat: 'streaks10', target: 1 },
  ],

  create(host, root) {
    root.classList.add('cc-root');
    let best = 0;
    let streak = 0;
    let catches = 0;
    let cell = -1;
    let timer = null;
    let slowdown = 0;
    let running = false;
    let visible = false;      // the shell may resume us while we are off screen

    root.innerHTML = `
      <p class="cc-hint">Tap the coin before it hops</p>
      <div class="cc-grid">${Array.from({ length: 9 }, (_, i) =>
        `<button class="cc-cell" data-i="${i}" aria-label="cell ${i + 1}"></button>`).join('')}</div>
      <div class="cc-cat">${host.art.cat('peek', 150, 'cc-peek')}</div>`;
    const cells = [...root.querySelectorAll('.cc-cell')];

    const window_ = () => Math.max(420, 1400 - streak * 60) + slowdown;

    function report() {
      host.progress({
        title: `Streak ${streak}`,
        fraction: null,                       // no bar: this game has no levels
        figure: `Best ${best}`,
        sub: `${catches} caught`,
        summary: catches ? `Best streak ${best}` : '',
      });
    }

    function place() {
      cells.forEach((c) => { c.innerHTML = ''; c.classList.remove('on'); });
      let next;
      do { next = Math.floor(Math.random() * 9); } while (next === cell);
      cell = next;
      cells[cell].classList.add('on');
      cells[cell].innerHTML = host.art.coin(52);
      clearTimeout(timer);
      if (running) timer = setTimeout(miss, window_());
    }

    async function miss() {
      if (!running) return;
      running = false;
      clearTimeout(timer);
      host.haptic(30);
      const lost = streak;
      streak = 0;
      report();
      if (lost >= 3) {
        // A rewarded ad could save the streak. The shell decides if one exists.
        if (host.rewarded.available('keep-streak') && await host.rewarded.show('keep-streak')) {
          streak = lost;
          report();
        } else {
          await host.setback({ kicker: 'Missed', title: `Streak of ${lost} ended`, line: 'The coin hopped away.' });
        }
      }
      running = true;
      place();
    }

    async function hit(i) {
      if (!running || i !== cell) return;
      streak += 1;
      catches += 1;
      best = Math.max(best, streak);
      host.stat('catches');
      if (streak === 10) host.stat('streaks10');
      host.wallet.earn(streak % 5 === 0 ? 10 : 1, 'catch');
      host.haptic(8);
      report();
      if (streak % 10 === 0) {
        running = false;
        clearTimeout(timer);
        await host.celebrate({ kicker: 'Streak', title: `${streak} in a row`, reward: '+10 coins' });
        await host.moment('streak');
        running = true;
      }
      place();
      host.save();
    }

    root.querySelector('.cc-grid').addEventListener('click', (e) => {
      const b = e.target.closest('.cc-cell');
      if (b) hit(Number(b.dataset.i));
    });

    return {
      start(saved) {
        if (saved) ({ best = 0, catches = 0 } = saved);
        report();
      },
      serialize: () => ({ best, catches }),
      show() { visible = true; running = true; place(); },
      hide() { visible = false; running = false; clearTimeout(timer); },
      pause() { running = false; clearTimeout(timer); },
      resume() { if (visible && !running) { running = true; place(); } },
      setPerk(config) { slowdown = config.slowdown || 0; },
      progressRows: () => ({
        blurb: 'Catch the coin before it hops. Longer streaks pay more.',
        tiles: [{ value: best, label: 'best streak' }, { value: catches, label: 'coins caught' }],
      }),
      dev: {
        buttons: [{ id: 'catch', label: 'Catch it', run: () => hit(cell) }],
        readout: () => `<dl><dt>streak</dt><dd>${streak}</dd><dt>window</dt><dd>${window_()}ms</dd></dl>`,
      },
    };
  },
};
