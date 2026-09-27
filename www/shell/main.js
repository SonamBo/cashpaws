/**
 * The shell. Boots the installed game inside the lobby, header, tabs, save
 * and back-button handling every game shares.
 *
 * Which game is installed is decided in games/active.js, and nowhere else.
 * This file must never import from a game's folder.
 */

import game from '../games/active.js';
import * as store from './save.js';
import { Wallet } from './wallet.js';
import { createAds } from './ads.js';
import { createAnalytics } from './analytics.js';
import { createHost, loadStyles } from './host.js';
import { Header } from './header.js';
import { LobbyView } from './lobby.js';
import { Panels } from './tabs.js';
import { CATS, catById, unlockProgress, perkIn } from './cats.js';
import { setWornCat, icons } from './art.js';
import {
  mountOverlays, anyCardOpen, confirm, pauseMenu, settings, toast, boxCard, celebrate,
} from './overlays.js';
import { localDay, ensureDay, claimable, claimTask, claimBonus, newlyDone } from './daily.js';
import { isReady, msUntil, formatWait, openBox, adOpensLeft, DEFAULT_VALUE } from './rewards.js';
import * as Q from './quest.js';
import { bell, introCard, findingCard, pathCard, wonCard, overCard } from './questui.js';

const DEV = new URLSearchParams(location.search).has('dev');
const APP_VERSION = '1.8.0';

// Game folders are named after their id; assets and styles resolve from here.
game.path = `games/${game.id}/`;

let record;           // the whole save
let shell;            // record.shell, the part the shell owns
let wallet, header, lobby, panels, instance, ads, analytics;
let screen = 'lobby';

/* ---------------------------------------------------------------- *
 * Save
 * ---------------------------------------------------------------- */

function save() {
  if (!instance) return;
  shell.coins = wallet.coins;
  record.games[game.id] = { v: game.saveVersion, data: instance.serialize() };
  store.write(record);
}

/** One count per calendar day the app is opened, for daily tasks and stats. */
function markDay() {
  const today = localDay();      // the phone's date, not UTC
  if (shell.stats.lastDay === today) return;
  // A clock wound backwards does not earn a new day.
  if (shell.stats.lastDay && today < shell.stats.lastDay) return;
  shell.stats.lastDay = today;
  shell.stats.daysPlayed += 1;
}

/* ---------------------------------------------------------------- *
 * Daily tasks — the rules live in daily.js
 * ---------------------------------------------------------------- */

const gameStats = () => (shell.gameStats[game.id] ||= {});

/** Draw today's tasks if it is a new day, and keep the tab's badge honest. */
function refreshDaily() {
  if (!instance) return;
  markDay();
  ensureDay(shell.daily, game, gameStats(), localDay(), (t) => instance.canOffer?.(t) ?? true);
  lobby.setDailyBadge(claimable(shell.daily, gameStats()));
}

/** A stat moved during play: announce any task it just finished, quietly. */
function onStat(before, after) {
  if (shell.daily.game !== game.id) return;
  for (const t of newlyDone(shell.daily, before, after)) {
    toast(`${icons.check(16)} <span>Task done &middot; ${t.text}</span>`);
  }
  lobby.setDailyBadge(claimable(shell.daily, after));
}

function onClaim(which) {
  const stats = gameStats();
  const coins = which === 'bonus' ? claimBonus(shell.daily, stats) : claimTask(shell.daily, which, stats);
  if (!coins) return;
  const task = which === 'bonus' ? null : shell.daily.tasks[which];
  track(which === 'bonus' ? 'daily_bonus' : 'daily_claim', which === 'bonus'
    ? { coins, streak: shell.daily.streak }
    : { coins, task: task?.id, tier: task?.tier });
  wallet.earn(coins, 'daily');
  lobby.setDailyBadge(claimable(shell.daily, stats));
  panels.show('daily', panelContext());
  save();
}

/* ---------------------------------------------------------------- *
 * Rewards Box — the rules live in rewards.js
 * ---------------------------------------------------------------- */

