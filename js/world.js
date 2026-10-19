/* Lineage | world. Intellectual property of Sidedoor Digital. */
'use strict';
/* ============================== ALIEN WORLDS: TERRAIN, PLANTS, SKY, DAY/NIGHT ============================== */
const WORLD_PALETTES = [
  { name: 'Verdant', grassA: [.24, .5, .3], grassB: [.52, .58, .26], sand: [.84, .76, .54], rock: [.48, .45, .5], water: 0x2f8fb6, skyTop: 0x4f9ee0, skyBot: 0xdcedf3, fog: 0xc0dae6, trees: [120, 150, 95], trunk: 0x6a4a34 },
  { name: 'Dusk', grassA: [.36, .44, .3], grassB: [.6, .56, .36], sand: [.86, .78, .62], rock: [.42, .36, .44], water: 0x2f8f9e, skyTop: 0x6f63b4, skyBot: 0xf4cba8, fog: 0xe2c8c2, trees: [320, 285, 35], trunk: 0x3a2a3a },
  { name: 'Savanna', grassA: [.58, .5, .26], grassB: [.78, .66, .34], sand: [.9, .82, .6], rock: [.52, .42, .36], water: 0x2a78c6, skyTop: 0x4a86d8, skyBot: 0xf2e6cc, fog: 0xe6dcc4, trees: [95, 28, 170], trunk: 0x5a3a2a },
  { name: 'Bluemoss', grassA: [.2, .46, .44], grassB: [.38, .6, .5], sand: [.88, .84, .7], rock: [.44, .46, .52], water: 0x2a64a8, skyTop: 0x5a78c8, skyBot: 0xe0e4f2, fog: 0xc8d4e8, trees: [205, 330, 48], trunk: 0x2a3a3a },
];
function worldPalette(seed) { return WORLD_PALETTES[seed % WORLD_PALETTES.length]; }
function buildTerrain(scene, seed, opts = {}) {
  const size = opts.size || 800, seg = Q.n(opts.seg || 180, 'terrain', 48), B = size / 2, water = opts.water ?? 0, flat = opts.flat || [], pal = opts.palette || worldPalette(seed);
  const N = makeNoise(seed), N2 = makeNoise(seed + 9), N3 = makeNoise(seed + 21);
  const h0 = (x, z) => {
    let y = (fbm(N, x / 170 + 3, z / 170, 5) - .46) * 60 + (Math.abs(fbm(N2, x / 70, z / 70, 3) - .5) * 2 - .5) * 6;
    for (const f of flat) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r * 1.6) y = lerp(f.h, y, smooth(clamp((d - f.r) / (f.r * .6), 0, 1))); }
    const e = Math.max(Math.abs(x), Math.abs(z)); if (e > B * .76) y += smooth(clamp((e - B * .76) / (B * .24), 0, 1)) * 70;
    return y;
  };
  const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  const G1 = seg + 1, cell = size / seg, HG = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { HG[i] = h0(pos.getX(i), pos.getZ(i)); pos.setY(i, HG[i]); }
  /* heights come from the mesh itself, so feet, props and units sit exactly on what is drawn, whatever the detail level */
  const h = (x, z) => {
    let fx = (x + B) / cell, fz = (z + B) / cell; fx = fx < 0 ? 0 : fx > seg - 1e-4 ? seg - 1e-4 : fx; fz = fz < 0 ? 0 : fz > seg - 1e-4 ? seg - 1e-4 : fz;
    const ix = fx | 0, iz = fz | 0, u = fx - ix, v = fz - iz, a = HG[iz * G1 + ix], b = HG[(iz + 1) * G1 + ix], c = HG[(iz + 1) * G1 + ix + 1], d = HG[iz * G1 + ix + 1];
    return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
  };
  geo.computeVertexNormals(); const nrm = geo.attributes.normal;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)], snow = [.94, .95, .98];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), slope = 1 - nrm.getY(i), m = fbm(N3, x / 60, z / 60, 3), q = N3(x / 5, z / 5);
    let col = y < water + 1.2 ? pal.sand : mix(pal.grassA, pal.grassB, clamp((m - .38) * 2.5, 0, 1));
    if (slope > .28) col = mix(col, pal.rock, clamp((slope - .28) * 4, 0, 1));
    if (y > 36) col = mix(col, snow, clamp((y - 36) / 10, 0, 1));
    if (y < water) col = mix(col, [.25, .3, .32], clamp((water - y) / 8, 0, .7));
    const k = .9 + q * .2; cols[i * 3] = Math.pow(col[0] * k, 2.2); cols[i * 3 + 1] = Math.pow(col[1] * k, 2.2); cols[i * 3 + 2] = Math.pow(col[2] * k, 2.2);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mesh = new THREE.Mesh(geo, litMat({ vertexColors: true, roughness: .95, metalness: 0 })); mesh.receiveShadow = Q.b.shadows > 0; scene.add(mesh);
  const wmesh = new THREE.Mesh(new THREE.PlaneGeometry(size * 4, size * 4, 1, 1), waterMaterial(pal.water)); wmesh.rotation.x = -Math.PI / 2; wmesh.position.y = water; scene.add(wmesh);
  const r = mulberry32(seed + 3), trees = [];
  const isWater = (x, z) => h(x, z) < water + .2, slopeAt = (x, z) => Math.hypot(h(x + 1, z) - h(x - 1, z), h(x, z + 1) - h(x, z - 1)) / 2;
  const nT = Q.n(opts.trees ?? 380, 'trees', 0);
  for (let k = 0; k < nT * 5 && trees.length < nT; k++) { const x = (r() * 2 - 1) * B * .78, z = (r() * 2 - 1) * B * .78, y = h(x, z); if (y < water + 1.5 || y > 34 || slopeAt(x, z) > .6) continue; if (flat.some(f => Math.hypot(x - f.x, z - f.z) < f.r * 1.1)) continue; if (fbm(N3, x / 90 + 7, z / 90, 2) < .47) continue; trees.push({ x, z, y, s: .9 + r() * 1.1, k: r(), type: Math.floor(r() * 3) }); }
  // three alien tree families, instanced
  const dummy = new THREE.Object3D(), tc = new THREE.Color(), mats = { trunk: litMat({ color: pal.trunk, roughness: .85 }), crown: swayMaterial(litMat({ roughness: .65 }), .06, 1) };
  const fam = [
    { trunk: new THREE.CylinderGeometry(.25, .45, 1, 6), crown: new THREE.SphereGeometry(1, Q.n(12, 'detail', 6), Q.n(9, 'detail', 5)), th: 4, cy: 1.4, cs: [2.3, 2.1, 2.3] },
    { trunk: new THREE.CylinderGeometry(.3, .5, 1, 6), crown: new THREE.SphereGeometry(1, Q.n(14, 'detail', 7), Q.n(8, 'detail', 4), 0, TAU, 0, Math.PI / 2), th: 3.2, cy: -.1, cs: [2.8, 1.4, 2.8] },
    { trunk: new THREE.CylinderGeometry(.15, .35, 1, 6), crown: new THREE.ConeGeometry(1, 1, 7), th: 2, cy: 2.2, cs: [1.6, 5, 1.6] },
  ];
  const parts = fam.map((f, fi) => { const list = trees.map((t, i) => ({ t, i })).filter(o => o.t.type === fi); const tr = new THREE.InstancedMesh(f.trunk, mats.trunk, Math.max(1, list.length)), cr = new THREE.InstancedMesh(f.crown, mats.crown, Math.max(1, list.length)); tr.count = cr.count = list.length; tr.castShadow = cr.castShadow = Q.b.shadows > 0; cr.receiveShadow = Q.b.shadows > 0; scene.add(tr); scene.add(cr); return { f, list, tr, cr, base: [] }; });
  for (const P of parts) P.list.forEach(({ t }, j) => {
    const f = P.f, th = f.th * t.s; dummy.position.set(t.x, t.y + th / 2, t.z); dummy.rotation.set(0, t.k * 6, 0); dummy.scale.set(t.s, th, t.s); dummy.updateMatrix(); P.tr.setMatrixAt(j, dummy.matrix); const m1 = dummy.matrix.clone();
    dummy.position.set(t.x, t.y + th + f.cy * t.s, t.z); dummy.scale.set(f.cs[0] * t.s, f.cs[1] * t.s, f.cs[2] * t.s); dummy.updateMatrix(); P.cr.setMatrixAt(j, dummy.matrix);
    const hh = pal.trees[Math.floor(t.k * pal.trees.length) % pal.trees.length]; tc.setHSL(((hh + t.k * 30) % 360) / 360, .5, .38 + t.k * .14); P.cr.setColorAt(j, tc); P.base.push([m1, dummy.matrix.clone()]); t.r = 1.4 * t.s; t.P = P; t.j = j;
  });
  // grass tufts and flowers
  const tuftGeo = new THREE.IcosahedronGeometry(.35, 0), NTUFT = Q.n(1400, 'tufts', 0), tufts = new THREE.InstancedMesh(tuftGeo, litMat({ roughness: .9 }), Math.max(1, NTUFT)); let nt = 0;
  for (let k = 0; k < 5000 && nt < NTUFT; k++) { const x = (r() * 2 - 1) * B * .75, z = (r() * 2 - 1) * B * .75, y = h(x, z); if (y < water + 1 || slopeAt(x, z) > .5) continue; dummy.position.set(x, y + .1, z); dummy.rotation.set(r() * .3, r() * 6, r() * .3); const s = .7 + r() * 1.3; dummy.scale.set(s, s * .6, s); dummy.updateMatrix(); tufts.setMatrixAt(nt, dummy.matrix); const c = mix(pal.grassA, pal.grassB, r()); tc.setRGB(c[0] * 1.15, c[1] * 1.15, c[2] * 1.15, THREE.SRGBColorSpace); if (r() < .12) tc.setHSL(pal.trees[2] / 360, .7, .65); tufts.setColorAt(nt, tc); nt++; }
  tufts.count = nt; scene.add(tufts);
  const rocks = []; for (let k = 0; k < (opts.rocks ?? 140); k++) { const x = (r() * 2 - 1) * B * .8, z = (r() * 2 - 1) * B * .8, y = h(x, z); if (y < water - 2) continue; rocks.push({ x, z, y, s: .5 + r() * 2.2, rot: r() * 6 }); }
  const rockM = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), litMat({ color: new THREE.Color().setRGB(...pal.rock), roughness: .9, flatShading: true }), Math.max(1, rocks.length));
  rocks.forEach((q, i) => { dummy.position.set(q.x, q.y + q.s * .3, q.z); dummy.rotation.set(q.rot, q.rot * 2, 0); dummy.scale.set(q.s, q.s * .7, q.s * 1.1); dummy.updateMatrix(); rockM.setMatrixAt(i, dummy.matrix); });
  rockM.count = rocks.length; rockM.castShadow = Q.tier === 'high'; rockM.receiveShadow = Q.b.shadows > 0; scene.add(rockM);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0); let hidden = [];
  /* hide trees standing between a camera and its player */
  const clearView = (cam, tx, ty, tz) => {
    for (const t of hidden) { t.P.tr.setMatrixAt(t.j, t.P.base[t.j][0]); t.P.cr.setMatrixAt(t.j, t.P.base[t.j][1]); t.P.dirty = true; }
    const cx = cam.position.x, cz = cam.position.z, dx = tx - cx, dz = tz - cz, L2 = dx * dx + dz * dz || 1, nh = [];
    for (const t of trees) { const u = ((t.x - cx) * dx + (t.z - cz) * dz) / L2; if (u < .05 || u > 1.02) continue; const px = cx + dx * u - t.x, pz = cz + dz * u - t.z; if (px * px + pz * pz < (2.8 * t.s) ** 2) nh.push(t); }
    for (const t of nh) { t.P.tr.setMatrixAt(t.j, zero); t.P.cr.setMatrixAt(t.j, zero); t.P.dirty = true; }
    for (const P of parts) if (P.dirty) { P.tr.instanceMatrix.needsUpdate = true; P.cr.instanceMatrix.needsUpdate = true; P.dirty = false; }
    hidden = nh;
  };
  return { mesh, h, B, water, isWater, trees, rocks, wmesh, slopeAt, clearView, pal, ground: (x, z) => Math.max(h(x, z), water - 1.4) };
}
function makeSky(scene, top, bottom, radius = 3000) {
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = smoothstep(-0.15, 0.55, vP.y); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }' });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), mat); m.renderOrder = -10; m.frustumCulled = false; scene.add(m); return m;
}
class DayNight {
  constructor(scene, sky, sun, hemi, len, pal) {
    this.scene = scene; this.sky = sky; this.sun = sun; this.hemi = hemi; this.len = len; this.t = len * .28;
    const n = Q.n(1500, 'sky', 400), p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rand(0, TAU), b = rand(.05, 1), R = 2500; p[i * 3] = Math.cos(a) * Math.sqrt(1 - b * b) * R; p[i * 3 + 1] = b * R; p[i * 3 + 2] = Math.sin(a) * Math.sqrt(1 - b * b) * R; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 5, transparent: true, opacity: 0, depthWrite: false, fog: false })); this.stars.frustumCulled = false; scene.add(this.stars);
    this.dayTop = new THREE.Color(pal.skyTop); this.dayBot = new THREE.Color(pal.skyBot); this.nightTop = new THREE.Color(0x0b1030); this.nightBot = new THREE.Color(0x283058); this.duskBot = new THREE.Color(0xf0a070);
    this.fogDay = new THREE.Color(pal.fog); this.fogNight = new THREE.Color(0x1c2448);
  }
  get phase() { return (this.t % this.len) / this.len; }
  get isNight() { const p = this.phase; return p > .58 && p < .94; }
  get light() { return clamp(Math.sin(this.phase * TAU) * 1.6 + .35, 0, 1); }
  update(dt, cx = 0, cz = 0) {
    this.t += dt; const ph = this.phase, k = this.light, dusk = clamp(1 - Math.abs(Math.sin(ph * TAU)) * 3, 0, 1) * (ph < .6 ? 1 : 0), ang = ph * TAU;
    this.sun.position.set(cx + Math.cos(ang) * 260, Math.max(60, Math.sin(ang) * 300), cz + 140); this.sun.target.position.set(cx, 0, cz); this.sun.target.updateMatrixWorld();
    this.sun.intensity = 2.4 * k + .25; this.sun.color.setHSL(.09, .5 * (1 - k) + .15, .75 + k * .15); this.hemi.intensity = .55 + k * .8;
    const top = this.sky.material.uniforms.top.value, bot = this.sky.material.uniforms.bottom.value;
    top.copy(this.nightTop).lerp(this.dayTop, k); bot.copy(this.nightBot).lerp(this.dayBot, k).lerp(this.duskBot, dusk * .5);
    if (this.scene.fog) this.scene.fog.color.copy(this.fogNight).lerp(this.fogDay, k).lerp(this.duskBot, dusk * .25);
    this.stars.material.opacity = clamp(1 - k * 1.6, 0, 1); this.stars.position.set(cx, 0, cz);
  }
}

