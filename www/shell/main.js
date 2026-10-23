/**
 * The shell. Boots the installed game inside the lobby, header, tabs, save
 * and back-button handling every game shares.
 *
 * Which game is installed is decided in games/active.js, and nowhere else.
 * This file must never import from a game's folder.
 */

import game from '../games/active.js';
import APP from '../app.config.js';
import * as store from './save.js';
import { Wallet } from './wallet.js';
import { createAds, INTERSTITIAL_FROM_LEVEL, AFTER_REWARDED_MS } from './ads.js';
import { createBilling } from './billing.js';
import { createAnalytics } from './analytics.js';
import { createCoach } from './coach.js';
import { createNotify, boxReminder, questReminder } from './notify.js';
import { createSound } from './sound.js';
import { createHost, loadStyles } from './host.js';
import { Header } from './header.js';
import { LobbyView } from './lobby.js';
import { Panels } from './tabs.js';
import { CATS, catById, unlockProgress, perkIn } from './cats.js';
import { setWornCat, icons, coinIcon } from './art.js';
import {
  mountOverlays, anyCardOpen, confirm, ask, choose, pauseMenu, settings, toast, boxCard, celebrate, adBreak,
} from './overlays.js';
import { localDay, ensureDay, claimable, claimTask, claimBonus, newlyDone } from './daily.js';
import { isReady, msUntil, formatWait, openBox, adOpensLeft, DEFAULT_VALUE } from './rewards.js';
import * as Q from './quest.js';
import { bell, introCard, findingCard, pathCard, wonCard, overCard } from './questui.js';

const DEV = new URLSearchParams(location.search).has('dev');
const APP_VERSION = APP.versionName;     // from www/app.config.js
document.title = APP.name;

// Game folders are named after their id; assets and styles resolve from here.
game.path = `games/${game.id}/`;

let record;           // the whole save
let shell;            // record.shell, the part the shell owns
let wallet, header, lobby, panels, instance, ads, analytics, notify, sound, billing;
let screen = 'lobby';
let currentLevel = 0;      // the installed game's level, from host.progress()
let adBreakOn = false;

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
  refreshReminders();
  await offerReminders('box');
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
  const pick = await pathCard({ q, now: Date.now(), first });
  await offerReminders('quest');
  if (pick === 'play') showScreen('game');
}

/** Pop the card up by itself: always on app open, on lobby return only with news. */
function autoQuest(reason) {
  if (!questOn()) return;
  questSync();
  const q = shell.quest;
  if (q.status === 'none') return;
  if (reason === 'open' || Q.hasNews(q) || (q.status === 'offer' && !offeredThisSession)) openQuest();
}

let reachedLevel = 0;      // the level just reached, for the Ad break at the level's end
function onLevelWon(info = {}) {
  if (Number.isFinite(info.level)) reachedLevel = info.level;
  flushCoins();
  track('level_up', { ...info, quest_step: Q.isActive(shell.quest) ? shell.quest.step + 1 : undefined });
  if (!questOn()) return;
  const q = shell.quest;
  const step = Q.advance(q, Date.now());
  if (!step) { refreshQuest(); return; }
  track(q.status === 'won' ? 'quest_win' : 'quest_step', { step, cats_left: Q.catsLeft(q) });
  // The card itself comes at the break between levels: see onLevelBreak().
  refreshQuest();
  save();
}

/**
 * The game has finished celebrating a level and is about to start the next.
 * Bell Quest's progress first, then, past level 10, an Ad break.
 */
async function onLevelBreak() {
  await questBreak();
  const level = reachedLevel || currentLevel;
  if (screen === 'game' && !adBreakOn && ads.interstitialDue(level)) await runAdBreak(level);
}

/**
 * Show the quest's progress here, in the game, rather than waiting for the
 * lobby. A win is claimed on the spot.
 */
