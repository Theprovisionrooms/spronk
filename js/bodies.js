/* Lineage | bodies. Intellectual property of Sidedoor Digital. */
'use strict';
/* ============================== MOULDABLE BODIES ==============================
   A body is a spine of vertebrae (position + radius) plus parts anchored to its skin.
   The skin is a smooth signed-distance surface (round cones blended with smooth-min),
   polygonised with marching cubes, coloured by paint, and skinned to one bone per vertebra.
   Parts, legs and arms are baked into the same skinned mesh, so a whole creature is one object. */

/* ---------- signed distance field ---------- */
function sdRC(px, py, pz, ax, ay, az, bx, by, bz, r1, r2) {
  const bax = bx - ax, bay = by - ay, baz = bz - az, l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr;
  if (a2 <= 1e-5) return Math.min(Math.hypot(px - ax, py - ay, pz - az) - r1, Math.hypot(px - bx, py - by, pz - bz) - r2);
  const il2 = 1 / l2, pax = px - ax, pay = py - ay, paz = pz - az, y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y, x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; }
function makeSDF(sp, isCell) {
  const n = sp.length, sy = isCell ? .58 : 1, k = isCell ? .12 : .1;
  const segs = []; for (let i = 0; i < n - 1; i++) { const a = sp[i], b = sp[i + 1]; segs.push([a.x, a.y, a.z, b.x, b.y, b.z, a.r, b.r]); }
  if (!segs.length) { const a = sp[0]; segs.push([a.x, a.y, a.z, a.x + .01, a.y, a.z, a.r, a.r]); }
  return (x, y, z) => {
    const yy = isCell ? y / sy : y; let d = 1e9;
    for (const s of segs) { const v = sdRC(x, yy, z, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7]); d = d > 1e8 ? v : smin(d, v, k); }
    return isCell ? d * .8 : d;
  };
}

/* ---------- marching cubes with shared vertices ---------- */
function polygonize(f, min, max, h) {
  let nx = Math.ceil((max.x - min.x) / h) + 1, ny = Math.ceil((max.y - min.y) / h) + 1, nz = Math.ceil((max.z - min.z) / h) + 1;
  while (nx * ny * nz > 160000) { h *= 1.12; nx = Math.ceil((max.x - min.x) / h) + 1; ny = Math.ceil((max.y - min.y) / h) + 1; nz = Math.ceil((max.z - min.z) / h) + 1; }
  const V = new Float32Array(nx * ny * nz), idx = (x, y, z) => x + nx * (y + ny * z);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) V[idx(x, y, z)] = f(min.x + x * h, min.y + y * h, min.z + z * h);
  const cache = new Int32Array(nx * ny * nz * 3).fill(-1), P = [], I = [];
  const vert = (x, y, z, axis) => {
    const key = idx(x, y, z) * 3 + axis; let v = cache[key]; if (v >= 0) return v;
    const x2 = x + (axis === 0), y2 = y + (axis === 1), z2 = z + (axis === 2), a = V[idx(x, y, z)], b = V[idx(x2, y2, z2)], t = a / (a - b);
    v = P.length / 3; P.push(min.x + (x + (x2 - x) * t) * h, min.y + (y + (y2 - y) * t) * h, min.z + (z + (z2 - z) * t) * h); cache[key] = v; return v;
  };
  const E = new Int32Array(12);
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    let c = 0;
    if (V[idx(x, y, z)] > 0) c |= 1; if (V[idx(x + 1, y, z)] > 0) c |= 2; if (V[idx(x + 1, y + 1, z)] > 0) c |= 4; if (V[idx(x, y + 1, z)] > 0) c |= 8;
    if (V[idx(x, y, z + 1)] > 0) c |= 16; if (V[idx(x + 1, y, z + 1)] > 0) c |= 32; if (V[idx(x + 1, y + 1, z + 1)] > 0) c |= 64; if (V[idx(x, y + 1, z + 1)] > 0) c |= 128;
    const bits = MC_EDGE[c]; if (!bits) continue;
    if (bits & 1) E[0] = vert(x, y, z, 0); if (bits & 2) E[1] = vert(x + 1, y, z, 1); if (bits & 4) E[2] = vert(x, y + 1, z, 0); if (bits & 8) E[3] = vert(x, y, z, 1);
    if (bits & 16) E[4] = vert(x, y, z + 1, 0); if (bits & 32) E[5] = vert(x + 1, y, z + 1, 1); if (bits & 64) E[6] = vert(x, y + 1, z + 1, 0); if (bits & 128) E[7] = vert(x, y, z + 1, 1);
    if (bits & 256) E[8] = vert(x, y, z, 2); if (bits & 512) E[9] = vert(x + 1, y, z, 2); if (bits & 1024) E[10] = vert(x + 1, y + 1, z, 2); if (bits & 2048) E[11] = vert(x, y + 1, z, 2);
    const o = c << 4; for (let i = 0; MC_TRI[o + i] !== -1; i += 3) I.push(E[MC_TRI[o + i]], E[MC_TRI[o + i + 1]], E[MC_TRI[o + i + 2]]);
  }
  const N = new Float32Array(P.length), e = h * .5;
  for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; let gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e); const l = Math.hypot(gx, gy, gz) || 1; N[i] = gx / l; N[i + 1] = gy / l; N[i + 2] = gz / l; }
  return { P: new Float32Array(P), N, I };
}

/* ---------- part catalogue ----------
   Part frame: +Y is the skin normal, +X points along the body (or up when the part faces forward), +Z to the side. */