function refreshBox() {
  if (lobby && shell) lobby.setBoxReady(isReady(shell.box, Date.now()));
}

async function onBox() {
  if (panels.open || anyCardOpen()) return;
  const day = localDay();
  const ready = isReady(shell.box, Date.now());
  const adsLeft = adOpensLeft(shell.box, day);
  const pick = await boxCard({
    ready,
    wait: formatWait(msUntil(shell.box, Date.now())),
    adOffer: !ready && adsLeft > 0 && ads.rewarded.available('box-early'),
    adsLeft,
  });
  if (pick !== 'open' && pick !== 'ad') return;
  if (pick === 'ad' && !(await ads.rewarded.show('box-early'))) return;

  const won = openBox(shell.box, {
    now: Date.now(), day, viaAd: pick === 'ad',
    value: instance.rewardValue?.() ?? DEFAULT_VALUE,
  });
  if (!won) return;
  track('box_open', { coins: won.coins, via_ad: pick === 'ad', big: won.big });
  wallet.earn(won.coins, 'box');
  refreshBox();
  save();
  await celebrate({
    kicker: 'Rewards box',
    title: `+${won.coins} coins`,
    reward: won.big ? 'A big one!' : '',
    go: 'Nice',
  });
}

// A box can become ready while the lobby is on screen.
setInterval(refreshBox, 30000);

/* ---------------------------------------------------------------- *
 * Bell Quest — the rules live in quest.js, the cards in questui.js
 *
 * A game opts in by declaring `quest` in its manifest and reporting outcomes
 * through host.levelWon() and host.levelLost(). The card comes up on its own
 * when the app opens, and on returning to the lobby when there is news: a step
 * climbed, a result, or a new quest not yet offered this session.
 * ---------------------------------------------------------------- */

const questOn = () => !!game.quest;
const questSteps = () => game.quest?.steps ?? Q.STEPS;
const questValue = () => instance?.rewardValue?.() ?? Q.DEFAULT_VALUE;
let offeredThisSession = false;
let questOpen = false;

function questSync() {
  if (!questOn() || !shell) return false;
  return Q.sync(shell.quest, {
    now: Date.now(),
    level: shell.stats.bestLevel,
    unlockLevel: game.quest.unlockLevel ?? Q.UNLOCK_LEVEL,
  });
}

function refreshQuest() {
  if (!lobby || !shell) return;
  if (questSync()) save();
  const q = shell.quest;
  if (!questOn() || q.status === 'none') { lobby.setQuest({ visible: false }); return; }
  const pill = {
    offer: 'New!', won: 'Claim!', lost: 'Over', expired: 'Over',
    active: Q.formatShort(q.endsAt - Date.now()),
  }[q.status];
  lobby.setQuest({
    visible: true,
    pill,
    badge: q.status === 'active' ? `${q.step}/${q.steps}` : '',
    news: q.status === 'offer' || Q.hasNews(q),
  });
}

/** The lobby icon, or the automatic popup: whichever card the quest needs now. */
async function openQuest() {
  if (!questOn() || questOpen || panels.open || anyCardOpen() || screen !== 'lobby') return;
  questOpen = true;
  try {
    questSync();
    const q = shell.quest;
    if (q.status === 'won') {
      await wonCard({ share: q.share, grand: q.grand, others: q.field[q.steps] });
      track('quest_claim', { share: q.share, finishers: q.field[q.steps] + 1 });
      wallet.earn(Q.claim(q), 'quest');
      analytics.setUser('quest_wins', q.wins);
    } else if (q.status === 'lost' || q.status === 'expired') {
      const pick = await overCard({ reason: q.status, step: q.step, steps: q.steps, left: Q.catsLeft(q) });
      track('quest_over_seen', { reason: q.status, step: q.step, again: pick === 'again' });
      Q.acknowledge(q);
      save();
      if (pick === 'again') await startQuest();
    } else if (q.status === 'offer') {
      offeredThisSession = true;
      track('quest_offer', { level: shell.stats.bestLevel });
      const pick = await introCard({
        grand: Q.grandPrize(questValue()), steps: questSteps(), hours: Q.DURATION_MS / 3600000,
      });
      if (pick === 'start') await startQuest();
    } else if (q.status === 'active') {
      const advanced = q.step !== q.seenStep;
      q.seenStep = q.step;
      save();
      if ((await pathCard({ q, now: Date.now(), advanced })) === 'play') showScreen('game');
    }
  } finally {
    questOpen = false;
    refreshQuest();
    save();
  }
}

