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

import { catAvatar, catPeek, coinIcon, icons } from './art.js';

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
    canAffordShuffle: g.canAffordShuffle,
    shuffleCanHelp: g.shuffleCanHelp,
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
          <span class="avatar">${catAvatar(34)}</span>
          <div class="coins" data-coin-pill>
            ${coinIcon(22)}
            <span class="coins-n" data-coins>0</span>
            <span class="coins-add">+</span>
          </div>
          <span class="hdr-spacer"></span>
          <button class="icon-btn" data-menu aria-label="Menu">${icons.pause(22)}</button>
        </div>

        <div class="hdr-meta">
          <span class="lv">LV <b data-lv>01</b></span>
          <span class="goal" data-goal></span>
        </div>

        <p class="net" data-net>$0</p>
        <div class="rail" data-rail></div>

        <div class="flow" data-flow>
          <span class="flow-label">FLOW</span>
          <span class="pips" data-pips></span>
        </div>
      </header>

      <main class="board" data-board>
        <div data-rows></div>
        <div class="mascot">${catPeek(104)}</div>
      </main>

      <footer class="foot">
        <button class="act" data-undo>
          ${icons.undo(20)}
          <span class="act-cost">${coinIcon(16)}<span data-undo-cost>20</span></span>
        </button>
        <button class="act" data-shuffle>
          ${icons.shuffle(20)}
          <span class="act-cost">${coinIcon(16)}<span data-shuffle-cost>30</span></span>
        </button>
        <span class="turn" data-turn>T000</span>
      </footer>

    `;

    const $ = (s) => this.root.querySelector(s);
    this.el = {
      coins: $('[data-coins]'), coinPill: $('[data-coin-pill]'),
      lv: $('[data-lv]'), goal: $('[data-goal]'), net: $('[data-net]'),
      rail: $('[data-rail]'), flow: $('[data-flow]'), pips: $('[data-pips]'),
      board: $('[data-board]'), rows: $('[data-rows]'), turn: $('[data-turn]'),
      undo: $('[data-undo]'), shuffle: $('[data-shuffle]'),
      undoCost: $('[data-undo-cost]'), shuffleCost: $('[data-shuffle-cost]'),
    };

    this.el.undoCost.textContent = this.game.cfg.undoCost;
    this.el.shuffleCost.textContent = this.game.cfg.shuffleCost;

    for (let i = 0; i < RAIL_SEGMENTS; i++) {
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.innerHTML = '<span class="seg-fill"></span>';
      this.el.rail.appendChild(seg);
    }

    this.el.rows.addEventListener('click', (e) => {
      const tube = e.target.closest('.tube');
      if (tube) this.fire('tap', Number(tube.dataset.col));
    });
    this.el.undo.addEventListener('click', () => this.fire('undo'));
    this.el.shuffle.addEventListener('click', () => this.fire('shuffle'));
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
        for (let c = 0; c < this.game.cfg.capacity; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell ghost';
          tube.appendChild(cell);
        }
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
    const cells = this.tubes[col]?.children;
    if (!cells) return null;
    for (const cell of cells) if (cell.firstElementChild) return cell.firstElementChild;
    return null;
  }

  syncTube(tube, values, cap) {
    const cells = tube.children;
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
    this.el.lv.textContent = String(vm.level).padStart(2, '0');
    this.el.net.textContent = money(vm.netWorth);
    this.el.turn.textContent = 'T' + String(vm.turn).padStart(3, '0');
    this.el.goal.textContent =
      `${money(vm.netWorth - vm.floor)} / ${money(vm.nextFloor - vm.floor)}`;

    const first = Math.max(1, vm.level - 2);
    [...this.el.rail.children].forEach((seg, i) => {
      const lv = first + i;
      const done = lv < vm.level;
      seg.classList.toggle('done', done);
      seg.classList.toggle('future', lv > vm.level);
      seg.firstElementChild.style.width =
        lv === vm.level ? (vm.levelProgress * 100).toFixed(1) + '%' : done ? '100%' : '0%';
    });

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
    this.el.shuffle.disabled = !(vm.canAffordShuffle && vm.shuffleCanHelp);
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

    this.app.classList.toggle('short', this.app.clientHeight < 800);

    const cs = getComputedStyle(board);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const gaps = (rows - 1) * parseFloat(cs.rowGap || 0);
    const avail = board.clientHeight - padY - gaps;
    if (avail <= 0) return;

    const TUBE_PAD = 16; // 6px padding plus 2px border, top and bottom
    let cell = Math.floor((avail / rows - TUBE_PAD) / cap);
    cell = Math.max(30, Math.min(58, cell));

    board.style.setProperty('--cell-h', cell + 'px');
    board.style.setProperty('--chip-d', Math.max(24, cell - 8) + 'px');
    board.classList.toggle('tight', cell < 42);
  }

  /* ---------------- feedback ---------------- */

  /** Record where the travelling chip starts, before the board updates. */
  prepareMove(from) {
    const chip = this.topChip(from);
    this.flightFrom = chip ? chip.getBoundingClientRect() : null;
  }

  /** Slide the arrived chip from where it was lifted. */
  finishMove(to) {
    const chip = this.topChip(to);
    const from = this.flightFrom;
    this.flightFrom = null;
    if (!chip || !from) return;
    const now = chip.getBoundingClientRect();
    const dx = from.left - now.left;
    const dy = from.top - now.top;
    if (!dx && !dy) return;
    chip.style.animation = 'none';
    chip.style.transition = 'none';
    chip.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      chip.style.transition = 'transform var(--t-base) var(--ease)';
      chip.style.transform = '';
      setTimeout(() => { chip.style.transition = ''; chip.style.animation = ''; }, 260);
    });
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