const PART_CATS = {
  creature: [['mouth', 'Mouths'], ['eye', 'Eyes'], ['leg', 'Legs'], ['arm', 'Arms'], ['detail', 'Details']],
  cell: [['cmouth', 'Mouths'], ['cmove', 'Movement'], ['cweapon', 'Weapons'], ['ceye', 'Eyes']],
};
const ABIL = { bite: 'Bite', charge: 'Charge', strike: 'Strike', spit: 'Spit', sing: 'Sing', dance: 'Dance', charm: 'Charm', pose: 'Pose', speed: 'Speed', jump: 'Jump', glide: 'Glide', sneak: 'Sneak', health: 'Health', sight: 'Sight' };
const CELL_ABIL = { speed: 'Speed', turn: 'Agility', dash: 'Dash', spike: 'Spikes', poison: 'Poison', shock: 'Shock', sight: 'Sight', armor: 'Armour' };
const P = (id, name, cat, cost, stats, extra = {}) => ({ id, name, cat, cost, stats, ...extra });
const PARTS = {};
[
  P('m_graze', 'Grazer lips', 'mouth', 6, { bite: 1, sing: 1 }, { diet: 'herb' }),
  P('m_beak', 'Hook beak', 'mouth', 10, { bite: 2, sing: 1 }, { diet: 'omni' }),
  P('m_fang', 'Fang jaw', 'mouth', 14, { bite: 3 }, { diet: 'carn' }),
  P('m_mandible', 'Mandibles', 'mouth', 12, { bite: 2, charm: 1 }, { diet: 'carn' }),
  P('m_trumpet', 'Trumpet snout', 'mouth', 16, { sing: 3, bite: 1 }, { diet: 'herb', lock: true }),
  P('m_maw', 'Gulper maw', 'mouth', 24, { bite: 4 }, { diet: 'omni', lock: true }),
  P('e_round', 'Round eye', 'eye', 3, { sight: 1 }),
  P('e_slit', 'Hunter eye', 'eye', 6, { sight: 2, sneak: 1 }),
  P('e_stalk', 'Stalk eye', 'eye', 7, { sight: 2, charm: 1 }),
  P('e_bug', 'Compound eye', 'eye', 9, { sight: 3 }, { lock: true }),
  P('l_walker', 'Walker leg', 'leg', 8, { speed: 1, dance: 1 }, { foot: 'paw', len: 1.1, thick: 1 }),
  P('l_strider', 'Strider leg', 'leg', 14, { speed: 3 }, { foot: 'hoof', len: 1.5, thick: .7 }),
  P('l_stomper', 'Stomper leg', 'leg', 14, { charge: 2, health: 1 }, { foot: 'pad', len: 1, thick: 1.6 }),
  P('l_hopper', 'Hopper leg', 'leg', 14, { jump: 3, speed: 1 }, { foot: 'paw', len: 1.3, thick: 1, reverse: true, lock: true }),
  P('l_talon', 'Talon leg', 'leg', 13, { speed: 2, strike: 1, sneak: 1 }, { foot: 'talon', len: 1.2, thick: .8, lock: true }),
  P('a_grasp', 'Grasper arm', 'arm', 8, { charm: 2 }, { hand: 'hand', len: 1, thick: .8 }),
  P('a_claw', 'Claw arm', 'arm', 12, { strike: 2 }, { hand: 'claw', len: 1, thick: .9 }),
  P('a_pincer', 'Pincer arm', 'arm', 16, { strike: 3 }, { hand: 'pincer', len: 1.1, thick: 1, lock: true }),
  P('a_frond', 'Frond arm', 'arm', 10, { dance: 2, charm: 1 }, { hand: 'frond', len: 1, thick: .7, lock: true }),
  P('d_horn', 'Horn', 'detail', 6, { charge: 1 }),
  P('d_spike', 'Spike', 'detail', 4, { health: 1 }),
  P('d_plate', 'Armour plate', 'detail', 9, { health: 2 }),
  P('d_wing', 'Wing', 'detail', 14, { glide: 2, jump: 1 }),
  P('d_fin', 'Fin', 'detail', 5, { sneak: 1, pose: 1 }),
  P('d_frill', 'Frill', 'detail', 8, { pose: 2, charm: 1 }),
  P('d_crest', 'Crest', 'detail', 7, { pose: 2 }),
  P('d_antenna', 'Antenna', 'detail', 5, { sing: 1, sight: 1 }),
  P('d_glow', 'Glow bulb', 'detail', 8, { charm: 2, sight: 1 }, { lock: true }),
  P('d_spitter', 'Spit gland', 'detail', 12, { spit: 2 }, { lock: true }),
  P('d_club', 'Tail club', 'detail', 10, { charge: 1, strike: 1 }, { lock: true }),
  P('d_shell', 'Shell dome', 'detail', 15, { health: 3 }, { lock: true }),
  // cell parts
  P('c_filter', 'Filter mouth', 'cmouth', 0, {}, { diet: 'herb' }),
  P('c_jaw', 'Jaw', 'cmouth', 15, { spike: 1 }, { diet: 'carn' }),
  P('c_proboscis', 'Proboscis', 'cmouth', 20, {}, { diet: 'omni' }),
  P('c_flagellum', 'Flagellum', 'cmove', 10, { speed: 1 }, { anim: 'flag' }),
  P('c_cilia', 'Cilia', 'cmove', 12, { turn: 2, speed: 1 }),
  P('c_jet', 'Jet', 'cmove', 15, { dash: 2 }),
  P('c_spike', 'Spike', 'cweapon', 10, { spike: 1 }),
  P('c_poison', 'Poison gland', 'cweapon', 25, { poison: 1 }),
  P('c_electric', 'Electric organ', 'cweapon', 30, { shock: 1 }),
  P('c_armor', 'Membrane plate', 'cweapon', 12, { armor: 1 }),
  P('c_eye', 'Eyespot', 'ceye', 4, { sight: 1 }),
  P('c_stalk', 'Stalk eye', 'ceye', 8, { sight: 2 }),
].forEach(p => PARTS[p.id] = p);
const LIMB_CATS = new Set(['leg', 'arm']);

/* ---------- primitive geometry ---------- */
const PRIM = {};
function prim(name) {
  if (PRIM[name]) return PRIM[name];
  const g = { sph: () => new THREE.SphereGeometry(1, 14, 10), sphl: () => new THREE.SphereGeometry(1, 9, 7), cone: () => new THREE.ConeGeometry(1, 1, 10), cyl: () => new THREE.CylinderGeometry(1, 1, 1, 10), cylo: () => new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), box: () => new THREE.BoxGeometry(1, 1, 1), disc: () => new THREE.CircleGeometry(1, 18, 0, Math.PI), tor: () => new THREE.TorusGeometry(1, .25, 6, 14), ico: () => new THREE.IcosahedronGeometry(1, 0) }[name]();
  PRIM[name] = g; return g;
}
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _e4 = new THREE.Euler(), _s4 = new THREE.Vector3(), _p4 = new THREE.Vector3();
/* piece: primitive placed at (x,y,z), rotated (rx,ry,rz), scaled (sx,sy,sz), with a colour token and material slot */
const pc = (g, x, y, z, sx, sy, sz, col, o = {}) => ({ g, m: _m4.compose(_p4.set(x, y, z), _q4.setFromEuler(_e4.set(o.rx || 0, o.ry || 0, o.rz || 0)), _s4.set(sx, sy, sz)).clone(), col, mat: o.mat || 0, jaw: !!o.jaw });
function partPieces(id) {
  switch (id) {
    case 'm_graze': return [pc('sph', 0, .18, 0, .3, .26, .34, 'detail'), pc('sph', .1, .34, 0, .16, .08, .26, 'dark'), pc('sph', -.08, .3, 0, .14, .07, .22, 'detail', { jaw: true })];
    case 'm_beak': return [pc('cone', .06, .38, 0, .2, .6, .18, 'bone', { rz: -.25, mat: 1 }), pc('cone', -.1, .26, 0, .13, .38, .13, 'bone', { rz: .15, mat: 1, jaw: true })];
    case 'm_fang': return [pc('sph', .08, .2, 0, .32, .26, .34, 'base'), ...[-1, 1].map(s => pc('cone', -.06, .38, s * .17, .05, .22, .05, 'bone', { rz: Math.PI, mat: 1 })), pc('sph', -.14, .22, 0, .3, .12, .3, 'dark', { jaw: true }), ...[-1, 0, 1].map(s => pc('cone', -.06, .3, s * .12, .035, .12, .035, 'bone', { mat: 1, jaw: true }))];
    case 'm_mandible': return [-1, 1].flatMap(s => [pc('cone', 0, .34, s * .14, .07, .5, .07, 'bone', { rx: -s * .4, mat: 1, jaw: true }), pc('sph', 0, .08, s * .14, .1, .1, .1, 'dark')]);
    case 'm_trumpet': return [pc('cyl', 0, .4, 0, .12, .8, .12, 'detail', { rz: -.1 }), pc('cone', .05, .86, 0, .26, .3, .26, 'pattern', { rz: Math.PI })];
    case 'm_maw': return [pc('sph', .1, .24, 0, .42, .3, .46, 'base'), pc('sph', -.22, .26, 0, .44, .16, .44, 'dark', { jaw: true }), ...[-2, -1, 0, 1, 2].map(s => pc('cone', -.12, .42, s * .14, .05, .16, .05, 'bone', { mat: 1, jaw: true }))];
    case 'e_round': return [pc('sph', 0, .08, 0, .2, .2, .2, 'eye', { mat: 1 }), pc('sph', .06, .22, 0, .1, .1, .1, 'pupil', { mat: 1 }), pc('sph', .07, .06, 0, .22, .14, .22, 'base', { rz: .3 })];
    case 'e_slit': return [pc('sph', 0, .08, 0, .17, .14, .2, 'gold', { mat: 1 }), pc('box', .04, .19, 0, .03, .03, .14, 'pupil', { mat: 1 })];
    case 'e_stalk': return [pc('cyl', 0, .25, 0, .045, .5, .045, 'detail'), pc('sph', 0, .55, 0, .16, .16, .16, 'eye', { mat: 1 }), pc('sph', .08, .63, 0, .08, .08, .08, 'pupil', { mat: 1 })];
    case 'e_bug': return [pc('ico', 0, .06, 0, .24, .18, .24, 'bug', { mat: 1 })];
    case 'd_horn': return [pc('cone', -.05, .32, 0, .1, .66, .1, 'bone', { rz: .35, mat: 1 })];
    case 'd_spike': return [pc('cone', 0, .2, 0, .08, .42, .08, 'bone', { mat: 1 })];
    case 'd_plate': return [pc('box', 0, .07, 0, .5, .14, .5, 'pattern', { rx: 0 }), pc('box', 0, .16, 0, .34, .06, .34, 'detail')];
    case 'd_wing': return [pc('disc', -.25, .5, 0, .55, 1.1, 1, 'pattern', { rz: -.5, rx: Math.PI / 2, mat: 0 }), pc('cyl', -.1, .5, 0, .04, 1, .04, 'detail', { rz: -.35 })];
    case 'd_fin': return [pc('disc', 0, 0, 0, .45, .55, 1, 'pattern', { rz: -Math.PI / 2 })];
    case 'd_frill': return [0, 1, 2, 3, 4].map(k => pc('cone', -.06 + (k - 2) * .02, .3, (k - 2) * .13, .06, .6, .03, k % 2 ? 'pattern' : 'detail', { rx: (k - 2) * .35 }));
    case 'd_crest': return [pc('disc', 0, 0, 0, .4, .46, 1, 'pattern', { rz: -Math.PI / 2 })];
    case 'd_antenna': return [pc('cyl', -.05, .35, 0, .025, .7, .025, 'dark', { rz: .25 }), pc('sph', -.14, .7, 0, .07, .07, .07, 'pattern', { mat: 1 })];
    case 'd_glow': return [pc('cyl', 0, .25, 0, .03, .5, .03, 'dark', { rz: .3 }), pc('sph', -.08, .52, 0, .13, .13, .13, 'glow', { mat: 2 })];
    case 'd_spitter': return [pc('sph', 0, .12, 0, .22, .2, .22, 'sac', { mat: 1 }), pc('cyl', 0, .32, 0, .06, .2, .06, 'detail')];
    case 'd_club': return [pc('sph', 0, .2, 0, .3, .3, .3, 'bone', { mat: 1 }), ...[0, 1, 2, 3, 4, 5].map(k => pc('cone', Math.cos(k) * .25, .2 + Math.sin(k * 2) * .1, Math.sin(k) * .25, .05, .2, .05, 'bone', { rz: -Math.cos(k), rx: Math.sin(k), mat: 1 }))];
    case 'd_shell': return [pc('sph', 0, 0, 0, .6, .32, .55, 'pattern', { mat: 1 }), pc('tor', 0, .05, 0, .5, .45, .5, 'detail', { rx: Math.PI / 2 })];
    // cell parts
    case 'c_filter': return [-3, -2, -1, 0, 1, 2, 3].map(k => pc('cyl', k * .05, .14, 0, .015, .26, .015, 'detail', { rz: -k * .14 }));
    case 'c_jaw': return [-1, 1].map(s => pc('cone', 0, .22, s * .08, .06, .38, .06, 'bone', { rx: -s * .35, mat: 1, jaw: true }));
    case 'c_proboscis': return [pc('cyl', 0, .3, 0, .06, .6, .06, 'detail'), pc('sph', 0, .62, 0, .07, .07, .07, 'dark')];
    case 'c_flagellum': return [pc('sph', 0, .02, 0, .1, .06, .1, 'detail')];
    case 'c_cilia': return [-2, -1, 0, 1, 2].map(k => pc('cyl', k * .07, .08, 0, .012, .16, .012, 'detail', { rz: -k * .2 }));
    case 'c_jet': return [pc('cone', 0, .12, 0, .14, .24, .14, 'detail', { rz: Math.PI }), pc('tor', 0, .02, 0, .12, .12, .12, 'dark', { rx: Math.PI / 2 })];
    case 'c_spike': return [pc('cone', 0, .22, 0, .07, .44, .07, 'bone', { mat: 1 })];
    case 'c_poison': return [pc('sph', 0, .08, 0, .14, .12, .14, 'poison', { mat: 1 })];
    case 'c_electric': return [pc('sph', 0, .06, 0, .14, .1, .14, 'shock', { mat: 2 })];
    case 'c_armor': return [pc('box', 0, .04, 0, .36, .08, .36, 'pattern')];
    case 'c_eye': return [pc('sph', 0, .06, 0, .16, .16, .16, 'eye', { mat: 1 }), pc('sph', .05, .16, 0, .08, .08, .08, 'pupil', { mat: 1 })];
    case 'c_stalk': return [pc('cyl', 0, .18, 0, .03, .36, .03, 'detail'), pc('sph', 0, .38, 0, .12, .12, .12, 'eye', { mat: 1 }), pc('sph', .05, .45, 0, .06, .06, .06, 'pupil', { mat: 1 })];
  }
  return [pc('sph', 0, .1, 0, .15, .15, .15, 'detail')];
}

