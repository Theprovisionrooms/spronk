/* Lineage | stage-cell. Intellectual property of Sidedoor Digital. */
'use strict';
/* ============================== STAGE 1: CELL ============================== */
const CELL_GOAL = 180, CELL_MAX = 320; /* growth stops at CELL_MAX so a cell that keeps exploring after its goal stays playable */
const FLAG_SEGS = 7;
const CellStage = {
  idx: 0,
  enter() {
    G.stage = 0; saveGame();
    const sc = this.scene = new THREE.Scene(); sc.background = new THREE.Color(0x07243f); sc.fog = new THREE.FogExp2(0x0a2e50, .011);
    sc.add(new THREE.HemisphereLight(0xaee8ff, 0x0b1a2e, 1.6)); const dl = new THREE.DirectionalLight(0xd8f4ff, 1.6); dl.position.set(40, 120, 30); sc.add(dl);
    this.R = 230; this.t = 0; const seed = G.seed + 1;
    // deep water layers: floor, kelp, vents, drifting giants far below (parallax depth)
    const N = makeNoise(seed), fg = new THREE.PlaneGeometry(900, 900, Q.n(90, 'terrain', 40), Q.n(90, 'terrain', 40)); fg.rotateX(-Math.PI / 2);
    const fp = fg.attributes.position, fc = new Float32Array(fp.count * 3);
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), z = fp.getZ(i), n = fbm(N, x / 60, z / 60, 4); fp.setY(i, -34 + (n - .5) * 16); const k = .7 + n * .5; fc[i * 3] = .14 * k; fc[i * 3 + 1] = .3 * k; fc[i * 3 + 2] = .36 * k; }
    fg.computeVertexNormals(); fg.setAttribute('color', new THREE.BufferAttribute(fc, 3)); sc.add(new THREE.Mesh(fg, litMat({ vertexColors: true, roughness: 1 })));
    this.giants = []; for (let i = 0; i < 9; i++) { const g = new THREE.Mesh(sharedGeo('gs', () => new THREE.SphereGeometry(1, 16, 10)), litMat({ color: col3(rand(150, 300), .4, .35), transparent: true, opacity: .55 })); const s = rand(6, 16); g.scale.set(s, s * .5, s * 1.3); g.position.set(rand(-200, 200), rand(-28, -14), rand(-200, 200)); sc.add(g); this.giants.push({ m: g, a: rand(0, TAU), sp: rand(1, 3) }); }
    this.kelp = []; for (let i = 0; i < Q.n(50, 'detail', 20); i++) { const a = rand(0, TAU), d = rand(20, this.R * 1.4); this.kelp.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, ph: rand(0, 9), h: rand(.8, 1.4) }); }
    this.kelpMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.35, .5, 4, 5), litMat({ color: 0x3f9f6a, roughness: .7, emissive: 0x0b2a14 }), this.kelp.length * 8); sc.add(this.kelpMesh);
    this.vents = []; for (let i = 0; i < 6; i++) { const a = rand(0, TAU), d = rand(50, this.R * .85), v = { x: Math.cos(a) * d, z: Math.sin(a) * d, r: 6 }; this.vents.push(v);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(5, 26, 7, 1, true), litMat({ color: 0x2a2226, roughness: .9, flatShading: true })); cone.position.set(v.x, -18, v.z); sc.add(cone);
      const glow = new THREE.Mesh(sharedGeo('gs', () => new THREE.SphereGeometry(1, 16, 10)), new THREE.MeshBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: .5 })); glow.scale.set(v.r, 1.2, v.r); glow.position.set(v.x, -2.5, v.z); sc.add(glow); }
    this.currents = []; for (let i = 0; i < 4; i++) { const a = rand(0, TAU), d = rand(50, this.R * .8); this.currents.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 30, dx: Math.cos(a + 1.6), dz: Math.sin(a + 1.6) }); }
    const shaftMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: .05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < Q.n(12, 'particles', 4); i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(3, 14, 100, 12, 1, true), shaftMat); m.position.set(rand(-230, 230), 10, rand(-230, 230)); m.rotation.z = rand(-.25, .25); sc.add(m); }
    const n = Q.n(2600, 'particles', 600), spp = new Float32Array(n * 3); for (let i = 0; i < n; i++) { spp[i * 3] = rand(-300, 300); spp[i * 3 + 1] = rand(-28, 8); spp[i * 3 + 2] = rand(-300, 300); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(spp, 3)); this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfe6ff, size: .5, map: dotTexture(), transparent: true, opacity: .55, depthWrite: false })); sc.add(this.snow);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(this.R, .5, 6, 120), new THREE.MeshBasicMaterial({ color: 0x5ce1e6, transparent: true, opacity: .25 })); rim.rotation.x = Math.PI / 2; sc.add(rim);
    // food, pods, toxin
    this.plantMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), litMat({ color: 0x8fe06a, emissive: 0x1f4a12, roughness: .5, flatShading: true }), 360); sc.add(this.plantMesh);
    this.meatMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), litMat({ color: 0xff6a4a, emissive: 0x401008, roughness: .4 }), 200); sc.add(this.meatMesh);
    this.podMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), litMat({ color: 0xffd34d, emissive: 0xb8860b, emissiveIntensity: .9, metalness: .4, roughness: .3 }), 12); sc.add(this.podMesh);
    this.cloudMesh = new THREE.InstancedMesh(sharedGeo('gs', () => new THREE.SphereGeometry(1, 16, 10)), new THREE.MeshBasicMaterial({ color: 0xb48cff, transparent: true, opacity: .22, depthWrite: false }), 160); sc.add(this.cloudMesh);
    this.flagMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), litMat({ roughness: .5 }), 900); this.flagMesh.frustumCulled = false; sc.add(this.flagMesh);
    this.food = []; this.pods = []; this.cells = []; this.clouds = [];
    for (let i = 0; i < 260; i++) this.spawnPlant(null);
    for (let i = 0; i < 6; i++) this.spawnPod();
    this.fx = new FX3(sc, .9);
    // a handful of NPC templates, baked once
    const r = mulberry32(seed + 5); this.templates = {};
    for (const kind of ['grazer', 'hunter', 'schooler', 'drifter']) this.templates[kind] = [0, 1].map(() => { const body = genCell(r, kind); return { body, B: bakeBody(body, { res: .07 }) }; });
    const bossBody = genCell(r, 'hunter'); bossBody.parts.push({ id: 'c_spike', s: 0, dx: .3, dy: 0, dz: .9, scale: 1.4 }, { id: 'c_spike', s: 1, dx: 0, dy: 0, dz: 1, scale: 1.4 }, { id: 'c_eye', s: .5, dx: .2, dy: .9, dz: .6, scale: 1.4 }); this.templates.boss = [{ body: bossBody, B: bakeBody(bossBody, { res: .07 }) }];
    const mk = (kind, hue, extra) => { const body = genCell(r, kind); body.paint.h1 = hue; body.paint.h2 = (hue + 25) % 360; extra(body); return { body, B: bakeBody(body, { res: .07 }) }; };
    this.templates.swarmer = [mk('hunter', 20, b => { b.spine = b.spine.slice(0, 2); })];
    this.templates.stinger = [mk('hunter', 300, b => { b.parts.push({ id: 'c_spike', s: 0, dx: 1, dy: 0, dz: 0, scale: 1.5 }, { id: 'c_flagellum', s: b.spine.length - 1, dx: -1, dy: 0, dz: .4, scale: 1 }); })];
    this.templates.splitter = [mk('grazer', 190, b => { b.spine.push({ x: b.spine[b.spine.length - 1].x - .44, y: 0, z: 0, r: .5 }); b.paint.pattern = 'spots'; })];
    this.buildCuriosities(mulberry32(seed + 77)); this.bloomT = 70; this.bloom = null; this.hitstop = 0;
    this.pl = [];
    for (let p = 0; p < G.mode; p++) {
      const P = G.players[p]; if (!P.cell || P.cell.kind !== 'cell') P.cell = starterCell(P);
      const q = { p, x: G.mode === 2 ? (p ? 25 : -25) : 0, z: 0, vx: 0, vz: 0, a: -Math.PI / 2, mass: 4, k: 1, hp: 1, maxhp: 1, dead: 0, biteCd: 0, dashCd: 0, dash: 0, zapCd: 0, hurtT: 9, dna: 20 + (P.dna || 0), plant: 0, meat: 0, kills: 0, deaths: 0, cloudT: 0, inv: 2, shake: 0, lungeCd: 0 };
      this.pl.push(q); this.rebuild(q); this.recalc(q); q.hp = q.maxhp;
      Panes[p].build({ eyebrow: 'Stage 1 · Cell', title: P.name, meters: [{ id: 'hp', label: 'Health', color: 'var(--membrane)' }, { id: 'gr', label: 'Growth', color: 'var(--chloro)' }], stats: [{ id: 'dna', label: 'DNA' }, { id: 'diet', label: 'Diet' }, { id: 'won', label: 'Curiosities' }, { id: 'size', label: 'Size' }] });
      toastP(p, `Eat and grow. ${KEYLABEL[p].a1} dash, ${KEYLABEL[p].a3} lunge bite, ${KEYLABEL[p].menu} cell editor, ${KEYLABEL[p].back} cell menu. Glowing shapes in the deep are curiosities worth swimming to.`);
    }
    this.boss = null; this.bossT = 100;
  },
  rebuild(q) {
    const P = G.players[q.p]; if (q.cr) q.cr.dispose(); if (q.B) q.B.geometry.dispose();
    q.B = bakeBody(P.cell); q.cr = new Creature(q.B, q.k, { shadow: false }); this.scene.add(q.cr.group); q.ab = abilities(P.cell);
    q.flags = q.B.anchors.filter(a => P.cell.parts[a.i] && P.cell.parts[a.i].id === 'c_flagellum').map(a => ({ p: a.p, n: a.n, s: P.cell.parts[a.i].s, ph: rand(0, 6) }));
    if (!q.tag) { q.tag = new THREE.Mesh(sharedGeo('ring', () => new THREE.RingGeometry(1.15, 1.3, 32)), new THREE.MeshBasicMaterial({ color: col3(P.hue, .8, .6), transparent: true, opacity: .8, side: THREE.DoubleSide })); q.tag.rotation.x = -Math.PI / 2; this.scene.add(q.tag); }
  },
  recalc(q) {
    q.mass = Math.min(q.mass, CELL_MAX); const A = q.ab.A, P = G.players[q.p];
    q.k = .8 + Math.sqrt(q.mass) * .16; q.r = q.B.radius * q.k * .9;
    q.speed = (7 + A.speed * 2.6 + A.turn * .6) * (.9 + q.k * .1);
    const old = q.maxhp; q.maxhp = (30 + A.armor * 18 + q.k * 14 + q.B.ab.vol * 20) * P.mods.hp; if (old > 1) q.hp = Math.min(q.maxhp, q.hp + Math.max(0, q.maxhp - old));
    const d = q.ab.diet; q.bite = d === 'carn' ? 12 + q.k * 6 : d === 'omni' ? 7 + q.k * 3 : 0;
    q.cr.k = q.k;
  },
  canEat(q, type) { const d = q.ab.diet; return type === 'plant' ? d === 'herb' || d === 'omni' : d === 'carn' || d === 'omni'; },
  spawnPlant(near) {
    let x, z; if (near) { const a = rand(0, TAU), d = rand(40, 110); x = near.x + Math.cos(a) * d; z = near.z + Math.sin(a) * d; } else { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * this.R; x = Math.cos(a) * d; z = Math.sin(a) * d; }
    if (Math.hypot(x, z) > this.R) return; const s = rand(.7, 1.3) * (near ? Math.max(1, near.k * .9) : 1);
    this.food.push({ x, z, y: rand(-1, 1), r: .4 * s, type: 'plant', val: 1.05 * s, w: rand(0, TAU), life: 1e9 });
  },
  spawnPod() { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * this.R * .95; this.pods.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, w: rand(0, 9) }); },
  spawnCell(near, kind) {
    const view = 24 + near.k * 9, a = rand(0, TAU), d = rand(view, view + 45), x = near.x + Math.cos(a) * d, z = near.z + Math.sin(a) * d; if (Math.hypot(x, z) > this.R - 5) return;
    const roll = Math.random(); kind = kind || (roll < .34 ? 'grazer' : roll < .56 ? 'hunter' : roll < .68 ? 'schooler' : roll < .76 ? 'drifter' : roll < .85 ? 'swarmer' : roll < .93 ? 'stinger' : 'splitter');
    const cnt = kind === 'schooler' ? 5 : kind === 'swarmer' ? 6 : 1, T = pick(this.templates[kind]);
    for (let k = 0; k < cnt; k++) {
      let kk = kind === 'grazer' ? near.k * rand(.45, 1.1) : kind === 'hunter' ? near.k * rand(.6, 1.5) : kind === 'schooler' ? near.k * rand(.35, .5) : kind === 'boss' ? near.k * 2.8 : kind === 'swarmer' ? near.k * rand(.3, .42) : kind === 'stinger' ? near.k * rand(.8, 1.1) : kind === 'splitter' ? near.k * rand(1.3, 1.8) : near.k * rand(1.2, 2);
      kk = Math.max(.35, kk); const cr = new Creature(T.B, kk, { shadow: false }); this.scene.add(cr.group);
      const ab = abilities(T.body), hp = (kind === 'boss' ? 60 : 20) * kk * (1 + T.B.ab.vol);
      const n = { x: x + rand(-3, 3), z: z + rand(-3, 3), vx: 0, vz: 0, a: rand(0, TAU), wa: rand(0, TAU), k: kk, r: T.B.radius * kk * .9, hp, maxhp: hp, kind, ab, B: T.B, cr, sp: (kind === 'drifter' ? 3 : kind === 'hunter' ? 6.5 : kind === 'schooler' ? 8.5 : kind === 'boss' ? 7 : kind === 'swarmer' ? 9 : kind === 'stinger' ? 8 : kind === 'splitter' ? 3.5 : 6.5) + ab.A.speed * 1.5, cd: 0, flash: 0, t: rand(0, 9), tired: 0, chase: 0, spikes: ab.A.spike,
        flags: T.B.anchors.filter(a => T.body.parts[a.i].id === 'c_flagellum').map(a => ({ p: a.p, n: a.n, s: T.body.parts[a.i].s, ph: rand(0, 6) })) };
      n.gen = 0; this.cells.push(n); if (kind === 'boss') return n;
    }
  },
  nearestPlayer(n) { let best = null, bd = 1e9; for (const q of this.pl) { if (q.dead) continue; const d = Math.hypot(q.x - n.x, q.z - n.z); if (d < bd) { bd = d; best = q; } } return [best, bd]; },
  threatens(q, n) { return q.bite > 0 && q.k > n.k * .8; },
  onAction(p, act) {
    const q = this.pl[p]; if (!q || q.dead) return; const A = q.ab.A;
    if (act === 'menu') this.openEditor(p);
    else if (act === 'a1') { if (q.dashCd > 0) return; q.dash = .35 + A.dash * .08; q.dashCd = Math.max(1, 3 - A.dash * .5 - A.speed * .2); Sfx.tone(300, .15, 'sine', .03, 2, Sfx.pan(p)); this.fx.burst(q.x, 0, q.z, '#bfe8ff', 8, 6, .4); }
    else if (act === 'a2' && A.shock && q.zapCd <= 0) this.zap(q);
    else if (act === 'a3') this.lunge(q);
    else if (act === 'a4' && G.mode === 2 && G.accord) { const o = this.pl[other(p)]; if (q.dna >= 10 && o && !o.dead) { q.dna -= 10; o.dna += 10; toastP(o.p, `P${p + 1} sent you 10 DNA.`, 'good'); this.fx.text(q.x, 2, q.z, '-10 DNA', '#ffd34d', p); } }
    else if (act === 'back') Menus[p].open({ eyebrow: 'Your cell', title: G.players[p].name, live: true, sub: () => `${q.dna} DNA · growth ${Math.min(100, Math.floor(q.mass / CELL_GOAL * 100))}% · ${Disc.count(p)} of ${Disc.list.length} curiosities found`, items: () => [...evolveItems(p), { head: true, label: 'Cell' }, { label: 'Open the cell editor', desc: 'Spend DNA on new parts. The game pauses while you edit.', onSelect: () => { Menus[p].close(); this.openEditor(p); } }, ...accordItem(p), { label: 'Close', close: true, onSelect: () => {} }] });
  },
  openEditor(p) {
    const q = this.pl[p];
    Editor.open(p, 'cell', { dna: q.dna, onDone: (saved, wallet) => { q.dna = wallet; if (saved) { this.rebuild(q); this.recalc(q); toastP(p, 'Your cell has evolved.', 'good'); } } });
  },
  lunge(q) {
    if (q.lungeCd > 0) return;
    q.lungeCd = .9; let best = null, bs = 1e9;
    for (const o of [...this.cells, ...this.pl.filter(o => o !== q && !o.dead && canHarm())]) { const d = Math.hypot(o.x - q.x, o.z - q.z); if (d > q.r + o.r + 9) continue; const da = Math.abs(angDiff(q.a, Math.atan2(o.z - q.z, o.x - q.x))); if (da > 1.1) continue; const sc = d + da * 6; if (sc < bs) { bs = sc; best = o; } }
    if (best) q.a = Math.atan2(best.z - q.z, best.x - q.x);
    const v = q.speed * 2.6; q.vx = Math.cos(q.a) * v; q.vz = Math.sin(q.a) * v; q.lungeT = .22; q.lungeHit = false; q.cr.st.bite = .35; Sfx.tone(240, .1, 'square', .025, 1.8, Sfx.pan(q.p));
  },
  knock(o, fx, fz, f) { const m = 1 / Math.max(.4, o.k); o.vx = (o.vx || 0) + fx * f * m; o.vz = (o.vz || 0) + fz * f * m; },
  zap(q) {
    q.zapCd = 5; Sfx.tone(900, .25, 'sawtooth', .03, .3, Sfx.pan(q.p)); const R = q.r * 4 + 4, dmg = 28 * G.players[q.p].mods.dmg * q.ab.A.shock;
    this.fx.burst(q.x, 0, q.z, '#fff27a', 30, 14, .5);
    for (const n of this.cells) if (Math.hypot(n.x - q.x, n.z - q.z) < R + n.r) { n.hp -= dmg; n.flash = .2; n.stun = 1.5; n.lastHit = q.p; }
    for (const o of this.pl) if (o !== q && !o.dead && canHarm() && Math.hypot(o.x - q.x, o.z - q.z) < R + o.r) { this.hurtPlayer(o, dmg * .6, `P${q.p + 1} shocked you!`); o.stun = 1; }
  },
  hurtPlayer(q, dmg, msg) { if (q.dead || q.inv > 0) return; q.shake = Math.min(.6, (q.shake || 0) + .3); q.hp -= dmg * (1 - q.ab.A.armor * .12); q.hurtT = 0; Sfx.hurt(q.p); this.fx.text(q.x, 2, q.z, '-' + Math.round(dmg), '#ff4d6d', q.p); if (msg) toastP(q.p, msg, 'bad'); },
  update(dt0) {
    let dt = dt0; if (this.hitstop > 0) { this.hitstop -= dt0; dt = dt0 * .15; }
    this.t += dt; this.updateBloom(dt); Disc.update(dt, p => { const q = this.pl[p]; return q && !q.dead ? q : null; });
    for (const q of this.pl) safely(() => this.updatePlayer(q, dt), () => this.respawn(q));
    this.food = this.food.filter(f => f.life > 0 && this.pl.some(q => Math.hypot(f.x - q.x, f.z - q.z) < 300));
    for (const q of this.pl) { let near = 0; for (const f of this.food) if (f.type === 'plant' && Math.abs(f.x - q.x) < 110 && Math.abs(f.z - q.z) < 110) near++; for (let i = near; i < 120 / G.mode + 30; i++) this.spawnPlant(q); }
    while (this.pods.length < 6) this.spawnPod();
    this.cells = this.cells.filter(n => { const keep = n.hp > 0 && this.pl.some(q => Math.hypot(n.x - q.x, n.z - q.z) < 24 + q.k * 9 + 200); if (!keep) { if (n.hp <= 0 && !n.dead) this.killNpc(n); n.cr.dispose(); if (n === this.boss) this.boss = null; } return keep; });
    for (const q of this.pl) { const mine = this.cells.filter(n => Math.hypot(n.x - q.x, n.z - q.z) < 24 + q.k * 9 + 100).length; if (mine < 22 / G.mode + 8) this.spawnCell(q); }
    const big = this.pl.reduce((a, q) => q.mass > a.mass ? q : a, this.pl[0]);
    if (!this.boss && big.mass > 50 && !big.dead) { this.bossT -= dt; if (this.bossT <= 0) { this.boss = this.spawnCell(big, 'boss'); this.bossT = 160; if (this.boss) toastAll('A leviathan cell is hunting nearby. Avoid it, or bring it down for a big DNA reward.', 'warn'); } }
    for (const n of this.cells) safely(() => this.updateNpc(n, dt), () => { n.hp = 0; });
    for (const n of this.cells) if (n.hp <= 0 && !n.dead) this.killNpc(n);
    if (this._split) { for (const s2 of this._split) this.cells.push(s2); this._split = null; }
    for (const cl of this.clouds) { cl.life -= dt; cl.r += dt * .6; } this.clouds = this.clouds.filter(c => c.life > 0);
    this.fx.update(dt); this.drawPools(dt); this.drawFlagella();
    if (Math.random() < dt * 8) { const v = pick(this.vents); this.fx.burst(v.x + rand(-3, 3), -1, v.z + rand(-3, 3), '#ffb070', 2, 3, 1.2, -4); }
    const dm = new THREE.Object3D(); let ki = 0;
    for (const k of this.kelp) { let x = k.x, y = -34, z = k.z; for (let s = 0; s < 8; s++) { const sw = Math.sin(this.t * .8 + k.ph + s * .45) * .14 * s; const nx = x + Math.cos(k.ph) * sw, nz = z + Math.sin(k.ph) * sw; dm.position.set((x + nx) / 2, y + 2 * k.h, (z + nz) / 2); dm.rotation.set(Math.sin(k.ph) * sw * .3, 0, Math.cos(k.ph) * sw * .3); dm.scale.set(1 - s * .09, k.h, 1 - s * .09); dm.updateMatrix(); this.kelpMesh.setMatrixAt(ki++, dm.matrix); x = nx; z = nz; y += 4 * k.h; } }
    this.kelpMesh.instanceMatrix.needsUpdate = true;
    for (const g of this.giants) { g.a += dt * .05; g.m.position.x += Math.cos(g.a) * g.sp * dt; g.m.position.z += Math.sin(g.a) * g.sp * dt; g.m.rotation.y = -g.a; if (Math.hypot(g.m.position.x, g.m.position.z) > 260) g.a += Math.PI; }
  },
  updatePlayer(q, dt) {
    const P = G.players[q.p], A = q.ab.A, pane = Panes[q.p];
    if (q.dead > 0) { q.dead -= dt; pane.wait(true, 'Eaten!', `A descendant divides again in ${Math.ceil(q.dead)}…`); if (q.dead <= 0) this.respawn(q); this.hud(q); return; }
    q.biteCd -= dt; q.dashCd -= dt; q.zapCd -= dt; q.lungeCd -= dt; q.shake = Math.max(0, (q.shake || 0) - dt * 2); q.lungeT = (q.lungeT || 0) - dt; q.hurtT += dt; q.dash -= dt; q.stun = (q.stun || 0) - dt; q.inv -= dt;
    const dir = Menus[q.p].isOpen || q.stun > 0 ? { x: 0, z: 0, m: 0 } : dirOf(q.p);
    const spd = q.speed * (q.dash > 0 ? 2.4 : q.lungeT > 0 ? 2.6 : 1), acc = q.speed * (4.5 + A.turn * 1.2);
    q.vx += dir.x * dir.m * acc * dt; q.vz += dir.z * dir.m * acc * dt;
    const s = Math.hypot(q.vx, q.vz); if (s > spd) { q.vx *= spd / s; q.vz *= spd / s; }
    const fr = q.lungeT > 0 ? .3 : !dir.m ? 1.8 + A.turn : 1.6; q.vx *= 1 - Math.min(1, dt * fr); q.vz *= 1 - Math.min(1, dt * fr);
    for (const cu of this.currents) if (Math.hypot(q.x - cu.x, q.z - cu.z) < cu.r) { q.vx += cu.dx * 6 * dt; q.vz += cu.dz * 6 * dt; }
    q.x += q.vx * dt; q.z += q.vz * dt;
    if (s > .5) q.a = lerpAng(q.a, Math.atan2(q.vz, q.vx), dt * (5 + A.turn * 2));
    const dc = Math.hypot(q.x, q.z); if (dc > this.R) { q.x *= this.R / dc; q.z *= this.R / dc; }
    if (q.hurtT > 3) q.hp = Math.min(q.maxhp, q.hp + q.maxhp * .05 * dt);
    if (G.accord) for (const o of this.pl) if (o !== q && !o.dead && Math.hypot(o.x - q.x, o.z - q.z) < 18) q.hp = Math.min(q.maxhp, q.hp + q.maxhp * .05 * dt);
    for (const v of this.vents) if (Math.hypot(q.x - v.x, q.z - v.z) < v.r + q.r * .4) { q.hp -= 8 * dt; q.hurtT = 0; }
    if (A.poison) { q.cloudT -= dt; if (q.cloudT <= 0 && s > 2) { q.cloudT = .22; this.clouds.push({ x: q.x - Math.cos(q.a) * q.r, z: q.z - Math.sin(q.a) * q.r, r: q.r * .7, life: 2.5, owner: q.p }); } }
    for (const f of this.food) {
      if (f.life <= 0) continue; const d = Math.hypot(f.x - q.x, f.z - q.z), ok = this.canEat(q, f.type);
      if (ok && d < q.r + f.r) {
        const y = q.ab.diet === 'omni' ? .8 : 1, gain = f.val * y * (f.type === 'plant' ? P.mods.econ : 1);
        q.mass += gain; f.life = -1; q.dna += f.type === 'meat' ? 2 : 1; if (f.type === 'plant') q.plant += gain; else q.meat += gain;
        q.hp = Math.min(q.maxhp, q.hp + 2); q.cr.st.bite = .25; Sfx.eat(q.p); this.fx.burst(f.x, 0, f.z, f.type === 'plant' ? '#a6d96a' : '#ff7a59', 4, 3, .4); this.recalc(q);
      } else if (ok && d < q.r * 3.5) { f.x += (q.x - f.x) / d * 3.5 * dt; f.z += (q.z - f.z) / d * 3.5 * dt; }
    }
    if (q.lungeT > 0 && !q.lungeHit) {
      for (const n of this.cells) { if (n.hp <= 0 || Math.hypot(n.x - q.x, n.z - q.z) > q.r + n.r + .6) continue; q.lungeHit = true; const dmg = (q.bite || 3) * 1.6 * P.mods.dmg * (this.teamHit(q, n) ? 1.4 : 1); n.hp -= dmg; n.flash = .2; n.lastHit = q.p; n.stun = .5; n.windup = 0; const d = Math.hypot(n.x - q.x, n.z - q.z) || 1; this.knock(n, (n.x - q.x) / d, (n.z - q.z) / d, 14); q.vx *= -.3; q.vz *= -.3; this.hitstop = .06; q.shake = Math.min(.5, q.shake + .2); Sfx.hit(q.p); this.fx.burst(n.x, .5, n.z, '#ffd2c4', 10, 7, .4); this.fx.text(n.x, n.r + 2, n.z, Math.round(dmg), '#ffe2d6', q.p); break; }
      if (!q.lungeHit) for (const o of this.pl) { if (o === q || o.dead || !canHarm() || o.inv > 0 || Math.hypot(o.x - q.x, o.z - q.z) > q.r + o.r + .6) continue; q.lungeHit = true; this.hurtPlayer(o, (q.bite || 3) * 1.3 * P.mods.dmg, `P${q.p + 1} bit you!`); const d = Math.hypot(o.x - q.x, o.z - q.z) || 1; this.knock(o, (o.x - q.x) / d, (o.z - q.z) / d, 12); this.hitstop = .06; if (o.hp <= 0) { q.mass += o.mass * .3; q.dna += 15; this.recalc(q); toastP(q.p, `You ate P${o.p + 1}!`, 'good'); } break; }
    }
    if (this.bloom && Math.hypot(this.bloom.x - q.x, this.bloom.z - q.z) < this.bloom.r) { q.dna += 6 * dt * (G.accord ? 1.3 : 1); q.mass += .6 * dt; this.recalc(q); }
    for (const pd of this.pods) if (Math.hypot(pd.x - q.x, pd.z - q.z) < q.r + 1.2) { pd.taken = true; q.dna += 12; Sfx.good(q.p); this.fx.burst(pd.x, 0, pd.z, '#ffd34d', 18, 8, .7); this.fx.text(pd.x, 2, pd.z, '+12 DNA', '#ffd34d', q.p); }
    this.pods = this.pods.filter(p => !p.taken);
    for (const o of this.pl) {
      if (o === q || o.dead) continue; const d = Math.hypot(o.x - q.x, o.z - q.z), rr = q.r + o.r;
      if (d < rr && d > 0) {
        const push = (rr - d) / d * .5; q.x -= (o.x - q.x) * push; q.z -= (o.z - q.z) * push;
        if (canHarm()) {
          const facing = Math.abs(angDiff(q.a, Math.atan2(o.z - q.z, o.x - q.x))) < 1.3;
          if (q.bite && q.biteCd <= 0 && q.k >= o.k * .7 && facing && o.inv <= 0) { this.hurtPlayer(o, q.bite * P.mods.dmg); q.biteCd = .55; q.cr.st.bite = .3; Sfx.hit(q.p); if (o.hp <= 0) { q.meat += o.mass * .3; q.mass += o.mass * .3; q.dna += 15; this.recalc(q); toastP(q.p, `You ate P${o.p + 1}!`, 'good'); } }
          if (A.spike) o.hp -= A.spike * 5 * P.mods.dmg * dt;
        }
      }
    }
    if (q.hp <= 0) this.die(q);
    if (q.mass >= CELL_GOAL && !Flow.ready[q.p]) {
      const tot = q.plant + q.meat, mf = tot ? q.meat / tot : .5, dt2 = q.ab.diet;
      const style = dt2 === 'carn' ? 'aggr' : dt2 === 'herb' ? 'social' : mf > .7 ? 'aggr' : mf < .3 ? 'social' : 'mixed';
      P.diet = style === 'aggr' ? 'carn' : style === 'social' ? 'herb' : 'omni'; P.dna = Math.min(80, Math.floor(q.dna * .5));
      playerDone(q.p, style, [`Ate ${Math.round(mf * 100)}% meat, killed ${q.kills} cells, died ${q.deaths} times.`, `Diet locked in: ${DIET_WORD[P.diet]}. Time to grow legs.`]);
    }
    if (q.cr.st.bite > 0) q.cr.st.bite -= dt;
    q.cr.update(dt, q.x, q.z, q.a, () => 0, 0); q.tag.position.set(q.x, -.8, q.z); q.tag.scale.setScalar(q.r * 1.1);
    pane.wait(false); this.hud(q);
  },
  die(q) { if (q.dead) return; Menus[q.p].close(); q.dead = 2.5; q.deaths++; this.fx.burst(q.x, 0, q.z, hueCss(G.players[q.p].hue), 24, 10, 1); Sfx.bad(q.p); q.cr.setVisible(false); q.tag.visible = false; },
  respawn(q) {
    q.mass = Math.max(4, q.mass * .75); let x = 0, z = 0; for (let k = 0; k < 20; k++) { const a = rand(0, TAU), d = rand(0, this.R * .6); x = Math.cos(a) * d; z = Math.sin(a) * d; if (!this.cells.some(n => (n.kind === 'hunter' || n.kind === 'boss') && Math.hypot(n.x - x, n.z - z) < 40)) break; }
    q.x = x; q.z = z; q.vx = q.vz = 0; q.dead = 0; q.maxhp = 0; q.inv = 3; this.recalc(q); q.hp = q.maxhp; q.cr.setVisible(true); q.tag.visible = true; Panes[q.p].wait(false);
  },
  updateNpc(n, dt) {
    n.t += dt; n.cd -= dt; n.flash -= dt; n.tired -= dt; n.stun = (n.stun || 0) - dt;
    if (n.windup > 0) { n.windup -= dt; n.vx *= 1 - dt * 6; n.vz *= 1 - dt * 6; const t = n.wTarget; if (t && !t.dead) n.a = lerpAng(n.a, Math.atan2(t.z - n.z, t.x - n.x), dt * 8); n.x += n.vx * dt; n.z += n.vz * dt;
      if (n.windup <= 0) { const v = n.sp * (n.kind === 'stinger' ? 4.2 : 3.4); n.vx = Math.cos(n.a) * v; n.vz = Math.sin(n.a) * v; n.dashT = .4; n.cd = 0; Sfx.tone(140, .12, 'sawtooth', .02, 1.5); }
      n.cr.st.pose = true; n.cr.update(dt, n.x, n.z, n.a, () => 0, 0); n.cr.mesh.visible = Math.floor(n.windup * 16) % 2 === 0; return; }
    n.cr.st.pose = false; n.dashT = (n.dashT || 0) - dt; n.cool2 = (n.cool2 || 0) - dt;
    const [q, d] = this.nearestPlayer(n); let dx = Math.cos(n.wa), dz = Math.sin(n.wa), urg = .55; n.wa += rand(-1.5, 1.5) * dt;
    if (n.stun > 0) urg = 0;
    else if (n.kind === 'swarmer') {
      let flock = 0, cx = 0, cz = 0; for (const o of this.cells) if (o !== n && o.kind === 'swarmer' && Math.abs(o.x - n.x) < 14 && Math.abs(o.z - n.z) < 14) { cx += o.x; cz += o.z; flock++; }
      if (q && d < 30 && q.inv <= 0 && flock >= 2 && n.tired <= 0) { dx = (q.x - n.x) / d; dz = (q.z - n.z) / d; urg = 1; n.chase += dt; if (n.chase > 5) { n.tired = 3; n.chase = 0; } }
      else if (flock) { const vx = cx / flock - n.x, vz = cz / flock - n.z, m = Math.hypot(vx, vz) || 1; dx = dx * .5 + vx / m * .5; dz = dz * .5 + vz / m * .5; }
      if (q && flock < 2 && d < 16 && this.threatens(q, n)) { dx = (n.x - q.x) / d; dz = (n.z - q.z) / d; urg = 1.1; }
    } else if (n.kind === 'stinger') {
      if (q && d < 34 && q.inv <= 0 && n.cool2 <= 0) { dx = (q.x - n.x) / d; dz = (q.z - n.z) / d; urg = .8; if (d < 14 && n.cd <= 0) { n.windup = .5; n.wTarget = q; n.cool2 = 3.5; } }
      else if (q && d < 22 && n.cool2 > 0) { dx = (n.x - q.x) / d; dz = (n.z - q.z) / d; urg = .9; }
    } else if ((n.kind === 'hunter' || n.kind === 'boss') && n.tired <= 0) {
      let tgt = null, td = 26 + n.r * 4;
      if (q && n.k > q.k * 1.05 && d < td && q.inv <= 0) { tgt = q; td = d; }
      for (const o of this.cells) { if (o === n || o.kind === 'boss' || o.k > n.k * .85) continue; const od = Math.hypot(o.x - n.x, o.z - n.z); if (od < td * .8) { tgt = o; td = od; } }
      if (tgt === q && td < 11 + n.r && n.cool2 <= 0 && n.stun <= 0) { n.windup = n.kind === 'boss' ? .7 : .5; n.wTarget = q; n.cool2 = n.kind === 'boss' ? 3 : 4; }
      if (tgt) { dx = (tgt.x - n.x) / (td || 1); dz = (tgt.z - n.z) / (td || 1); urg = 1; n.chase += dt; if (n.chase > (n.kind === 'boss' ? 7 : 4.5)) { n.tired = 3.5; n.chase = 0; } }
    } else if (n.kind === 'grazer' || n.kind === 'schooler') {
      let fled = false;
      if (q && d < 22 + n.r && this.threatens(q, n)) { dx = (n.x - q.x) / d; dz = (n.z - q.z) / d; urg = 1.05; fled = true; }
      for (const o of this.cells) { if (o === n) continue; const od = Math.hypot(o.x - n.x, o.z - n.z); if ((o.kind === 'hunter' || o.kind === 'boss') && o.k > n.k && od < 18) { dx = (n.x - o.x) / od; dz = (n.z - o.z) / od; urg = 1.05; fled = true; break; } }
      if (!fled && n.kind === 'schooler') { let ax = 0, az = 0, cx = 0, cz = 0, k = 0; for (const o of this.cells) { if (o === n || o.kind !== 'schooler') continue; const od = Math.hypot(o.x - n.x, o.z - n.z); if (od < 12) { ax += o.vx; az += o.vz; cx += o.x; cz += o.z; k++; } } if (k) { const vx = ax / k + (cx / k - n.x) * .5, vz = az / k + (cz / k - n.z) * .5, m = Math.hypot(vx, vz) || 1; dx = lerp(dx, vx / m, .7); dz = lerp(dz, vz / m, .7); } }
    }
    n.vx += dx * n.sp * 3 * urg * dt; n.vz += dz * n.sp * 3 * urg * dt;
    const ns = Math.hypot(n.vx, n.vz), mx = n.sp * Math.max(.3, urg) * (n.dashT > 0 ? 4 : 1); if (ns > mx) { n.vx *= mx / ns; n.vz *= mx / ns; }
    n.vx *= 1 - dt * 1.5; n.vz *= 1 - dt * 1.5; n.x += n.vx * dt; n.z += n.vz * dt;
    if (ns > .5) n.a = lerpAng(n.a, Math.atan2(n.vz, n.vx), dt * 5);
    const nd = Math.hypot(n.x, n.z); if (nd > this.R) { n.x *= this.R / nd; n.z *= this.R / nd; n.wa += Math.PI; }
    for (const cl of this.clouds) if (Math.hypot(cl.x - n.x, cl.z - n.z) < cl.r + n.r) { n.hp -= 14 * G.players[cl.owner].mods.dmg * dt; n.flash = .1; n.lastHit = cl.owner; n.tired = Math.max(n.tired, .5); }
    if (n.kind === 'grazer' || n.kind === 'schooler') for (const f of this.food) if (f.type === 'plant' && f.life > 0 && Math.abs(f.x - n.x) < n.r && Math.abs(f.z - n.z) < n.r) { f.life = -1; break; }
    if ((n.kind === 'hunter' || n.kind === 'boss') && n.cd <= 0) for (const o of this.cells) { if (o === n || o.k > n.k * .85) continue; if (Math.hypot(o.x - n.x, o.z - n.z) < n.r + o.r) { o.hp -= 6 + n.k * 5; o.flash = .15; n.cd = .8; n.cr.st.bite = .3; break; } }
    for (const q2 of this.pl) {
      if (q2.dead) continue; const A = q2.ab.A, P = G.players[q2.p], dd = Math.hypot(n.x - q2.x, n.z - q2.z), rr = q2.r + n.r;
      if (dd < rr && dd > 0) {
        const push = (rr - dd) / dd, wp = n.k * n.k / (n.k * n.k + q2.k * q2.k);
        q2.x -= (n.x - q2.x) * push * wp; q2.z -= (n.z - q2.z) * push * wp; n.x += (n.x - q2.x) * push * (1 - wp); n.z += (n.z - q2.z) * push * (1 - wp);
        const facing = Math.abs(angDiff(q2.a, Math.atan2(n.z - q2.z, n.x - q2.x))) < 1.4;
        if (q2.bite && q2.biteCd <= 0 && q2.k >= n.k * .7 && facing) { n.hp -= q2.bite * P.mods.dmg; n.flash = .15; q2.biteCd = .45; q2.cr.st.bite = .3; n.lastHit = q2.p; Sfx.hit(q2.p); this.fx.burst((n.x + q2.x) / 2, .5, (n.z + q2.z) / 2, '#ffd2c4', 6, 6, .35); }
        if (A.spike) { n.hp -= A.spike * 9 * P.mods.dmg * dt; n.flash = .08; n.lastHit = q2.p; }
        if ((n.kind === 'hunter' || n.kind === 'boss' || n.kind === 'stinger') && n.cd <= 0 && (n.k > q2.k * .8 || n.dashT > 0) && n.stun <= 0 && q2.inv <= 0) { const big = n.dashT > 0; this.hurtPlayer(q2, (4 + n.k * 5) * (big ? 1.6 : 1) * (n.kind === 'stinger' ? 1.2 : 1)); n.cd = .9; n.cr.st.bite = .3; this.knock(q2, (q2.x - n.x) / dd, (q2.z - n.z) / dd, big ? 16 : 7); if (big) { n.dashT = 0; n.vx *= -.3; n.vz *= -.3; } }
        if (n.kind === 'swarmer' && n.cd <= 0 && q2.inv <= 0 && n.stun <= 0) { this.hurtPlayer(q2, 1.5 + n.k * 2); n.cd = .6; n.cr.st.bite = .3; }
        if (n.spikes && n.kind !== 'hunter' && q2.inv <= 0) { q2.hp -= n.spikes * 3 * dt; q2.hurtT = 0; }
      }
    }
    if (n.cr.st.bite > 0) n.cr.st.bite -= dt;
    let near = 1e9; for (const p of this.pl) near = Math.min(near, Math.hypot(p.x - n.x, p.z - n.z)); n.cr.setVisible(near < 120);
    n.cr.update(dt, n.x, n.z, n.a, () => 0, 0);
    n.cr.mesh.visible = !(n.flash > 0 && Math.floor(n.flash * 30) % 2);
  },
  killNpc(n) {
    n.dead = true; const cnt = Math.ceil(n.k * 2);
    for (let i = 0; i < cnt; i++) this.food.push({ x: n.x + rand(-n.r, n.r) * .6, z: n.z + rand(-n.r, n.r) * .6, y: 0, r: .3 + n.k * .15, type: 'meat', val: n.k * 1.6, w: rand(0, TAU), life: 30 });
    this.fx.burst(n.x, 0, n.z, hueCss(n.B.body.paint.h1), 14, 9, .7);
    if (n.lastHit !== undefined) { const q = this.pl[n.lastHit]; if (q) { q.kills++; q.dna += n.kind === 'boss' ? 45 : 3; if (n.kind === 'boss') toastAll(`P${q.p + 1} brought down the leviathan! +45 DNA.`, 'good'); } }
    if (n.kind === 'splitter' && n.gen < 2 && n.k > .5) { this._split = this._split || []; for (let i = 0; i < 2; i++) { const kk = n.k * .62, cr = new Creature(n.B, kk, { shadow: false }); this.scene.add(cr.group); const a = rand(0, TAU), hp = n.maxhp * .45; this._split.push({ ...n, cr, k: kk, r: n.B.radius * kk * .9, hp, maxhp: hp, x: n.x + Math.cos(a) * n.r, z: n.z + Math.sin(a) * n.r, vx: Math.cos(a) * 10, vz: Math.sin(a) * 10, dead: false, gen: n.gen + 1, lastHit: undefined, flags: n.flags.map(f => ({ ...f })) }); } this.fx.burst(n.x, 0, n.z, '#7ee0ff', 16, 8, .5); }
    if (n === this.boss) this.boss = null;
  },
  teamHit(q, n) { if (!G.accord) return false; const o = this.pl[other(q.p)]; const r = o && o.lastOn === n && this.t - o.lastT < 1.6; q.lastOn = n; q.lastT = this.t; if (r) this.fx.text(n.x, n.r + 3, n.z, 'TEAM COMBO', '#f2b544'); return r; },
  updateBloom(dt) {
    this.bloomT -= dt;
    if (!this.bloom && this.bloomT <= 0) { const a = rand(0, TAU), d = rand(40, this.R * .7); const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); m.scale.set(12, 6, 12); m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); this.scene.add(m); this.bloom = { x: m.position.x, z: m.position.z, r: 12, t: 30, m }; toastAll('A DNA bloom has opened. Sit inside it to soak up DNA before it fades.', 'warn'); }
    if (this.bloom) { const b = this.bloom; b.t -= dt; b.m.material.opacity = .12 + .08 * Math.sin(this.t * 4); b.m.rotation.y += dt; if (Math.random() < dt * 20) this.fx.burst(b.x + rand(-b.r, b.r) * .7, -1, b.z + rand(-b.r, b.r) * .7, '#ffd34d', 1, 2, 1, -3); if (b.t <= 0) { this.scene.remove(b.m); this.bloom = null; this.bloomT = rand(80, 120); } }
  },
  drawPools(dt) {
    const dm = new THREE.Object3D(); let pi = 0, mi = 0;
    for (const f of this.food) {
      f.w += dt; if (f.life < 1e8) f.life -= dt; f.x += Math.cos(f.w * .7) * .4 * dt; f.z += Math.sin(f.w * .5) * .4 * dt;
      dm.position.set(f.x, f.y + Math.sin(f.w) * .3, f.z); dm.rotation.set(f.w * .5, f.w, 0); dm.scale.setScalar(f.r); dm.updateMatrix();
      if (f.type === 'plant') { if (pi < 360) this.plantMesh.setMatrixAt(pi++, dm.matrix); } else if (mi < 200) this.meatMesh.setMatrixAt(mi++, dm.matrix);
    }
    this.plantMesh.count = pi; this.meatMesh.count = mi; this.plantMesh.instanceMatrix.needsUpdate = true; this.meatMesh.instanceMatrix.needsUpdate = true;
    this.pods.forEach((p, i) => { p.w += dt; dm.position.set(p.x, Math.sin(p.w * 2) * .5, p.z); dm.rotation.set(0, p.w * 2, 0); dm.scale.setScalar(1.1); dm.updateMatrix(); this.podMesh.setMatrixAt(i, dm.matrix); });
    this.podMesh.count = this.pods.length; this.podMesh.instanceMatrix.needsUpdate = true;
    const cl = this.clouds.slice(0, 160); cl.forEach((c, i) => { dm.position.set(c.x, 0, c.z); dm.rotation.set(0, 0, 0); dm.scale.set(c.r, c.r * .4, c.r); dm.updateMatrix(); this.cloudMesh.setMatrixAt(i, dm.matrix); });
    this.cloudMesh.count = cl.length; this.cloudMesh.instanceMatrix.needsUpdate = true;
  },
  drawFlagella() {
    const dm = new THREE.Object3D(), c = new THREE.Color(), base = new THREE.Vector3(), n = new THREE.Vector3(); let k = 0;
    const doOne = (o, hue) => {
      if (!o.cr.visible || !o.flags) return; const sp = Math.hypot(o.vx || 0, o.vz || 0);
      for (const f of o.flags) {
        o.cr.attach(f.p, f.s, base); const bi = clamp(Math.round(f.s), 0, o.cr.B.sp.length - 1); n.copy(f.n).applyQuaternion(o.cr.bones[bi].quaternion); n.y = 0; if (n.lengthSq() < 1e-4) n.set(-Math.cos(o.a), 0, -Math.sin(o.a)); n.normalize();
        const px = -n.z, pz = n.x, seg = .22 * o.k;
        for (let s = 0; s < FLAG_SEGS && k < 900; s++) { const u = (s + 1) / FLAG_SEGS, w = Math.sin(this.t * (10 + sp * .6) - s * 1.1 + f.ph) * seg * 1.6 * u; dm.position.set(base.x + n.x * seg * (s + 1) + px * w, base.y, base.z + n.z * seg * (s + 1) + pz * w); dm.scale.setScalar(o.k * (.09 - s * .009)); dm.updateMatrix(); this.flagMesh.setMatrixAt(k, dm.matrix); c.setHSL(hue / 360, .5, .72); this.flagMesh.setColorAt(k, c); k++; }
      }
    };
    for (const q of this.pl) if (!q.dead) doOne(q, G.players[q.p].cell.paint.h3);
    for (const nn of this.cells) doOne(nn, nn.B.body.paint.h3);
    this.flagMesh.count = k; this.flagMesh.instanceMatrix.needsUpdate = true; if (this.flagMesh.instanceColor) this.flagMesh.instanceColor.needsUpdate = true;
  },
  camFor(i, cam, dt) {
    const q = this.pl[i]; if (!q) return; const h = 7.5 + q.k * 5, k = dt ? Math.min(1, dt * 4) : 1;
    _tv3.set(q.x, h, q.z + h * .55); cam.position.lerp(_tv3, k); cam.lookAt(cam.position.x, 0, cam.position.z - h * .55); if (q.shake > 0) { cam.position.x += (Math.random() - .5) * q.shake; cam.position.z += (Math.random() - .5) * q.shake; }
  },
  beforeRender(i) { const q = this.pl[i]; if (q) this.scene.fog.density = .016 - Math.min(3, q.ab.A.sight) * .0025; },
  labels(i) {
    const pane = Panes[i], me = this.pl[i];
    for (const o of this.pl) if (o !== me && !o.dead) { const s = project(_kv3.set(o.x, o.r * 1.4, o.z), i); if (s) pane.label(s.x, s.y, `<span style="color:${hueCss(G.players[o.p].hue)}">P${o.p + 1} · ${esc(G.players[o.p].name)}</span>`); }
    for (const n of this.cells) if (n.windup > 0 && n.wTarget === me) { const s = project(_kv3.set(n.x, n.r * 1.4 + 1, n.z), i); if (s) pane.label(s.x, s.y, '<b class="warn-ico">!</b>'); }
    if (me && this.bloom) { const s = project(_kv3.set(this.bloom.x, 3, this.bloom.z), i); if (s) pane.label(s.x, s.y, '<b style="color:#ffd34d">DNA bloom</b>'); else CreatureStage.edge.call(this, pane, i, this.bloom.x, 0, this.bloom.z, 'DNA bloom', '#ffd34d'); }
    for (const o of this.pl) if (o !== me && !o.dead && me) CreatureStage.edge.call(this, pane, i, o.x, 0, o.z, `P${o.p + 1}`, hueCss(G.players[o.p].hue));
    Disc.labels(i, p => this.pl[p], s => 2, (pn, ii, x, y, z, h, c) => CreatureStage.edge.call(this, pn, ii, x, y, z, h, c));
    if (me && !me.dead) {
      const radar = 35 + me.ab.A.sight * 25, r = paneRects[i];
      for (const n of this.cells) {
        if (!(n.kind === 'hunter' || n.kind === 'boss') || n.k <= me.k * 1.05) continue; const d = Math.hypot(n.x - me.x, n.z - me.z); if (d > radar) continue;
        if (project(_kv3.set(n.x, 0, n.z), i)) { if (d < 30) { const s = project(_kv3.set(n.x, n.r * 1.2, n.z), i); if (s) pane.label(s.x, s.y, '<span style="color:#ff4d6d">!</span>'); } continue; }
        const a = Math.atan2(n.z - me.z, n.x - me.x), kk = Math.min((r.w / 2 - 30) / Math.abs(Math.cos(a) || 1e-6), (r.h / 2 - 40) / Math.abs(Math.sin(a) || 1e-6));
        pane.label(r.w / 2 + Math.cos(a) * kk, r.h / 2 + Math.sin(a) * kk + 8, `<div class="radar" style="transform:rotate(${(a + Math.PI / 2).toFixed(2)}rad)"></div>`);
      }
    }
    this.fx.labels(i);
  },
  hud(q) {
    const pane = Panes[q.p], A = q.ab.A, tot = q.plant + q.meat;
    pane.meter('hp', Math.max(0, q.hp), q.maxhp); pane.meter('gr', q.mass, CELL_GOAL, Math.min(100, Math.floor(q.mass / CELL_GOAL * 100)) + '%');
    pane.stat('dna', q.dna); pane.stat('won', `${Disc.count(q.p)}/${Disc.list.length}`); pane.stat('size', (q.k * 10).toFixed(0) + 'µm'); pane.stat('diet', tot < 1 ? DIET_WORD[q.ab.diet] || 'none' : Math.round(q.meat / tot * 100) + '% meat');
    pane.acts([{ act: 'a1', label: 'Dash', icon: 'dash', cd: q.dashCd > 0 ? q.dashCd / 3 : 0 }, ...(A.shock ? [{ act: 'a2', label: 'Shock', icon: 'shock', cd: q.zapCd > 0 ? q.zapCd / 5 : 0 }] : []), { act: 'a3', label: q.bite ? 'Lunge' : 'Ram', icon: 'bite', cd: q.lungeCd > 0 ? q.lungeCd / .9 : 0 }, ...(G.mode === 2 && G.accord ? [{ act: 'a4', label: 'Gift 10', icon: 'mate', off: q.dna < 10 }] : []), { act: 'menu', label: 'Editor', icon: 'edit', hot: q.dna >= 15 }, { act: 'back', label: 'Menu', icon: 'menu', hot: canEvolve(q.p) }]);
    if (!q.dead) pane.prompt(this.cells.some(n => n.windup > 0 && n.wTarget === q) ? 'Incoming lunge: dash away!' : this.vents.some(v => Math.hypot(q.x - v.x, q.z - v.z) < v.r + 6) ? 'Hot vent: it burns' : q.ab.diet === 'none' ? 'You have no mouth! Add one in the editor.' : '');
  },
  musicMood() { return this.pl.some(q => this.cells.some(n => n.windup > 0 && n.wTarget === q) || (this.boss && Math.hypot(this.boss.x - q.x, this.boss.z - q.z) < 60)) ? 1 : this.bloom ? .3 : 0; },
  summary(p) { const q = this.pl[p], tot = q.plant + q.meat, mf = tot ? q.meat / tot : .5; return [`Ate ${Math.round(mf * 100)}% meat, killed ${q.kills} cells, died ${q.deaths} times.`, `Diet locked in: ${DIET_WORD[G.players[p].diet]}. Time to grow legs.`]; },
  evolveHint(p) { return `press ${KEYLABEL[p].back} for the cell menu`; },
  /* curiosities on the sea floor: big glowing shapes far below the swimming plane */
  buildCuriosities(r) {
    const kinds = [
      { k: 'shell', name: 'The Spiral Shell', lore: 'A shell bigger than a thousand of you, spiralling down into the dark.' },
      { k: 'sponge', name: 'The Glass Sponge', lore: 'A tower of glass threads, glowing where the current strokes it.' },
      { k: 'star', name: 'The Fallen Star', lore: 'A shard of something from the sky, still warm, still humming.' },
      { k: 'mats', name: 'The Old Mats', lore: 'Mounds built by the very first life, layer on layer.' },
      { k: 'ribs', name: 'The Whale Fall', lore: 'The bones of a giant, feeding a whole world down here.' },
    ].sort(() => r() - .5);
    const base = r() * TAU;
    kinds.forEach((K, i) => {
      const a = base + i * TAU / kinds.length + (r() - .5) * .4, d = 110 + r() * 90, x = Math.cos(a) * d, z = Math.sin(a) * d, g = new THREE.Group(); g.position.set(x, -30, z);
      const glow = (h, l = .55) => stdMat(col3(h, .7, l).getHex(), { emissive: col3(h, .8, .3).getHex(), flatShading: true });
      if (K.k === 'shell') { for (let j = 0; j < 7; j++) { const m = new THREE.Mesh(sharedGeo('cTor', () => new THREE.TorusGeometry(1, .38, 6, 12)), glow(30 + j * 6, .6)); const s2 = 9 * Math.pow(.78, j); m.scale.set(s2, s2, s2); m.position.set(j * 2.4, s2 * .5 + j * 1.6, 0); m.rotation.y = Math.PI / 2; g.add(m); } }
      else if (K.k === 'sponge') { for (let j = 0; j < 6; j++) { const m = new THREE.Mesh(G_CONE(), glow(185, .6)); const h = 14 + r() * 16; m.scale.set(2.2, h, 2.2); m.position.set((r() - .5) * 10, h / 2, (r() - .5) * 10); m.rotation.x = Math.PI; g.add(m); } }
      else if (K.k === 'star') { for (let j = 0; j < 6; j++) { const m = new THREE.Mesh(sharedGeo('octa', () => new THREE.OctahedronGeometry(1, 0)), glow(280, .62)); const h = 5 + r() * 9; m.scale.set(2, h, 2); m.position.set((r() - .5) * 8, h * .6, (r() - .5) * 8); m.rotation.set(r() - .5, r() * 3, r() - .5); g.add(m); } }
      else if (K.k === 'mats') { for (let j = 0; j < 9; j++) { const m = new THREE.Mesh(sharedGeo('cDome', () => new THREE.SphereGeometry(1, 10, 5, 0, TAU, 0, Math.PI / 2)), glow(95 + j * 4, .45)); const sz = 3 + r() * 4; m.scale.set(sz, sz * 1.2, sz); m.position.set((r() - .5) * 22, 0, (r() - .5) * 22); g.add(m); } }
      else { const bone = stdMat(0xf0e6d0, { emissive: 0x3a3020 }); for (let j = 0; j < 6; j++) { const m = new THREE.Mesh(sharedGeo('cRib', () => new THREE.TorusGeometry(8, .7, 5, 10, Math.PI)), bone); m.position.set((j - 2.5) * 4, 0, 0); m.rotation.y = Math.PI / 2; g.add(m); } }
      const beacon = beaconMesh(60, 0x9fe8ff); beacon.scale.x = beacon.scale.z = .7; g.add(beacon); this.scene.add(g);
      Disc.add({ x, z, y: -20, r: 16, see: 120, far: 260, name: K.name, lore: K.lore, icon: '✧', beacon, reward: p => { const q = this.pl[p]; q.dna += 12; q.mass += 8; q.hp = q.maxhp; this.recalc(q); return '+12 DNA, a growth spurt, and full health.'; } });
    });
  },
  forceStyle(p) { const d = this.pl[p].ab.diet; G.players[p].diet = d === 'carn' ? 'carn' : d === 'herb' ? 'herb' : 'omni'; G.players[p].dna = Math.min(80, Math.floor(this.pl[p].dna * .5)); return d === 'carn' ? 'aggr' : d === 'herb' ? 'social' : 'mixed'; },
  exit() { if (this.bloom) this.scene.remove(this.bloom.m); for (const q of this.pl) if (q.cr) q.cr.dispose(); for (const n of this.cells) n.cr.dispose(); },
};
const _tv3 = new THREE.Vector3(), _kv3 = new THREE.Vector3();
/* run fn; if it throws, log once and run the recovery so one bad entity never freezes the game */
function safely(fn, recover) { try { fn(); } catch (e) { if (!safely.n) { console.error(e); } safely.n = (safely.n || 0) + 1; try { recover && recover(); } catch (_) {} } }