function waterMaterial(color) {
  const m = litMat({ color, transparent: true, opacity: .82, roughness: .06, metalness: .35 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = WORLD_TIME;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uTime;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 wp = vWP.xz; float t = uTime;
        vec3 wn = vec3(sin(wp.x * .35 + t * 1.4) * .5 + sin(wp.x * .9 - wp.y * .6 + t * 2.1) * .3 + sin(wp.y * 1.7 + t * 2.7) * .15, 4.0, cos(wp.y * .31 - t * 1.2) * .5 + cos(wp.x * .7 + wp.y * .8 + t * 1.8) * .3);
        normal = normalize((viewMatrix * vec4(normalize(wn), 0.0)).xyz);`);
  };
  return m;
}
/* living-world extras shared by the land stages: swaying grass around each player, clouds, a sun, pollen and fireflies */
class WorldFX {
  constructor(scene, T, pal, sun, day) {
    this.scene = scene; this.T = T; this.sun = sun; this.day = day; const c = new THREE.Color();
    // grass blades
    const g = new THREE.BufferGeometry(), P = [], I = [], H = [0, .35, .7, 1], Wd = [.07, .055, .03, 0];
    for (let i = 0; i < 4; i++) { P.push(-Wd[i], H[i], 0, Wd[i], H[i], 0); if (i < 3) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
    const gm = swayMaterial(litMat({ side: THREE.DoubleSide, roughness: .8 }), .32, 0, 9);
    this.patches = []; this.N = Q.n(2400, 'grass', 0); this.S = 56;
    for (let k = 0; k < 2; k++) {
      const m = new THREE.InstancedMesh(g, gm, Math.max(1, this.N)); m.count = this.N; m.frustumCulled = false; m.receiveShadow = Q.b.shadows > 0; scene.add(m);
      const seeds = []; for (let i = 0; i < this.N; i++) { seeds.push({ ox: Math.random() * this.S, oz: Math.random() * this.S, h: .6 + Math.random() * 1.1, r: Math.random() * 6 }); const gc = Math.random(), base = pal.grassB; c.setRGB(lerp(pal.grassA[0], base[0], gc) * 1.25, lerp(pal.grassA[1], base[1], gc) * 1.25, lerp(pal.grassA[2], base[2], gc) * 1.25, THREE.SRGBColorSpace); if (Math.random() < .05) c.setHSL(pal.trees[2] / 360, .75, .68); m.setColorAt(i, c); }
      this.patches.push({ m, seeds, cx: 1e9, cz: 1e9 });
    }
    // clouds
    const cg = new THREE.SphereGeometry(1, Q.n(10, 'detail', 6), Q.n(7, 'detail', 4)), cm = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x606878, fog: false, transparent: true, opacity: .92 });
    this.clouds = new THREE.InstancedMesh(cg, cm, 140); this.clouds.frustumCulled = false; const dm = new THREE.Object3D(); let ci = 0;
    for (let k = 0; k < 20; k++) { const cx = rand(-900, 900), cz = rand(-900, 900), cy = rand(170, 230); for (let j = 0; j < 7; j++) { dm.position.set(cx + rand(-40, 40), cy + rand(-6, 8), cz + rand(-25, 25)); const s = rand(18, 34); dm.scale.set(s * 1.4, s * .55, s); dm.updateMatrix(); this.clouds.setMatrixAt(ci++, dm.matrix); } }
    scene.add(this.clouds);
    // sun glow
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xfff0c8, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); this.sunSprite.scale.setScalar(420); scene.add(this.sunSprite);
    // pollen by day, fireflies by night
    this.motes = []; for (let k = 0; k < 2; k++) { const n = Q.n(260, 'particles', 40), pos = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) pos[i] = Math.random() * 40 - 20; const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const pm = new THREE.PointsMaterial({ size: .22, map: dotTexture(), color: 0xffffff, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending }); const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; scene.add(pts); this.motes.push({ pts, seeds: Array.from({ length: n }, () => ({ x: Math.random() * 40, y: Math.random() * 6, z: Math.random() * 40, ph: Math.random() * 9 })) }); }
  }
  update(dt, players) {
    WORLD_TIME.value += dt; const dm = new THREE.Object3D(), T = this.T, S = this.S, night = this.day && this.day.isNight;
    this.clouds.position.x += dt * 2.5; if (this.clouds.position.x > 300) this.clouds.position.x -= 600;
    players.forEach((p, k) => {
      const pa = this.patches[k]; if (!pa) return; pa.m.visible = true;
      if (Math.hypot(p.x - pa.cx, p.z - pa.cz) > 2.5) {
        pa.cx = p.x; pa.cz = p.z;
        pa.seeds.forEach((s, i) => { const x = s.ox + S * Math.round((p.x - s.ox) / S), z = s.oz + S * Math.round((p.z - s.oz) / S), y = T.h(x, z); const ok = y > T.water + .7 && y < 34 && T.slopeAt(x, z) < .7; dm.position.set(x, y - .05, z); dm.rotation.set(0, s.r, 0); dm.scale.set(ok ? 1 : 0, ok ? s.h : 0, ok ? 1 : 0); dm.updateMatrix(); pa.m.setMatrixAt(i, dm.matrix); });
        pa.m.instanceMatrix.needsUpdate = true;
      }
      const mo = this.motes[k]; if (!mo) return; const pos = mo.pts.geometry.attributes.position, t = WORLD_TIME.value;
      mo.seeds.forEach((s, i) => { s.x += Math.sin(t * .3 + s.ph) * dt * .6; s.z += Math.cos(t * .27 + s.ph) * dt * .6; const x = p.x - 20 + ((s.x - p.x + 20) % 40 + 40) % 40, z = p.z - 20 + ((s.z - p.z + 20) % 40 + 40) % 40; pos.setXYZ(i, x, T.ground(x, z) + .5 + s.y * (night ? .5 : 1) + Math.sin(t + s.ph) * .3, z); });
      pos.needsUpdate = true; mo.pts.material.color.set(night ? 0xd8ff7a : 0xfff6e0); mo.pts.material.size = night ? .32 : .14; mo.pts.material.opacity = night ? .95 : .45;
    });
    for (let k = players.length; k < 2; k++) { this.patches[k].m.visible = false; this.motes[k].pts.visible = false; }
  }
  beforeRender(cam) { const d = this.sun.position.clone().sub(this.sun.target.position).normalize(); this.sunSprite.position.copy(cam.position).addScaledVector(d, 2200); this.sunSprite.material.opacity = this.day ? clamp(this.day.light * 1.2, 0, 1) : 1; }
}

/* ============================== WONDERS: LANDMARKS WORTH THE WALK ==============================
   Big, simple, low-poly set pieces that read as a silhouette from across the map. Each one carries a
   golden beacon until every player has found it. Cheap: a handful of meshes with shared materials. */
const WONDER_KINDS = {
  arch: { name: 'The Weathered Arch', icon: '◠', lore: 'Wind has worn a hole clean through the hill.' },
  spire: { name: 'Crystal Spires', icon: '◆', lore: 'Glassy columns hum when the wind passes through them.' },
  ribs: { name: "The Giant's Ribs", icon: '☽', lore: 'Bones of something enormous, older than any living species.' },
  skytree: { name: 'The Elder Tree', icon: '♣', lore: 'One tree, older than the forest around it, heavy with fruit.' },
  floaters: { name: 'The Drifting Stones', icon: '◈', lore: 'Boulders hang in the air over a scar in the ground.' },
  springs: { name: 'Steam Springs', icon: '≋', lore: 'Warm pools bubble out of the rock. Wounds close quickly here.' },
  stones: { name: 'The Standing Ring', icon: '⊙', lore: 'Stones set in a circle by no hand you know of.' },
  shrooms: { name: 'Lantern Grove', icon: '♠', lore: 'Mushrooms the size of huts glow softly in the dusk.' },
};
function beaconMesh(h = 140, color = 0xffd56a) {
  const m = new THREE.Mesh(sharedGeo('beacon', () => new THREE.CylinderGeometry(.9, 2.6, 1, 8, 1, true)), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }));
  m.scale.set(1, h, 1); m.position.y = h / 2; m.renderOrder = 2; return m;
}
function makeLandmark(kind, pal, r = Math.random) {
  const g = new THREE.Group(), rockC = new THREE.Color().setRGB(...pal.rock).multiplyScalar(1.1).getHex(), rock = stdMat(rockC, { flatShading: true, roughness: .9 });
  const add = (geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = Q.tier === 'high'; g.add(m); return m; };
  const D = Q.b.detail, seg = n => Math.max(4, Math.round(n * D)), anim = [];
  if (kind === 'arch') {
    add(new THREE.TorusGeometry(14, 4.2, seg(7), seg(14), Math.PI), rock, 0, 0, 0, 1, 1.35, 1);
    for (const s of [-1, 1]) add(sharedGeo('dodec', () => new THREE.DodecahedronGeometry(1, 0)), rock, s * 14, 2, 0, 6, 5, 6, r(), r(), 0);
  } else if (kind === 'spire') {
    const cm = stdMat(col3(pal.trees[2], .55, .62).getHex(), { flatShading: true, emissive: col3(pal.trees[2], .7, .22).getHex(), roughness: .2, metalness: .1 });
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + r(), d = i ? 4 + r() * 6 : 0, h = i ? 10 + r() * 16 : 34; add(sharedGeo('octa', () => new THREE.OctahedronGeometry(1, 0)), cm, Math.cos(a) * d, h * .45, Math.sin(a) * d, 2.2 + r() * 1.5, h * .55, 2.2 + r() * 1.5, (r() - .5) * .4, r() * 3, (r() - .5) * .4); }
  } else if (kind === 'ribs') {
    const bone = stdMat(0xeee2c6, { roughness: .6 });
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) add(new THREE.TorusGeometry(11 - Math.abs(i - 2.5) * 1.3, .9, seg(5), seg(10), Math.PI * .55), bone, (i - 2.5) * 5, 0, 0, 1, 1.4, 1, 0, s > 0 ? 0 : Math.PI, Math.PI * .22);
    add(sharedGeo('dodec', () => new THREE.DodecahedronGeometry(1, 0)), bone, 19, 4, 0, 6, 4.5, 5, .2, .3, 0);
    add(new THREE.CylinderGeometry(1.2, .8, 34, seg(6)), bone, 0, 9, 0, 1, 1, 1, 0, 0, Math.PI / 2);
  } else if (kind === 'skytree') {
    const bark = stdMat(pal.trunk, { roughness: .9, flatShading: true }), leaf = stdMat(col3(pal.trees[0], .45, .34).getHex(), { flatShading: true, roughness: .8 });
    add(new THREE.CylinderGeometry(2.6, 5, 34, seg(8)), bark, 0, 17, 0, 1, 1, 1);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + r(), d = 8 + r() * 6; add(sharedGeo('icoT', () => new THREE.IcosahedronGeometry(1, 1)), leaf, Math.cos(a) * d, 33 + r() * 8, Math.sin(a) * d, 11 + r() * 5, 6 + r() * 3, 11 + r() * 5, 0, r() * 3, 0); }
    add(sharedGeo('icoT', () => new THREE.IcosahedronGeometry(1, 1)), leaf, 0, 42, 0, 14, 8, 14);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; add(new THREE.CylinderGeometry(.6, 1.6, 12, seg(5)), bark, Math.cos(a) * 5, 2, Math.sin(a) * 5, 1, 1, 1, Math.sin(a) * .9, 0, -Math.cos(a) * .9); }
  } else if (kind === 'floaters') {
    add(new THREE.CylinderGeometry(14, 16, 2, seg(10)), stdMat(0x2a2430, { flatShading: true }), 0, -.6, 0, 1, 1, 1);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + r(), d = i ? 6 + r() * 6 : 0, m = add(sharedGeo('dodec', () => new THREE.DodecahedronGeometry(1, 0)), rock, Math.cos(a) * d, 12 + r() * 16, Math.sin(a) * d, 3 + r() * 4, 2.5 + r() * 3, 3 + r() * 4, r() * 3, r() * 3, 0); anim.push({ m, y: m.position.y, ph: r() * 9 }); }
  } else if (kind === 'springs') {
    const water = litMat({ color: 0x8fe8e0, emissive: 0x1f6a66, roughness: .1, transparent: true, opacity: .85 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + r(), d = i ? 9 : 0; add(new THREE.CylinderGeometry(1, 1, .4, seg(14)), water, Math.cos(a) * d, .3, Math.sin(a) * d, 5 + r() * 2, 1, 5 + r() * 2); add(new THREE.TorusGeometry(1, .18, 4, seg(14)), rock, Math.cos(a) * d, .4, Math.sin(a) * d, 5.4, 5.4, 4, Math.PI / 2, 0, 0); }
    const steam = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .16, depthWrite: false });
    for (let i = 0; i < 5; i++) { const m = add(sharedGeo('sphS', () => new THREE.SphereGeometry(1, 8, 6)), steam, (r() - .5) * 14, 6 + i * 4, (r() - .5) * 14, 4 + i, 3 + i * .5, 4 + i); anim.push({ m, y: m.position.y, ph: r() * 9, steam: true }); }
  } else if (kind === 'stones') {
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; add(G_BOX(), rock, Math.cos(a) * 13, 6, Math.sin(a) * 13, 3, 12 + r() * 4, 2, 0, -a, (r() - .5) * .15); }
    add(G_BOX(), rock, 0, 2, 0, 7, 1.6, 4.5);
  } else {
    const cap = stdMat(col3(pal.trees[1], .65, .55).getHex(), { emissive: col3(pal.trees[1], .8, .28).getHex(), flatShading: true }), stem = stdMat(0xe8dcc8, { roughness: .8 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + r(), d = i ? 7 + r() * 6 : 0, h = i ? 8 + r() * 10 : 22; add(new THREE.CylinderGeometry(.9, 1.4, h, seg(7)), stem, Math.cos(a) * d, h / 2, Math.sin(a) * d, 1, 1, 1); add(new THREE.SphereGeometry(1, seg(12), seg(6), 0, TAU, 0, Math.PI / 2), cap, Math.cos(a) * d, h, Math.sin(a) * d, h * .45, h * .3, h * .45); }
  }
  const beacon = beaconMesh(); g.add(beacon);
  return { g, beacon, spin: anim.length ? dt => { const t = WORLD_TIME.value; for (const o of anim) { o.m.position.y = o.y + Math.sin(t * .8 + o.ph) * (o.steam ? 2.5 : 1.4); if (o.steam) o.m.material.opacity = .1 + .06 * Math.sin(t + o.ph); else o.m.rotation.y += dt * .15; } } : null };
}
/* pick n wonder sites around a ring, away from each other and from listed points; returns {x,z,kind} */
function wonderSites(r, n, kinds, minD, maxD, avoid = []) {
  const out = [], pool = kinds.slice().sort(() => r() - .5), base = r() * TAU;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 40; k++) {
      const a = base + i * TAU / n + (r() - .5) * .5, d = minD + r() * (maxD - minD), x = Math.cos(a) * d, z = Math.sin(a) * d;
      if ([...avoid, ...out].some(o => Math.hypot(o.x - x, o.z - z) < (o.r || 30) + 30)) continue;
      out.push({ x, z, kind: pool[i % pool.length], r: 26 }); break;
    }
  }
  return out;
}