/* ---------- paint ---------- */
const PATTERNS = ['none', 'stripes', 'spots', 'patches', 'bands', 'fade'];
const defaultPaint = (h = 20) => ({ h1: h, h2: (h + 40) % 360, h3: (h + 180) % 360, l1: .5, pattern: 'stripes' });
function paintColor(tok, paint) {
  const c = new THREE.Color();
  switch (tok) {
    case 'base': return c.setHSL(paint.h1 / 360, .72, paint.l1 ?? .5);
    case 'pattern': return c.setHSL(paint.h2 / 360, .65, .45);
    case 'detail': return c.setHSL(paint.h3 / 360, .55, .62);
    case 'dark': return c.setHSL(paint.h1 / 360, .35, .2);
    case 'bone': return c.set(0xf1e9d8);
    case 'eye': return c.set(0xffffff);
    case 'pupil': return c.set(0x120d1c);
    case 'gold': return c.set(0xf2c14e);
    case 'bug': return c.set(0x3a2e6a);
    case 'glow': return c.set(0x9dfcf0);
    case 'sac': return c.setHSL((paint.h3 + 40) / 360, .7, .6);
    case 'poison': return c.set(0xa86cff);
    case 'shock': return c.set(0xfff27a);
  }
  return c.set(tok);
}
const skinNoise = makeNoise3(777);

/* ---------- geometry assembly ---------- */
class GeoBuilder {
  constructor() { this.P = []; this.N = []; this.C = []; this.SI = []; this.SW = []; this.I = [[], [], []]; }
  get count() { return this.P.length / 3; }
  vert(x, y, z, nx, ny, nz, c, b0, b1, w) { this.P.push(x, y, z); this.N.push(nx, ny, nz); this.C.push(c.r, c.g, c.b); this.SI.push(b0, b1, 0, 0); this.SW.push(1 - w, w, 0, 0); }
  addGeo(g, m, col, mat, b0, b1, w) {
    const base = this.count, pos = g.attributes.position, nor = g.attributes.normal, nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); this.vert(v.x, v.y, v.z, n.x, n.y, n.z, col, b0, b1, w); }
    const flip = m.determinant() < 0, I = this.I[mat];
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) flip ? I.push(base + a[i], base + a[i + 2], base + a[i + 1]) : I.push(base + a[i], base + a[i + 1], base + a[i + 2]); }
    else for (let i = 0; i < pos.count; i += 3) flip ? I.push(base + i, base + i + 2, base + i + 1) : I.push(base + i, base + i + 1, base + i + 2);
  }
  build() {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3)); g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
    const all = []; let off = 0; this.I.forEach((arr, k) => { if (arr.length) { g.addGroup(off, arr.length, k); off += arr.length; all.push(...arr); } });
    g.setIndex(all); g.computeBoundingSphere(); return g;
  }
}
/* skin materials: [skin, glossy parts, unlit eyes]. Rebuilt in place when the graphics tier swaps Lambert and PBR */
const BODY_MATS = [];
function rebuildBodyMats() {
  const want = Q.b.lambert ? 'L' : 'S'; if (BODY_MATS._k === want) return; BODY_MATS._k = want;
  for (const m of BODY_MATS) m.dispose();
  const a = litMat({ vertexColors: true, roughness: .55, metalness: 0 }), b = litMat({ vertexColors: true, roughness: .18, metalness: .05 }), c = new THREE.MeshBasicMaterial({ vertexColors: true });
  skinShader(a, .34); skinShader(b, .25); for (const m of [a, b, c]) m.userData.shared = true; BODY_MATS[0] = a; BODY_MATS[1] = b; BODY_MATS[2] = c; BODY_MATS.length = 3;
}
rebuildBodyMats();

