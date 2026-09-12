/**
 * Controller. Owns input, the overlay sequence, the wallet and the save.
 *
 * The engine resolves a whole turn synchronously, so events are collected as
 * they fire together with a snapshot of the state at that instant. Draining
 * that queue replays the turn at human speed. Because applying a choice from
 * the stuck-board card appends more events to the same live queue, the drain
 * loop picks them up without recursing.
 */

import { Game, DEFAULTS } from './engine.js';
import { BoardView, vmOf, money } from './render.js';
import {
  mountOverlays, milestoneCard, lockedCard, levelLostCard,
  confirmCard, menuCard, wait,
} from './overlays.js';
import { Panels, CATS, SKINS } from './tabs.js';
import { LobbyView } from './lobby.js';

const SAVE_KEY = 'cashpaws.save.v1';
const DEV = new URLSearchParams(location.search).has('dev');

let game, view, lobby, panels;
let screen = 'lobby';
let frames = [];
let busy = false;
let wallet = { cats: ['patch'], activeCat: 'patch', skins: ['classic'], activeSkin: 'classic' };
let stats = { banks: 0, drops: 0, bestLevel: 1, shuffles: 0 };
let log = [];

/* ---------------------------------------------------------------- *
 * Haptics — silent no-op anywhere the API is missing
 * ---------------------------------------------------------------- */

function buzz(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

/* ---------------------------------------------------------------- *
 * Native bridge — the Android shell calls into these
 * ---------------------------------------------------------------- */

function installBridge() {
  window.CashPaws = {
    /** True if the game consumed the back press. */
    onBack() {
      // An open card is a decision; back must not skip it.
      if (document.querySelector('.ovl')) return true;
      if (panels.open) { closePanel(); return true; }
      if (screen === 'board') { showScreen('lobby'); return true; }
      return false;
    },
    /** Called when the app is backgrounded, before the process can be killed. */
    flush() { save(); },
    version: '0.4.0',
  };
}

/* ---------------------------------------------------------------- *
 * Save
 * ---------------------------------------------------------------- */

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ game: game.serialize(), wallet, stats }));
  } catch { /* private mode or full storage: play on without a save */ }
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const g = Game.deserialize(data.game);
    if (data.wallet) wallet = { ...wallet, ...data.wallet };
    if (data.stats) stats = { ...stats, ...data.stats };
    return g;
  } catch {
    return null;
  }
}

function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
}

/* ---------------------------------------------------------------- *
 * Boot
 * ---------------------------------------------------------------- */

function attach(g) {
  game = g;
  frames = [];
  game.on((e) => {
    frames.push({ e, vm: vmOf(game) });
    if (e.type === 'bank') stats.banks++;
    if (e.type === 'inflow') stats.drops++;
    if (e.type === 'shuffle') stats.shuffles++;
    if (e.type === 'levelup') stats.bestLevel = Math.max(stats.bestLevel, e.level);
    if (DEV) { log.unshift(e); log = log.slice(0, 9); }
  });
  window.game = game;
}

function boot() {
  const root = document.getElementById('app');
  attach(loadSaved() || new Game({}));

  // Two screens in one container; overlays and sheets sit above both.
  root.innerHTML =
    '<div class="screen" data-screen="lobby"></div>' +
    '<div class="screen" data-screen="board"></div>';

  lobby = new LobbyView(root.querySelector('[data-screen="lobby"]'));
  view = new BoardView(root.querySelector('[data-screen="board"]'), game);
  mountOverlays(root);
  panels = new Panels(root);
  panels.onBuy = buy;
  panels.onClose = () => closePanel();

  view.on('tap', onTap);
  view.on('undo', onUndo);
  view.on('shuffle', onShuffle);
  view.on('settings', onMenu);

  lobby.on('play', () => showScreen('board'));
  lobby.on('tab', onLobbyTab);
  lobby.on('settings', onLobbySettings);

  showScreen('lobby');

  window.view = view;
  installBridge();
  applySkin();
  view.chipSet = wallet.activeSkin === 'notes' ? 'b' : 'a';
  frames = [];
  view.update();
  if (DEV) wireDev();

  if (game.status === 'locked') resolveLock();
}