async function questBreak() {
  if (!questOn() || questOpen) return;
  const q = shell.quest;
  if (!Q.hasNews(q) || (q.status !== 'active' && q.status !== 'won')) return;
  questOpen = true;
  try {
    if (q.status === 'won') {
      await wonCard({ share: q.share, grand: q.grand, others: q.field[q.steps] });
      track('quest_claim', { share: q.share, finishers: q.field[q.steps] + 1, where: 'game' });
      wallet.earn(Q.claim(q), 'quest');
      analytics.setUser('quest_wins', q.wins);
    } else {
      const from = q.seenStep;
      q.seenStep = q.step;
      save();
      await pathCard({ q, now: Date.now(), advanced: true, from, inGame: true });
    }
  } finally {
    questOpen = false;
    refreshQuest();
    save();
  }
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

/**
 * What to warn about before a level the player chose to lose, or null when
 * nothing would be lost with it. The game shows it in its own card (Money
 * Sort swaps it into the stuck card) and reports the answer.
 */
function levelLossWarning() {
  questSync();
  const q = shell.quest;
  if (!questOn() || !Q.isActive(q)) return null;
  return {
    kicker: 'Bell Quest',
    title: 'Give up quest?',
    line: `Dropping a level ends it. `
        + `${Q.catsLeft(q)} cats are still in, sharing ${q.grand.toLocaleString('en-US')} coins.`,
    stat: { label: `Step ${q.step + 1} of ${q.steps}`, value: `${Q.catsLeft(q)} cats` },
    ok: 'Drop anyway',
    cancel: 'Keep quest',
    answer: (gaveUp) => track('quest_give_up_prompt', { step: q.step, gave_up: gaveUp }),
  };
}

/** The same warning as a plain confirm, for a game with no card of its own. */
async function confirmLevelLoss() {
  const w = levelLossWarning();
  if (!w) return true;
  const yes = await confirm({ kicker: w.kicker, title: w.title, line: w.line, ok: w.ok, cancel: w.cancel });
  w.answer(yes);
  return yes;
}

// The timer on the icon counts down while the lobby is on screen.
setInterval(refreshQuest, 30000);

/*
 * Interstitials, at the end of a level (onLevelBreak above): past level 10,
 * after the level-up celebration and any Bell Quest card, an "Ad break"
 * screen shows the cat for 2 seconds and then the ad plays, before the next
 * level starts. Never mid-board. The game is paused throughout.
 */
async function runAdBreak(level = currentLevel) {
  adBreakOn = true;
  instance.pause?.();
  try {
    const card = adBreak(2000);
    await card.done;
    await ads.showInterstitial('ad-break', { level });
    await card.close();
  } finally {
    adBreakOn = false;
    if (screen === 'game' && !panels.open) instance.resume?.();
  }
}

/* ---------------------------------------------------------------- *
 * Reminders — the wording and timing live in notify.js
 *
 * Android asks for permission once; so the game asks first, in its own
 * words, at a moment the reminder obviously helps: just after opening a
 * Rewards Box, or starting a Bell Quest. "Not now" is respected: it never
 * asks again, and Settings has the switch.
 * ---------------------------------------------------------------- */

const remindersOn = () => notify?.available && shell.reminders.on && notify.permission() === 'granted';

function refreshReminders() {
  if (!notify?.available) return;
  const on = remindersOn();
  const now = Date.now();
  questSync();                     // a quest may have unlocked or ended since
  notify.set('box', on ? boxReminder(shell.box, now) : null);
  notify.set('quest', on && questOn() ? questReminder(shell.quest, now, questValue()) : null);
}

async function offerReminders(reason) {
  if (!notify?.available || shell.reminders.asked || notify.permission() !== 'ask') return;
  if (panels.open || anyCardOpen()) return;
  shell.reminders.asked = true;
  save();
  const yes = await ask({
    kicker: 'Reminders',
    title: reason === 'box' ? 'Remind you when it refills?' : 'Remind you to keep going?',
    line: 'Rewards Box ready, and a daily Bell Quest update. Nothing else.',
    ok: 'Remind me',
    cancel: 'Not now',
  });
  track('reminders_offer', { reason, yes });
  if (!yes) return;
  const granted = await notify.request();
  shell.reminders.on = granted;
  track('reminders_permission', { granted });
  save();
  refreshReminders();
}

/** Settings switch. Turning on may need the system prompt, or the phone's settings. */
async function toggleReminders() {
  if (remindersOn()) { shell.reminders.on = false; }
  else {
    const perm = notify.permission();
    if (perm === 'ask') shell.reminders.on = await notify.request();
    else if (perm === 'granted') shell.reminders.on = true;
    else toast(`Turn on notifications in phone settings`, 3600);
  }
  track('reminders_toggle', { on: remindersOn() });
  save();
  refreshReminders();
}

globalThis.__reminderOpened = (id) => track('reminder_open', { id });

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
  if (delta > 0 && ['daily', 'box', 'quest', 'safety-net', 'purchase'].includes(reason)) sound?.play('coin');
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
  notify = createNotify({ dev: DEV });
  sound = createSound(shell.audio);
  // A soft tick on the shell's buttons (a game's own pieces make their own sounds).
  root.addEventListener('click', (e) => {
    if (e.target.closest('button, [data-pick], .menu-link, [data-tap]') && !e.target.closest('[data-game-root] .tube, [data-game-root] [data-col]')) sound.play('tap');
  }, true);
  lobby = new LobbyView(root.querySelector('[data-screen="lobby"]'));
  header = new Header(root.querySelector('[data-header]'), { onPause, onCoins: openCoins });
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
  lobby.on('coins', openCoins);

  setWornCat(shell.cats.worn);
  await loadStyles(game);
  sound.register(game.sounds);

  ads = createAds({ dev: DEV, confirm, track });
  // Silence while an ad plays. On Android the full-screen ad sits over a
  // WebView that would otherwise keep playing; a bridge that knows exactly
  // when its ad starts (CrazyGames) does this itself.
  if (!ads.handlesAudio) {
    const showRewarded = ads.rewarded.show;
    ads.rewarded.show = async (where) => { sound.hold('ad'); try { return await showRewarded(where); } finally { sound.release('ad'); } };
    const showInterstitial = ads.showInterstitial.bind(ads);
    ads.showInterstitial = async (...a) => { sound.hold('ad'); try { return await showInterstitial(...a); } finally { sound.release('ad'); } };
  }
  const host = createHost({
    game, shell, wallet, header, ads, sound,
    onProgress: (p) => {
      if (Number.isFinite(p?.level)) currentLevel = p.level;
      lobby.update({ coins: wallet.coins, summary: shell.summaries[game.id] });
    },
    onStat,
    save,
    exit: () => showScreen('lobby'),
    dev: DEV,
    coach: createCoach(root),
    events: {
      levelWon: onLevelWon, levelLost: onLevelLost, levelBreak: onLevelBreak,
      levelLossWarning, confirmLevelLoss, track,
      shortOf, shortHelps, openCoins, coinsForSale: () => !!billing?.enabled,
    },
  });

  instance = game.create(host, root.querySelector('[data-game-root]'));
  instance.setPerk?.(perkIn(game, shell.cats.worn)?.config || {});
  instance.setCosmetic?.(activeCosmetic());

  const slot = record.games[game.id];
  instance.start(slot ? slot.data : null, slot ? slot.v : null);

  // Coin packs, after the game has started: a purchase is saved the moment it pays.
  billing = createBilling({
    packs: APP.coinPacks || [], dev: DEV, confirm, track, wallet, ledger: shell.iap, save,
    notice: onBillingNotice,
    onChange: () => { if (panels.open === 'shop') panels.show('shop', panelContext()); },
  });
  refreshDaily();
  refreshBox();

  header.setCoins(wallet.coins);
  lobby.update({ coins: wallet.coins, summary: shell.summaries[game.id] });
  applySizeClasses();
  installBridge();
  refreshUser();
  track('app_ready', { coins: wallet.coins, best_level: shell.stats.bestLevel, quest: shell.quest.status });
  const from = notify.launchSource();
  if (from) track('reminder_open', { id: from });
  refreshReminders();
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
  if (document.visibilityState === 'hidden') { instance.pause?.(); flushCoins(); save(); refreshReminders(); }
  else {
    refreshDaily(); refreshBox(); refreshQuest(); instance.resume?.();
    if (screen === 'lobby') autoQuest('return');   // a quest may have ended while away
  }
});

