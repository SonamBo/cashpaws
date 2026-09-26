/**
 * The player's coins. They belong to the shell, not to any game: the shop and
 * the cats spend them, and every game earns them through host.wallet.
 *
 * `coinsEarned` counts lifetime earnings and drives cat unlocks. Handing back a
 * move's payout on undo lowers it again, so undo cannot be used to farm it.
 */

export class Wallet {
  constructor(coins, stats) {
    this.balance = coins;
    this.stats = stats;
    this.listeners = new Set();
  }

  get coins() { return this.balance; }
  canAfford(n) { return this.balance >= n; }

  earn(n, reason = '') {
    n = Math.floor(n);
    if (n <= 0) return;
    this.balance += n;
    // A top-up so a broke player always has one way out is a gift, not earnings.
    if (reason !== 'safety-net') this.stats.coinsEarned = (this.stats.coinsEarned || 0) + n;
    this.notify(n, reason);
  }

  spend(n, reason = '') {
    n = Math.floor(n);
    if (n <= 0) return true;
    if (this.balance < n) return false;
    this.balance -= n;
    if (reason === 'undo-reversal') {
      this.stats.coinsEarned = Math.max(0, (this.stats.coinsEarned || 0) - n);
    }
    this.notify(-n, reason);
    return true;
  }

  /** Development and tests only. */
  set(n) {
    this.balance = Math.max(0, Math.floor(n));
    this.notify(0, 'set');
  }

  onChange(fn) { this.listeners.add(fn); }
  notify(delta, reason) { this.listeners.forEach((fn) => fn(this.balance, delta, reason)); }
}
