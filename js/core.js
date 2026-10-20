/* Lineage | core. Intellectual property of Sidedoor Digital. */
'use strict';
/* ============================== UTILITIES ============================== */
const TAU = Math.PI * 2;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
const lerpAng = (a, b, t) => a + angDiff(a, b) * clamp(t, 0, 1);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function makeNoise(seed) {
  const r = mulberry32(seed); const P = new Float32Array(65536); for (let i = 0; i < P.length; i++) P[i] = r();
  const g = (a, b) => P[(a & 255) + ((b & 255) << 8)];
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), v = smooth(y - yi); return lerp(lerp(g(xi, yi), g(xi + 1, yi), u), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), u), v); };
}
function makeNoise3(seed) {
  const r = mulberry32(seed); const P = new Float32Array(32768); for (let i = 0; i < P.length; i++) P[i] = r();
  const g = (a, b, c) => P[(a & 31) + ((b & 31) << 5) + ((c & 31) << 10)];
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = smooth(x - xi), v = smooth(y - yi), w = smooth(z - zi);
    const a = lerp(lerp(g(xi, yi, zi), g(xi + 1, yi, zi), u), lerp(g(xi, yi + 1, zi), g(xi + 1, yi + 1, zi), u), v);
    const b = lerp(lerp(g(xi, yi, zi + 1), g(xi + 1, yi, zi + 1), u), lerp(g(xi, yi + 1, zi + 1), g(xi + 1, yi + 1, zi + 1), u), v);
    return lerp(a, b, w);
  };
}
function fbm(n, x, y, o = 4) { let a = 0, amp = .5, f = 1, t = 0; for (let i = 0; i < o; i++) { a += amp * n(x * f, y * f); t += amp; amp *= .5; f *= 2.03; } return a / t; }
function fbm3(n, x, y, z, o = 4) { let a = 0, amp = .5, f = 1, t = 0; for (let i = 0; i < o; i++) { a += amp * n(x * f, y * f, z * f); t += amp; amp *= .5; f *= 2.03; } return a / t; }
const SYL = ['ka', 'zu', 'mor', 'vel', 'tha', 'ri', 'on', 'xi', 'bra', 'lo', 'sen', 'dra', 'ul', 'py', 'qua', 'neth', 'or', 'ix', 'vo', 'ha', 'el', 'gor', 'sha', 'ti', 'ny', 'ek'];
function makeName(r = Math.random, n = 2 + Math.floor(r() * 2)) { let s = ''; for (let i = 0; i < n; i++) s += SYL[Math.floor(r() * SYL.length)]; return s[0].toUpperCase() + s.slice(1); }
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Math.abs(n) >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n));
const hueCss = (h, s = 70, l = 60) => `hsl(${Math.round(h)},${s}%,${l}%)`;
const col3 = (h, s = .6, l = .5) => new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, s, l);