/* ---------- helpers on the spine ---------- */
function spinePoint(sp, s) { const n = sp.length - 1, i = clamp(Math.floor(s), 0, Math.max(0, n - 1)), f = clamp(s - i, 0, 1), a = sp[i], b = sp[Math.min(n, i + 1)]; return new THREE.Vector3(lerp(a.x, b.x, f), lerp(a.y, b.y, f), lerp(a.z, b.z, f)); }
function nearestS(sp, p) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < sp.length - 1; i++) { const a = sp[i], b = sp[i + 1], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l2 = dx * dx + dy * dy + dz * dz || 1e-6; const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / l2, 0, 1); const d = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y, a.z + dz * t - p.z); if (d < bd) { bd = d; best = i + t; } }
  return best;
}
function anchorOf(f, sp, s, dir) {
  const c = spinePoint(sp, s), d = new THREE.Vector3(dir.x, dir.y, dir.z).normalize(); let t0 = 0, t1 = 0;
  const maxR = Math.max(...sp.map(v => v.r)) * 3 + .5; t1 = maxR;
  if (f(c.x, c.y, c.z) > 0) t1 = 0; else for (let k = 0; k < 24; k++) { const t = (t0 + t1) / 2; if (f(c.x + d.x * t, c.y + d.y * t, c.z + d.z * t) < 0) t0 = t; else t1 = t; }
  const p = c.addScaledVector(d, t1), e = .01;
  const n = new THREE.Vector3(f(p.x + e, p.y, p.z) - f(p.x - e, p.y, p.z), f(p.x, p.y + e, p.z) - f(p.x, p.y - e, p.z), f(p.x, p.y, p.z + e) - f(p.x, p.y, p.z - e));
  if (n.lengthSq() < 1e-10) n.copy(d); n.normalize(); return { p, n };
}
function partFrame(p, n, scale, flipX) {
  const X = new THREE.Vector3(1, 0, 0); X.addScaledVector(n, -X.dot(n)); if (X.lengthSq() < .09) { X.set(0, 1, 0).addScaledVector(n, -n.y); } X.normalize();
  const Z = new THREE.Vector3().crossVectors(X, n).normalize();
  const m = new THREE.Matrix4().makeBasis(X, n, Z); m.scale(new THREE.Vector3(scale, scale, scale)); m.setPosition(p); return m;
}
const needsMirror = pl => Math.abs(pl.dz) > .12;
function placements(body) { const out = []; body.parts.forEach((pl, i) => { out.push({ i, pl, dir: { x: pl.dx, y: pl.dy, z: pl.dz }, mirror: false }); if (needsMirror(pl)) out.push({ i, pl, dir: { x: pl.dx, y: pl.dy, z: -pl.dz }, mirror: true }); }); return out; }

/* ---------- abilities ---------- */
function abilities(body) {
  const isCell = body.kind === 'cell', A = {}, names = isCell ? CELL_ABIL : ABIL; for (const k in names) A[k] = 0;
  let diet = null; const diets = new Set();
  for (const pl of body.parts) { const d = PARTS[pl.id]; if (!d) continue; for (const k in d.stats) A[k] = (A[k] || 0) + d.stats[k]; if (d.diet) diets.add(d.diet); }
  if (isCell) { A.speed += body.parts.filter(p => p.id === 'c_flagellum' && needsMirror(p)).length; }
  for (const k in A) A[k] = clamp(A[k], 0, 5);
  diet = diets.has('omni') || (diets.has('herb') && diets.has('carn')) ? 'omni' : diets.has('carn') ? 'carn' : diets.has('herb') ? 'herb' : 'none';
  const legs = body.parts.filter(p => PARTS[p.id] && PARTS[p.id].cat === 'leg').length;
  const vol = body.spine.reduce((a, v) => a + v.r * v.r * v.r, 0);
  return { A, diet, legs, vol, mouths: body.parts.filter(p => PARTS[p.id] && /mouth/.test(PARTS[p.id].cat)).length };
}
function bodyCost(body) { return body.parts.reduce((a, pl) => a + (PARTS[pl.id] ? PARTS[pl.id].cost : 0), 0) + Math.max(0, body.spine.length - (body.kind === 'cell' ? 3 : 5)) * 3; }
const MAX_PARTS = { creature: 22, cell: 14 };