async function startQuest() {
  const q = shell.quest;
  const seed = (Math.random() * 2 ** 31) | 0;
  if (!Q.start(q, { now: Date.now(), value: questValue(), steps: questSteps(), seed })) return;
  track('quest_start', { grand: q.grand, quest_number: q.played });
  save();
  await findingCard({ grand: q.grand });
  const first = !q.seenRules;
  q.seenRules = true;
  save();
  if ((await pathCard({ q, now: Date.now(), first })) === 'play') showScreen('game');
}

/** Pop the card up by itself: always on app open, on lobby return only with news. */
function autoQuest(reason) {
  if (!questOn()) return;
  questSync();
  const q = shell.quest;
  if (q.status === 'none') return;
  if (reason === 'open' || Q.hasNews(q) || (q.status === 'offer' && !offeredThisSession)) openQuest();
}

function onLevelWon(info = {}) {
  flushCoins();
  track('level_up', { ...info, quest_step: Q.isActive(shell.quest) ? shell.quest.step + 1 : undefined });
  if (!questOn()) return;
  const q = shell.quest;
  const step = Q.advance(q, Date.now());
  if (!step) { refreshQuest(); return; }
  track(q.status === 'won' ? 'quest_win' : 'quest_step', { step, cats_left: Q.catsLeft(q) });
  toast(q.status === 'won'
    ? `${bell(20)} <span>Bell Quest complete! Claim your prize in the lobby.</span>`
    : `${bell(20)} <span>Bell Quest ${step}/${q.steps} &middot; ${Q.catsLeft(q)} cats left</span>`, 3200);
  refreshQuest();
  save();
}

function onLevelLost(info = {}) {
  flushCoins();
  track('level_lost', info);
  if (!questOn() || !Q.knockOut(shell.quest)) return;
  track('quest_knockout', { step: shell.quest.step });
  toast(`${bell(20)} <span>Out of Bell Quest</span>`, 3200);
  refreshQuest();
  save();
}

/** Before a level the player chose to lose: warn them if it ends a quest. */
async function confirmLevelLoss() {
  questSync();
  const q = shell.quest;
  if (!questOn() || !Q.isActive(q)) return true;
  const yes = await confirm({
    kicker: 'Bell Quest',
    title: 'Give up your quest?',
    line: `Dropping a level knocks you out of Bell Quest on step ${q.step + 1} of ${q.steps}. `
        + `${Q.catsLeft(q)} cats are still in, sharing ${q.grand.toLocaleString('en-US')} coins.`,
    ok: 'Drop a level anyway',
    cancel: 'Back',
  });
  track('quest_give_up_prompt', { step: q.step, gave_up: yes });
  return yes;
}

// The timer on the icon counts down while the lobby is on screen.
setInterval(refreshQuest, 30000);

/* ---------------------------------------------------------------- *
 * Analytics — the destination lives in analytics.js
 *
 * Coins: every earn and spend is an event, except the reasons a game marks as
 * frequent (Money Sort's banks), which are summed and sent at each level end,
 * so one level is a handful of events rather than dozens.
 * ---------------------------------------------------------------- */

const track = (name, params) => analytics?.track(name, params);
const pendingCoins = new Map();          // 'earn:bank' -> total since last flush