/* ============================== INPUT (two players, one keyboard) ============================== */
const KEYMAP = [
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], a1: ['Slash', 'Numpad1'], a2: ['Period', 'Numpad2'], a3: ['Semicolon', 'Numpad3'], a4: ['Quote', 'Numpad4'], menu: ['Enter', 'NumpadEnter'], back: ['ShiftRight', 'Numpad0', 'Backspace'] },
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], a1: ['KeyF'], a2: ['KeyG'], a3: ['KeyR'], a4: ['KeyT'], menu: ['KeyE'], back: ['KeyQ'] },
];
const KEYLABEL = [{ a1: '/', a2: '.', a3: ';', a4: "'", menu: '↵', back: '⇧', move: 'Arrows' }, { a1: 'F', a2: 'G', a3: 'R', a4: 'T', menu: 'E', back: 'Q', move: 'WASD' }];
const Input = { held: [{}, {}], codeMap: new Map(), anyKey: null };
function buildCodeMap() {
  Input.codeMap.clear();
  KEYMAP.forEach((m, p) => { for (const act in m) for (const code of m[act]) { const owner = G.mode === 1 ? 0 : p; if (!Input.codeMap.has(code)) Input.codeMap.set(code, []); Input.codeMap.get(code).push({ p: owner, act }); } });
}
const DIRS = ['up', 'down', 'left', 'right'];
Input.pad = [{}, {}]; Input.stick = [{ x: 0, z: 0 }, { x: 0, z: 0 }]; Input.padOwner = -1;
const held = (p, act) => !!(Input.held[p][act] || Input.pad[p][act]);
function dirOf(p) {
  const st = Input.stick[p], sm = Math.hypot(st.x, st.z); if (sm > .3) return { x: st.x / sm, z: st.z / sm, m: Math.min(1, sm) };
  let x = 0, z = 0; if (held(p, 'up')) z -= 1; if (held(p, 'down')) z += 1; if (held(p, 'left')) x -= 1; if (held(p, 'right')) x += 1; const m = Math.hypot(x, z); return m ? { x: x / m, z: z / m, m: 1 } : { x: 0, z: 0, m: 0 };
}
/* controllers: two pads map to P1 and P2; one pad plays as P2 in split screen unless switched in the pause menu */
const PAD_BTN = { 0: 'a1', 1: 'a2', 2: 'a3', 3: 'a4', 9: 'menu', 5: 'menu', 8: 'back', 4: 'back', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
function pollPads() {
  let pads = []; try { pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean); } catch (_) { return; }
  const owners = pads.length >= 2 ? [0, 1] : [G.mode === 1 ? 0 : (Input.padOwner >= 0 ? Input.padOwner : 1)];
  for (let p = 0; p < 2; p++) if (!pads.length || !owners.includes(p)) { Input.pad[p] = {}; Input.stick[p] = { x: 0, z: 0 }; }
  pads.slice(0, 2).forEach((pad, k) => {
    const p = owners[k]; if (p === undefined || p >= G.mode) return; const now = {};
    pad.buttons.forEach((b, i) => { const act = PAD_BTN[i]; if (act && (b.pressed || b.value > .5)) now[act] = true; });
    const ax = pad.axes[0] || 0, az = pad.axes[1] || 0; Input.stick[p] = { x: Math.abs(ax) > .2 ? ax : 0, z: Math.abs(az) > .2 ? az : 0 };
    if (az < -.6) now.up = true; if (az > .6) now.down = true; if (ax < -.6) now.left = true; if (ax > .6) now.right = true;
    const was = Input.pad[p];
    for (const act in now) if (!was[act]) { Sfx.init(); dispatchPress(p, act); }
    for (const act in was) if (was[act] && !now[act] && !Input.held[p][act] && S && S.onRelease) S.onRelease(p, act);
    Input.pad[p] = now;
  });
}
window.addEventListener('keydown', e => {
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
  Sfx.init();
  const maps = Input.codeMap.get(e.code); if (!maps) { if (e.code === 'Escape') { e.preventDefault(); onEscape(); } return; }
  e.preventDefault();
  for (const { p, act } of maps) {
    const counter = '_' + act; Input.held[p][counter] = (Input.held[p][counter] || 0) + (e.repeat ? 0 : 1);
    const was = Input.held[p][act]; Input.held[p][act] = true;
    if (!was || (e.repeat && DIRS.includes(act) && Menus[p] && Menus[p].isOpen)) dispatchPress(p, act);
  }
});
window.addEventListener('keyup', e => {
  const maps = Input.codeMap.get(e.code); if (!maps) return;
  for (const { p, act } of maps) { const c = '_' + act; Input.held[p][c] = Math.max(0, (Input.held[p][c] || 1) - 1); if (!Input.held[p][c]) { Input.held[p][act] = false; if (S && S.onRelease) S.onRelease(p, act); } }
});
window.addEventListener('blur', () => { Input.held = [{}, {}]; Input.pad = [{}, {}]; });
function dispatchPress(p, act) {
  if (Modal.isOpen) { Modal.press(p, act); return; }
  if (G.paused) return;
  if (Menus[p] && Menus[p].isOpen) { Menus[p].key(act); return; }
  if (S && S.onAction) S.onAction(p, act);
}