/* ---------------------------------------------------------------- *
 * Tabs, menus, settings
 * ---------------------------------------------------------------- */

const panelContext = () => ({ game, shell, instance, billing, stats: gameStats() });

const panelClosed = [];      // openCoins() waiters
function closePanel() {
  panels.hide();
  panelClosed.splice(0).forEach((fn) => fn());
  if (screen === 'lobby') lobby.setNavTab('home');
  else instance.resume?.();          // nothing covers the game any more
}

function onLobbyTab(tab, opts) {
  lobby.setNavTab(tab);
  if (tab === 'home') return panels.hide();
  if (tab === 'daily') refreshDaily();
  track('screen_view', { screen_name: tab, screen_class: 'tab' });
  panels.show(tab, panelContext(), opts);
  if (tab === 'shop' && billing?.state === 'ready') track('iap_view', { from: opts?.from || 'tab' });
}

/**
 * The + on the coin counter, and "Get coins" when something costs too much:
 * the Shop's coin section. Resolves when the sheet closes.
 */
function openCoins(from = 'pill') {
  if (anyCardOpen()) return Promise.resolve();
  if (typeof from !== 'string') from = 'pill';
  billing?.refresh();
  const closed = new Promise((resolve) => panelClosed.push(resolve));
  if (screen === 'lobby') onLobbyTab('shop', { focus: 'coins', from });
  else {
    instance.pause?.();                         // resumed when the sheet closes
    panels.show('shop', panelContext(), { focus: 'coins' });
    if (billing?.state === 'ready') track('iap_view', { from });
  }
  return closed;
}

