/**
 * View layer.
 *
 * Renders from a plain view-model rather than the live game, because overlay
 * sequencing replays past states: by the time the UI animates a bank, the
 * engine has already moved on. Snapshots are captured as each event fires.
 *
 * Columns only gain or lose chips at the top, so tubes are synced by pushing
 * and popping DOM children. Chip elements stay stable, which is what the move
 * animation needs.
 */

import { catAvatar, knobCat, coinIcon, icons, refCat, refHeart } from './art.js';

export const money = (n) => '$' + n.toLocaleString('en-US');

/** Freeze everything the screen needs. Must be a deep copy. */
export function vmOf(g) {
  return {
    columns: g.columns.map((c) => [...c]),
    columnCount: g.columnCount,
    capacity: g.cfg.capacity,
    level: g.level,
    netWorth: g.netWorth,
    coins: g.coins,
    turn: g.turn,
    floor: g.floor,
    nextFloor: g.nextFloor,
    levelProgress: g.levelProgress,
    turnsUntilDrop: g.turnsUntilDrop,
    currentInterval: g.currentInterval,
    telegraphing: g.telegraphing,
    selected: g.selected,
    status: g.status,
    canUndo: g.canUndo,
    canAffordSort: g.canAffordSort,
    sortCanHelp: g.sortCanHelp,
  };
}

/** 5 or fewer on one row; 6-8 split into two balanced rows. */
export function rowsFor(n) {
  if (n <= 5) return [n];
  return [Math.ceil(n / 2), Math.floor(n / 2)];
}

const RAIL_SEGMENTS = 5;

export class BoardView {
  constructor(root, game) {
    this.root = root;
    this.app = document.getElementById('app');
    this.game = game;
    this.tubes = [];
    this.handlers = {};
    this.build();
    this.update();
  }

  on(name, fn) { this.handlers[name] = fn; }
  fire(name, ...args) { this.handlers[name]?.(...args); }

  build() {
    this.root.innerHTML = `
      <header class="hdr">
        <div class="hdr-top">
          <div class="coins" data-coin-pill>
            ${coinIcon(26)}
            <span class="coins-n" data-coins>0</span>
            <span class="coins-add">+</span>
          </div>
          <span class="hdr-spacer"></span>
          <button class="pause-btn" data-menu aria-label="Menu">${icons.pause(20)}</button>
        </div>

        <h1 class="level-title">Level <span data-lv>1</span></h1>

        <div class="bar">
          <span class="bar-fill" data-fill></span>
          <span class="bar-knob" data-knob>${knobCat(38)}</span>
        </div>

        <p class="bar-figure" data-goal></p>
        <p class="bar-sub" data-sub></p>

        <div class="flow" data-flow>
          <span class="flow-label">FLOW</span>
          <span class="pips" data-pips></span>
          <span class="turn" data-turn>T000</span>
        </div>
      </header>

      <main class="board" data-board>
        <div data-rows></div>
      </main>

      <div class="ledge">
        ${refCat(150)}
        ${refHeart(26)}
        <footer class="foot">
          <button class="act act-undo" data-undo>
            ${icons.undo(20)}<span>Undo</span>
            <span class="act-cost">${coinIcon(18)}<span data-undo-cost>20</span></span>
          </button>
          <button class="act act-sort" data-sort>
            ${icons.sort(20)}<span>Sort</span>
            <span class="act-cost">${coinIcon(18)}<span data-sort-cost>150</span></span>
          </button>
        </footer>
      </div>

    `;

    const $ = (s) => this.root.querySelector(s);
    this.el = {
      coins: $('[data-coins]'), coinPill: $('[data-coin-pill]'),
      lv: $('[data-lv]'), goal: $('[data-goal]'), sub: $('[data-sub]'),
      fill: $('[data-fill]'), knob: $('[data-knob]'),
      flow: $('[data-flow]'), pips: $('[data-pips]'),
      board: $('[data-board]'), rows: $('[data-rows]'), turn: $('[data-turn]'),
      undo: $('[data-undo]'), sort: $('[data-sort]'),
      undoCost: $('[data-undo-cost]'), sortCost: $('[data-sort-cost]'),
    };

    this.el.undoCost.textContent = this.game.cfg.undoCost;
    this.el.sortCost.textContent = this.game.cfg.sortCost;

    this.el.rows.addEventListener('click', (e) => {
      const tube = e.target.closest('.tube');
      if (tube) this.fire('tap', Number(tube.dataset.col));
    });
    this.el.undo.addEventListener('click', () => this.fire('undo'));
    this.el.sort.addEventListener('click', () => this.fire('sort'));
    $('[data-menu]').addEventListener('click', () => this.fire('settings'));

    this.buildTubes(this.game.columnCount);
  }