/* ============================== SOUND ============================== */
const Sfx = {
  ac: null, on: true, master: null,
  init() { if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ac.createGain(); this.master.gain.value = .8; this.master.connect(this.ac.destination); } catch (_) { this.ac = null; } } else if (this.ac.state === 'suspended') this.ac.resume(); },
  tone(f = 440, d = .08, type = 'sine', v = .04, slide = 0, pan = 0) {
    const ac = this.ac; if (!ac || !this.on) return;
    try {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; let out = g;
      o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
      o.connect(g); out.connect(this.master); o.start(t); o.stop(t + d + .03);
    } catch (_) {}
  },
  pan(p) { return G.mode === 2 ? (p === 0 ? -.6 : .6) : 0; },
  eat(p) { this.tone(rand(520, 700), .07, 'sine', .035, 1.6, this.pan(p)); },
  hit(p) { this.tone(160, .1, 'square', .025, .5, this.pan(p)); },
  hurt(p) { this.tone(110, .16, 'sawtooth', .03, .6, this.pan(p)); },
  good(p) { const pn = this.pan(p); this.tone(523, .1, 'triangle', .04, 0, pn); setTimeout(() => this.tone(784, .16, 'triangle', .04, 0, pn), 90); },
  bad(p) { this.tone(220, .2, 'triangle', .04, .7, this.pan(p)); },
  note(i, p) { this.tone([392, 440, 523, 587, 659, 784, 880][((i % 7) + 7) % 7], .2, 'triangle', .035, 0, this.pan(p)); },
  click(p) { this.tone(880, .03, 'square', .012, 0, this.pan(p)); },
  warp(p) { this.tone(200, .5, 'sine', .04, 4, this.pan(p)); },
};