const fmtCoins = (n) => Number(n).toLocaleString('en-US');

function onBillingNotice(kind, { coins, pack } = {}) {
  if (kind === 'granted') {
    sound.play('celebrate');
    toast(`${coinIcon(18)} <span>+${fmtCoins(coins)} coins · Thank you!</span>`, 3200);
  } else if (kind === 'pending') {
    toast(`<span>Payment pending · coins arrive once confirmed</span>`, 3600);
  }
}

/** Whether shortOf() has anything to offer: coin packs, or a rewarded ad for this placement. */
const shortHelps = (ad) => !!billing?.enabled || !!(ad && ads.rewarded.available(ad));

/**
 * Something costs more than the player has. One card, coin packs first, then
 * a rewarded ad (when the caller has a placement for one), then "Not now".
 * Resolves 'coins' (the player now has enough), 'ad' (watched to the end)
 * or null. Games reach it as host.shortOf().
 */
async function shortOf({ price, what, ad = null, adLabel = 'Watch an ad instead' } = {}) {
  const canBuy = !!billing?.enabled;
  const canAd = !!(ad && ads.rewarded.available(ad));
  if (!canBuy && !canAd) return null;
  const need = Math.max(1, price - wallet.coins);
  track('coins_short', { what, need, buy: canBuy, ad: canAd });
  const pick = await choose({
    kicker: 'Not enough coins',
    title: `${fmtCoins(need)} more for ${what}`,
    line: canBuy && canAd ? 'Coin pack or a short ad' : canBuy ? 'Get a coin pack' : 'Watch a short ad',
    choices: [
      canBuy && { id: 'coins', label: `${coinIcon(18)} Get coins`, primary: true },
      canAd && { id: 'ad', label: `${icons.play(16)} ${adLabel}`, primary: !canBuy },
    ].filter(Boolean),
  });
  if (pick === 'coins') { await openCoins('short'); return wallet.coins >= price ? 'coins' : null; }
  if (pick === 'ad') return (await ads.rewarded.show(ad)) ? 'ad' : null;
  return null;
}

/*
 * The game stays paused for as long as anything covers it. Resuming as soon as
 * the menu closed let a real-time game keep running underneath an open Cats or
 * Shop sheet; a turn-based game never shows that, which is how it went unseen.
 */
