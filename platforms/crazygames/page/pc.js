/**
 * Keyboard for PC players. Every key presses the same on-screen control a
 * click would, so neither the shell nor the game needs to know about keys.
 *
 * Built in, for any game (they act on the shell's own screens):
 *   Enter/Space  a card's main button; Play in the lobby
 *   P            pause; in a card or sheet, its back or close button
 *   Backspace    also back, in a card or sheet
 * Not Esc: browsers use it to leave fullscreen (CrazyGames' restricted keys).
 *
 * The game adds its own in www/games/<id>/web.json, for example:
 *   "keys": [
 *     { "key": "1-9", "click": ".tube[data-col=\"{i}\"]" },   {i} = digit − 1, {n} = digit
 *     { "key": "z", "click": "[data-undo]" }
 *   ],
 *   "numberLabels": { "selector": ".tube[data-col]", "attr": "data-col" }
 * Game keys work while the game screen is up and nothing covers it.
 */
(function () {
  const GAME = window.__WEB_GAME || {};

  // Scale the app up on large windows: it lays out as if the window were
  // about 960×560 at most, then grows to fill it (pc.css). Never below 1, so
  // phones and small frames are exactly as on Android; at most 2.
  function fit() {
    const s = Math.max(1, Math.min(2, window.innerWidth / 960, window.innerHeight / 560));
    document.documentElement.style.setProperty('--app-scale', s.toFixed(3));
  }
  fit();
  window.addEventListener('resize', () => { fit(); window.dispatchEvent(new Event('app-scaled')); });
  const app = () => document.getElementById('app');
  const visible = (el) => !!el && el.offsetParent !== null && !el.disabled;
  const press = (el) => { if (visible(el)) { el.click(); return true; } return false; };
  const first = (root, sels) => {
    for (const s of sels) {
      const el = [...root.querySelectorAll(s)].find(visible);
      if (el) return el;
    }
    return null;
  };

  // Game keys: "1-9" ranges and single keys.
  const bindings = [];
  for (const k of GAME.keys || []) {
    const range = /^(\d)-(\d)$/.exec(k.key);
    if (range) for (let d = Number(range[1]); d <= Number(range[2]); d++) bindings.push({ key: String(d), sel: k.click.replaceAll('{i}', d - 1).replaceAll('{n}', d), digit: true });
    else bindings.push({ key: k.key.toLowerCase(), sel: k.click, digit: false });
  }

  // Number labels on the game's targets, shown once the keyboard is used.
  function labelTargets() {
    const L = GAME.numberLabels;
    if (!L) return;
    document.querySelectorAll(L.selector).forEach((el) => {
      const n = Number(el.getAttribute(L.attr)) + 1;
      if (n >= 1 && n <= 9) el.dataset.key = String(n); else delete el.dataset.key;
    });
  }
  new MutationObserver(() => { if (document.documentElement.classList.contains('keys')) labelTargets(); })
    .observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const root = app();
    if (!root) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    let done = false;

    // A card or sheet on top takes the keys first.
    const cards = [...root.querySelectorAll('.overlays .ovl')];
    const card = cards[cards.length - 1];
    const sheet = root.querySelector('.panel-sheet.in');
    if (card) {
      if (key === 'Enter' || key === ' ') {
        done = press(first(card, ['[data-go]', '[data-ok]', '.ovl-btn.primary', 'button.primary', '[data-pick="resume"]', '[data-tap]', '[data-pick="close"]']));
      } else if (key === 'p' || key === 'Backspace') {
        done = press(first(card, ['[data-cancel]', '[data-pick="resume"]', '[data-pick="close"]', '.ovl-btn.ghost']));
      }
    } else if (sheet) {
      if (key === 'p' || key === 'Backspace') done = press(sheet.querySelector('[data-close]'));
    } else if (root.classList.contains('on-game')) {
      if (key === 'p') done = press(root.querySelector('[data-menu]'));
      else {
        const b = bindings.find((x) => x.key === key);
        if (b) {
          if (b.digit) { document.documentElement.classList.add('keys'); labelTargets(); }
          done = press(root.querySelector(b.sel));
        }
      }
    } else if (root.classList.contains('on-lobby')) {
      if (key === 'Enter' || key === ' ') done = press(root.querySelector('[data-play]'));
    }
    if (done) e.preventDefault();
  });
})();