/* ============================== GAME STATE, LEGACIES, SAVE ============================== */
const STAGE_NAMES = ['Cell', 'Creature', 'Tribe', 'Civilization', 'Space'];
const G = { mode: 2, paused: false, stage: 0, accord: false, accordStages: 0, players: [], seed: 1 };
const LEGACY = [
  { aggr: { title: "Hunter's Hunger", desc: 'Ate other cells. +20% damage for the rest of the game. Carnivore.', mods: { dmg: 1.2 } },
    social: { title: 'Steady Metabolism', desc: 'Grazed peacefully. +20% health, +10% food and income. Herbivore.', mods: { hp: 1.2, econ: 1.1 } },
    mixed: { title: 'Opportunist', desc: 'Ate anything. +10% damage and health. Omnivore.', mods: { dmg: 1.1, hp: 1.1 } } },
  { aggr: { title: 'Apex Instinct', desc: 'Drove species to extinction. +25% damage.', mods: { dmg: 1.25 } },
    social: { title: 'Silver Tongue', desc: 'Befriended the wild. +30% social power.', mods: { social: 1.3 } },
    mixed: { title: 'Pack Mind', desc: 'Fought some, befriended others. +10% damage, +15% social.', mods: { dmg: 1.1, social: 1.15 } } },
  { aggr: { title: 'Warlord', desc: 'United tribes by force. +20% damage, +10% health.', mods: { dmg: 1.2, hp: 1.1 } },
    social: { title: 'Keeper of Songs', desc: 'United tribes with music and gifts. +30% social.', mods: { social: 1.3 } },
    mixed: { title: 'Chieftain', desc: 'Gifts and spears both worked. +20% income, +10% social.', mods: { econ: 1.2, social: 1.1 } } },
  { aggr: { title: 'Iron Doctrine', desc: 'Conquered cities. +30% weapons.', mods: { dmg: 1.3 } },
    social: { title: 'Missionary Zeal', desc: 'Converted cities with culture. +35% diplomacy.', mods: { social: 1.35 } },
    mixed: { title: 'Merchant Princes', desc: 'Bought cities with trade. +40% income.', mods: { econ: 1.4 } } },
  { aggr: { title: 'Galactic Warlord', desc: 'Took the stars by force.', mods: {} }, social: { title: 'Galactic Diplomat', desc: 'United the stars.', mods: {} }, mixed: { title: 'Galactic Pioneer', desc: 'Explored and settled the stars.', mods: {} } },
];
const SHARED = { title: 'Shared Prosperity', desc: 'Finished this stage in accord with your rival. +6% income and social.', mods: { econ: 1.06, social: 1.06 } };
const WANDER_MODS = { hp: 1.05, econ: 1.05 };
const isExtra = l => !!(l.shared || l.first || l.wander);
const STYLE_WORD = { aggr: 'Predatory', social: 'Peaceful', mixed: 'Adaptive' };
const DIET_WORD = { carn: 'carnivore', herb: 'herbivore', omni: 'omnivore' };
function newPlayer(i, name, hue) {
  return { i, name, hue, hue2: (hue + 150) % 360, diet: 'omni', legacies: [], mods: { dmg: 1, hp: 1, social: 1, econ: 1, speed: 1 }, cell: null, body: null, unlocked: [], journal: [], genes: [], chronicle: [], score: 0 };
}
function recalcMods(P) {
  P.mods = { dmg: 1, hp: 1, social: 1, econ: 1, speed: 1 }; P.genes = P.genes || []; P.chronicle = P.chronicle || [];
  for (const l of P.legacies) { const m = l.shared ? SHARED.mods : l.wander ? WANDER_MODS : l.first ? {} : LEGACY[l.stage][l.style].mods; for (const k in m) P.mods[k] *= m[k]; }
  /* genes stack on top of legacies; GENES lives in genome.js, which loads later but before anything calls this */
  if (typeof GENES !== 'undefined') for (const g of P.genes) { const m = GENES[g] && GENES[g].mods; if (m) for (const k in m) P.mods[k] = (P.mods[k] || 1) * m[k]; }
}
function addLegacy(P, stage, style) { P.legacies = P.legacies.filter(l => !(l.stage === stage && !isExtra(l))); const L = LEGACY[stage][style]; P.legacies.push({ stage, style, title: L.title, desc: L.desc }); recalcMods(P); }
function styleCount(P, s) { return P.legacies.filter(l => l.style === s && !isExtra(l)).length; }
function modsHTML(P) {
  const m = P.mods, out = [];
  const f = (k, n) => { if (Math.abs(m[k] - 1) > .001) out.push(`<span>${n} ×${m[k].toFixed(2)}</span>`); };
  f('dmg', 'Damage'); f('hp', 'Health'); f('social', 'Social'); f('econ', 'Income'); f('speed', 'Speed');
  if (P.cell) out.push(`<span>${DIET_WORD[P.diet]}</span>`);
  return `<div class="mods">${out.join('') || '<span>No inherited traits yet</span>'}</div>`;
}
function legacyCard(l) {
  const tag = l.shared ? 'Accord' : l.wander ? 'Explorer' : l.first ? 'Bonus' : STYLE_WORD[l.style];
  return `<div class="legacy"><div class="eyebrow">Stage ${l.stage + 1} · ${STAGE_NAMES[l.stage]} · ${tag}</div><div class="t">${esc(l.title)}</div><div class="d">${esc(l.desc)}</div></div>`;
}
const SAVE_KEY = 'lineage3d-save-v1';
function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, mode: G.mode, stage: G.stage, accord: G.accord, accordStages: G.accordStages, seed: G.seed, players: G.players })); } catch (_) {} }
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 1 && s.players) return s; } catch (_) {} return null; }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} }
