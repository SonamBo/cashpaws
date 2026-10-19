/**
 * Sound for the shell and any game on it, synthesized with Web Audio: no
 * audio files, nothing to license, a few KB of code.
 *
 *   sound.play('drop')          an effect (names below); games use host.sound()
 *   sound.setSfx(on), sound.setMusic(on)
 *   sound.hold(reason), sound.release(reason)   silence everything while any
 *                                               reason holds: 'hidden', 'ad'
 *
 * Browsers and the Android WebView only allow audio after a tap or key, so
 * nothing plays until the first one; music starts then.
 *
 * Effects: tap, lift, drop, bank, levelup, celebrate, setback, flow, sort,
 * undo, error, coin, open, unlock.
 *
 * A game can add its own with a `sounds` map in its manifest (see
 * docs/GAME-MODULE.md): each is `(t, kit) => {}`, scheduled at time `t` on the
 * effects bus, so the Sound switch, ads and backgrounding silence it too. The
 * shell's names always win, so a game can't replace one by accident.
 */

const C = { sfx: 1.5, music: 0.55 };      // tuned by measuring a rendered mix (see the preview tool)

export function createSound({ sfx = true, music = true, context = null } = {}) {
  let ctx = null;
  const given = context;     // an OfflineAudioContext, to render a preview to a file
  let master, sfxBus, musicBus;
  const state = { sfx, music };
  const holds = new Set();
  let musicTimer = null;
  let nextBar = 0;
  let bar = 0;

  function ensure() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC && !given) return null;
    ctx = given || new AC();
    // A gentle compressor at the end keeps busy moments (a bank during music)
    // from clipping while everything else sits at a normal game loudness.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 1.6; master.connect(comp);
    // A soft low-pass keeps everything warm rather than chirpy.
    const warm = ctx.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 7000; warm.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = state.sfx ? C.sfx : 0; sfxBus.connect(warm);
    musicBus = ctx.createGain(); musicBus.gain.value = state.music ? C.music : 0; musicBus.connect(warm);
    return ctx;
  }

  function audible() { return ctx && holds.size === 0; }

  /* ---------------- unlocking ---------------- */

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended' && holds.size === 0) ctx.resume().catch(() => {});
    if (state.music) startMusic();
  }
  for (const ev of ['pointerdown', 'keydown', 'touchend']) {
    globalThis.addEventListener?.(ev, unlock, { capture: true, passive: true });
  }

  /* ---------------- building blocks ---------------- */

  function tone(freq, start, dur, { type = 'sine', gain = 0.3, attack = 0.005, slide = 0, bus = sfxBus } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(bus);
    o.start(start); o.stop(start + dur + 0.02);
  }

  let noiseBuf = null;
  function noise(start, dur, { gain = 0.15, from = 3000, to = 800, q = 1, bus = sfxBus } = {}) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(from, start); f.frequency.exponentialRampToValueAtTime(to, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(gain, start + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(start); s.stop(start + dur + 0.02);
  }

  // A coin: two inharmonic partials, a bright tick and a fast decay.
  function clink(t, pitch = 1, gain = 0.22) {
    tone(2093 * pitch, t, 0.16, { type: 'triangle', gain });
    tone(3136 * pitch, t, 0.09, { type: 'sine', gain: gain * 0.55 });
    tone(5274 * pitch, t, 0.03, { type: 'sine', gain: gain * 0.25 });
  }

  const N = (semis) => 523.25 * 2 ** (semis / 12);     // semitones from C5
  const custom = {};

  const EFFECTS = {
    tap: (t) => tone(1400, t, 0.03, { type: 'sine', gain: 0.08 }),
    lift: (t) => tone(520, t, 0.09, { type: 'sine', gain: 0.18, slide: 1.6 }),
    drop: (t) => { clink(t, 0.9); clink(t + 0.045, 1.05, 0.12); },
    bank: (t) => {
      [0, 4, 7, 12].forEach((s, i) => tone(N(s + 7), t + i * 0.055, 0.22, { type: 'triangle', gain: 0.17 }));
      for (let i = 0; i < 5; i++) clink(t + 0.05 + i * 0.045, 1 + i * 0.07, 0.09);
    },
    levelup: (t) => {
      [0, 4, 7, 12, 16].forEach((s, i) => tone(N(s), t + i * 0.09, 0.42, { type: 'triangle', gain: 0.2 }));
      tone(N(24), t + 0.48, 0.7, { type: 'sine', gain: 0.12 });
      for (let i = 0; i < 6; i++) clink(t + 0.45 + i * 0.06, 1.1 + (i % 3) * 0.1, 0.07);
    },
    celebrate: (t) => [0, 4, 7].forEach((s, i) => tone(N(s + 5), t + i * 0.08, 0.3, { type: 'triangle', gain: 0.16 })),
    setback: (t) => { tone(N(-1), t, 0.28, { type: 'triangle', gain: 0.16 }); tone(N(-5), t + 0.2, 0.42, { type: 'triangle', gain: 0.15 }); },
    flow: (t) => { noise(t, 0.38, { gain: 0.12, from: 600, to: 2600, q: 0.8 }); for (let i = 0; i < 3; i++) clink(t + 0.22 + i * 0.05, 0.85, 0.07); },
    sort: (t) => { for (let i = 0; i < 7; i++) clink(t + i * 0.05, 0.8 + (i % 4) * 0.12, 0.08); noise(t, 0.4, { gain: 0.05, from: 1500, to: 4000 }); },
    undo: (t) => tone(700, t, 0.12, { type: 'sine', gain: 0.14, slide: 0.6 }),
    error: (t) => { tone(196, t, 0.12, { type: 'square', gain: 0.05 }); tone(185, t + 0.06, 0.12, { type: 'square', gain: 0.04 }); },
    coin: (t) => { clink(t, 1); clink(t + 0.07, 1.2, 0.14); },
    open: (t) => { tone(N(7), t, 0.12, { type: 'sine', gain: 0.1 }); tone(N(12), t + 0.06, 0.18, { type: 'sine', gain: 0.1 }); },
    unlock: (t) => { tone(N(12), t, 0.08, { type: 'square', gain: 0.04 }); clink(t + 0.06, 1.3, 0.12); },
  };

  /* ---------------- music: a cosy loop, generated ---------------- */

  // 84 bpm, Cmaj7 – Am7 – Fmaj7 – G7(sus): soft pads, a walking bass, and a
  // pentatonic melody that varies every other time round.
  const BEAT = 60 / 84;
  const CHORDS = [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 5]];
  const BASS = [-12, -15, -19, -17];
  const MELODY = [
    [12, null, 9, 7, null, 4, 7, null], [9, null, 7, 4, null, 2, 4, null],
    [7, null, 9, 12, null, 9, 7, null], [5, 7, null, 2, null, 4, null, null],
    [16, null, 14, 12, null, 9, 12, null], [14, 12, null, 9, null, 7, 9, null],
    [12, null, 14, 16, null, 14, 12, null], [11, null, 9, 7, null, null, null, null],
  ];

  function scheduleBar(t) {
    const chord = CHORDS[bar % 4];
    for (const s of chord) {                    // pad: two detuned soft voices
      tone(N(s - 12), t, BEAT * 4, { type: 'sine', gain: 0.05, attack: 0.4, bus: musicBus });
      tone(N(s - 12) * 1.003, t, BEAT * 4, { type: 'triangle', gain: 0.025, attack: 0.5, bus: musicBus });
    }
    tone(N(BASS[bar % 4] - 12), t, BEAT * 1.6, { type: 'triangle', gain: 0.12, attack: 0.01, bus: musicBus });
    tone(N(BASS[bar % 4] - 12 + 7), t + BEAT * 2, BEAT * 1.4, { type: 'triangle', gain: 0.09, attack: 0.01, bus: musicBus });
    const line = MELODY[bar % 8];
    line.forEach((s, i) => {
      if (s === null) return;
      tone(N(s - 12), t + i * BEAT / 2, BEAT * 0.9, { type: 'sine', gain: 0.07, attack: 0.01, bus: musicBus });
    });
    // A soft shaker on the off-beats.
    for (let i = 1; i < 8; i += 2) noise(t + i * BEAT / 2, 0.05, { gain: 0.012, from: 6000, to: 5000, q: 2, bus: musicBus });
    bar++;
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    nextBar = ctx.currentTime + 0.1;
    musicTimer = setInterval(() => {
      if (!audible() || !state.music) return;
      while (nextBar < ctx.currentTime + 1.2) { scheduleBar(nextBar); nextBar += BEAT * 4; }
    }, 250);
  }

  /* ---------------- holds: background, ads ---------------- */

  function applyHolds() {
    if (!ctx) return;
    if (holds.size) ctx.suspend().catch(() => {});
    else {
      ctx.resume().catch(() => {});
      nextBar = Math.max(nextBar, ctx.currentTime + 0.1);
    }
  }
  globalThis.document?.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') holds.add('hidden'); else holds.delete('hidden');
    applyHolds();
  });

  return {
    play(name, delay = 0) {
      if (given) ensure();
      if (!state.sfx || !audible()) return;
      const t = ctx.currentTime + 0.005 + delay;
      try {
        if (EFFECTS[name]) EFFECTS[name](t);
        else if (custom[name]) custom[name](t, { ctx, bus: sfxBus, tone, noise, clink, N });
      } catch { /* never let a sound break the game */ }
    },
    /** A game's own effects, from its manifest's `sounds`. */
    register(effects = {}) {
      for (const [name, fx] of Object.entries(effects)) if (typeof fx === 'function' && !EFFECTS[name]) custom[name] = fx;
    },
    /** Rendering a preview only: schedule `bars` bars of music from `at` seconds. */
    scheduleMusic(at, bars) { ensure(); for (let i = 0; i < bars; i++) scheduleBar(at + i * BEAT * 4); },
    get sfx() { return state.sfx; },
    get music() { return state.music; },
    setSfx(on) {
      state.sfx = !!on;
      if (sfxBus) sfxBus.gain.setTargetAtTime(on ? C.sfx : 0, ctx.currentTime, 0.05);
    },
    setMusic(on) {
      state.music = !!on;
      if (musicBus) musicBus.gain.setTargetAtTime(on ? C.music : 0, ctx.currentTime, 0.3);
      if (on) { ensure(); startMusic(); }
    },
    hold(reason) { holds.add(reason); applyHolds(); },
    release(reason) { holds.delete(reason); applyHolds(); },
    get names() { return [...Object.keys(EFFECTS), ...Object.keys(custom)]; },
  };
}