/* ---------------------------------------------------------------- *
 * Screens
 * ---------------------------------------------------------------- */

function showScreen(next) {
  screen = next;
  const root = document.getElementById('app');
  root.classList.toggle('on-lobby', next === 'lobby');
  root.classList.toggle('on-board', next === 'board');
  if (next === 'board') {
    view.update();
    view.fitBoard();
    if (game.status === 'locked') resolveLock();
  } else {
    lobby.update(game);
  }
}

function closePanel() {
  panels.hide();
  if (screen === 'lobby') lobby.setNavTab('home');
}

function onLobbyTab(tab) {
  lobby.setNavTab(tab);
  if (tab === 'home') return panels.hide();
  panels.show(tab, game, wallet, stats);
}

async function onLobbySettings() {
  if (panels.open) return;
  const yes = await confirmCard({
    kicker: 'Settings',
    title: 'Erase everything?',
    line: 'Your level, net worth, coins, cats and chip sets all go back to the start. '
        + 'This cannot be undone.',
    ok: 'Erase and start over',
  });
  if (!yes) return;
  wipe();
  location.reload();
}

/* ---------------------------------------------------------------- *
 * The sequencer
 * ---------------------------------------------------------------- */

async function drain() {
  if (busy) return;
  busy = true;
  document.body.classList.add('busy');

  while (frames.length) {
    const { e, vm } = frames.shift();
    switch (e.type) {
      case 'move':
        view.update(vm);
        view.finishMove(e.to, e.count || 1);
        await wait(180);
        break;

      case 'bank':
        view.update(vm);
        view.bankPop(e.column, e.amount);
        buzz(14);
        await wait(420);
        break;

      case 'levelup':
        view.update(vm);
        buzz([0, 18, 70, 26]);
        await wait(120);
        await milestoneCard(e);
        break;

      case 'inflow':
        view.update(vm);
        view.flowPulse(e.count);
        buzz(18);
        await wait(420);
        break;

      case 'shuffle':
        view.update(vm);
        await wait(300);
        break;

      case 'lock': {
        view.update(vm);
        const choice = await lockedCard(e, vm, game.cfg.shuffleCost);
        // Both of these emit into the same live queue, so the loop continues.
        if (choice === 'shuffle') game.shuffle();
        else game.loseLevel();
        break;
      }

      case 'level-lost':
        view.update(vm);
        await levelLostCard(e);
        break;

      case 'restart':
      case 'undo':
        view.update(vm);
        await wait(120);
        break;

      default:
        break; // lift, drop-cancel, reject carry no sequence
    }
  }

  busy = false;
  document.body.classList.remove('busy');
  view.update();
  lobby.update(game);
  save();
  if (DEV) paintDev();
}

/** A board restored mid-lock needs the card put back in front of the player. */
async function resolveLock() {
  const vm = vmOf(game);
  frames = [{
    e: { type: 'lock', canShuffle: vm.shuffleCanHelp && vm.canAffordShuffle, coins: vm.coins },
    vm,
  }];
  await drain();
}

/* ---------------------------------------------------------------- *
 * Input
 * ---------------------------------------------------------------- */

function onTap(col) {
  if (busy || panels.open || game.status !== 'playing') return;

  const moving = game.selected !== null && game.canMove(game.selected, col);
  if (moving) view.prepareMove(game.selected);

  const res = game.tap(col);
  if (res.action === 'move') { drain(); return; }

  frames = [];
  if (!res.ok && res.reason === 'illegal') { view.shake(col); buzz(9); }
  view.update();
}

function onUndo() {
  if (busy || panels.open || !game.canUndo) return;
  if (!game.undo().ok) { frames = []; return; }
  drain();
}

function onShuffle() {
  if (busy || panels.open) return;
  if (!(game.canAffordShuffle && game.shuffleCanHelp)) return;
  if (!game.shuffle().ok) { frames = []; return; }
  drain();
}