function onCoins(delta, reason) {
  if (!delta || !reason || reason === 'set') return;
  const dir = delta > 0 ? 'earn' : 'spend';
  if ((game.analytics?.batch || []).includes(reason)) {
    const k = `${dir}:${reason}`;
    pendingCoins.set(k, (pendingCoins.get(k) || 0) + Math.abs(delta));
    return;
  }
  sendCoins(dir, reason, Math.abs(delta));
}

function sendCoins(dir, reason, value) {
  track(dir === 'earn' ? 'earn_virtual_currency' : 'spend_virtual_currency', {
    virtual_currency_name: 'coins',
    value,
    [dir === 'earn' ? 'source' : 'item_name']: reason,
    balance: wallet.coins,
  });
}

function flushCoins() {
  for (const [k, v] of pendingCoins) { const [dir, reason] = k.split(':'); sendCoins(dir, reason, v); }
  pendingCoins.clear();
}

/** Facts that stay attached to every later event. */
function refreshUser() {
  analytics.setUser('game', game.id);
  analytics.setUser('best_level', shell.stats.bestLevel);
  analytics.setUser('cat_worn', shell.cats.worn);
  analytics.setUser('days_played', shell.stats.daysPlayed);
  analytics.setUser('cats_owned', shell.cats.owned.length);
}

/* ---------------------------------------------------------------- *
 * Boot
 * ---------------------------------------------------------------- */