async function onPause() {
  if (panels.open || anyCardOpen()) return;
  instance.pause?.();
  const pick = await pauseMenu({ canRestart: !!instance.restart, title: APP.name });
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
const SETTINGS_NOTE_ADS = 'Free, with ads. Optional ads give rewards; past level 10, '
  + 'an Ad break at each level end. {buy} '
  + 'Ads by Google AdMob (see Privacy Policy).';
const SETTINGS_NOTE_NO_ADS = 'No ads. {buy} Progress saved on this phone.';
const SETTINGS_BUY = 'Optional coin packs via Google Play.';
const SETTINGS_NO_BUY = 'No purchases.';
// Only said where it is true: the Android app, where Firebase is built in.
const SETTINGS_NOTE_ANALYTICS = ' Gameplay stats and crash reports go to Google Firebase.';

/**
 * Ad status: for testing on a phone. Says what AdMob last answered, in plain
 * words, so "no ads" can be told apart: no fill, a wrong ID, consent, offline.
 */
const AD_CODES = {
  0: 'AdMob had an internal problem. Usually passes; try again later.',
  1: 'Invalid request: the ad unit or app ID is wrong, or the app ID and ad unit are from different AdMob apps.',
  2: 'Network error: the phone could not reach AdMob.',
  3: 'No fill: AdMob had no ad to give. Normal for a new AdMob app until it is approved and linked to its Play listing; on your own phone, register it as a test device.',
  8: 'The app ID is wrong or the app is missing in AdMob.',
  9: 'No fill from any source (mediation).',
};
function explainAd(state) {
  if (!state || ['ready', 'loading', 'idle'].includes(state)) return state || 'unknown';
  const code = /error (\d+)/.exec(state)?.[1];
  return `${state}<br><small>${AD_CODES[code] || ''}</small>`;
}
/** Coin packs on the testing card: whether Play answered, and which packs it found. */
function billingLine() {
  const b = billing?.status();
  if (!b) return '<b>Purchases</b>: none in this build';
  if (!b.asked) return `<b>Purchases</b>: ${b.state}`;
  return `<b>Purchases</b>: ${b.state}, ${b.found}/${b.asked.length} packs found in Play`
    + (b.error ? `<br><small>${b.error}</small>` : '');
}

async function adStatus() {
  for (;;) {
    const s = ads.status();
    const tail = (id) => (id ? '…' + String(id).slice(-10) : 'none');
    const line = !s
      ? 'No ad SDK in this build (a browser, or an app built without ad units).'
      : [
        `<b>Build</b>: ${s.build}`,
        `<b>Consent</b>: ${s.consent}${s.canRequestAds ? '' : ' (ads blocked until consent)'}${s.consentError ? `<br><small>${s.consentError}</small>` : ''}`,
        `<b>SDK started</b>: ${s.started ? 'yes' : 'no'}`,
        `<b>Rewarded</b> ${tail(s.rewardedUnit)}: ${explainAd(s.rewarded)}`,
        `<b>Interstitial</b> ${tail(s.interstitialUnit)}: ${explainAd(s.interstitial)}`,
        `<b>Ad break</b>: at each level end from level ${INTERSTITIAL_FROM_LEVEL}; now on ${currentLevel}. Last rewarded ad ${Number.isFinite(ads.sinceRewarded) ? `${ads.sinceRewarded} s ago` : 'never'} (skips within ${AFTER_REWARDED_MS / 1000} s)`,
        billingLine(),
      ].join('<br>');
    const again = await confirm({ kicker: 'Testing', title: 'Ad status', line, ok: 'Refresh', cancel: 'Close' });
    if (!again) return;
  }
}

async function onSettings() {
  if (panels.open) return;
  const pick = await settings({
    title: APP.name,
    note: (ads.enabled ? SETTINGS_NOTE_ADS : SETTINGS_NOTE_NO_ADS)
      .replace('{buy}', billing.enabled ? SETTINGS_BUY : SETTINGS_NO_BUY)
      + (analytics.enabled ? SETTINGS_NOTE_ANALYTICS : ''),
    privacy: ads.enabled && ads.privacyRequired(),
    reminders: notify.available ? remindersOn() : null,
    audio: { sfx: sound.sfx, music: sound.music },
    version: APP_VERSION,
  });
  if (pick === 'sfx' || pick === 'music') {
    const on = !shell.audio[pick];
    shell.audio[pick] = on;
    if (pick === 'sfx') sound.setSfx(on); else sound.setMusic(on);
    track('audio_toggle', { kind: pick, on });
    save();
    return onSettings();
  }
  if (pick === 'adstatus') return adStatus();
  if (pick === 'reminders') {
    await toggleReminders();
    return onSettings();
  }
  if (pick === 'privacy') {
    track('privacy_choices_open', {});
    ads.showPrivacy();            // Google's own form, over the app
    return;
  }
  if (pick !== 'erase') return;
  const yes = await confirm({
    kicker: 'Settings',
    title: 'Erase everything?',
    line: 'Coins, cats and progress. Can\'t be undone.',
    ok: 'Erase',
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

async function buy(kind, id, button) {
  if (kind === 'pack') {
    if (button) button.disabled = true;
    const status = await billing.buy(id);
    if (status === 'error') toast('<span>Purchase failed. Try again later.</span>', 3200);
    else if (status === 'owned') toast('<span>Finishing an earlier purchase…</span>', 3000);
    if (panels.open === 'shop') panels.show('shop', panelContext());
    return;
  }
  if (kind === 'cat') {
    const c = catById(id);
    if (!unlockProgress(c, shell.stats).revealed) return;   // hidden cats cannot be bought
    if (!shell.cats.owned.includes(id)) {
      if (!wallet.spend(c.price, 'cat')) return shortOf({ price: c.price, what: c.name });   // the price tag says so; packs may help
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
      if (!wallet.spend(item.price, 'cosmetic')) return shortOf({ price: item.price, what: item.name });
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
    /** For platform layers (the CrazyGames adapter): hold('ad') / release('ad'). */
    sound: { hold: (r) => sound.hold(r), release: (r) => sound.release(r) },
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
  window.__ads = ads;
  window.__sound = sound;
  window.__shop = billing;
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