/* ---------- bake ---------- */
function bakeBody(body, opts = {}) {
  const isCell = body.kind === 'cell', paint = body.paint || defaultPaint();
  const sp = body.spine.map(v => ({ x: v.x, y: v.y, z: v.z || 0, r: v.r }));
  // centre the body on its mass
  let cx = 0, cz = 0, tw = 0; for (const v of sp) { const w = v.r * v.r; cx += v.x * w; cz += v.z * w; tw += w; } cx /= tw; cz /= tw;
  if (opts.center === false) { cx = 0; cz = 0; }
  for (const v of sp) { v.x -= cx; if (isCell) v.z -= cz; else cz = 0; }
  let f = makeSDF(sp, isCell);
  // standing height: lift the body so its best legs can reach the ground
  let dy = 0; const limbs = [];
  if (!isCell) {
    const pls = placements(body).filter(q => LIMB_CATS.has(PARTS[q.pl.id]?.cat));
    for (const q of pls) { const d = PARTS[q.pl.id], a = anchorOf(f, sp, q.pl.s, q.dir), L = (q.pl.len || d.len) * (q.pl.scale || 1) * 1.1; limbs.push({ q, d, p: a.p, n: a.n, L, thick: (q.pl.thick || d.thick) * (q.pl.scale || 1), kind: d.cat }); }
    const bottom = Math.min(...sp.map(v => v.y - v.r * 1.02));
    const legs = limbs.filter(l => l.kind === 'leg');
    dy = legs.length ? Math.max(Math.max(...legs.map(l => .82 * l.L - l.p.y)), -bottom) : -bottom + .02;
    for (const v of sp) v.y += dy; for (const l of limbs) l.p.y += dy;
    f = makeSDF(sp, isCell);
    for (const l of limbs) l.reach = l.kind === 'leg' && l.p.y <= l.L * .98;
  }
  // skin surface
  const maxR = Math.max(...sp.map(v => v.r)) * (isCell ? 1.1 : 1.25) + .06, mn = new THREE.Vector3(1e9, 1e9, 1e9), mx = new THREE.Vector3(-1e9, -1e9, -1e9);
  for (const v of sp) { mn.min(new THREE.Vector3(v.x - maxR, v.y - maxR, v.z - maxR)); mx.max(new THREE.Vector3(v.x + maxR, v.y + maxR, v.z + maxR)); }
  const surf = polygonize(f, mn, mx, (opts.res || (isCell ? .045 : .055)) * (opts.exact ? 1 : Q.b.res));
  const gb = new GeoBuilder(), nS = sp.length;
  const base = paintColor('base', paint), pat = paintColor('pattern', paint), det = paintColor('detail', paint), c = new THREE.Color(), tmp = new THREE.Vector3();
  const segLen = []; let acc = 0; for (let i = 0; i < nS; i++) { segLen.push(acc); if (i < nS - 1) acc += Math.hypot(sp[i + 1].x - sp[i].x, sp[i + 1].y - sp[i].y, sp[i + 1].z - sp[i].z); }
  for (let i = 0; i < surf.P.length; i += 3) {
    const x = surf.P[i], y = surf.P[i + 1], z = surf.P[i + 2]; tmp.set(x, y, z); const s = nearestS(sp, tmp), j = Math.min(nS - 2, Math.floor(s)), w = nS > 1 ? s - j : 0, cp = spinePoint(sp, s);
    const ny = surf.N[i + 1], arc = segLen[Math.max(0, j)] + w * (nS > 1 ? segLen[Math.min(nS - 1, j + 1)] - segLen[Math.max(0, j)] : 0);
    c.copy(base); const top = isCell ? 1 : clamp((y - cp.y) / .2 + .5, 0, 1), nz = skinNoise(x * 4, y * 4, z * 4);
    let m = 0;
    switch (paint.pattern) {
      case 'stripes': m = (Math.sin(arc * 11) > .25 ? 1 : 0) * top; break;
      case 'spots': m = skinNoise(x * 5.5 + 9, y * 5.5, z * 5.5) > .62 ? 1 : 0; break;
      case 'patches': m = skinNoise(x * 2.2, y * 2.2 + 4, z * 2.2) > .55 ? 1 : 0; break;
      case 'bands': m = Math.sin(arc * 7) > .55 ? 1 : 0; break;
      case 'fade': m = clamp(top * 1.2 - .1, 0, 1); break;
    }
    c.lerp(pat, m);
    if (!isCell && ny < -.35) c.lerp(det, .65); // belly
    if (isCell) c.lerp(det, clamp(.35 - Math.hypot(x - cp.x, z - cp.z) / (sp[Math.round(s)] ? sp[Math.round(s)].r : .5) * .35, 0, .35));
    c.multiplyScalar(.92 + nz * .16);
    gb.vert(x, y, z, surf.N[i], surf.N[i + 1], surf.N[i + 2], c, Math.max(0, j), Math.min(nS - 1, j + 1), nS > 1 ? w : 0);
  }
  { const I = gb.I[0]; for (let i = 0; i < surf.I.length; i++) I.push(surf.I[i]); }
  // bones: spine, then jaw, then limbs (3 bones each)
  const boneDefs = sp.map((v, i) => ({ kind: 'spine', i, bind: new THREE.Vector3(v.x, v.y, v.z) }));
  let jaw = null; const anchors = [];
  const pls = placements(body);
  for (const q of pls) {
    const d = PARTS[q.pl.id]; if (!d) continue;
    if (LIMB_CATS.has(d.cat)) { const l = limbs.find(l => l.q === q); if (l) anchors.push({ i: q.i, mirror: q.mirror, p: l.p.clone(), n: l.n.clone() }); continue; }
    const a = anchorOf(f, sp, q.pl.s, q.dir); anchors.push({ i: q.i, mirror: q.mirror, p: a.p.clone(), n: a.n.clone() });
    const m = partFrame(a.p, a.n, q.pl.scale || 1), s = clamp(q.pl.s, 0, nS - 1), b0 = Math.min(nS - 1, Math.floor(s)), b1 = Math.min(nS - 1, b0 + 1), w = s - b0;
    let jawIdx = -1; if (/mouth/.test(d.cat) && !jaw) { jaw = { bone: boneDefs.length, bind: a.p.clone(), s }; boneDefs.push({ kind: 'jaw', bind: a.p.clone(), spine: b0 }); }
    if (jaw && /mouth/.test(d.cat) && Math.abs(jaw.s - s) < .01) jawIdx = jaw.bone;
    for (const piece of partPieces(q.pl.id)) { const mm = new THREE.Matrix4().multiplyMatrices(m, piece.m); const col = paintColor(piece.col, paint); if (piece.jaw && jawIdx >= 0) gb.addGeo(prim(piece.g), mm, col, piece.mat, jawIdx, jawIdx, 0); else gb.addGeo(prim(piece.g), mm, col, piece.mat, b0, b1, w); }
  }
  // limbs: tubes in bind pose hanging straight down
  const limbOut = [];
  for (const l of limbs) {
    const L1 = l.L * .5, L2 = l.L * .5, r = .075 * l.thick * (body.spine[0] ? 1 : 1), hip = l.p, b = boneDefs.length, s = clamp(l.q.pl.s, 0, nS - 1);
    boneDefs.push({ kind: 'thigh', bind: hip.clone() }, { kind: 'shin', bind: new THREE.Vector3(hip.x, hip.y - L1, hip.z) }, { kind: 'foot', bind: new THREE.Vector3(hip.x, hip.y - L1 - L2, hip.z) });
    const dark = paintColor('dark', paint), limbCol = paintColor(l.kind === 'arm' ? 'base' : 'base', paint).lerp(dark, .25);
    // thigh, knee blob, shin
    const seg = (y0, y1, r0, r1, bA, bB, wA, wB) => { const g = prim('cylo'), m = new THREE.Matrix4().compose(new THREE.Vector3(hip.x, (y0 + y1) / 2, hip.z), new THREE.Quaternion(), new THREE.Vector3((r0 + r1) / 2, Math.abs(y1 - y0), (r0 + r1) / 2)); const st = gb.count; gb.addGeo(g, m, limbCol, 0, bA, bB, 0); for (let k = st; k < gb.count; k++) { const yy = gb.P[k * 3 + 1], t = clamp((y0 - yy) / Math.abs(y0 - y1), 0, 1); gb.SW[k * 4] = 1 - lerp(wA, wB, t); gb.SW[k * 4 + 1] = lerp(wA, wB, t); } };
    seg(hip.y + r, hip.y - L1 * .8, r * 1.3, r, b, b + 1, 0, 0);
    seg(hip.y - L1 * .8, hip.y - L1 * 1.2, r, r * .9, b, b + 1, .1, .9);
    seg(hip.y - L1 * 1.2, hip.y - L1 - L2, r * .9, r * .7, b + 1, b + 1, 0, 0);
    gb.addGeo(prim('sphl'), new THREE.Matrix4().compose(new THREE.Vector3(hip.x, hip.y, hip.z), new THREE.Quaternion(), new THREE.Vector3(r * 1.5, r * 1.5, r * 1.5)), limbCol, 0, b, b, 0);
    gb.addGeo(prim('sphl'), new THREE.Matrix4().compose(new THREE.Vector3(hip.x, hip.y - L1, hip.z), new THREE.Quaternion(), new THREE.Vector3(r * 1.1, r * 1.1, r * 1.1)), limbCol, 0, b, b + 1, .5);
    const ay = hip.y - L1 - L2, fb = b + 2, fcol = paintColor('dark', paint), bone = paintColor('bone', paint), FX = (g, x, y, z, sx, sy, sz, col, o = {}) => gb.addGeo(prim(g), new THREE.Matrix4().compose(new THREE.Vector3(hip.x + x, ay + y, hip.z + z), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0)), new THREE.Vector3(sx, sy, sz)), col, o.mat || 0, fb, fb, 0);
    const k = l.thick, fs = Math.max(.7, l.L * .7);
    if (l.kind === 'leg') {
      if (l.d.foot === 'hoof') FX('cyl', 0, -.03, 0, .09 * k * fs, .1 * fs, .09 * k * fs, fcol);
      else if (l.d.foot === 'pad') FX('sph', .03, -.03, 0, .2 * k * fs, .09 * fs, .18 * k * fs, fcol);
      else if (l.d.foot === 'talon') { FX('sph', 0, 0, 0, .07 * fs, .06 * fs, .07 * fs, fcol); for (const a of [-.5, 0, .5]) FX('cone', Math.cos(a) * .12 * fs, -.04, Math.sin(a) * .12 * fs, .025 * fs, .16 * fs, .025 * fs, bone, { rz: -Math.PI / 2 - .3, ry: -a, mat: 1 }); }
      else { FX('sph', .05 * fs, -.02, 0, .15 * k * fs, .07 * fs, .12 * k * fs, fcol); for (const a of [-.4, 0, .4]) FX('sph', .15 * fs, -.03, Math.sin(a) * .1 * fs, .04 * fs, .035 * fs, .04 * fs, fcol); }
    } else {
      const hs = Math.max(.7, l.L * .7);
      if (l.d.hand === 'claw') for (const a of [-.35, 0, .35]) FX('cone', .06 * hs, -.1 * hs, Math.sin(a) * .08 * hs, .03 * hs, .2 * hs, .03 * hs, bone, { rz: Math.PI - .5, rx: a, mat: 1 });
      else if (l.d.hand === 'pincer') { FX('sph', 0, -.08 * hs, 0, .09 * hs, .12 * hs, .08 * hs, paintColor('pattern', paint)); for (const s2 of [-1, 1]) FX('cone', .04 * hs, -.24 * hs, s2 * .04 * hs, .045 * hs, .2 * hs, .03 * hs, paintColor('pattern', paint), { rz: Math.PI, rx: s2 * .3 }); }
      else if (l.d.hand === 'frond') for (const a of [-.6, -.2, .2, .6]) FX('cone', 0, -.12 * hs, Math.sin(a) * .1 * hs, .05 * hs, .24 * hs, .015 * hs, paintColor('pattern', paint), { rz: Math.PI, rx: a });
      else { FX('sph', 0, -.04 * hs, 0, .07 * hs, .08 * hs, .06 * hs, limbCol); for (const a of [-.5, 0, .5]) FX('cyl', .02 * hs, -.13 * hs, Math.sin(a) * .05 * hs, .015 * hs, .1 * hs, .015 * hs, limbCol, { rx: a * .5 }); FX('cyl', .06 * hs, -.08 * hs, 0, .015 * hs, .08 * hs, .015 * hs, limbCol, { rz: .9 }); }
    }
    limbOut.push({ kind: l.kind, reach: !!l.reach, bones: [b, b + 1, b + 2], hip: hip.clone(), L1, L2, spineS: s, side: Math.sign(l.q.dir.z) || 0, reverse: !!l.d.reverse, footH: l.kind === 'leg' ? .05 : 0 });
  }
  const geometry = gb.build();
  // picking geometry (skin only)
  const pick = new THREE.BufferGeometry(); pick.setAttribute('position', new THREE.BufferAttribute(surf.P, 3)); pick.setIndex(surf.I); pick.computeBoundingSphere(); pick.computeBoundingBox();
  const ab = abilities(body), len = sp.length > 1 ? Math.hypot(sp[0].x - sp[nS - 1].x, sp[0].y - sp[nS - 1].y, sp[0].z - sp[nS - 1].z) + sp[0].r + sp[nS - 1].r : sp[0].r * 2;
  const height = Math.max(...sp.map(v => v.y + v.r));
  return { body, isCell, off: { cx, cz }, geometry, pick, boneDefs, limbs: limbOut, jaw, dy, sp, anchors, ab, len, height, radius: Math.max(len / 2, height / 2), tris: surf.I.length / 3 };
}