async function boot() {
  record = store.read();
  shell = record.shell;
  markDay();

  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="screen" data-screen="lobby"></div>
    <div class="screen" data-screen="game">
      <div data-header></div>
      <div class="game-root" data-game-root></div>
    </div>`;

  wallet = new Wallet(shell.coins, shell.stats);
  analytics = createAnalytics({ dev: DEV });
  lobby = new LobbyView(root.querySelector('[data-screen="lobby"]'));
  header = new Header(root.querySelector('[data-header]'), { onPause });
  mountOverlays(root);
  panels = new Panels(root);
  panels.onBuy = buy;
  panels.onClaim = onClaim;
  panels.onClose = closePanel;

  wallet.onChange((coins, delta, reason) => {
    onCoins(delta, reason);
    header.setCoins(coins);
    if (delta > 0) header.pulseCoins();
    lobby.update({ coins, summary: shell.summaries[game.id] });
  });

  lobby.on('play', () => showScreen('game'));
  lobby.on('tab', onLobbyTab);
  lobby.on('settings', onSettings);
  lobby.on('box', onBox);
  lobby.on('quest', openQuest);

  setWornCat(shell.cats.worn);
  await loadStyles(game);

  ads = createAds({ dev: DEV, confirm, track });
  const host = createHost({
    game, shell, wallet, header, ads,
    onProgress: () => lobby.update({ coins: wallet.coins, summary: shell.summaries[game.id] }),
    onStat,
    save,
    exit: () => showScreen('lobby'),
    dev: DEV,
    events: { levelWon: onLevelWon, levelLost: onLevelLost, confirmLevelLoss, track },
  });

  instance = game.create(host, root.querySelector('[data-game-root]'));
  instance.setPerk?.(perkIn(game, shell.cats.worn)?.config || {});
  instance.setCosmetic?.(activeCosmetic());

  const slot = record.games[game.id];
  instance.start(slot ? slot.data : null, slot ? slot.v : null);
  refreshDaily();
  refreshBox();

  header.setCoins(wallet.coins);
  lobby.update({ coins: wallet.coins, summary: shell.summaries[game.id] });
  applySizeClasses();
  installBridge();
  refreshUser();
  track('app_ready', { coins: wallet.coins, best_level: shell.stats.bestLevel, quest: shell.quest.status });
  showScreen('lobby', { opening: true });
  save();

  if (DEV) wireDev();
}

/* ---------------------------------------------------------------- *
 * Screens and sizing
 * ---------------------------------------------------------------- */

function showScreen(next, { opening = false } = {}) {
  const from = screen;
  screen = next;
  if (next !== from || opening) track('screen_view', { screen_name: next, screen_class: next });
  const root = document.getElementById('app');
  root.classList.toggle('on-lobby', next === 'lobby');
  root.classList.toggle('on-game', next === 'game');
  if (next === 'game') {
    instance.relayout?.();
    instance.show?.();
  } else {
    instance.hide?.();
    refreshDaily();          // midnight may have passed while playing
    refreshBox();
    refreshQuest();
    lobby.update({ coins: wallet.coins, summary: shell.summaries[game.id] });
    if (opening) setTimeout(() => autoQuest('open'), 400);
    else if (from === 'game') setTimeout(() => autoQuest('return'), 250);
  }
}

/** Height classes are the shell's call; the game then lays itself out. */
function applySizeClasses() {
  const root = document.getElementById('app');
  const h = root.clientHeight;
  root.classList.toggle('short', h < 800);
  root.classList.toggle('xshort', h < 660);
}

window.addEventListener('resize', () => {
  if (!instance) return;
  applySizeClasses();
  instance.relayout?.();
});

document.addEventListener('visibilitychange', () => {
  if (!instance) return;
  if (document.visibilityState === 'hidden') { instance.pause?.(); flushCoins(); save(); }
  else {
    refreshDaily(); refreshBox(); refreshQuest(); instance.resume?.();
    if (screen === 'lobby') autoQuest('return');   // a quest may have ended while away
  }
});

/* ---------------------------------------------------------------- *
 * Tabs, menus, settings
 * ---------------------------------------------------------------- */

const panelContext = () => ({ game, shell, instance, stats: gameStats() });

function closePanel() {
  panels.hide();
  if (screen === 'lobby') lobby.setNavTab('home');
  else instance.resume?.();          // nothing covers the game any more
}

function onLobbyTab(tab) {
  lobby.setNavTab(tab);
  if (tab === 'home') return panels.hide();
  if (tab === 'daily') refreshDaily();
  track('screen_view', { screen_name: tab, screen_class: 'tab' });
  panels.show(tab, panelContext());
}

/*
 * The game stays paused for as long as anything covers it. Resuming as soon as
 * the menu closed let a real-time game keep running underneath an open Cats or
 * Shop sheet; a turn-based game never shows that, which is how it went unseen.
 */
async function onPause() {
  if (panels.open || anyCardOpen()) return;
  instance.pause?.();
  const pick = await pauseMenu({ canRestart: !!instance.restart, title: game.name });
  if (pick === 'lobby') return showScreen('lobby');
  if (pick === 'progress' || pick === 'cats' || pick === 'shop') {
    return panels.show(pick, panelContext());   // resumed when the sheet closes
  }
  instance.resume?.();
  if (pick === 'restart') await instance.restart();
}

/*
 * What Settings says about ads and data has to be true of the build it is in.
 * With ads on, the note says so and the US opt-out appears; without keys, the
 * app shows no ads and sends nothing, and says that instead.
 */
const SETTINGS_NOTE_ADS = 'Free to play, with optional ads that earn rewards. No purchases. '
  + 'Ads are served by AppLovin; see the Privacy Policy for what they collect.';
const SETTINGS_NOTE_NO_ADS = 'No ads and no purchases. Your progress stays on this phone.';
// Only said where it is true: the Android app, where Firebase is built in.
const SETTINGS_NOTE_ANALYTICS = ' Gameplay statistics and crash reports are sent to Google Firebase '
  + 'to help improve the game.';

async function onSettings() {
  if (panels.open) return;
  const pick = await settings({
    title: 'Cash Paws',
    note: (ads.enabled ? SETTINGS_NOTE_ADS : SETTINGS_NOTE_NO_ADS)
      + (analytics.enabled ? SETTINGS_NOTE_ANALYTICS : ''),
    doNotSell: ads.enabled || DEV ? ads.getDoNotSell() || !!shell.privacy?.doNotSell : null,
  });
  if (pick === 'dns') {
    const next = !(ads.getDoNotSell() || !!shell.privacy?.doNotSell);
    shell.privacy = { ...(shell.privacy || {}), doNotSell: next };
    ads.setDoNotSell(next);
    track('do_not_sell', { on: next });
    save();
    return onSettings();          // reopen, showing the new state
  }
  if (pick !== 'erase') return;
  const yes = await confirm({
    kicker: 'Settings',
    title: 'Erase everything?',
    line: 'Your coins, cats, cosmetics and every game\'s progress all go back to the start. '
        + 'This cannot be undone.',
    ok: 'Erase and start over',
  });
  if (!yes) return;
  track('progress_erased', { best_level: shell.stats.bestLevel });
  store.erase();
  location.reload();
}

/* ---------------------------------------------------------------- *
 * Buying: cats are the shell's, cosmetics belong to the game
 * ---------------------------------------------------------------- */

function activeCosmetic() {
  return shell.cosmetics[game.id]?.active || game.defaultCosmetic || null;
}

function buy(kind, id) {
  if (kind === 'cat') {
    const c = catById(id);
    if (!unlockProgress(c, shell.stats).revealed) return;   // hidden cats cannot be bought
    if (!shell.cats.owned.includes(id)) {
      if (!wallet.spend(c.price, 'cat')) return;             // the price tag already says so
      shell.cats.owned.push(id);
    }
    shell.cats.worn = id;
    track('cat_select', { cat: id });
    refreshUser();
    setWornCat(id);
    header.redrawCat();
    instance.setPerk?.(perkIn(game, id)?.config || {});
  }

  if (kind === 'cosmetic') {
    const item = (game.cosmetics || []).find((x) => x.id === id);
    if (!item) return;
    const mine = (shell.cosmetics[game.id] ||= { owned: [], active: game.defaultCosmetic });
    if (item.price > 0 && !mine.owned.includes(id)) {
      if (!wallet.spend(item.price, 'cosmetic')) return;
      mine.owned.push(id);
    }
    mine.active = id;
    track('cosmetic_select', { item: id });
    instance.setCosmetic?.(id);
  }

  panels.show(panels.open, panelContext());
  save();
}

/* ---------------------------------------------------------------- *
 * Android: the native shell calls these
 * ---------------------------------------------------------------- */

function installBridge() {
  window.CashPaws = {
    /** True if the app consumed the back press. */
    onBack() {
      if (anyCardOpen()) return true;          // a card is a decision; back must not skip it
      if (panels.open) { closePanel(); return true; }
      if (screen === 'game') {
        if (instance.onBack?.()) return true;
        showScreen('lobby');
        return true;
      }
      return false;
    },
    flush: save,
    version: APP_VERSION,
  };
}

/* ---------------------------------------------------------------- *
 * Dev harness — only with ?dev=1
 * ---------------------------------------------------------------- */

function wireDev() {
  document.body.classList.add('dev');
  window.shell = shell;
  window.wallet = wallet;
  window.stats = shell.stats;
  window.gameStats = shell.gameStats[game.id] ||= {};
  window.CATS = CATS;

  const bar = document.getElementById('dev-buttons');
  if (bar) {
    const btns = [...(instance.dev?.buttons || []),
      { id: 'wipe', label: 'Wipe save', run: () => { store.erase(); location.reload(); } }];
    bar.innerHTML = btns.map((b) => `<button id="${b.id}">${b.label}</button>`).join('');
    btns.forEach((b) => document.getElementById(b.id).addEventListener('click', async () => {
      await b.run();
      paintDev();
    }));
  }
  paintDev();
}

function paintDev() {
  const el = document.getElementById('readout');
  if (!el) return;
  el.innerHTML = `
    <dl>
      <dt>game</dt><dd>${game.name} (${game.id})</dd>
      <dt>coins</dt><dd>${wallet.coins} &middot; earned ${shell.stats.coinsEarned}</dd>
      <dt>cat</dt><dd>${shell.cats.worn}</dd>
    </dl>
    ${instance.dev?.readout?.() || ''}`;
}

document.addEventListener('DOMContentLoaded', boot);