  buildTubes(count) {
    this.el.rows.innerHTML = '';
    this.tubes = [];
    let index = 0;
    const layout = rowsFor(count);
    this.el.board.classList.toggle('rows-2', layout.length > 1);
    for (const n of layout) {
      const row = document.createElement('div');
      row.className = 'row';
      for (let i = 0; i < n; i++) {
        const tube = document.createElement('div');
        tube.className = 'tube';
        tube.dataset.col = index;
        const glass = document.createElement('div');
        glass.className = 'glass';
        for (let c = 0; c < this.game.cfg.capacity; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell ghost';
          glass.appendChild(cell);
        }
        tube.appendChild(glass);
        row.appendChild(tube);
        this.tubes.push(tube);
        index++;
      }
      this.el.rows.appendChild(row);
    }
    this.renderedColumns = count;
  }

  /** Chips are the source artwork; the denomination is printed on it. */
  chipEl(value) {
    const el = document.createElement('img');
    el.className = `chip v${value}`;
    el.src = `img/${this.chipSet === 'b' ? 'chipb' : 'chip'}-${value}.png`;
    el.alt = '$' + value;
    el.draggable = false;
    el.dataset.v = value;
    el.dataset.set = this.chipSet || 'a';
    return el;
  }

  /** Top chip of a column, as a DOM node. */
  topChip(col) {
    const cells = this.tubes[col]?.querySelector('.glass')?.children;
    if (!cells) return null;
    for (const cell of cells) if (cell.firstElementChild) return cell.firstElementChild;
    return null;
  }

  syncTube(tube, values, cap) {
    const cells = tube.querySelector('.glass').children;
    for (let c = 0; c < cap; c++) {
      const cell = cells[c];
      const value = values[cap - 1 - c];
      const chip = cell.firstElementChild;
      if (value === undefined) {
        if (chip) chip.remove();
        cell.classList.add('ghost');
        continue;
      }
      cell.classList.remove('ghost');
      if (!chip) cell.appendChild(this.chipEl(value));
      else if (chip.dataset.v !== String(value) || chip.dataset.set !== (this.chipSet || 'a')) {
        chip.replaceWith(this.chipEl(value));
      }
    }
  }

  update(vm = vmOf(this.game)) {
    this.el.coins.textContent = vm.coins;
    this.el.lv.textContent = vm.level;
    this.el.turn.textContent = 'T' + String(vm.turn).padStart(3, '0');
    this.el.goal.textContent = `${money(vm.netWorth)} / ${money(vm.nextFloor)}`;
    this.el.sub.textContent = `Next level at ${money(vm.nextFloor)}`;

    const pct = Math.max(0, Math.min(1, vm.levelProgress)) * 100;
    this.el.fill.style.width = pct.toFixed(1) + '%';
    this.el.knob.style.left = pct.toFixed(1) + '%';

    if (this.el.pips.children.length !== vm.currentInterval) {
      this.el.pips.innerHTML = '';
      for (let i = 0; i < vm.currentInterval; i++) {
        const pip = document.createElement('span');
        pip.className = 'pip';
        this.el.pips.appendChild(pip);
      }
    }
    const left = Math.max(0, vm.turnsUntilDrop);
    [...this.el.pips.children].forEach((p, i) => p.classList.toggle('on', i < left));
    this.el.flow.classList.toggle('warn', vm.telegraphing);
    this.el.board.classList.toggle('telegraph', vm.telegraphing);

    if (this.renderedColumns !== vm.columnCount) this.buildTubes(vm.columnCount);
    this.tubes.forEach((tube, i) => {
      this.syncTube(tube, vm.columns[i] || [], vm.capacity);
      tube.classList.toggle('selected', vm.selected === i);
      tube.classList.toggle('full', (vm.columns[i] || []).length >= vm.capacity);
    });

    this.el.undo.disabled = !vm.canUndo;
    this.el.sort.disabled = !(vm.canAffordSort && vm.sortCanHelp);
    this.lastVm = vm;
    this.fitBoard();
  }