/* ---------- runtime creature ---------- */
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q1b = new THREE.Quaternion(), _q2b = new THREE.Quaternion(), _mb = new THREE.Matrix4(), _UP = new THREE.Vector3(0, 1, 0), _X = new THREE.Vector3(1, 0, 0), _Z = new THREE.Vector3(0, 0, 1), _bm = new THREE.Matrix4(), _eu = new THREE.Euler();
const BLOB = {
  geo() { return sharedGeo('blob', () => { const g = new THREE.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2); return g; }); },
  mat() { if (this.m) return this.m; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.6, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.userData.shared = true; this.m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true }); this.m.userData.shared = true; return this.m; },
};
class Creature {
  constructor(baked, k = 1, opts = {}) {
    this.B = baked; this.k = k; this.group = new THREE.Group();
    this.bones = baked.boneDefs.map(d => { const b = new THREE.Bone(); b.position.copy(d.bind); this.group.add(b); return b; });
    this.group.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(this.bones);
    this.mesh = new THREE.SkinnedMesh(baked.geometry, BODY_MATS); this.mesh.castShadow = opts.shadow !== false && Q.b.shadows > 0; this.mesh.receiveShadow = false;
    /* bones live in world space, so the cull sphere is moved by hand each update instead of being computed from the bind pose */
    this.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), baked.radius * k * 1.6 + 1); this.mesh.frustumCulled = true;
    this.group.add(this.mesh); this.mesh.bind(this.skeleton, new THREE.Matrix4());
    /* soft contact shadow on land: the only shadow on Low, and for anything not casting a real one */
    if (!baked.isCell && opts.blob !== false && !this.mesh.castShadow) { this.blob = new THREE.Mesh(BLOB.geo(), BLOB.mat()); this.blob.renderOrder = 1; this.group.add(this.blob); }
    this.x = 0; this.z = 0; this.a = 0; this.y = 0; this.vx = 0; this.vz = 0; this.speed = 0; this.turn = 0; this.lastA = 0; this.t = rand(0, 9); this.init = false;
    this.st = {}; this.look = 0; this.lift = 0; this.pitch = 0;
    this.feet = baked.limbs.map(l => ({ pos: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), st: 0, grp: 0 }));
    let gi = 0; baked.limbs.forEach((l, i) => { if (l.kind === 'leg' && l.reach) { this.feet[i].grp = (l.side >= 0 ? 1 : 0) ^ (Math.floor(gi / 2) % 2); gi++; } });
    this.legCount = baked.limbs.filter(l => l.kind === 'leg' && l.reach).length;
    this.visible = true;
  }
  setVisible(v) { if (v !== this.visible) { this.visible = v; this.group.visible = v; if (v) this.init = false; } }
  dispose() { if (this.group.parent) this.group.parent.remove(this.group); this.skeleton.dispose(); }
  head() { return this.bones[0].position; }
  /* place at (x,z) facing a; ground(x,z) gives terrain height; lift raises the body (jump, swim, glide) */
  update(dt, x, z, a, ground, lift = 0) {
    if (dt > 0) { this.vx = lerp(this.vx, (x - this.x) / dt, Math.min(1, dt * 8)); this.vz = lerp(this.vz, (z - this.z) / dt, Math.min(1, dt * 8)); this.turn = lerp(this.turn, clamp(angDiff(this.lastA, a) / dt, -6, 6), Math.min(1, dt * 6)); }
    this.x = x; this.z = z; this.a = a; this.lastA = a; this.t += dt; this.lift = lift;
    if (!this.visible) return;
    const bs = this.mesh.boundingSphere; bs.center.set(x, ground(x, z) + lift + this.B.height * this.k * .5, z); bs.radius = this.B.radius * this.k * 1.6 + 1;
    if (this.blob) {
      const g0 = ground(x, z), r = Math.max(.45, this.B.radius * this.k * .95), e = Math.max(.8, r * .7), nx = (ground(x - e, z) - ground(x + e, z)) / (2 * e), nz = (ground(x, z - e) - ground(x, z + e)) / (2 * e);
      _v3.set(nx, 1, nz).normalize(); this.blob.quaternion.setFromUnitVectors(_UP, _v3).multiply(_q2b.setFromAxisAngle(_UP, -a));
      this.blob.position.set(x, g0 + .12, z); this.blob.scale.set(r * 1.25, 1, r); this.blob.visible = lift < 6;
    }
    const B = this.B, k = this.k, st = this.st, t = this.t, sp = B.sp, nS = sp.length, speed = Math.hypot(this.vx, this.vz), sn = clamp(speed / (4 * k), 0, 1.5);
    const half = Math.max(.3, B.len * .45) * k, ca = Math.cos(a), sa = Math.sin(a);
    const gF = ground(x + ca * half, z + sa * half), gB = ground(x - ca * half, z - sa * half), gy = (gF + gB) * .25 + ground(x, z) * .5;
    const pitchT = (B.isCell ? 0 : Math.atan2(gF - gB, half * 2) * (this.legCount ? .8 : 1)) + (st.pose ? .45 : 0) - (st.charge ? .18 : 0);
    this.pitch = lerp(this.pitch, pitchT, dt > 0 ? Math.min(1, dt * 6) : 1);
    const bob = (this.legCount ? Math.abs(Math.sin(t * (6 + speed * 1.2))) * .05 * sn : 0) + (st.dance ? Math.abs(Math.sin(t * 9)) * .18 : 0) + (st.sleep ? -B.dy * .45 : 0) + (st.pose ? .15 : 0);
    const roll = st.dance ? Math.sin(t * 9) * .12 : st.charm ? Math.sin(t * 3) * .15 : 0;
    _bm.compose(_v1.set(x, gy + lift, z), _q1b.setFromEuler(_eu.set(roll, -a, this.pitch, 'YZX')), _v2.set(k, k, k));
    _mb.makeTranslation(0, bob, 0); _bm.multiply(_mb);
    _mb.extractRotation(_bm); _q1b.setFromRotationMatrix(_mb);
    // spine bones: sway, bend into turns, head looks around
    const wig = (this.legCount ? .05 : .22) * sn + (st.dance ? .08 : 0), freq = this.legCount ? 5 : 7, OZ = this._oz || (this._oz = new Float32Array(16));
    for (let i = 0; i < nS; i++) { const v = sp[i], u = nS > 1 ? i / (nS - 1) : 0; OZ[i] = Math.sin(t * freq - i * .9) * wig * (u + .2) + this.turn * .05 * v.x * Math.abs(v.x); }
    for (let i = 0; i < nS; i++) {
      const v = sp[i]; let ox = 0, oy = 0;
      if (i <= 1 && (st.bite > 0 || st.lunge > 0)) ox += .1 * (2 - i);
      if (i === 0 && st.sing) oy += .05;
      _v1.set(v.x + ox, v.y + oy, v.z + OZ[i]).applyMatrix4(_bm); const b = this.bones[i]; b.position.copy(_v1);
      let yaw = i > 0 ? -Math.atan2(OZ[i] - OZ[i - 1], (sp[i - 1].x - v.x) || .3) * .6 : -Math.atan2(OZ[1] - OZ[0], (v.x - sp[1].x) || .3) * .3;
      if (nS === 1) yaw = 0;
      let hp = 0, hr = 0; if (i === 0) { yaw += this.look * .6; hp = (st.sing ? .35 : 0) + (st.eat ? -.45 : 0); hr = st.charm ? Math.sin(t * 4) * .25 : 0; }
      _q2b.setFromEuler(_eu.set(hr, yaw, hp, 'YZX')); b.quaternion.copy(_q1b).multiply(_q2b); b.scale.set(k, k, k);
    }
    if (B.jaw) {
      const jb = this.bones[B.jaw.bone], hb = this.bones[0], hd = B.boneDefs[0].bind;
      _v1.copy(B.jaw.bind).sub(hd).multiplyScalar(k).applyQuaternion(hb.quaternion).add(hb.position); jb.position.copy(_v1);
      const open = st.bite > 0 ? .7 : st.sing ? .25 + .25 * Math.sin(t * 14) : st.eat ? .3 + .3 * Math.sin(t * 10) : .05 + .03 * Math.sin(t * 2);
      jb.quaternion.copy(hb.quaternion).multiply(_q2b.setFromAxisAngle(_Z, -open * .9)); jb.scale.set(k, k, k);
    }
    const fwd = LT.f.set(ca, 0, sa);
    B.limbs.forEach((l, i) => {
      const f = this.feet[i], [b0, b1, b2] = l.bones, sb = Math.min(nS - 1, Math.round(l.spineS)), spb = this.bones[sb], sbind = B.boneDefs[sb].bind;
      const hip = LT.h.copy(l.hip).sub(sbind).multiplyScalar(k).applyQuaternion(spb.quaternion).add(spb.position);
      const L1 = l.L1 * k, L2 = l.L2 * k, side = l.side, tgt = LT.t;
      if (l.kind === 'leg' && l.reach) {
        const rest = LT.r.copy(hip).addScaledVector(fwd, .05 * k); rest.x += -sa * side * L1 * .3; rest.z += ca * side * L1 * .3; rest.y = ground(rest.x, rest.z) + l.footH * k;
        if (!this.init || lift > L1 * .6) { f.pos.copy(rest); if (lift > L1 * .6) f.pos.y = hip.y - (L1 + L2) * .85; f.st = 0; }
        else if (f.st > 0) { f.st += dt / clamp(.1 + L1 * .12, .1, .3); const u = Math.min(1, f.st); f.pos.lerpVectors(f.from, f.to, u); f.pos.y += Math.sin(u * Math.PI) * L1 * .5; if (u >= 1) f.st = 0; }
        else {
          const d = Math.hypot(f.pos.x - rest.x, f.pos.z - rest.z), busy = this.feet.some((o, j) => j !== i && o.st > 0 && o.grp !== f.grp);
          if ((d > L1 * .55 && !busy) || d > L1 * 1.6) { f.st = 1e-4; f.from.copy(f.pos); const lead = Math.min(L1 * .7, speed * .14); f.to.copy(rest); if (speed > .2) { f.to.x += this.vx / speed * lead; f.to.z += this.vz / speed * lead; } f.to.y = ground(f.to.x, f.to.z) + l.footH * k; }
          else f.pos.y = lerp(f.pos.y, ground(f.pos.x, f.pos.z) + l.footH * k, .3);
        }
        tgt.copy(f.pos);
      } else {
        const reach = st.strike > 0 && l.kind === 'arm', swing = Math.sin(t * (4 + speed) + side) * .25 * (L1 + L2) * sn;
        tgt.copy(hip).addScaledVector(fwd, (reach ? .95 : .12) * (L1 + L2) + swing); tgt.y -= (reach ? .1 : .82) * (L1 + L2); tgt.x += -sa * side * (L1 + L2) * .15; tgt.z += ca * side * (L1 + L2) * .15;
        if (st.dance && l.kind === 'arm') tgt.y += (L1 + L2) * (.5 + .4 * Math.sin(t * 9 + side));
        if (l.kind === 'leg') tgt.y = Math.max(tgt.y, ground(tgt.x, tgt.z) + .02);
        f.pos.copy(tgt);
      }
      const D0 = LT.d.copy(tgt).sub(hip), D = clamp(D0.length(), Math.abs(L1 - L2) + 1e-3, (L1 + L2) * .999); if (D0.lengthSq() < 1e-8) D0.set(0, -1, 0); D0.normalize();
      const aa = (L1 * L1 - L2 * L2 + D * D) / (2 * D), h = Math.sqrt(Math.max(0, L1 * L1 - aa * aa));
      const pole = LT.p.set(l.reverse ? -ca : ca, .25, l.reverse ? -sa : sa); pole.x += -sa * side * .4; pole.z += ca * side * .4;
      pole.addScaledVector(D0, -pole.dot(D0)); if (pole.lengthSq() < 1e-6) pole.set(ca, 0, sa); pole.normalize();
      const knee = LT.k.copy(hip).addScaledVector(D0, aa).addScaledVector(pole, h), ankle = LT.a.copy(hip).addScaledVector(D0, D);
      this.setLimbBone(this.bones[b0], hip, knee, fwd, k); this.setLimbBone(this.bones[b1], knee, ankle, fwd, k);
      const fb = this.bones[b2]; fb.position.copy(ankle); if (l.kind === 'arm') fb.quaternion.copy(this.bones[b1].quaternion); else fb.quaternion.setFromAxisAngle(_UP, -a); fb.scale.set(k, k, k);
    });
    this.init = true;
  }
  setLimbBone(bone, from, to, fwd, k) {
    const yv = LT.y.copy(from).sub(to); if (yv.lengthSq() < 1e-10) yv.set(0, 1, 0); yv.normalize();
    const xv = LT.x.copy(fwd).addScaledVector(yv, -fwd.dot(yv)); if (xv.lengthSq() < 1e-6) xv.set(0, 0, 1); xv.normalize();
    const zv = LT.z.crossVectors(xv, yv); _mb.makeBasis(xv, yv, zv); bone.position.copy(from); bone.quaternion.setFromRotationMatrix(_mb); bone.scale.set(k, k, k);
  }
  /* world position of a bind-space point riding on spine bone at param s */
  attach(p, s, out) { const i = clamp(Math.round(s), 0, this.B.sp.length - 1), b = this.bones[i]; return out.copy(p).sub(this.B.boneDefs[i].bind).multiplyScalar(this.k).applyQuaternion(b.quaternion).add(b.position); }
}
const LT = { f: new THREE.Vector3(), h: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), d: new THREE.Vector3(), p: new THREE.Vector3(), k: new THREE.Vector3(), a: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
function pick2(r, a) { return a[Math.floor(r() * a.length)]; }

