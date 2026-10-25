/**
 * Puzzle of the Day: the screen, its cards, the streak, and the share clip.
 *
 * Opened from its lobby button (host.lobbyButton → openFromLobby). It lays
 * over Money Sort's own board in the same game screen and leaves it as it
 * was. The board is drawn by the game's BoardView, so tubes, coins and coin
 * flights look exactly like the main game; the rules are puzzle.js's.
 *
 * Moves allowed = par, the fewest that clear the board, so solving it is
 * finding the best line. Retries are free and unlimited all day. The first
 * solve of a day pays coins (more later in the week) plus a streak bonus.
 */

import { puzzleFor, localDateKey, addDays, applyMove, canMove, isSolved, CAP } from './puzzle.js';
import PUZZLES from './puzzles.js';
import { BoardView, vmOf } from './board.js';
import { buildTimeline, recordClip, loadClipArt, clipType, drawFrame } from './clip.js';

const STREAK_STEP = 10;      // streak bonus per day after the first
const STREAK_MAX = 50;       // capped, so a long streak doesn't swamp the economy
const KEEP_DAYS = 10;        // days of history kept in the save

const svg = (d, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_X = svg('<path d="M6 6l12 12M18 6L6 18"/>', 22);
const ICON_UNDO = svg('<path d="M4.6 12a7.4 7.4 0 1 1 2.6 5.6"/><path d="M4.4 5.2v5.1h5.1"/>');
const ICON_RESTART = svg('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>');
const ICON_SHARE = svg('<path d="M12 15V3"/><path d="M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12"/>', 18);

export function streakBonus(streak) { return Math.min(STREAK_MAX, Math.max(0, streak - 1) * STREAK_STEP); }

/** A fresh or loaded record of the player's puzzles: streak, best, and each recent day. */
export function potdState(saved) {
  const s = { last: null, streak: 0, best: 0, ...(saved || {}) };
  s.days = { ...(saved?.days || {}) };
  const keys = Object.keys(s.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete s.days[k];
  return s;
}

/** The streak as it stands today: it lapses once a whole day passes unsolved. */
export function liveStreak(s, today) {
  return s.last === today || s.last === addDays(today, -1) ? s.streak : 0;
}

/** Record a first solve today; returns { coins, bonus, streak }. */
export function recordSolve(s, p, moves, today) {
  const day = (s.days[today] ||= { tries: 1, solved: false, moves: null });
  if (day.solved) return null;
  day.solved = true;
  day.moves = moves.map((m) => [...m]);
  s.streak = s.last === addDays(today, -1) ? s.streak + 1 : 1;
  s.last = today;
  s.best = Math.max(s.best, s.streak);
  const bonus = streakBonus(s.streak);
  return { coins: p.coins, bonus, streak: s.streak };
}

export function createDailyPuzzle({ host, root, onOpen, onClose, chipSet = () => 'a' }) {
  let state = potdState(null);
  let p = null;               // today's puzzle
  let today = null;
  let cols = [];
  let moves = [];
  let history = [];
  let selected = null;
  let busy = false;
  let practice = false;       // already solved today: playing again, no reward
  let view = null;
  let el = null;
  let opened = false;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const track = (name, extra = {}) => host.track(name, { number: p?.number, day: p?.day?.toLowerCase(), par: p?.par, ...extra });

  /* ---------------- the lobby button ---------------- */

  function refreshLobby() {
    const t = localDateKey();
    const done = !!state.days[t]?.solved;
    const streak = liveStreak(state, t);
    host.lobbyButton('daily-puzzle', {
      icon: 'img/puzzle-day.svg',
      label: 'Puzzle of the Day',
      pill: done ? 'Solved' : 'Puzzle',
      badge: streak >= 2 ? `${streak}🔥` : '',
      news: !done,
    });
  }

  /* ---------------- the screen ---------------- */

  function build() {
    el = document.createElement('div');
    el.className = 'potd';
    el.hidden = true;
    el.innerHTML = `
      <div class="potd-head">
        <button class="potd-x" data-x aria-label="Close">${ICON_X}</button>
        <h2 class="potd-title" data-title></h2>
        <p class="potd-goal" data-goal></p>
        <div class="potd-count" data-count><b data-left></b><span data-left-label>moves left</span></div>
      </div>
      <div class="potd-stage ms-root" data-stage></div>`;
    root.appendChild(el);
    el.querySelector('[data-x]').addEventListener('click', () => close(true));
  }

  /** What BoardView reads: the board, nothing of the main game's flow or prices. */
  function fake() {
    return {
      columns: cols, columnCount: cols.length, cfg: { capacity: CAP, undoCost: 0 },
      level: 1, netWorth: 0, turn: moves.length, floor: 0, nextFloor: 1, levelProgress: 0,
      turnsUntilDrop: 0, currentInterval: 0, telegraphing: false, selected, status: 'playing',
      canUndo: history.length > 0 && !busy, canAffordSort: true, freeSorts: 0, kind: 'normal',
      sortPrice: 0, sortCanHelp: moves.length > 0 && !busy, locked: null, ice: [],
    };
  }

  function mountBoard() {
    const stage = el.querySelector('[data-stage]');
    stage.innerHTML = '';
    view = new BoardView(stage, fake(), host);
    view.chipSet = chipSet();
    // The ledge's two buttons, as the puzzle's: a free Undo, and Restart.
    const undo = stage.querySelector('[data-undo]');
    const restart = stage.querySelector('[data-sort]');
    undo.innerHTML = `${ICON_UNDO}<span>Undo</span><span class="act-cost">Free</span>`;
    restart.innerHTML = `${ICON_RESTART}<span>Restart</span>`;
    restart.classList.add('potd-restart');
    view.el.undoCost = document.createElement('span');     // BoardView writes prices here; nothing shows them
    view.el.sortCost = document.createElement('span');
    view.on('tap', onTap);
    view.on('undo', onUndo);
    view.on('sort', () => onRestart());
    paint();
  }

  function paint() {
    if (!view) return;
    view.game = fake();
    view.update(vmOf(view.game));
    const left = p.par - moves.length;
    el.querySelector('[data-left]').textContent = Math.max(0, left);
    el.querySelector('[data-left-label]').textContent = left === 1 ? 'move left' : 'moves left';
    el.querySelector('[data-count]').classList.toggle('low', left <= 2 && !isSolved(cols));
  }

  function load() {
    today = localDateKey();
    p = puzzleFor(today, PUZZLES);
    practice = !!state.days[today]?.solved;
    cols = p.board.map((c) => [...c]);
    moves = [];
    history = [];
    selected = null;
    el.querySelector('[data-title]').textContent = `#${p.number} · ${p.day}`;
    el.querySelector('[data-goal]').innerHTML = practice
      ? `Solved today · play again for fun`
      : `Clear the board in <b>${p.par}</b> moves`;
  }

  async function open() {
    if (!el) build();
    else if (!el.isConnected) root.appendChild(el);     // the main board rebuilt itself underneath
    load();
    opened = true;
    el.hidden = false;
    root.classList.add('potd-on');
    onOpen?.();
    mountBoard();
    const day = (state.days[today] ||= { tries: 1, solved: false, moves: null });
    track('puzzle_open', { solved: day.solved, tries: day.tries, streak: liveStreak(state, today) });
    if (day.solved) { await wait(250); solvedCard({ already: true }); }
  }

  function close(toLobby = false) {
    if (!opened) return;
    opened = false;
    el.hidden = true;
    root.classList.remove('potd-on');
    view = null;
    el.querySelector('[data-stage]').innerHTML = '';
    onClose?.();
    refreshLobby();
    if (toLobby) host.exit();
  }

  /* ---------------- play ---------------- */

  async function onTap(i) {
    if (busy || !p || isSolved(cols) || moves.length >= p.par) return;
    if (selected === null) {
      if (!cols[i].length) return;
      selected = i;
      host.sound('lift');
      paint();
      return;
    }
    if (selected === i) { selected = null; paint(); return; }
    if (canMove(cols, selected, i)) { await move(selected, i); return; }
    if (cols[i].length) { selected = i; host.sound('lift'); paint(); return; }
    view.shake(i); host.haptic(9); host.sound('error');
  }

  async function move(from, to) {
    busy = true;
    host.busy(true);
    const r = applyMove(cols, from, to);
    view.prepareMove(from);
    history.push(cols.map((c) => [...c]));
    moves.push([from, to]);
    // The coins land first; a full tube cashes in after.
    const mid = cols.map((c) => [...c]);
    for (let k = 0; k < r.count; k++) mid[to].push(mid[from].pop());
    cols = mid;
    selected = null;
    paint();
    await view.finishMove(to, r.count);
    if (r.banked.length) {
      for (const c of r.banked) view.bankPop(c, r.value * CAP);
      host.sound('bank');
      host.haptic([0, 14, 40, 22]);
      const tubes = r.banked.map((c) => view.tubes[c]?.getBoundingClientRect()).filter(Boolean);
      tubes.forEach((rect) => view.fx.burst?.(rect, '#ffd36b', 12));
      await wait(420);
    }
    cols = r.cols;
    busy = false;
    host.busy(false);
    paint();
    if (isSolved(cols)) { await solved(); return; }
    if (moves.length >= p.par) await outOfMoves();
  }

  function onUndo() {
    if (busy || !history.length) return;
    cols = history.pop();
    moves.pop();
    selected = null;
    host.sound('undo');
    paint();
  }

  async function onRestart(quiet = false) {
    if (busy) return;
    cols = p.board.map((c) => [...c]);
    if (moves.length && !quiet) {
      (state.days[today] ||= { tries: 1, solved: false, moves: null }).tries += 1;
      host.save();
    }
    moves = [];
    history = [];
    selected = null;
    host.sound('undo');
    paint();
  }

  /* ---------------- outcomes ---------------- */

  async function solved() {
    const day = state.days[today];
    if (practice || day?.solved) {
      host.sound('levelup');
      track('puzzle_replayed', { moves: moves.length });
      await solvedCard({ already: true, replay: true });
      return;
    }
    const got = recordSolve(state, p, moves, today);
    host.wallet.earn(got.coins + got.bonus, 'daily-puzzle');
    host.stat('puzzles');
    host.save();
    track('puzzle_solved', { moves: moves.length, tries: day?.tries ?? 1, streak: got.streak, coins: got.coins + got.bonus });
    const gains = [`+${got.coins} coins`];
    if (got.bonus) gains.push(`🔥 ${got.streak}-day streak · +${got.bonus}`);
    else gains.push('Streak started · come back tomorrow');
    await host.celebrate({
      juicy: true,
      headline: 'SOLVED!',
      ribbon: `Puzzle #${p.number}`,
      kicker: 'Puzzle of the day',
      title: `${p.par} moves · perfect`,
      reward: gains,
      go: 'Nice!',
    });
    refreshLobby();
    await solvedCard({});
  }

  function nextIn() {
    const now = new Date();
    const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const m = Math.max(1, Math.round((mid - now) / 60000));
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }

  /** After a solve, or opening a solved day: share the clip, play again, or go. */
  function solvedCard({ already = false }) {
    return new Promise((resolve) => {
      const streak = liveStreak(state, today);
      const canShare = host.canShareFile?.();
      const card = host.cards.show(`
        <div class="ovl-stack">
          ${host.art.cat('cheer', 190, 'ovl-cheer')}
          <div class="ovl-card">
            <p class="ovl-kicker">Puzzle #${p.number} · ${p.day}</p>
            <h2 class="ovl-h">${already ? 'Solved today' : 'Share your solve'}</h2>
            <p class="ovl-sub">${streak >= 2 ? `🔥 ${streak}-day streak · ` : ''}Next puzzle in ${nextIn()}</p>
            ${canShare ? `<button class="ovl-btn primary" data-share>${ICON_SHARE} Share my solve</button>` : ''}
            <button class="ovl-btn ${canShare ? 'alt' : 'primary'}" data-again>Play again</button>
            <button class="ovl-btn ghost" data-done>Done</button>
          </div>
        </div>`, 'milestone');
      card.addEventListener('click', async (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        if (b.matches('[data-share]')) { await shareClip(); return; }   // the card stays up
        await host.cards.dismiss(card);
        resolve();
        if (b.matches('[data-again]')) { practice = true; load(); el.querySelector('[data-goal]').textContent = 'Solved today · play again for fun'; paint(); }
        else close(true);
      });
    });
  }

  async function outOfMoves() {
    const day = (state.days[today] ||= { tries: 1, solved: false, moves: null });
    track('puzzle_failed', { tries: day.tries, practice });
    host.sound('setback');
    const again = await new Promise((resolve) => {
      const card = host.cards.show(`
        <div class="ovl-stack">
          ${host.art.cat('slump', 190, 'cat-lying')}
          <div class="ovl-card">
            <p class="ovl-kicker">Out of moves</p>
            <h2 class="ovl-h">So close!</h2>
            <p class="ovl-sub">${p.par} moves is the best line. Retries are free.</p>
            <button class="ovl-btn primary" data-again>Try again</button>
            <button class="ovl-btn ghost" data-later>Later</button>
          </div>
        </div>`, 'locked');
      card.addEventListener('click', async (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        await host.cards.dismiss(card);
        resolve(b.matches('[data-again]'));
      });
    });
    if (again) await onRestart();
    else { await onRestart(); close(true); }
  }

  /* ---------------- the clip ---------------- */

  async function shareClip() {
    const day = state.days[today];
    const solve = day?.moves || p.solution;
    const set = chipSet() === 'b' ? 'chipb' : 'chip';
    const src = (html) => /src="([^"]+)"/.exec(html)?.[1] || '';
    const imgs = await loadClipArt({
      chips: Object.fromEntries([1, 5, 10, 20, 50].map((v) => [v, host.asset(`img/${set}-${v}.png`)])),
      tube: host.asset('img/tube.png'),
      logo: src(host.art.logo?.(300) || ''),
      cat: src(host.art.cat('cheer', 300)),
      peek: src(host.art.cat('peek', 300)),
    });
    const tl = buildTimeline({ board: p.board, moves: solve, mode: 'player' });
    const o = { number: p.number, day: p.day, par: p.par, used: solve.length, imgs };
    const type = clipType();
    const W = 720, H = 1280;

    const card = host.cards.show(`
      <div class="ovl-stack">
        <div class="ovl-card potd-clip">
          <p class="ovl-kicker">Your clip</p>
          <canvas class="potd-clip-canvas" width="${W}" height="${H}"></canvas>
          <div class="potd-clip-bar"><i data-bar></i></div>
          <p class="ovl-sub" data-clip-line>${type ? 'Making your clip…' : 'Making your picture…'}</p>
        </div>
      </div>`, 'milestone');
    const canvas = card.querySelector('canvas');
    const bar = card.querySelector('[data-bar]');
    const name = `cash-paws-puzzle-${p.number}`;
    const textLine = `I solved Cash Paws Puzzle of the Day #${p.number} in ${solve.length} moves 🐾 Can you?`;
    let blob = null;
    let ext = 'png';
    if (type) {
      blob = await recordClip(canvas, tl, o, { onProgress: (k) => { bar.style.width = `${Math.round(k * 100)}%`; } });
      ext = type.includes('mp4') ? 'mp4' : 'webm';
    }
    if (!blob) {
      // No recorder on this phone: share the solved card as a picture.
      drawFrame(canvas.getContext('2d'), W, H, tl, tl.duration - 0.1, o);
      blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      ext = 'png';
    }
    bar.style.width = '100%';
    card.querySelector('[data-clip-line]').textContent = 'Opening share…';
    track('puzzle_share', { kind: ext, kb: Math.round((blob?.size || 0) / 1024) });
    await host.shareFile({ blob, name: `${name}.${ext}`, text: textLine, from: 'puzzle' });
    await host.cards.dismiss(card);
  }

  return {
    open,
    close,
    refreshLobby,
    get isOpen() { return opened; },
    relayout() { view?.relayout(); },
    setChipSet(s) { if (view) { view.chipSet = s; paint(); } },
    serialize: () => state,
    load(saved) { state = potdState(saved); },
    /** Dev only: start over, as if never played. */
    reset() { state = potdState(null); refreshLobby(); },
    /** Dev and tests: the moves that solve today's puzzle. */
    get solution() { return p?.solution; },
  };
}