  /**
   * Size the chips to whatever vertical space is actually left. The design
   * target is 402x874, but real phones are shorter and lose more again to the
   * status and gesture bars, so fixed cell heights would push the nav off.
   */
  fitBoard() {
    const board = this.el.board;
    const rows = board.querySelectorAll('.row').length || 1;
    const cap = this.game.cfg.capacity;
    const h = this.app.clientHeight;

    /*
     * Every layout switch is decided from stable inputs — screen height and row
     * count — and applied before measuring. Deriving `tight` from the computed
     * cell size instead fed back into the padding it depended on, so the board
     * resized by one frame's lag on every tap.
     */
    this.app.classList.toggle('short', h < 800);
    this.app.classList.toggle('xshort', h < 660);
    board.classList.toggle('rows-2', rows > 1);
    board.classList.toggle('tight', h < 700 || (rows > 1 && h < 820));

    const cs = getComputedStyle(board);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const gaps = (rows - 1) * parseFloat(cs.rowGap || 0);
    const avail = board.clientHeight - padY - gaps;
    if (avail <= 0) return;

    const TUBE_PAD = 36; // the tube art's rim and rounded base, slightly compressed
    let cell = Math.floor((avail / rows - TUBE_PAD) / cap);
    // 16px is the floor a 4-inch screen needs at eight columns once the system
    // bars take their share. Chips are small there, but nothing overlaps.
    cell = Math.max(16, Math.min(58, cell));

    board.style.setProperty('--cell-h', cell + 'px');
    board.style.setProperty('--chip-d', Math.max(18, cell - 8) + 'px');
  }


  /* ---------------- feedback ---------------- */

  /** Record where the travelling chip starts, before the board updates. */
  prepareMove(from) {
    const chip = this.topChip(from);
    this.flightFrom = chip ? chip.getBoundingClientRect() : null;
  }

  /** Slide the arrived chips from where they were lifted, top one last. */
  finishMove(to, count = 1) {
    const from = this.flightFrom;
    this.flightFrom = null;
    const tube = this.tubes[to];
    if (!from || !tube) return;

    const chips = [];
    for (const cell of tube.querySelector('.glass').children) {
      if (cell.firstElementChild) chips.push(cell.firstElementChild);
      if (chips.length === count) break;
    }

    chips.forEach((chip, i) => {
      const now = chip.getBoundingClientRect();
      const dx = from.left - now.left;
      const dy = from.top - now.top;
      if (!dx && !dy) return;
      const delay = (chips.length - 1 - i) * 45;   // bottom chip leaves first
      chip.style.animation = 'none';
      chip.style.transition = 'none';
      chip.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        chip.style.transition = `transform var(--t-base) var(--ease) ${delay}ms`;
        chip.style.transform = '';
        setTimeout(() => { chip.style.transition = ''; chip.style.animation = ''; }, 300 + delay);
      });
    });
  }

  /**
   * The flow used to take over the whole screen. It fires often enough that a
   * full-bleed card became an interruption, so it now reads on the board
   * itself: the columns flash and a count rises off the FLOW label.
   */
  flowPulse(count) {
    this.el.board.classList.add('flowing');
    setTimeout(() => this.el.board.classList.remove('flowing'), 560);
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'flow-badge';
      badge.textContent = '+' + count;
      this.el.flow.appendChild(badge);
      setTimeout(() => badge.remove(), 1000);
    }
  }

  /** Green pulse and a rising figure when a column banks. */
  bankPop(col, amount) {
    const tube = this.tubes[col];
    if (!tube) return;
    tube.classList.add('banking');
    setTimeout(() => tube.classList.remove('banking'), 520);
    const pop = document.createElement('span');
    pop.className = 'pop';
    pop.textContent = '+' + money(amount);
    tube.appendChild(pop);
    setTimeout(() => pop.remove(), 900);
    this.pulseCoins();
  }

  pulseCoins() {
    this.el.coinPill.classList.remove('pulse');
    void this.el.coinPill.offsetWidth;
    this.el.coinPill.classList.add('pulse');
  }

  /** An illegal target refuses rather than ignoring the tap. */
  shake(col) {
    const tube = this.tubes[col];
    if (!tube) return;
    tube.classList.remove('shake');
    void tube.offsetWidth;
    tube.classList.add('shake');
    setTimeout(() => tube.classList.remove('shake'), 400);
  }

}