/* ---------- random bodies for other species ---------- */
function genBody(r, o = {}) {
  const posture = o.posture || (r() < .22 ? 'upright' : r() < .4 ? 'arched' : 'level');
  const n = o.segs || (4 + Math.floor(r() * 4)), spacing = .36 + r() * .16, spine = [];
  const rHead = .26 + r() * .14, rMid = .36 + r() * .3, rTail = .1 + r() * .12;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), x = (n - 1) * spacing / 2 - i * spacing;
    let y = 0; if (posture === 'upright') y = (1 - u) * (1 - u) * 1.1 - .2; else if (posture === 'arched') y = Math.sin(u * Math.PI) * .25 - u * .2; else y = -u * u * .25;
    const rr = u < .25 ? lerp(rHead, rMid, u / .25) : lerp(rMid, rTail, (u - .25) / .75) * (1 + Math.sin(u * 3) * .1);
    spine.push({ x: posture === 'upright' ? x * .75 : x, y, z: 0, r: Math.max(.09, rr) });
  }
  const pal = o.paint || { h1: Math.floor(r() * 36) * 10, h2: 0, h3: 0, l1: .45 + r() * .15, pattern: PATTERNS[Math.floor(r() * PATTERNS.length)] };
  if (!o.paint) { pal.h2 = (pal.h1 + 30 + Math.floor(r() * 30) * 10) % 360; pal.h3 = (pal.h1 + 150 + Math.floor(r() * 6) * 10) % 360; }
  const parts = [], add = (id, s, dx, dy, dz, extra = {}) => parts.push({ id, s, dx, dy, dz, scale: 1, ...extra });
  const diet = o.diet || pick2(r, ['herb', 'carn', 'omni']);
  const mouthId = o.mouth || pick2(r, diet === 'herb' ? ['m_graze', 'm_trumpet'] : diet === 'carn' ? ['m_fang', 'm_mandible'] : ['m_beak', 'm_maw']);
  add(mouthId, 0, 1, -.25, 0, { scale: .9 + r() * .4 });
  const eyeId = pick2(r, ['e_round', 'e_round', 'e_slit', 'e_stalk', 'e_bug']), eyes = r() < .15 ? 1 : 2;
  if (eyes === 1) add(eyeId, .15, .55, .8, 0, { scale: 1.2 }); else add(eyeId, .2, .55, .6, .5, { scale: .8 + r() * .5 });
  if (r() < .2) add('e_round', .35, .2, .8, .55, { scale: .6 });
  // legs
  const legIds = ['l_walker', 'l_strider', 'l_stomper', 'l_hopper', 'l_talon'];
  const legId = o.leg || pick2(r, legIds), pairs = posture === 'upright' ? 1 : (o.legPairs || 1 + Math.floor(r() * 3));
  const lenScale = .8 + r() * .7;
  for (let k = 0; k < pairs; k++) { const s = posture === 'upright' ? (n - 1) * .62 : pairs === 1 ? (n - 1) * .5 : lerp(.8, (n - 1) * .8, k / (pairs - 1)); add(legId, s, 0, -.8, .55, { len: PARTS[legId].len * lenScale, scale: 1 }); }
  if (posture === 'upright' || r() < .25) add(pick2(r, ['a_grasp', 'a_claw', 'a_pincer', 'a_frond']), Math.min(n - 1, 1.1), .1, -.2, .9, { scale: .9 });
  // details
  const det = ['d_horn', 'd_spike', 'd_plate', 'd_wing', 'd_fin', 'd_frill', 'd_crest', 'd_antenna', 'd_glow', 'd_spitter', 'd_club', 'd_shell'];
  const nd = o.details ?? Math.floor(r() * 4);
  for (let k = 0; k < nd; k++) {
    const id = pick2(r, det);
    if (id === 'd_horn') add(id, .1, .3, 1, r() < .5 ? .35 : 0, { scale: .8 + r() * .6 });
    else if (id === 'd_spike') for (let s = 1; s < n - 1; s++) add(id, s, 0, 1, 0, { scale: .7 + r() * .3 });
    else if (id === 'd_plate') add(id, Math.floor(n / 2), 0, 1, .2, { scale: 1 });
    else if (id === 'd_wing') add(id, 1.2, 0, .5, .85, { scale: 1 + r() * .4 });
    else if (id === 'd_fin') add(id, Math.floor(n / 2), 0, 1, 0, { scale: 1 + r() * .5 });
    else if (id === 'd_frill') add(id, .8, -.2, .3, .9, { scale: .9 });
    else if (id === 'd_crest') add(id, .1, -.2, 1, 0, { scale: .9 + r() * .4 });
    else if (id === 'd_antenna') add(id, 0, .4, 1, .4, { scale: 1 });
    else if (id === 'd_glow') add(id, .2, .2, 1, 0, { scale: 1 });
    else if (id === 'd_spitter') add(id, .5, .2, -.4, .8, { scale: .9 });
    else if (id === 'd_club') add(id, n - 1, -1, .2, 0, { scale: 1 });
    else if (id === 'd_shell') add(id, (n - 1) / 2, 0, 1, 0, { scale: 1.2 + r() * .3 });
  }
  return { kind: 'creature', spine, parts, paint: pal };
}
function starterCreature(P) {
  const diet = P.diet || 'omni', mouth = diet === 'herb' ? 'm_graze' : diet === 'carn' ? 'm_fang' : 'm_beak';
  const pc0 = P.cell && P.cell.paint ? { ...P.cell.paint } : defaultPaint(P.hue);
  return { kind: 'creature', spine: [{ x: .9, y: .05, z: 0, r: .3 }, { x: .45, y: 0, z: 0, r: .38 }, { x: 0, y: 0, z: 0, r: .42 }, { x: -.45, y: -.02, z: 0, r: .36 }, { x: -.9, y: -.08, z: 0, r: .24 }],
    parts: [{ id: mouth, s: 0, dx: 1, dy: -.25, dz: 0, scale: 1 }, { id: 'e_round', s: .2, dx: .55, dy: .6, dz: .5, scale: 1 }, { id: 'l_walker', s: 2.2, dx: 0, dy: -.8, dz: .55, scale: 1 }], paint: pc0 };
}
function starterCell(P) {
  return { kind: 'cell', spine: [{ x: .45, y: 0, z: 0, r: .5 }, { x: 0, y: 0, z: 0, r: .62 }, { x: -.45, y: 0, z: 0, r: .45 }],
    parts: [{ id: 'c_filter', s: 0, dx: 1, dy: 0, dz: 0, scale: 1 }, { id: 'c_flagellum', s: 2, dx: -1, dy: 0, dz: 0, scale: 1 }, { id: 'c_eye', s: .5, dx: .3, dy: .9, dz: .3, scale: 1 }], paint: defaultPaint(P.hue) };
}
function genCell(r, kind) {
  const h = kind === 'hunter' ? 345 + Math.floor(r() * 3) * 10 : kind === 'grazer' ? 140 + Math.floor(r() * 6) * 10 : kind === 'schooler' ? 40 + Math.floor(r() * 3) * 10 : 260 + Math.floor(r() * 4) * 10;
  const n = 2 + Math.floor(r() * 3), sp = []; for (let i = 0; i < n; i++) sp.push({ x: (n - 1) * .22 - i * .44, y: 0, z: 0, r: .38 + r() * .3 });
  const parts = [{ id: kind === 'hunter' ? 'c_jaw' : kind === 'drifter' ? 'c_proboscis' : 'c_filter', s: 0, dx: 1, dy: 0, dz: 0, scale: 1 }, { id: 'c_eye', s: .3, dx: .4, dy: .8, dz: .35, scale: 1 }];
  if (kind !== 'drifter') parts.push({ id: 'c_flagellum', s: n - 1, dx: -1, dy: 0, dz: r() < .5 ? 0 : .4, scale: 1 });
  if (kind === 'drifter' || r() < .3) for (let k = 0; k < (kind === 'drifter' ? 3 : 1); k++) parts.push({ id: 'c_spike', s: r() * (n - 1), dx: r() - .5, dy: 0, dz: .9, scale: 1 });
  if (kind === 'schooler') parts.push({ id: 'c_cilia', s: (n - 1) / 2, dx: 0, dy: 0, dz: 1, scale: 1 });
  return { kind: 'cell', spine: sp, parts, paint: { h1: h, h2: (h + 30) % 360, h3: (h + 60) % 360, l1: .55, pattern: pick2(r, ['none', 'spots', 'none', 'patches']) } };
}
