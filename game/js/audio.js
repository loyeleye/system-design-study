// Music and sound effects. Recorded tracks and samples (assets/audio, credited in CREDITS.md) play when they load;
// the chiptune synth below is the fallback, and still voices the typewriter blips and a few comic effects.
// Synth tracks are note strings: one token per step ("C5" a note, "-" hold, "." rest). Channels loop on their own length.
(function () {
  const A = SD.audio = {};
  const PREF = 'isekai-prod-audio';
  const prefs = { music: true, sfx: true };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF) || '{}')); } catch (e) { /* storage blocked */ }
  A.prefs = prefs;
  const savePrefs = () => { try { localStorage.setItem(PREF, JSON.stringify(prefs)); } catch (e) { /* ignore */ } };

  let ctx = null, master, musicBus, sfxBus, noise;
  let want = null;          // track requested before audio was unlocked
  let cur = null;           // { name, gain, timer }

  A.unlock = function () {
    if (ctx) { if (ctx.state === 'suspended' && !document.hidden) ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = prefs.music ? 0.34 : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx ? 0.55 : 0; sfxBus.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    Object.values(SAMPLE).concat(Object.values(JING)).forEach(loadBuf);
    if (want) { const w = want; want = null; A.music(w); }
    if (wantWx) { const w = wantWx; wantWx = null; A.weather(w); }
  };
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, A.unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  A.set = function (kind, on) {
    prefs[kind] = on; savePrefs();
    if (!ctx) return;
    const bus = kind === 'music' ? musicBus : sfxBus;
    bus.gain.setTargetAtTime(on ? (kind === 'music' ? 0.34 : 0.55) : 0, ctx.currentTime, 0.05);
  };
  A.muted = () => !prefs.music && !prefs.sfx;
  A.toggleAll = function () { const on = A.muted(); A.set('music', on); A.set('sfx', on); return on; };

  // ---------- Voices ----------
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(n) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
    if (!m) return 0;
    const midi = 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function tone(o) {
    // o: {wave, f, f2, t, dur, vol, bus, lp, vib, a, r}
    const t = o.t, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.wave || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + o.dur);
    if (o.vib) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 6; lg.gain.value = o.f * 0.03;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + o.dur + 0.1);
    }
    const a = o.a || 0.005, r = o.r || 0.05, v = o.vol || 0.1;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setValueAtTime(v, t + Math.max(a, o.dur - r));
    g.gain.linearRampToValueAtTime(0, t + o.dur);
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + o.dur + 0.02);
  }
  function hiss(o) {
    // o: {t, dur, vol, type, f, f2, bus}
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise;
    f.type = o.type || 'highpass'; f.frequency.setValueAtTime(o.f || 2000, o.t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, o.t + o.dur);
    g.gain.setValueAtTime(o.vol || 0.2, o.t);
    g.gain.exponentialRampToValueAtTime(0.001, o.t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(o.t); src.stop(o.t + o.dur + 0.02);
  }
  function drum(k, t, bus) {
    if (k === 'k') tone({ wave: 'sine', f: 150, f2: 40, t, dur: 0.14, vol: 0.9, bus, r: 0.08 });
    if (k === 's') { hiss({ t, dur: 0.13, vol: 0.32, f: 1800, bus }); tone({ wave: 'triangle', f: 190, f2: 120, t, dur: 0.08, vol: 0.25, bus }); }
    if (k === 'h') hiss({ t, dur: 0.035, vol: 0.12, f: 7500, bus });
    if (k === 'c') hiss({ t, dur: 0.9, vol: 0.22, f: 5000, bus });
  }

  // ---------- Tracks ----------
  const TRACKS = {
    title: { bpm: 128, ch: [
      { wave: 'square', vol: 0.13, lp: 3200, n: 'G4 C5 E5 G5 - - E5 G5 C6 - - - B5 - A5 - G5 - - E5 F5 - D5 - E5 - - - - - . . A4 C5 F5 A5 - - G5 F5 E5 - G5 - C6 - - - D6 - C6 - B5 - G5 - C6 - - - - - . .' },
      { wave: 'triangle', vol: 0.12, n: 'E4 - - - G4 - - - E4 - - - F4 - - - D4 - - - B3 - - - C4 - - - G3 - - - F4 - - - C4 - - - G4 - - - E4 - - - F4 - - - D4 - - - E4 - - - C4 - - -' },
      { wave: 'triangle', vol: 0.26, n: 'C3 . C3 . G2 . G2 . A2 . A2 . E2 . E2 . F2 . F2 . G2 . G2 . C3 . G2 . C3 . . . F2 . F2 . C3 . C3 . C3 . C3 . E2 . E2 . G2 . G2 . G2 . B2 . C3 . G2 . C3 . . .' },
      { drums: 'k . h . s . h k k . h . s . h .' }
    ] },
    town: { bpm: 108, ch: [
      { wave: 'square', vol: 0.1, lp: 2600, n: 'C5 . A4 . F4 . A4 C5 D5 . C5 . A4 - - . A#4 . G4 . E4 . G4 A#4 C5 . A#4 . A4 - - . C5 . A4 . F4 . A4 C5 F5 . E5 . D5 . C5 . A#4 . D5 . C5 . E4 . F4 - - - . . . .' },
      { wave: 'triangle', vol: 0.07, n: '. A3 . A3 . A3 . A3 . A#3 . A#3 . A#3 . A#3 . G3 . G3 . G3 . G3 . A3 . A3 . A3 . A3' },
      { wave: 'triangle', vol: 0.07, n: '. C4 . C4 . C4 . C4 . D4 . D4 . D4 . D4 . E4 . E4 . E4 . E4 . C4 . C4 . C4 . C4' },
      { wave: 'triangle', vol: 0.24, n: 'F2 . C3 . F2 . C3 . A#2 . F3 . A#2 . F3 . C3 . G3 . C3 . G3 . F2 . C3 . A2 . C3 . F2 . C3 . F2 . C3 . A#2 . F3 . A#2 . F3 . C3 . G2 . C3 . E3 . F2 . C3 . F2 . . .' },
      { drums: 'k . h . s . h . k . h h s . h .' }
    ] },
    explore: { bpm: 112, ch: [
      { wave: 'square', vol: 0.09, lp: 2200, n: 'E5 . B4 . G4 . B4 . C5 . B4 . A4 - - . D5 . A4 . F#4 . A4 . B4 - - - . . . . E5 . B4 . G4 . B4 . C5 . E5 . G5 . F#5 . E5 . D5 . C5 . A4 . B4 - - - . . . .' },
      { wave: 'triangle', vol: 0.24, n: 'E2 . B2 . E2 . B2 . C2 . G2 . C2 . G2 . D2 . A2 . D2 . A2 . B1 . F#2 . B1 . F#2 . E2 . B2 . E2 . B2 . C2 . G2 . C2 . G2 . A1 . E2 . A1 . E2 . B1 . F#2 . B1 . D#2 .' },
      { drums: 'k . . h s . . h' }
    ] },
    battle: { bpm: 150, ch: [
      { wave: 'square', vol: 0.12, lp: 3400, n: 'A4 . A4 C5 . A4 E5 . D5 . C5 . B4 . G4 . A4 . A4 C5 . A4 E5 . G5 . F5 . E5 - - . F5 . E5 . D5 . C5 . E5 . D5 . C5 . B4 . C5 . B4 . A4 . G#4 . A4 . E5 . A5 - - .' },
      { wave: 'triangle', vol: 0.26, n: 'A2 A3 A2 A3 A2 A3 A2 A3 G2 G3 G2 G3 G2 G3 G2 G3 A2 A3 A2 A3 A2 A3 A2 A3 C3 C4 C3 C4 C3 C4 C3 C4 F2 F3 F2 F3 F2 F3 F2 F3 C3 C4 C3 C4 C3 C4 C3 C4 D3 D4 D3 D4 E3 E4 E3 E4 A2 A3 A2 A3 A2 . . .' },
      { wave: 'square', vol: 0.04, lp: 1800, n: 'E4 . E4 . E4 . E4 . D4 . D4 . D4 . D4 . E4 . E4 . E4 . E4 . E4 . E4 . E4 . E4 . F4 . F4 . F4 . F4 . E4 . E4 . E4 . E4 . F4 . F4 . G#4 . G#4 . A4 . A4 . . . . .' },
      { drums: 'k . h k s . h . k . h k s . h s' }
    ] },
    boss: { bpm: 164, ch: [
      { wave: 'square', vol: 0.12, lp: 3600, n: 'D5 . D5 . F5 . D5 . C#5 . E5 . A4 - - . D5 . D5 . F5 . A5 . G5 . F5 . E5 - - . A#4 . D5 . F5 . A#5 . A5 . G5 . F5 . E5 . F5 . E5 . D5 . C#5 . D5 - - - . . . .' },
      { wave: 'sawtooth', vol: 0.05, lp: 1400, n: 'D4 - - - - - - - E4 - - - - - - - F4 - - - - - - - G4 - - - - - - - F4 - - - - - - - E4 - - - - - - - A4 - - - - - - - D4 - - - - - - -' },
      { wave: 'triangle', vol: 0.27, n: 'D2 D3 D2 D3 D2 D3 D2 D3 A1 A2 A1 A2 A1 A2 A1 A2 D2 D3 D2 D3 D2 D3 D2 D3 C2 C3 C2 C3 C2 C3 C2 C3 A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 C2 C3 C2 C3 C2 C3 C2 C3 A1 A2 A1 A2 A1 A2 A1 A2 D2 D3 D2 D3 D2 . . .' },
      { drums: 'k k s . k k s . k . s k k k s s' }
    ] },
    victory: { bpm: 150, once: true, ch: [
      { wave: 'square', vol: 0.14, lp: 3600, n: 'G4 C5 E5 G5 - E5 G5 - C6 - - - - - . .' },
      { wave: 'square', vol: 0.07, lp: 2400, n: 'E4 E4 G4 C5 - G4 C5 - E5 - - - - - . .' },
      { wave: 'triangle', vol: 0.26, n: 'C3 . . . G2 . . . C3 - - - - - . .' },
      { drums: 'k . . . s . . . k . . . c . . .' }
    ] },
    defeat: { bpm: 76, once: true, ch: [
      { wave: 'sawtooth', vol: 0.18, lp: 1300, vib: true, n: 'G3 - F#3 - F3 - E3 - - - - - . .' }
    ] },
    gary: { bpm: 92, once: true, ch: [
      { wave: 'sawtooth', vol: 0.12, lp: 1600, n: 'D3 . D3 . D3 - - - - - . . . . . .' },
      { wave: 'sawtooth', vol: 0.1, lp: 1600, n: 'A3 . A3 . A3 - - - - - . . . . . .' },
      { wave: 'square', vol: 0.06, n: '. . . . . . . . . . . . . . C6 .' },
      { drums: 'k . k . k . c . . . . . . . . .' }
    ] }
  };
  function parse(str) {
    const tok = str.trim().split(/\s+/), ev = [];
    tok.forEach((x, i) => {
      if (x === '.' || x === '-') return;
      let len = 1; while (tok[i + len] === '-') len++;
      ev[i] = { f: freq(x), len };
    });
    return { ev, len: tok.length };
  }
  const parsed = {};
  function track(name) {
    if (parsed[name]) return parsed[name];
    const T = TRACKS[name];
    const ch = T.ch.map(c => c.drums ? { drums: c.drums.trim().split(/\s+/) } : Object.assign({}, c, parse(c.n)));
    const len = Math.max(...ch.map(c => c.drums ? c.drums.length : c.len));
    return (parsed[name] = { bpm: T.bpm, once: !!T.once, ch, len });
  }

  function stopCur(fade) {
    if (!cur) return;
    const c = cur; cur = null;
    clearInterval(c.timer);
    c.gain.gain.setTargetAtTime(0, ctx.currentTime, fade || 0.12);
    setTimeout(() => { c.gain.disconnect(); if (c.el) { c.el.pause(); c.el.removeAttribute('src'); c.el.load(); } }, 1200);
  }

  // ---------- Recorded music and samples ----------
  const BASE = 'assets/audio/';
  // mapN is chapter N's dungeon map; chapters without one use explore.
  const SONG = { title: 'm-opening', office: 'm-office', goddess: 'm-goddess', town: 'm-village', explore: 'm-explore', battle: 'm-battle', boss: 'm-boss', quest: 'm-quest', story: 'm-story', guild: 'm-guild',
    map2: 'm-ch2', map3: 'm-ch3', map4: 'm-ch4', map5: 'm-ch5' };
  // Songs without a synth version fall back to this one if the file fails to load.
  const FALLBACK = { quest: 'town', story: 'town', guild: 'town', map2: 'explore', map3: 'explore', map4: 'explore', map5: 'explore' };
  // Per-song loudness: the piano is gentle on purpose, and the chapter maps are mastered hotter than explore.
  const SONG_VOL = { story: 0.75, map2: 0.6, map3: 0.7, map4: 0.65, map5: 0.65 };
  const JING = { victory: 'j-victory', defeat: 'j-defeat', gary: 'j-gary' };
  const SAMPLE = { blip: 's-blip', ok: 's-ok', cancel: 's-cancel', card: 's-card', hit: 's-hit', crit: 's-crit', resist: 's-resist', hurt: 's-hurt', shield: 's-shield', coin: 's-coin', right: 's-right', wrong: 's-wrong', door: 's-door' };
  const SONG_GAIN = 1.5;  // recorded tracks are mastered quieter than the synth
  const bufs = {}, failed = new Set();
  function loadBuf(file) {
    if (bufs[file] || failed.has(file)) return;
    bufs[file] = 'loading';
    fetch(BASE + file + '.mp3').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .then(d => { bufs[file] = d; })
      .catch(() => { failed.add(file); delete bufs[file]; });
  }
  function playBuf(file, bus, vol, onEnd) {
    const b = bufs[file];
    if (!b || b === 'loading') return false;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b; g.gain.value = vol || 1;
    src.connect(g); g.connect(bus); src.start();
    if (onEnd) src.onended = onEnd;
    return true;
  }
  // Songs stream through an <audio> element routed into the music bus, so the mute toggle and fades still apply.
  function playSong(name) {
    const file = SONG[name];
    const el = new Audio(BASE + file + '.mp3');
    el.loop = true; el.preload = 'auto';
    const gain = ctx.createGain(); gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain); gain.connect(musicBus);
    gain.gain.setTargetAtTime(SONG_GAIN * (SONG_VOL[name] || 1), ctx.currentTime, 0.15);
    const me = { name, gain, el, timer: 0 };
    el.onerror = () => { failed.add(file); if (cur === me) { stopCur(0.05); play(name); } };
    el.play().catch(() => { /* resumes on the next tap */ });
    cur = me;
  }

  function play(name, onEnd) {
    if ((!SONG[name] || failed.has(SONG[name])) && !TRACKS[name] && FALLBACK[name]) name = FALLBACK[name];
    if (SONG[name] && !failed.has(SONG[name]) && !onEnd) { playSong(name); return; }
    if (!TRACKS[name]) return;
    const T = track(name);
    const gain = ctx.createGain(); gain.connect(musicBus);
    const stepDur = 60 / T.bpm / 2;
    let step = 0, next = ctx.currentTime + 0.06;
    const me = { name, gain, timer: 0 };
    const tick = () => {
      while (next < ctx.currentTime + 0.15) {
        if (T.once && step >= T.len) {
          clearInterval(me.timer);
          if (cur === me) { cur = null; setTimeout(() => { if (!cur && onEnd) onEnd(); }, Math.max(0, (next - ctx.currentTime) * 1000)); }
          return;
        }
        T.ch.forEach(c => {
          if (c.drums) { const k = c.drums[step % c.drums.length]; if (k !== '.') drum(k, next, gain); return; }
          const e = c.ev[step % c.len];
          if (e && e.f) tone({ wave: c.wave, f: e.f, t: next, dur: e.len * stepDur * 0.92, vol: c.vol, bus: gain, lp: c.lp, vib: c.vib, r: 0.04 });
        });
        step++; next += stepDur;
      }
    };
    me.timer = setInterval(tick, 25);
    cur = me; tick();
  }

  // Loop a track. Asking for the track already playing does nothing.
  A.has = name => !!(SONG[name] || TRACKS[name]);
  A.music = function (name) {
    A.loopName = name;
    if (wx && wx.song !== name) A.weather(null);
    if (!ctx) { want = name; wantWx = null; return; }
    if (cur && cur.name === name) return;
    stopCur();
    if (name) play(name);
  };
  // One-shot jingle, then go back to `then` (or the last looping track).
  A.jingle = function (name, then) {
    const back = then !== undefined ? then : A.loopName;
    if (!ctx) { want = back; return; }
    stopCur(0.05);
    const resume = () => { if (back) { A.loopName = null; A.music(back); } };
    if (JING[name] && playBuf(JING[name], musicBus, 1.6, () => setTimeout(resume, 250))) return;
    play(name, resume);
  };
  A.stop = function () { A.loopName = null; want = null; A.weather(null); if (ctx) stopCur(0.3); };

  // ---------- Sound effects ----------
  const FX = {
    blip: t => tone({ wave: 'square', f: 880, t, dur: 0.035, vol: 0.06 }),
    ok: t => { tone({ wave: 'square', f: 660, t, dur: 0.05, vol: 0.07 }); tone({ wave: 'square', f: 990, t: t + 0.05, dur: 0.07, vol: 0.07 }); },
    cancel: t => { tone({ wave: 'square', f: 520, t, dur: 0.05, vol: 0.06 }); tone({ wave: 'square', f: 340, t: t + 0.05, dur: 0.07, vol: 0.06 }); },
    card: t => { hiss({ t, dur: 0.12, vol: 0.12, type: 'bandpass', f: 800, f2: 3000 }); tone({ wave: 'triangle', f: 520, f2: 780, t, dur: 0.08, vol: 0.18 }); },
    hit: t => { hiss({ t, dur: 0.14, vol: 0.35, type: 'lowpass', f: 1600, f2: 300 }); tone({ wave: 'square', f: 160, f2: 60, t, dur: 0.12, vol: 0.14 }); },
    crit: t => { FX.hit(t); [1047, 1319, 1568, 2093].forEach((f, i) => tone({ wave: 'square', f, t: t + 0.04 + i * 0.045, dur: 0.07, vol: 0.06 })); },
    resist: t => { tone({ wave: 'triangle', f: 200, f2: 150, t, dur: 0.12, vol: 0.22 }); hiss({ t, dur: 0.05, vol: 0.08, type: 'lowpass', f: 600 }); },
    hurt: t => { tone({ wave: 'square', f: 320, f2: 70, t, dur: 0.26, vol: 0.12 }); hiss({ t, dur: 0.2, vol: 0.2, type: 'lowpass', f: 900 }); },
    shield: t => { tone({ wave: 'triangle', f: 700, f2: 1500, t, dur: 0.16, vol: 0.15 }); tone({ wave: 'triangle', f: 1050, f2: 2100, t: t + 0.03, dur: 0.14, vol: 0.08 }); },
    coin: t => { tone({ wave: 'square', f: 988, t, dur: 0.06, vol: 0.07 }); tone({ wave: 'square', f: 1319, t: t + 0.06, dur: 0.22, vol: 0.07, r: 0.15 }); },
    levelup: t => { ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => tone({ wave: 'square', f: freq(n), t: t + i * 0.06, dur: 0.1, vol: 0.07 })); tone({ wave: 'triangle', f: freq('C6'), t: t + 0.36, dur: 0.4, vol: 0.12, r: 0.3 }); },
    heal: t => ['C5', 'G5', 'C6', 'E6'].forEach((n, i) => tone({ wave: 'sine', f: freq(n), t: t + i * 0.07, dur: 0.18, vol: 0.12, r: 0.12 })),
    right: t => ['E5', 'G5', 'C6'].forEach((n, i) => tone({ wave: 'square', f: freq(n), t: t + i * 0.07, dur: 0.1, vol: 0.07 })),
    wrong: t => { tone({ wave: 'square', f: 150, t, dur: 0.12, vol: 0.09 }); tone({ wave: 'square', f: 140, t: t + 0.15, dur: 0.2, vol: 0.09 }); },
    door: t => { hiss({ t, dur: 0.12, vol: 0.25, type: 'lowpass', f: 500 }); tone({ wave: 'triangle', f: 110, f2: 70, t, dur: 0.15, vol: 0.3 }); },
    gate: t => { tone({ wave: 'sawtooth', f: 110, f2: 880, t, dur: 0.9, vol: 0.08, lp: 2000, r: 0.3 }); hiss({ t, dur: 1, vol: 0.16, type: 'bandpass', f: 400, f2: 4000 }); },
    punch: t => {
      drum('k', t, sfxBus); drum('k', t + 0.06, sfxBus);
      hiss({ t, dur: 0.9, vol: 0.6, type: 'lowpass', f: 3000, f2: 120 });
      tone({ wave: 'square', f: 90, f2: 30, t, dur: 0.6, vol: 0.18, r: 0.4 });
    },
    truck: t => {
      [233, 277].forEach(f => tone({ wave: 'square', f, t, dur: 0.7, vol: 0.08, vib: true, lp: 2200, r: 0.05 }));
      hiss({ t: t + 0.75, dur: 0.8, vol: 0.7, type: 'lowpass', f: 4000, f2: 100 });
      drum('k', t + 0.75, sfxBus);
    },
    enter: t => { hiss({ t, dur: 0.03, vol: 0.3, f: 3000 }); tone({ wave: 'square', f: 1200, t, dur: 0.02, vol: 0.04 }); },
    alarm: t => [0, 1, 2].forEach(i => { tone({ wave: 'square', f: 880, t: t + i * 0.28, dur: 0.13, vol: 0.07 }); tone({ wave: 'square', f: 660, t: t + i * 0.28 + 0.14, dur: 0.13, vol: 0.07 }); }),
    whoosh: t => hiss({ t, dur: 0.35, vol: 0.2, type: 'bandpass', f: 300, f2: 3000 })
  };
  // `pitch` lets each speaker have their own typewriter voice, as in classic JRPGs.
  A.sfx = function (name, pitch) {
    if (!ctx || !prefs.sfx) return;
    const t = ctx.currentTime + 0.005;
    if (name === 'text') { tone({ wave: 'square', f: pitch || 600, t, dur: 0.025, vol: 0.035 }); return; }
    if (SAMPLE[name] && playBuf(SAMPLE[name], sfxBus, 1.4)) {
      // Crits keep the synth sparkle on top of the recorded slash.
      if (name === 'crit') [1047, 1319, 1568, 2093].forEach((f, i) => tone({ wave: 'square', f, t: t + 0.04 + i * 0.045, dur: 0.07, vol: 0.05 }));
      return;
    }
    if (FX[name]) FX[name](t);
  };

  // ---------- Weather ----------
  // A looping bed under the dungeon map with occasional one-shots: birdsong and leaves in the sun, rain with distant
  // thunder in storms (and wind gusts in the Sky Harbour), and a thunderstorm at the end. It belongs to the song playing
  // when it starts and stops when the music changes. Pixabay sound effects, credited in CREDITS.md.
  const AMB = { birds: 'a-birds', leaves: 'a-leaves', rain: 'a-rain', storm: 'a-storm', wind: 'a-wind', rumble: 'a-rumble', clap1: 'a-thunder1', clap2: 'a-thunder2', clap3: 'a-thunder3' };
  // bed and its volume, then extras: [sounds to pick from, volume, min and max seconds between them].
  const SKY = {
    sun: { bed: 'birds', vol: 0.35, extra: [[['leaves'], 0.4, 12, 28]] },
    rain: { bed: 'rain', vol: 1.5, extra: [[['rumble'], 0.3, 30, 60]] },
    wind: { bed: 'rain', vol: 1.3, extra: [[['wind'], 0.3, 10, 22], [['rumble'], 0.25, 30, 60]] },
    storm: { bed: 'storm', vol: 0.4, extra: [[['clap1', 'clap2', 'clap3'], 0.5, 10, 25], [['wind'], 0.35, 14, 30]] }
  };
  let wx = null, wantWx = null;
  A.weather = function (kind) {
    if (!ctx) { wantWx = kind; return; }
    if (wx && wx.kind === kind) return;
    if (wx) {
      const old = wx; wx = null;
      old.timers.forEach(clearTimeout);
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      setTimeout(() => { if (old.src) old.src.stop(); old.gain.disconnect(); }, 2500);
    }
    const W = SKY[kind];
    if (!W) return;
    [W.bed].concat(...W.extra.map(e => e[0])).forEach(k => loadBuf(AMB[k]));
    const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(sfxBus);
    const me = wx = { kind, song: A.loopName, gain, src: null, timers: [] };
    const later = (fn, ms) => me.timers.push(setTimeout(() => { if (wx === me) fn(); }, ms));
    const startBed = () => {
      const b = bufs[AMB[W.bed]];
      if (!b || b === 'loading') { if (!failed.has(AMB[W.bed])) later(startBed, 400); return; }
      const src = me.src = ctx.createBufferSource();
      src.buffer = b; src.loop = true; src.connect(gain); src.start();
      gain.gain.setTargetAtTime(W.vol, ctx.currentTime, 0.8);
    };
    startBed();
    W.extra.forEach(([names, vol, lo, hi]) => {
      const go = () => {
        playBuf(AMB[names[Math.floor(Math.random() * names.length)]], gain, vol / W.vol);
        later(go, (lo + Math.random() * (hi - lo)) * 1000);
      };
      later(go, (lo / 2 + Math.random() * (hi - lo) / 2) * 1000);
    });
  };
})();