/** The board has no bottom nav, so the pause button carries the menu. */
async function onMenu() {
  if (busy || panels.open) return;
  const pick = await menuCard();
  if (!pick || pick === 'resume') return;

  if (pick === 'lobby') { showScreen('lobby'); return; }

  if (pick === 'restart') {
    const yes = await confirmCard({
      kicker: 'Restart',
      title: 'Restart this board?',
      line: `You keep level ${String(game.level).padStart(2, '0')} and its columns. `
          + `Net worth falls back to ${money(game.floor)}, the floor for this level.`,
      ok: 'Restart board',
    });
    if (!yes) return;
    game.restartBoard();
    drain();
    return;
  }

  panels.show(pick, game, wallet, stats);
}

/* ---------------------------------------------------------------- *
 * Purchases — cosmetic only
 * ---------------------------------------------------------------- */

function buy(kind, id) {
  const list = kind === 'cat' ? CATS : SKINS;
  const item = list.find((x) => x.id === id);
  if (!item) return;

  const ownedKey = kind === 'cat' ? 'cats' : 'skins';
  const activeKey = kind === 'cat' ? 'activeCat' : 'activeSkin';

  if (wallet[ownedKey].includes(id)) {
    wallet[activeKey] = id;
  } else if (game.coins >= item.price) {
    game.coins -= item.price;
    wallet[ownedKey].push(id);
    wallet[activeKey] = id;
    view.pulseCoins();
  } else {
    return; // not enough coins; the price tag already says so
  }

  applySkin();
  view.chipSet = wallet.activeSkin === 'notes' ? 'b' : 'a';
  view.update();
  panels.show(panels.open, game, wallet, stats);
  lobby.update(game);
  save();
}

function applySkin() {
  const root = document.getElementById('app');
  SKINS.forEach((s) => root.classList.remove('skin-' + s.id));
  root.classList.add('skin-' + wallet.activeSkin);
  if (view) view.chipSet = wallet.activeSkin === 'notes' ? 'b' : 'a';
}

/* ---------------------------------------------------------------- *
 * Dev harness — only with ?dev=1
 * ---------------------------------------------------------------- */

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

function wireDev() {
  document.body.classList.add('dev');
  const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);
  on('step', () => botStep(1));
  on('step10', () => botStep(10));
  on('telegraph', async () => {
    for (let i = 0; i < 40 && !game.telegraphing; i++) await botStep(1);
  });
  on('inflow', async () => { game.turnsUntilDrop = 1; await botStep(1); });
  on('levelup', () => { game.netWorth = game.nextFloor; game.checkLevelUp(); drain(); });
  on('wipe', () => { wipe(); location.reload(); });
  paintDev();
}

function paintDev() {
  const el = document.getElementById('readout');
  if (!el) return;
  const g = game;
  el.innerHTML = `
    <dl>
      <dt>status</dt><dd>${g.status}</dd>
      <dt>level</dt><dd>${g.level} &middot; ${g.columnCount} cols</dd>
      <dt>net worth</dt><dd>${money(g.netWorth)}</dd>
      <dt>coins</dt><dd>${g.coins}</dd>
      <dt>pool</dt><dd>${g.pool.join(' / ')}</dd>
      <dt>next drop</dt><dd>in ${g.turnsUntilDrop} of ${g.currentInterval}</dd>
      <dt>drops</dt><dd>${g.dropCount}</dd>
      <dt>load</dt><dd>${g.chipsOnBoard} / ${g.columnCount * g.cfg.capacity}</dd>
      <dt>legal moves</dt><dd>${g.legalMoves().length}</dd>
      <dt>banked</dt><dd>${stats.banks}</dd>
    </dl>
    <h4>EVENTS</h4>
    <ul>${log.map((e) => `<li><b>${e.type}</b></li>`).join('') || '<li>none yet</li>'}</ul>`;
}

// Rotation, split screen, or the keyboard appearing all change the space.
window.addEventListener('resize', () => { if (view) view.fitBoard(); });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && game) save();
});

document.addEventListener('DOMContentLoaded', boot);
window.DEFAULTS = DEFAULTS;
