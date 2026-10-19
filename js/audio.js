/* Lineage | audio. Intellectual property of Sidedoor Digital. */
'use strict';
/* ============================== SOUND: EFFECTS, AMBIENCE AND MUSIC ==============================
   Everything is synthesised with Web Audio, so there are no files to download and it works offline.
   Three buses: effects, ambience and music, each with its own volume, all into one master.
   A cheap echo (two filtered feedback delays) stands in for reverb so old laptops cope.
   Music is generative: each stage has a key, mode, tempo, chord loop and set of instruments, and a
   small scheduler writes notes a fraction of a second ahead of the audio clock. A melody motif is
   made for each four-bar phrase and repeated with small changes, so it sounds composed rather than
   random. When a stage reports danger, a drum layer fades in. */
const AUDIO_KEY = 'lineage-audio';
const AudioCfg = {
  vol: { music: .6, sfx: .85, amb: .6 }, levels: [0, .3, .6, 1],
  load() { try { const s = JSON.parse(localStorage.getItem(AUDIO_KEY)); if (s) { for (const k of ['music', 'sfx', 'amb']) if (typeof s[k] === 'number') this.vol[k] = s[k]; if (s.on === false) Sfx.on = false; } } catch (_) {} },
  save() { try { localStorage.setItem(AUDIO_KEY, JSON.stringify({ ...this.vol, on: Sfx.on })); } catch (_) {} },
  label(k) { const v = this.vol[k]; return v <= 0 ? 'Off' : v < .45 ? 'Low' : v < .8 ? 'Medium' : 'High'; },
  cycle(k) { const i = this.levels.findIndex(l => Math.abs(l - this.vol[k]) < .05); this.vol[k] = this.levels[(i + 1) % this.levels.length]; this.apply(); this.save(); },
  apply() { if (!Sfx.ac) return; const t = Sfx.ac.currentTime; Sfx.bus.music.gain.setTargetAtTime(this.vol.music * (G.paused ? .45 : 1) * 1.6, t, .2); Sfx.bus.sfx.gain.setTargetAtTime(this.vol.sfx, t, .05); Sfx.bus.amb.gain.setTargetAtTime(this.vol.amb * 1.4, t, .3); Sfx.main.gain.setTargetAtTime(Sfx.on ? .9 : 0, t, .05); },
};
/* ---------- the engine: buses, echo, noise ---------- */
Object.assign(Sfx, {
  bus: null, main: null, noiseBuf: null,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const ac = this.ac = new (window.AudioContext || window.webkitAudioContext)();
      const main = this.main = ac.createGain(); main.gain.value = this.on ? .9 : 0;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; main.connect(comp); comp.connect(ac.destination);
      this.bus = { music: ac.createGain(), sfx: ac.createGain(), amb: ac.createGain() }; for (const k in this.bus) this.bus[k].connect(main);
      this.master = this.bus.sfx;
      // echo send: two delays feeding back through a low-pass, panned apart
      const send = this.echo = ac.createGain(); send.gain.value = 1;
      for (const [dt, pan] of [[.31, -.4], [.47, .4]]) { const d = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter(), p = ac.createStereoPanner ? ac.createStereoPanner() : null; d.delayTime.value = dt; fb.gain.value = .42; lp.type = 'lowpass'; lp.frequency.value = 2200; send.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); if (p) { p.pan.value = pan; lp.connect(p); p.connect(main); } else lp.connect(main); }
      const n = ac.sampleRate * 2, buf = this.noiseBuf = ac.createBuffer(1, n, ac.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
      AudioCfg.apply(); Music.boot();
    } catch (e) { this.ac = null; }
  },
  out(dest, pan) { const ac = this.ac; if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; p.connect(dest); return p; } return dest; },
  /* one shaped note: osc type, frequency, attack, hold, release, volume, optional slide, echo amount */
  voice(dest, { f = 440, type = 'sine', a = .005, h = 0, r = .2, v = .05, slide = 0, pan = 0, echo = 0, at = 0, cutoff = 0, detune = 0, vib = 0 }) {
    const ac = this.ac; if (!ac || !this.on) return; const t = at || ac.currentTime;
    try {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.value = detune;
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + a + h + r);
      if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.2; lg.gain.value = f * vib; l.connect(lg); lg.connect(o.frequency); l.start(t + .15); l.stop(t + a + h + r + .05); }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v, t + a + h); g.gain.exponentialRampToValueAtTime(.0001, t + a + h + r);
      let node = o; if (cutoff) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; o.connect(lp); node = lp; }
      node.connect(g); const out = this.out(dest, pan); g.connect(out); if (echo) { const e = ac.createGain(); e.gain.value = echo; g.connect(e); e.connect(this.echo); }
      o.start(t); o.stop(t + a + h + r + .05);
    } catch (_) {}
  },
  noise(dest, { a = .002, r = .1, v = .05, type = 'bandpass', f = 1200, q = 1, pan = 0, echo = 0, at = 0, sweep = 0 }) {
    const ac = this.ac; if (!ac || !this.on || !this.noiseBuf) return; const t = at || ac.currentTime;
    try {
      const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = this.noiseBuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * sweep), t + a + r);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + r);
      s.connect(fl); fl.connect(g); g.connect(this.out(dest, pan)); if (echo) { const e = ac.createGain(); e.gain.value = echo; g.connect(e); e.connect(this.echo); }
      s.start(t, Math.random() * 1.5); s.stop(t + a + r + .05);
    } catch (_) {}
  },
  /* the original simple blip, now routed through the effects bus */
  tone(f = 440, d = .08, type = 'sine', v = .04, slide = 0, pan = 0) { if (!this.ac) return; this.voice(this.bus.sfx, { f, type, a: .004, r: d, v: v * 1.2, slide, pan }); },
  /* ---------- effects ---------- */
  eat(p) { this.voice(this.bus.sfx, { f: rand(560, 720), type: 'sine', r: .09, v: .05, slide: 1.7, pan: this.pan(p) }); },
  hit(p) { this.noise(this.bus.sfx, { r: .09, v: .12, f: 900, q: .8, pan: this.pan(p) }); this.voice(this.bus.sfx, { f: 150, type: 'sine', r: .12, v: .09, slide: .5, pan: this.pan(p) }); },
  hurt(p) { this.voice(this.bus.sfx, { f: 120, type: 'sawtooth', r: .18, v: .05, slide: .6, cutoff: 900, pan: this.pan(p) }); this.noise(this.bus.sfx, { r: .12, v: .06, f: 400, pan: this.pan(p) }); },
  good(p) { const pn = this.pan(p); [523, 659, 784].forEach((f, i) => this.voice(this.bus.sfx, { f, type: 'triangle', r: .22, v: .05, pan: pn, echo: .25, at: this.ac ? this.ac.currentTime + i * .07 : 0 })); },
  bad(p) { const pn = this.pan(p); this.voice(this.bus.sfx, { f: 233, type: 'triangle', r: .25, v: .06, slide: .75, pan: pn }); this.voice(this.bus.sfx, { f: 175, type: 'triangle', r: .35, v: .05, slide: .8, pan: pn, at: this.ac ? this.ac.currentTime + .12 : 0 }); },
  note(i, p) { const sc = [392, 440, 523, 587, 659, 784, 880]; this.voice(this.bus.sfx, { f: sc[((i % 7) + 7) % 7], type: 'triangle', r: .3, v: .05, pan: this.pan(p), echo: .3 }); },
  click(p) { this.voice(this.bus.sfx, { f: 1100, type: 'square', r: .025, v: .012, pan: this.pan(p), cutoff: 3000 }); },
  warp(p) { this.noise(this.bus.sfx, { a: .05, r: .5, v: .07, f: 300, sweep: 8, q: 2, pan: this.pan(p), echo: .3 }); },
  whoosh(p) { this.noise(this.bus.sfx, { a: .04, r: .35, v: .06, f: 500, sweep: 4, q: 1.5, pan: this.pan(p) }); },
  splash(p) { this.noise(this.bus.sfx, { r: .3, v: .06, type: 'highpass', f: 1800, pan: this.pan(p) }); },
  discover(p) { if (!this.ac) return; const t = this.ac.currentTime, pn = this.pan(p); [0, 4, 7, 11, 14].forEach((s, i) => this.voice(this.bus.sfx, { f: 392 * Math.pow(2, s / 12), type: 'sine', r: .9, v: .045, pan: pn, echo: .5, at: t + i * .09 })); this.voice(this.bus.sfx, { f: 1568, type: 'sine', a: .2, r: 1.4, v: .02, pan: pn, echo: .6, at: t + .3 }); },
  ready(p) { if (!this.ac) return; const t = this.ac.currentTime, pn = this.pan(p); [[0, 4, 7], [5, 9, 12]].forEach((ch, k) => ch.forEach(s => this.voice(this.bus.sfx, { f: 330 * Math.pow(2, s / 12), type: 'triangle', a: .02, h: .25, r: .6, v: .035, pan: pn, echo: .4, at: t + k * .35 }))); },
  evolve() { if (!this.ac) return; const t = this.ac.currentTime; [[0, 7, 12, 16], [5, 9, 12, 17], [7, 11, 14, 19], [12, 16, 19, 24]].forEach((ch, k) => ch.forEach(s => this.voice(this.bus.sfx, { f: 196 * Math.pow(2, s / 12), type: k === 3 ? 'triangle' : 'sawtooth', cutoff: 2400, a: .03, h: k === 3 ? .8 : .18, r: k === 3 ? 1.6 : .3, v: .028, echo: .45, at: t + k * .28 }))); this.noise(this.bus.sfx, { a: .6, r: 1.8, v: .04, f: 5000, type: 'highpass', at: t + .84, echo: .4 }); },
  capture(p) { if (!this.ac) return; const t = this.ac.currentTime, pn = this.pan(p); this.voice(this.bus.sfx, { f: 262, type: 'sawtooth', cutoff: 1600, a: .02, h: .1, r: .4, v: .04, pan: pn, at: t }); this.voice(this.bus.sfx, { f: 392, type: 'sawtooth', cutoff: 1800, a: .02, h: .25, r: .6, v: .04, pan: pn, echo: .4, at: t + .14 }); this.voice(this.bus.sfx, { f: 70, type: 'sine', r: .4, v: .12, slide: .5, pan: pn, at: t }); },
  relic(p) { if (!this.ac) return; const t = this.ac.currentTime, pn = this.pan(p); for (let i = 0; i < 9; i++) this.voice(this.bus.sfx, { f: 880 * Math.pow(2, [0, 7, 12, 4, 11, 16, 7, 14, 19][i] / 12), type: 'sine', r: 1.2, v: .025, pan: pn + Math.sin(i) * .3, echo: .6, at: t + i * .06 }); this.voice(this.bus.sfx, { f: 110, type: 'sine', a: .3, h: .6, r: 1.5, v: .06, pan: pn, at: t }); },
  battle(p) { if (!this.ac) return; const t = this.ac.currentTime, pn = this.pan(p); for (let i = 0; i < 3; i++) this.voice(this.bus.sfx, { f: 98, type: 'sawtooth', cutoff: 700, a: .01, h: .08, r: .2, v: .06, pan: pn, at: t + i * .18 }); this.voice(this.bus.sfx, { f: 147, type: 'sawtooth', cutoff: 900, a: .02, h: .3, r: .5, v: .05, pan: pn, echo: .3, at: t + .54 }); },
  roar(p) { this.voice(this.bus.sfx, { f: 110, type: 'sawtooth', cutoff: 700, a: .05, h: .2, r: .4, v: .07, slide: .7, pan: this.pan(p), vib: .04 }); this.noise(this.bus.sfx, { a: .05, r: .5, v: .05, f: 500, q: .7, pan: this.pan(p) }); },
  dig(p) { for (let i = 0; i < 3; i++) this.noise(this.bus.sfx, { r: .07, v: .07, f: 700 + i * 200, pan: this.pan(p), at: this.ac ? this.ac.currentTime + i * .12 : 0 }); },
  coin(p) { if (!this.ac) return; const t = this.ac.currentTime; this.voice(this.bus.sfx, { f: 1320, type: 'square', cutoff: 4000, r: .08, v: .02, pan: this.pan(p), at: t }); this.voice(this.bus.sfx, { f: 1760, type: 'square', cutoff: 4000, r: .18, v: .02, pan: this.pan(p), at: t + .07 }); },
  laser(p) { this.voice(this.bus.sfx, { f: 1400, type: 'sawtooth', cutoff: 3000, r: .14, v: .025, slide: .3, pan: this.pan(p) }); },
  boom(x, p) { this.noise(this.bus.sfx, { r: .5, v: .09, type: 'lowpass', f: 600, sweep: .3, pan: this.pan(p), echo: .25 }); this.voice(this.bus.sfx, { f: 60, type: 'sine', r: .4, v: .12, slide: .5, pan: this.pan(p) }); },
});
/* ============================== MUSIC ============================== */
const MODES = { ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], aeolian: [0, 2, 3, 5, 7, 8, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10] };
const THEMES = {
  title: { bpm: 68, root: 50, mode: 'lydian', chords: [0, 4, 5, 1], pad: { type: 'triangle', cutoff: 1500, v: .022 }, lead: 'bell', leadOct: 2, density: .32, bass: false, drums: null, amb: 'water' },
  cell: { bpm: 62, root: 45, mode: 'aeolian', chords: [0, 5, 3, 6], pad: { type: 'sine', cutoff: 900, v: .03 }, lead: 'bubble', leadOct: 2, density: .3, bass: true, drums: 'soft', amb: 'water' },
  creature: { bpm: 84, root: 43, mode: 'lydian', chords: [0, 1, 4, 0], pad: { type: 'triangle', cutoff: 1800, v: .022 }, lead: 'flute', leadOct: 2, density: .45, bass: true, drums: 'hand', amb: 'meadow' },
  tribe: { bpm: 96, root: 40, mode: 'dorian', chords: [0, 3, 6, 3], pad: { type: 'triangle', cutoff: 1300, v: .018 }, lead: 'marimba', leadOct: 2, density: .55, bass: true, drums: 'tribal', always: .45, amb: 'meadow' },
  civ: { bpm: 100, root: 48, mode: 'ionian', chords: [0, 4, 5, 3], pad: { type: 'sawtooth', cutoff: 1100, v: .014 }, lead: 'pluck', leadOct: 2, density: .6, bass: true, drums: 'march', always: .25, amb: 'wind', arp: true },
  space: { bpm: 58, root: 42, mode: 'aeolian', chords: [0, 5, 2, 6], pad: { type: 'sawtooth', cutoff: 1300, v: .016 }, lead: 'bell', leadOct: 3, density: .28, bass: true, drums: 'pulse', amb: 'void' },
};
const Music = {
  name: null, theme: null, bus: null, nextT: 0, step: 0, bar: 0, motif: null, mood: 0, rng: Math.random, ambSrc: null, want: null,
  boot() { if (this.want) { const w = this.want; this.want = null; this.play(w); } },
  /* crossfade to a stage's theme; remembered if sound has not started yet */
  play(name) {
    if (!Sfx.ac) { this.want = name; return; } if (name === this.name) return; const ac = Sfx.ac, t = ac.currentTime;
    if (this.bus) { const old = this.bus; old.gain.setTargetAtTime(0, t, .6); setTimeout(() => { try { old.disconnect(); } catch (_) {} }, 4000); }
    if (this.ambSrc) { const a = this.ambSrc; a.g.gain.setTargetAtTime(0, t, .6); setTimeout(() => { try { a.s.stop(); a.g.disconnect(); } catch (_) {} }, 4000); this.ambSrc = null; }
    this.name = name; this.theme = THEMES[name] || THEMES.title; this.bus = ac.createGain(); this.bus.gain.value = 0; this.bus.gain.setTargetAtTime(1, t + .3, 1.2); this.bus.connect(Sfx.bus.music);
    this.drumBus = ac.createGain(); this.drumBus.gain.value = this.theme.always || 0; this.drumBus.connect(this.bus);
    this.nextT = t + .4; this.step = 0; this.bar = 0; this.motif = null; this.mood = 0; this.seed = (hashStr(name) ^ (G.seed || 1)) >>> 0; this.startAmb();
  },
  startAmb() {
    const ac = Sfx.ac, A = this.theme.amb; if (!A || !Sfx.noiseBuf) return;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = Sfx.noiseBuf; s.loop = true;
    f.type = A === 'void' ? 'lowpass' : A === 'water' ? 'lowpass' : 'bandpass'; f.frequency.value = A === 'void' ? 160 : A === 'water' ? 380 : A === 'wind' ? 500 : 700; f.Q.value = A === 'wind' ? .6 : .9;
    g.gain.value = 0; g.gain.setTargetAtTime(A === 'meadow' ? .02 : .05, ac.currentTime + .5, 2); s.connect(f); f.connect(g); g.connect(Sfx.bus.amb); s.start(); this.ambSrc = { s, f, g };
  },
  midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },
  deg(d, oct = 0) { const sc = MODES[this.theme.mode], o = Math.floor(d / 7); return this.theme.root + sc[((d % 7) + 7) % 7] + 12 * (o + oct); },
  /* called every frame: schedule what falls in the next 0.25 s */
  tick(dt) {
    if (!Sfx.ac || !this.theme || !Sfx.on || AudioCfg.vol.music <= 0 && AudioCfg.vol.amb <= 0) return; const ac = Sfx.ac, T = this.theme, beat = 60 / T.bpm / 2;
    const want = S && S.musicMood ? clamp(S.musicMood(), 0, 1) : 0; this.mood = lerp(this.mood, want, Math.min(1, dt * (want > this.mood ? 2 : .4)));
    this.drumBus.gain.setTargetAtTime(Math.max(T.always || 0, this.mood) * (T.drums ? 1 : 0), ac.currentTime, .4);
    if (this.nextT < ac.currentTime - .5) this.nextT = ac.currentTime + .05; // tab was asleep
    let guard = 0; while (this.nextT < ac.currentTime + .25 && guard++ < 16) { this.playStep(this.step, this.nextT, beat); this.nextT += beat; this.step++; }
    this.ambience(dt);
  },
  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; },
  playStep(st, t, beat) {
    const T = this.theme, inBar = st % 8, bar = Math.floor(st / 8), chord = T.chords[Math.floor(bar / 2) % T.chords.length], B = this.bus;
    const mv = AudioCfg.vol.music; if (mv <= 0) return;
    // pads: a new chord every two bars, long attack and release
    if (inBar === 0 && bar % 2 === 0) for (const k of [0, 2, 4]) for (const det of [-6, 6]) Sfx.voice(B, { f: this.midi(this.deg(chord + k, 1)), type: T.pad.type, cutoff: T.pad.cutoff, a: beat * 4, h: beat * 8, r: beat * 6, v: T.pad.v, detune: det, echo: .25, at: t });
    // bass on the beat
    if (T.bass && (inBar === 0 || (inBar === 4 && this.theme.drums !== 'soft'))) Sfx.voice(B, { f: this.midi(this.deg(chord, -1)), type: 'sine', a: .02, h: beat * 2, r: beat * 2, v: .07, at: t });
    if (T.arp && inBar % 2 === 1) Sfx.voice(B, { f: this.midi(this.deg(chord + [0, 2, 4, 7][(st >> 1) % 4], 1)), type: 'triangle', a: .005, r: beat * 1.2, v: .022, echo: .2, at: t });
    // melody: a motif per four-bar phrase, repeated with a twist on the last bar
    if (bar % 4 === 0 && inBar === 0) { this.motif = []; let d = 2 + Math.floor(this.rnd() * 3); for (let i = 0; i < 8; i++) { d = clamp(d + [-2, -1, -1, 0, 1, 1, 2][Math.floor(this.rnd() * 7)], -2, 9); this.motif.push(this.rnd() < T.density ? d : null); } }
    const m = this.motif && this.motif[inBar]; if (m !== null && m !== undefined) { const twist = bar % 4 === 3 && inBar > 4 ? 1 : 0; this.lead(this.midi(this.deg(m + twist + (chord % 2 ? 0 : 0), T.leadOct)), t, beat); }
    // drums: the layer's volume follows the danger level
    if (T.drums) this.drums(T.drums, inBar, t, beat);
  },
  lead(f, t, beat) {
    const B = this.bus, k = this.theme.lead;
    if (k === 'bell') { Sfx.voice(B, { f, type: 'sine', a: .005, r: beat * 5, v: .03, echo: .5, at: t }); Sfx.voice(B, { f: f * 2.76, type: 'sine', a: .005, r: beat * 1.5, v: .008, echo: .5, at: t }); }
    else if (k === 'bubble') Sfx.voice(B, { f: f * .5, type: 'sine', a: .01, r: beat * 1.6, v: .04, slide: 1.25, echo: .45, at: t });
    else if (k === 'flute') Sfx.voice(B, { f, type: 'triangle', a: beat * .4, h: beat * .6, r: beat * 1.4, v: .028, vib: .006, echo: .35, at: t, cutoff: 2600 });
    else if (k === 'marimba') { Sfx.voice(B, { f, type: 'sine', a: .002, r: beat * 1.1, v: .045, echo: .2, at: t }); Sfx.voice(B, { f: f * 4, type: 'sine', a: .001, r: .05, v: .01, at: t }); }
    else Sfx.voice(B, { f, type: 'sawtooth', cutoff: 1800, a: .004, r: beat * 1.3, v: .022, echo: .3, at: t });
  },
  drums(kind, i, t, beat) {
    const D = this.drumBus, kick = (v = .14) => Sfx.voice(D, { f: 120, type: 'sine', a: .002, r: .22, v, slide: .35, at: t }), hat = (v = .025) => Sfx.noise(D, { r: .04, v, type: 'highpass', f: 7000, at: t }), tom = (f, v = .08) => Sfx.voice(D, { f, type: 'sine', a: .002, r: .18, v, slide: .6, at: t }), snare = (v = .06) => Sfx.noise(D, { r: .12, v, f: 1800, q: .7, at: t });
    if (kind === 'soft') { if (i === 0) kick(.08); if (i === 6) Sfx.noise(D, { r: .2, v: .02, type: 'lowpass', f: 900, at: t }); }
    else if (kind === 'hand') { if (i === 0 || i === 5) tom(140); if (i === 3 || i === 7) tom(210, .05); if (i % 2) hat(.012); }
    else if (kind === 'tribal') { if (i === 0 || i === 3 || i === 6) tom(110, .1); if (i === 2 || i === 5) tom(180, .06); if (i === 4) snare(.03); hat(.008); }
    else if (kind === 'march') { if (i === 0 || i === 4) kick(.12); if (i === 2 || i === 6) snare(.05); if (i === 7) snare(.025); hat(.01); }
    else { if (i % 2 === 0) Sfx.voice(D, { f: this.midi(this.deg(this.theme.chords[0], -1)), type: 'sawtooth', cutoff: 500, a: .005, r: beat * .9, v: .05, at: t }); if (i === 0 || i === 4) kick(.12); }
  },
  /* little ambient touches between the beats: bubbles, birdsong, crickets, distant thunder of space */
  ambience(dt) {
    const A = this.theme && this.theme.amb, av = AudioCfg.vol.amb; if (!A || av <= 0) return; const r = Math.random(), B = Sfx.bus.amb, night = S && S.day && S.day.isNight;
    if (A === 'water' && r < dt * 1.6) Sfx.voice(B, { f: rand(300, 900), type: 'sine', a: .005, r: .08, v: .03, slide: 2.2, pan: rand(-.7, .7) });
    else if (A === 'meadow') {
      if (!night && r < dt * .5) { const f = rand(2200, 3600), pn = rand(-.8, .8), t = Sfx.ac.currentTime; for (let i = 0; i < 2 + Math.floor(rand(0, 3)); i++) Sfx.voice(B, { f: f * rand(.9, 1.1), type: 'sine', a: .005, r: .07, v: .012, slide: rand(1.2, 1.5), pan: pn, at: t + i * .1 }); }
      if (night && r < dt * 3) Sfx.voice(B, { f: rand(4200, 4800), type: 'square', cutoff: 6000, a: .002, r: .03, v: .004, pan: rand(-.8, .8) });
      if (this.ambSrc) this.ambSrc.g.gain.setTargetAtTime(night ? .012 : .02, Sfx.ac.currentTime, 2);
    }
    else if (A === 'wind' && this.ambSrc && r < dt * .3) this.ambSrc.f.frequency.setTargetAtTime(rand(300, 900), Sfx.ac.currentTime, 2);
    else if (A === 'void' && r < dt * .08) Sfx.voice(B, { f: rand(50, 80), type: 'sine', a: 1.5, h: 1, r: 3, v: .04, echo: .3 });
  },
};
AudioCfg.load();
window.addEventListener('pointerdown', () => Sfx.init(), { once: false, passive: true });
