/* Lineage | stage-civ. Intellectual property of Sidedoor Digital. */
'use strict';
/* ============================== STAGE 4: CIVILIZATION (one small planet) ==============================
   Fly your flagship over the world. Every city can be won three ways, shown on the city itself:
   send an army (quick, costs spice, makes enemies), open a trade route (steady, costs more spice),
   or hover over it and inspire it (free, but you have to be there). Rival nations do the same in their
   own style and can become allies. Wonders hidden around the planet give lasting bonuses.
   Unite enough of the planet and your species is ready for space.
   Movement is screen-relative: up always flies up the screen, because the camera's heading is carried
   across the sphere without turning (parallel transport), so the map never spins under you. */
const PR = 100;
const CIV_STYLES = { military: 'Militarist', trade: 'Merchant', culture: 'Zealot' };
const CIV_COST = { invade: 60, trade: 70, fort: 40, gift: 50, peace: 100 };
const CIV_NEED = { neutral: 100, city: 140, capital: 220 };
/* each city you hold can specialise; the choice shows on the city as a coloured spire */
const CIV_FOCUS = {
  farms: { name: 'Farms', act: 'Turn it over to farming', col: 0x7fd36a, cost: 30, desc: '+1 spice a second from this city.' },
  barracks: { name: 'Barracks', act: 'Garrison it', col: 0xff6a4a, cost: 30, desc: '+60 defences, and armies that set out from here are 40% stronger.' },
  temple: { name: 'Temple', act: 'Raise a temple', col: 0xf2d06a, cost: 30, desc: 'Inspires every city nearby that you do not hold, a little at a time, without you being there.' },
};
const CIV_WONDERS = [
  { k: 'crater', name: 'The Crater Sea', icon: '◎', lore: 'A perfect round sea where something fell long ago.', bonus: '+1 spice a second, for good.', apply: (st, n) => { n.bonus.income += 1; } },
  { k: 'ruins', name: 'Ruins of the First City', icon: '⌂', lore: 'Older than any nation. Your people feel at home here.', bonus: 'Inspiring cities is 50% faster.', apply: (st, n) => { n.bonus.inspire += .5; } },
  { k: 'skull', name: "The Titan's Skull", icon: '☠', lore: 'A skull the size of a hill, from the age of beasts.', bonus: 'Your armies are 30% stronger.', apply: (st, n) => { n.bonus.army += .3; } },
  { k: 'pillar', name: 'The Sky Pillar', icon: '│', lore: 'A spire of stone that pokes through the clouds.', bonus: 'Trade routes work 50% faster.', apply: (st, n) => { n.bonus.trade += .5; } },
  { k: 'aurora', name: 'The Aurora Peaks', icon: '▲', lore: 'Mountains wrapped in slow, moving light.', bonus: 'Stories of you spread: +20 loyalty in every city you do not hold.', apply: (st, n) => { for (const c of st.cities) if (c.owner !== n.id) c.loy[n.id] = (c.loy[n.id] || 0) + 20; } },
];
const _u1 = new THREE.Vector3(), _u2 = new THREE.Vector3(), _u3 = new THREE.Vector3(), _q1 = new THREE.Quaternion();
const CivStage = {
  idx: 3,
  grade: { bloom: .65, sat: 1.1, vig: .38 },
  enter() {
    G.stage = 3; saveGame();
    const sc = this.scene = new THREE.Scene(); sc.background = new THREE.Color(0x02030a);
    const seed = G.seed + 4, r = mulberry32(seed), N = makeNoise3(seed); this.t = 0; this.N = N;
    sc.add(new THREE.AmbientLight(0x4a5888, Q.b.lambert ? .7 : .55));
    const sun = this.sunL = new THREE.DirectionalLight(0xfff1dc, 2.9); sun.position.set(320, 160, 220); sc.add(sun);
    this.buildPlanet(seed, r);
    this.fx = new FX3(sc, 1.4);
    // cities: spread over land, capitals as far apart as possible
    const pts = []; for (let k = 0; k < 8000 && pts.length < 700; k++) { const u = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), h = this.hAt(u); if (h > this.sea + .025 && Math.abs(u.y) < .82 && (h - this.sea) * 26 < 4.5) pts.push(u); }
    const spots = []; for (const u of pts) { if (spots.length >= 16) break; if (spots.every(c => c.angleTo(u) > .44)) spots.push(u); }
    const np = G.mode, nAI = G.mode === 2 ? 2 : 3, nations = [];
    for (let p = 0; p < np; p++) { const P = G.players[p]; nations.push({ id: p, name: P.name, hue: P.hue, player: true, p, spice: 120, alive: true, bonus: { income: 0, inspire: 0, army: 0, trade: 0 }, stat: { mil: 0, trade: 0, culture: 0, ally: 0 } }); }
    const styles = ['military', 'trade', 'culture'].sort(() => r() - .5);
    for (let i = 0; i < nAI; i++) {
      const st = styles[i], att = [0, 1].slice(0, np).map(p => { const P = G.players[p]; return Math.round(clamp((st === 'military' ? 10 * styleCount(P, 'aggr') - 5 * styleCount(P, 'social') : st === 'culture' ? 10 * styleCount(P, 'social') - 5 * styleCount(P, 'aggr') : 10 * styleCount(P, 'mixed')) + (P.mods.social - 1) * 40, -30, 45)); });
      nations.push({ id: np + i, name: makeName(r), hue: (G.players[0].hue + 110 + i * 75) % 360, style: st, spice: 120, alive: true, think: 5 + i * 2, att, war: [false, false], ally: [false, false], bonus: { income: 0, inspire: 0, army: 0, trade: 0 } });
    }
    this.nations = nations;
    const caps = [spots[0]]; while (caps.length < nations.length) { let best = null, bd = -1; for (const c of spots) { if (caps.includes(c)) continue; const d = Math.min(...caps.map(x => x.angleTo(c))); if (d > bd) { bd = d; best = c; } } caps.push(best); }
    this.cities = spots.map((u, i) => { const ci = caps.indexOf(u); return { id: i, u, name: makeName(r, 2), owner: ci >= 0 ? ci : -1, capital: ci >= 0, fort: 0, def: 1, maxdef: 1, loy: {}, seed: r() * 1000 }; });
    for (const c of this.cities) { c.maxdef = this.baseDef(c); c.def = c.maxdef; this.buildCity(c); }
    for (const n of nations) n.cap = this.cities.find(c => c.capital && c.owner === n.id);
    // wonders on land between the cities
    const wpts = pts.filter(u => this.cities.every(c => c.u.angleTo(u) > .3)); const wsites = [];
    for (const u of wpts) { if (wsites.length >= 5) break; if (wsites.every(w => w.angleTo(u) > .7)) wsites.push(u); }
    const kinds = { crater: 'springs', ruins: 'stones', skull: 'ribs', pillar: 'spire', aurora: 'floaters' };
    Disc.dist = (q, s) => q.u.angleTo(s.u) * 1000; Disc.unit = 'km';
    Disc.vis = (i, s) => { const cam = cams[i]; return _u3.copy(cam.position).sub(s.wp).dot(s.u) > 0; };
    wsites.forEach((u, i) => {
      const W = CIV_WONDERS[i], lm = makeLandmark(kinds[W.k], this.pal, r), wp = this.surf(u, 0); lm.g.scale.setScalar(.16); lm.g.position.copy(wp); this.orient(lm.g, u); sc.add(lm.g);
      Disc.add({ u, wp, x: wp.x, z: wp.z, y: wp.y, up: true, r: 95, see: 700, far: 2400, nameAt: 220, name: W.name, lore: W.lore, icon: W.icon, beacon: lm.beacon, spin: lm.spin, reward: p => { const n = this.nations[p]; W.apply(this, n); n.spice += 60; return `+60 spice. ${W.bonus}`; } });
    });
    this.waves = []; this.routes = []; this.routeG = new THREE.Group(); sc.add(this.routeG);
    // flagships
    this.pl = [];
    for (let p = 0; p < np; p++) {
      const P = G.players[p], cap = nations[p].cap, u = cap.u.clone(); let hd = new THREE.Vector3(0, 1, 0).addScaledVector(u, -u.y); if (hd.lengthSq() < .01) hd.set(1, 0, 0).addScaledVector(u, -u.x); hd.normalize();
      const ship = this.makeShip(P.hue); sc.add(ship);
      const ring = new THREE.Mesh(sharedGeo('inspRing', () => new THREE.RingGeometry(.86, 1, 40)), new THREE.MeshBasicMaterial({ color: col3(P.hue, .8, .65), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); sc.add(ring);
      this.pl.push({ p, u, h: hd, ship, ring, vel: new THREE.Vector3(), bank: 0, compass: 0, lost: false });
      Panes[p].build({ eyebrow: 'Stage 4 · Civilization', title: 'Nation of ' + P.name, meters: [{ id: 'pl', label: 'Planet united', color: 'var(--ochre)' }], stats: [{ id: 'sp', label: 'Spice' }, { id: 'ci', label: 'Cities' }, { id: 'al', label: 'Allies' }, { id: 'won', label: 'Wonders' }] });
      const L = KEYLABEL[p];
      toastP(p, `Fly with ${G.mode === 2 ? L.move : 'the arrows'}: up is always up the screen. Over a city: ${L.a2} sends an army, hold ${L.a4} to inspire it, ${L.a1} opens it to trade. ${L.back} points your compass at the next goal.`);
      toastP(p, `Unite ${Math.round(this.goalShare() * 100)}% of the planet's cities. Allies' cities count too.`);
    }
    toastAll(`Other nations: ${nations.filter(n => !n.player).map(n => `${n.name} (${CIV_STYLES[n.style]})`).join(', ')}.`);
  },
  /* ---------- world building ---------- */
  buildPlanet(seed, r) {
    const sc = this.scene, N = this.N;
    this.hAt = u => fbm3(N, u.x * 1.7 + 5, u.y * 1.7, u.z * 1.7, 5); this.sea = .5;
    const pal = this.pal = worldPalette(seed), det = Q.n(44, 'terrain', 20);
    const geo = new THREE.IcosahedronGeometry(PR, det), pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
    const grassA = new THREE.Color().setRGB(...pal.grassA), grassB = new THREE.Color().setRGB(...pal.grassB), sand = new THREE.Color().setRGB(...pal.sand), rock = new THREE.Color().setRGB(...pal.rock), snow = new THREE.Color(0xf1f4fa), seabed = new THREE.Color(0x24506a);
    for (let i = 0; i < pos.count; i++) {
      _u1.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize(); const h = this.hAt(_u1), land = h > this.sea, el = land ? (h - this.sea) * 26 : (h - this.sea) * 14, lat = Math.abs(_u1.y);
      pos.setXYZ(i, _u1.x * (PR + el), _u1.y * (PR + el), _u1.z * (PR + el));
      if (!land) c.copy(seabed); else if (el < .5) c.copy(sand); else { const m = fbm3(N, _u1.x * 3.2, _u1.y * 3.2 + 9, _u1.z * 3.2, 3); c.copy(grassA).lerp(grassB, clamp((m - .4) * 3, 0, 1)); if (el > 4.2) c.lerp(rock, clamp((el - 4.2) / 1.6, 0, 1)); if (el > 6.2 || lat > .86) c.lerp(snow, clamp(Math.max((el - 6.2) / 1.2, (lat - .86) * 8), 0, 1)); }
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    this.planet = new THREE.Mesh(geo, litMat({ vertexColors: true, roughness: .92 })); sc.add(this.planet);
    // opaque ocean shaded by depth: turquoise shallows, deep blue far from shore
    const og = new THREE.IcosahedronGeometry(PR + .2, Q.n(24, 'terrain', 12)), op = og.attributes.position, oc = new Float32Array(op.count * 3), deep = new THREE.Color(0x0d3768), shallow = new THREE.Color(0x2fa6b8);
    for (let i = 0; i < op.count; i++) { _u1.set(op.getX(i), op.getY(i), op.getZ(i)).normalize(); const h = this.hAt(_u1); c.copy(deep).lerp(shallow, clamp((h - this.sea + .09) / .09, 0, 1)); oc[i * 3] = c.r; oc[i * 3 + 1] = c.g; oc[i * 3 + 2] = c.b; }
    og.setAttribute('color', new THREE.BufferAttribute(oc, 3)); og.computeVertexNormals();
    this.ocean = new THREE.Mesh(og, litMat({ vertexColors: true, roughness: .22, metalness: .05 })); sc.add(this.ocean);
    const atm = new THREE.Mesh(new THREE.SphereGeometry(PR * 1.14, 48, 32), new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.6); gl_FragColor = vec4(0.38,0.7,1.0,1.0) * f * 1.25; }' })); sc.add(atm);
    // scattered cloud puffs drifting with the wind (cheap instanced blobs instead of a full cloud sphere)
    const nc = Q.n(70, 'particles', 24); this.cloudM = new THREE.InstancedMesh(sharedGeo('civCloud', () => new THREE.IcosahedronGeometry(1, 1)), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x4a5268, transparent: true, opacity: .5, depthWrite: false }), nc);
    this.clouds = []; for (let i = 0; i < nc; i++) this.clouds.push({ u: new THREE.Vector3(rand(-1, 1), rand(-.8, .8), rand(-1, 1)).normalize(), s: rand(1.2, 2.8), sp: rand(.008, .02), ax: new THREE.Vector3(rand(-.2, .2), 1, rand(-.2, .2)).normalize() });
    this.cloudM.frustumCulled = false; sc.add(this.cloudM);
    const ns = Q.n(2500, 'sky', 800), sp = new Float32Array(ns * 3); for (let i = 0; i < ns; i++) { _u1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(1500, 2500)); sp[i * 3] = _u1.x; sp[i * 3 + 1] = _u1.y; sp[i * 3 + 2] = _u1.z; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sc.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 2, sizeAttenuation: false })));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(18, 20, 14), litMat({ color: 0xbab4c8, roughness: 1 })); moon.position.set(-420, 160, -520); sc.add(moon);
  },
  makeShip(hue) {
    const g = new THREE.Group(), body = new THREE.Mesh(sharedGeo('civHull', () => new THREE.ConeGeometry(1.5, 6, 7)), stdMat(col3(hue, .65, .55).getHex(), { metalness: .45, roughness: .3, emissive: col3(hue, .7, .16).getHex() })); body.rotation.x = Math.PI / 2; g.add(body);
    const wing = new THREE.Mesh(G_BOX(), stdMat(col3(hue, .45, .78).getHex(), { metalness: .3 })); wing.scale.set(8, .28, 2.2); wing.position.z = -1; g.add(wing);
    for (const s of [-1, 1]) { const pod = new THREE.Mesh(G_CYL(), stdMat(0x2a2840, { metalness: .5 })); pod.scale.set(.5, 2.4, .5); pod.rotation.x = Math.PI / 2; pod.position.set(s * 3.6, 0, -1.2); g.add(pod); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: col3(hue, .9, .7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(4); glow.position.z = -3.6; g.add(glow);
    return g;
  },
  baseDef(c) { return (c.capital ? 180 : c.owner >= 0 ? 110 : 80) + c.fort * 40 + (c.focus === 'barracks' ? 60 : 0); },
  need(c) { return c.owner < 0 ? CIV_NEED.neutral : c.capital ? CIV_NEED.capital : CIV_NEED.city; },
  goalShare() { return G.mode === 1 ? .5 : G.accord ? .3 : .4; },
  onAccordChange() { for (const q of this.pl || []) toastP(q.p, `New goal: unite ${Math.round(this.goalShare() * 100)}% of the planet${G.accord ? ' (the accord lowers the bar)' : ''}.`); },
  surf(u, alt) { const h = this.hAt(u), el = h > this.sea ? (h - this.sea) * 26 : 0; return u.clone().multiplyScalar(PR + Math.max(el, .2) + alt); },
  orient(obj, u) { obj.quaternion.setFromUnitVectors(_UP, u); },
  buildCity(c) {
    const g = new THREE.Group(); g.position.copy(this.surf(c.u, 0)); this.orient(g, c.u); this.scene.add(g); c.g = g; c.blds = []; c.wp = g.position.clone();
    const rr = mulberry32(Math.floor(c.seed)), nb = c.capital ? 13 : 8;
    for (let i = 0; i < nb; i++) { const a = rr() * TAU, d = .6 + rr() * (c.capital ? 3.6 : 2.8), h = .8 + rr() * (c.capital ? 3.8 : 2.2) * (1 - d / 6); const m = new THREE.Mesh(G_BOX(), stdMat(0xcccccc)); m.scale.set(.8 + rr() * .7, h, .8 + rr() * .7); m.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d); m.rotation.y = rr() * 3; g.add(m); c.blds.push(m); }
    if (c.capital) { const t = new THREE.Mesh(G_CONE(), stdMat(0xf2b544, { emissive: 0x6a4a10 })); t.scale.set(.7, 6.5, .7); t.position.y = 3.6; g.add(t); }
    const lights = new THREE.Mesh(sharedGeo('cityGlow', () => new THREE.CircleGeometry(4.8, 20)), new THREE.MeshBasicMaterial({ map: dotTexture(), color: 0xffc070, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); lights.rotation.x = -Math.PI / 2; lights.position.y = .25; g.add(lights);
    c.ring = new THREE.Mesh(sharedGeo('cring', () => new THREE.RingGeometry(5.6, 6.3, 40)), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75, side: THREE.DoubleSide, depthWrite: false })); c.ring.rotation.x = -Math.PI / 2; c.ring.position.y = .35; g.add(c.ring);
    c.loyRing = new THREE.Mesh(sharedGeo('cring2', () => new THREE.RingGeometry(6.5, 7.4, 40, 1, 0, TAU)), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false })); c.loyRing.rotation.x = -Math.PI / 2; c.loyRing.position.y = .4; c.loyRing.visible = false; g.add(c.loyRing);
    this.paintCity(c);
  },
  paintCity(c) {
    const n = c.owner >= 0 ? this.nations[c.owner] : null, h = n ? n.hue : 0, s = n ? .5 : 0;
    c.blds.forEach((m, i) => m.material = stdMat(col3(h, s, .52 + (i % 3) * .1).getHex(), { roughness: .6 })); c.ring.material.color.copy(n ? col3(h, .8, .6) : new THREE.Color(0x9a96a6));
  },
  /* ---------- rules ---------- */
  mine(id) { return this.cities.filter(c => c.owner === id); },
  allies(p) { return this.nations.filter(n => !n.player && n.alive && n.ally[p]); },
  held(p) { return this.mine(p).length + this.allies(p).reduce((a, n) => a + this.mine(n.id).length, 0); },
  income(n) { const k = n.player ? G.players[n.p].mods.econ : 1, farms = this.mine(n.id).filter(c => c.focus === 'farms').length; return (this.mine(n.id).length * 1.6 + farms + this.routes.filter(r => r.owner === n.id).length * .6 + n.bonus.income) * k; },
  mods(n) { return n.player ? G.players[n.p].mods : { dmg: 1, hp: 1, social: 1, econ: 1 }; },
  hostile(a, b) { if (a === b || a < 0 || b < 0) return false; const A = this.nations[a], B = this.nations[b]; if (A.player && B.player) return canHarm(); if (A.player) return B.war[A.p]; if (B.player) return A.war[B.p]; return false; },
  nearOwn(id, u) { return this.mine(id).sort((a, b) => a.u.angleTo(u) - b.u.angleTo(u))[0]; },
  near(q) { let best = null, bd = .13; for (const c of this.cities) { const d = c.u.angleTo(q.u); if (d < bd) { bd = d; best = c; } } return best; },
  canTake(p, c) { if (!c || c.owner === p) return false; const o = c.owner >= 0 ? this.nations[c.owner] : null; if (o && o.player && this.nations[p].player && !canHarm()) return false; if (o && !o.player && o.ally[p]) return false; return true; },
  why(p, c) { const o = c.owner >= 0 ? this.nations[c.owner] : null; if (c.owner === p) return 'That city is already yours.'; if (o && o.player) return 'You are in accord with that nation.'; if (o && o.ally[p]) return `The ${o.name} are your allies.`; return ''; },
  invade(p, c, quiet) {
    const n = this.nations[p]; if (!this.canTake(p, c)) { if (!quiet) toastP(p, this.why(p, c), 'bad'); return; }
    if (n.spice < CIV_COST.invade) { if (!quiet) toastP(p, `An army costs ${CIV_COST.invade} spice.`, 'bad'); return; }
    const from = this.nearOwn(p, c.u); if (!from) return; n.spice -= CIV_COST.invade;
    const o = c.owner >= 0 ? this.nations[c.owner] : null;
    if (o && !o.player && n.player && !o.war[n.p]) { o.war[n.p] = true; o.att[n.p] = Math.min(o.att[n.p], -40); toastP(n.p, `War with the ${o.name}. They will send armies at your cities until you make peace.`, 'warn'); }
    if (o && o.player && n.player && !this.pvp) { this.pvp = true; toastP(o.p, `P${n.p + 1} is invading your city ${c.name}!`, 'bad'); }
    if (o && o.player && !n.player) toastP(o.p, `The ${n.name} are marching on ${c.name}!`, 'bad');
    this.spawnWave(p, from, c); if (n.player) { Sfx.battle(n.p); toastP(n.p, `Your army marches on ${c.name}.`); }
  },
  spawnWave(owner, from, to) {
    const n = this.nations[owner], m = this.mods(n), g = new THREE.Group(), mat = stdMat(col3(n.hue, .65, .5).getHex(), { roughness: .5 });
    for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(G_BOX(), mat); t.scale.set(1.1, .8, 1.6); t.position.set((k - 1) * 1.7, .5, (k % 2) * 1.2); g.add(t); }
    this.scene.add(g); const hp = 60 * m.hp;
    this.waves.push({ owner, u: from.u.clone(), to, g, hp, maxhp: hp, str: 10 * m.dmg * (1 + n.bonus.army) * (from.focus === 'barracks' ? 1.4 : 1) * (n.player && hasFlag(G.players[n.p], 'venom') ? 1.15 : 1) });
  },
  openRoute(p, c) {
    const n = this.nations[p]; if (!this.canTake(p, c)) { toastP(p, this.why(p, c), 'bad'); return; }
    if (this.routes.some(r => r.owner === p && r.to === c)) { toastP(p, 'You already trade with that city.'); return; }
    if (n.spice < CIV_COST.trade) { toastP(p, `A trade route costs ${CIV_COST.trade} spice.`, 'bad'); return; }
    const from = this.nearOwn(p, c.u); if (!from) return; n.spice -= CIV_COST.trade; this.addRoute(p, from, c); Sfx.good(p); toastP(p, `Caravans set out for ${c.name}. It will join you when its loyalty fills.`, 'good');
  },
  addRoute(owner, from, to) {
    const n = this.nations[owner], pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(this.surf(_u1.copy(from.u).lerp(to.u, t).normalize(), 1.5 + Math.sin(t * Math.PI) * 6)); }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col3(n.hue, .8, .65), transparent: true, opacity: .85 }));
    const dot = new THREE.Mesh(G_SPHL(), new THREE.MeshBasicMaterial({ color: col3(n.hue, .9, .75) })); dot.scale.setScalar(.7);
    this.routeG.add(line); this.routeG.add(dot); this.routes.push({ owner, from, to, line, dot, pts, t: 0 });
  },
  dropRoutes(pred) { for (const r of this.routes.filter(pred)) { this.routeG.remove(r.line); this.routeG.remove(r.dot); r.line.geometry.dispose(); r.line.material.dispose(); } this.routes = this.routes.filter(r => !pred(r)); },
  /* a city breaks away and becomes independent again */
  freeCity(c) {
    const prev = c.owner; if (prev < 0) return; c.owner = -1; c.loy = {}; if (c.focus) this.setFocus(c, null); c.maxdef = this.baseDef(c); c.def = c.maxdef * .5; this.paintCity(c);
    this.dropRoutes(r => r.to === c || r.from === c); this.fx.burst(...this.surf(c.u, 3).toArray(), '#ffb347', 30, 7, 1);
    if (!this.cities.some(x => x.owner === prev)) { const pn = this.nations[prev]; if (!pn.player) { pn.alive = false; toastAll(`The ${pn.name} are no more.`, 'warn'); } }
  },
  setFocus(c, k) {
    c.focus = k; if (c.focusM) { c.g.remove(c.focusM); c.focusM = null; }
    if (k) { const m = new THREE.Mesh(sharedGeo('focusSpire', () => new THREE.ConeGeometry(.9, 4, 6)), stdMat(CIV_FOCUS[k].col, { emissive: CIV_FOCUS[k].col, emissiveIntensity: .5 })); m.position.set(2.6, 2.2, -2.2); c.g.add(m); c.focusM = m; }
    c.maxdef = this.baseDef(c); c.def = Math.min(c.def, c.maxdef);
  },
  fortify(p, c) { const n = this.nations[p]; if (c.owner !== p || c.fort >= 3 || n.spice < CIV_COST.fort) return; n.spice -= CIV_COST.fort; c.fort++; c.maxdef = this.baseDef(c); c.def = Math.min(c.maxdef, c.def + 40); Sfx.good(p); },
  capture(c, by, via) {
    const prev = c.owner; if (prev === by) return; c.owner = by; c.loy = {}; if (c.focus) this.setFocus(c, null); c.maxdef = this.baseDef(c); c.def = c.maxdef * .4; this.paintCity(c);
    this.dropRoutes(r => r.to === c || r.from === c);
    for (const w of this.waves) if (w.to === c && w.owner === by) w.done = true;
    const nb = this.nations[by]; this.fx.burst(...this.surf(c.u, 3).toArray(), hueCss(nb.hue), 30, 7, 1);
    if (nb.player) { Sfx.capture(nb.p); nb.stat[via]++; toastP(nb.p, `${c.name} joins you${via === 'mil' ? ' by force' : via === 'trade' ? ' through trade' : ' out of admiration'}.`, 'good'); }
    if (prev >= 0) {
      const pn = this.nations[prev]; if (pn.player) toastP(pn.p, `You lost ${c.name}.`, 'bad');
      if (!pn.player && via === 'mil' && nb.player) { pn.att[nb.p] -= 25; }
      if (!this.cities.some(x => x.owner === prev)) { pn.alive = false; if (!pn.player) toastAll(`The ${pn.name} are no more. Their people join the planet's other nations.`, 'warn'); }
    }
  },
  /* ---------- input ---------- */
  onAction(p, act) {
    const q = this.pl[p]; if (!q) return; const c = this.near(q);
    if (act === 'menu') { this.openNation(p); return; }
    if (act === 'a3') { Sfx.whoosh(p); return; }
    if (act === 'back') { q.compass = (q.compass + 1) % 3; toastP(p, `Compass: ${['the nearest city you could win', 'the nearest undiscovered wonder', 'your capital'][q.compass]}.`); Sfx.click(p); return; }
    if (act === 'a1') { if (!c) { toastP(p, 'Fly over a city first. Your compass points at the nearest one.'); return; } this.openCity(p, c); }
    else if (act === 'a2') { if (!c) { toastP(p, 'Fly over a city to send an army at it.'); return; } this.invade(p, c); }
    else if (act === 'a4' && !c) toastP(p, 'Hover over a city and hold this to inspire it.');
  },
  openCity(p, c) {
    const n = this.nations[p];
    Menus[p].open({ eyebrow: c.owner === p ? 'Your city' : c.owner >= 0 ? this.nations[c.owner].name + (this.nations[c.owner].style ? ' · ' + CIV_STYLES[this.nations[c.owner].style] : '') : 'Independent city', title: c.name + (c.capital ? ' ★' : ''), live: true,
      sub: () => `${Math.floor(n.spice)} spice · defences ${Math.round(c.def)}/${c.maxdef}${c.owner !== p ? ` · loyalty to you ${Math.min(100, Math.round((c.loy[p] || 0) / this.need(c) * 100))}%` : ''}`,
      items: () => {
        if (c.owner === p) return [
          { label: c.fort >= 3 ? 'Walls at full strength' : 'Build walls', value: c.fort >= 3 ? '' : CIV_COST.fort, desc: '+40 defences against armies.', disabled: c.fort >= 3 || n.spice < CIV_COST.fort, onSelect: () => this.fortify(p, c) },
          { head: true, label: `Focus · ${c.focus ? CIV_FOCUS[c.focus].name : 'none yet'}` },
          ...Object.entries(CIV_FOCUS).map(([k, F]) => ({ label: c.focus === k ? `${F.name} (current)` : F.act, value: c.focus === k ? '' : F.cost, desc: F.desc, disabled: c.focus === k || n.spice < F.cost, onSelect: () => { if (c.focus === k || n.spice < F.cost) return; n.spice -= F.cost; this.setFocus(c, k); Sfx.good(p); } })),
          ...evolveItems(p), { label: 'Close', close: true, onSelect: () => {} }];
        const o = c.owner >= 0 ? this.nations[c.owner] : null, ok = this.canTake(p, c), route = this.routes.some(r => r.owner === p && r.to === c);
        return [
          { head: true, label: 'Win this city' },
          { label: 'Send an army', value: CIV_COST.invade, desc: o ? (o.player ? 'Your rival will take it badly.' : `Means war with the ${o.name}.`) : 'Quick, but other nations will see you as a threat.', disabled: !ok || n.spice < CIV_COST.invade, onSelect: () => this.invade(p, c), close: true },
          { label: route ? 'Trade route open' : 'Open a trade route', value: route ? '' : CIV_COST.trade, desc: 'Loyalty grows steadily and the route pays you while it runs.', disabled: !ok || route || n.spice < CIV_COST.trade, onSelect: () => this.openRoute(p, c), close: true },
          { label: 'Inspire it', value: `hold ${KEYLABEL[p].a4}`, desc: 'Free. Hover over the city and hold the key. Loyalty fills while you stay.', disabled: !ok },
          ...(o && !o.player ? [{ head: true, label: `The ${o.name}` }, ...this.diploItems(p, o)] : []),
          ...(o && o.player ? accordItem(p) : []),
          { label: 'Close', close: true, onSelect: () => {} }];
      } });
  },
  diploItems(p, o) {
    const n = this.nations[p], rivalAlly = G.mode === 2 && o.ally[other(p)] && !G.accord;
    if (o.war[p]) return [{ label: 'Make peace', value: CIV_COST.peace, desc: `Attitude ${Math.round(o.att[p])}. They stop attacking you.`, disabled: n.spice < CIV_COST.peace, onSelect: () => { if (n.spice < CIV_COST.peace) return; n.spice -= CIV_COST.peace; o.war[p] = false; o.att[p] = Math.max(o.att[p], -10); for (const w of this.waves) if (w.owner === o.id && w.to.owner === p) w.done = true; toastP(p, `The ${o.name} accept peace.`, 'good'); } }];
    if (o.ally[p]) return [{ label: 'Allies', value: '♥', desc: `Their ${this.mine(o.id).length} cities count towards your goal.` }];
    return [
      { label: 'Send a gift', value: CIV_COST.gift, desc: `Attitude ${Math.round(o.att[p])}. ${o.style === 'trade' ? 'Merchants love gifts.' : o.style === 'military' ? 'Militarists respect strength more than gifts.' : 'Zealots like peaceful nations.'}`, disabled: n.spice < CIV_COST.gift, onSelect: () => { if (n.spice < CIV_COST.gift) return; n.spice -= CIV_COST.gift; const g = Math.round(14 * G.players[p].mods.social * (o.style === 'trade' ? 1.4 : o.style === 'military' ? .7 : 1)); o.att[p] = Math.min(100, o.att[p] + g); toastP(p, `Gift accepted. Attitude +${g}.`, 'good'); Sfx.good(p); } },
      { label: 'Form an alliance', value: rivalAlly ? `P${other(p) + 1}'s ally` : o.att[p] < 60 ? `needs 60` : '', desc: 'Their cities count towards your goal and they stop competing with you.', disabled: rivalAlly || o.att[p] < 60, onSelect: () => { if (rivalAlly || o.att[p] < 60) return; o.ally[p] = true; this.nations[p].stat.ally++; if (G.accord && G.mode === 2) o.ally[other(p)] = true; Sfx.good(p); toastAll(`The ${o.name} ally with P${p + 1}${G.accord ? ' and their accord partner' : ''}.`, 'good'); this.dropRoutes(r => r.owner === o.id && r.to.owner === p); } },
    ];
  },
  openNation(p) {
    const n = this.nations[p], q = this.pl[p];
    Menus[p].open({ eyebrow: 'Your nation', title: n.name, live: true, sub: () => `${Math.floor(n.spice)} spice (+${this.income(n).toFixed(1)}/s) · ${this.held(p)} of ${Math.ceil(this.cities.length * this.goalShare())} cities needed`,
      items: () => [
        ...evolveItems(p),
        { head: true, label: 'Other nations' },
        ...this.nations.filter(o => o !== n).map(o => o.player ? { label: `${o.name} (P${o.p + 1})`, value: `${this.mine(o.id).length} cities`, desc: G.accord ? 'In accord with you.' : 'Your rival.' } : { label: `${o.name} · ${CIV_STYLES[o.style]}`, value: !o.alive ? 'gone' : o.ally[p] ? 'ally' : o.war[p] ? 'at war' : `attitude ${Math.round(o.att[p])}`, desc: o.alive ? `${this.mine(o.id).length} cities. Choose to talk.` : 'Absorbed by the others.', disabled: !o.alive, onSelect: () => Menus[p].open({ eyebrow: CIV_STYLES[o.style], title: 'The ' + o.name, live: true, sub: () => `${this.mine(o.id).length} cities · attitude ${Math.round(o.att[p])}${o.war[p] ? ' · at war' : o.ally[p] ? ' · allies' : ''}`, items: () => [...this.diploItems(p, o), { label: 'Back', onSelect: () => this.openNation(p) }] }) }),
        { head: true, label: 'Travel' },
        { label: 'Fly to my capital', onSelect: () => { const c = n.cap && n.cap.owner === p ? n.cap : this.mine(p)[0]; if (c) { q.u.copy(c.u); this.fixHeading(q); } }, close: true },
        ...accordItem(p),
        { label: 'Close', close: true, onSelect: () => {} }] });
  },
  fixHeading(q) { q.h.addScaledVector(q.u, -q.h.dot(q.u)); if (q.h.lengthSq() < 1e-4) q.h.set(1, 0, 0).addScaledVector(q.u, -q.u.x); q.h.normalize(); },
  /* ---------- simulation ---------- */
  update(dt) {
    this.t += dt; WORLD_TIME.value += dt;
    for (const n of this.nations) if (n.alive) n.spice += this.income(n) * dt;
    for (const c of this.cities) { c.def = Math.min(c.maxdef, c.def + (c.owner < 0 ? 2 : 3) * dt); c.ring.scale.setScalar(.5 + .5 * c.def / c.maxdef); }
    // trade routes: caravans run along the route and loyalty grows at the far end
    for (const r of this.routes) {
      const n = this.nations[r.owner], k = (n.player ? G.players[n.p].mods.econ : 1) * (1 + n.bonus.trade); r.to.loy[r.owner] = (r.to.loy[r.owner] || 0) + 2.4 * k * dt;
      r.t = (r.t + dt * .25) % 1; const f = r.t * (r.pts.length - 1), i = Math.floor(f); r.dot.position.lerpVectors(r.pts[i], r.pts[Math.min(r.pts.length - 1, i + 1)], f - i);
    }
    // temples you build inspire the cities near them
    for (const t of this.cities) if (t.focus === 'temple' && t.owner >= 0) { const n = this.nations[t.owner], k = n.player ? G.players[n.p].mods.social : 1; for (const c of this.cities) if (c !== t && this.canTake(t.owner, c) && c.u.angleTo(t.u) < .55) c.loy[t.owner] = (c.loy[t.owner] || 0) + .6 * k * dt; }
    // zealot nations inspire the cities around them without moving
    for (const n of this.nations) if (!n.player && n.alive && n.style === 'culture') for (const c of this.cities) if (c.owner < 0 && this.mine(n.id).some(m => m.u.angleTo(c.u) < .6)) c.loy[n.id] = (c.loy[n.id] || 0) + 1.1 * dt;
    // armies roll along great circles, then besiege
    for (const w of this.waves) {
      if (w.done || w.hp <= 0) continue; const c = w.to;
      if (!this.canTake(w.owner, c) && c.owner !== w.owner) { w.done = true; continue; }
      const ang = w.u.angleTo(c.u);
      if (ang > .035) { w.u.lerp(c.u, Math.min(1, .16 * dt / ang)).normalize(); }
      else { c.def -= w.str * dt; w.hp -= (3 + c.fort * 2.5 + (c.capital ? 3 : 0)) * dt; if (Math.random() < dt * 6) this.fx.burst(...this.surf(c.u, 2).toArray(), '#ffb347', 4, 4, .4); if (c.def <= 0) this.capture(c, w.owner, 'mil'); }
      w.g.position.copy(this.surf(w.u, .2)); w.g.up.copy(w.u); _u2.copy(c.u).addScaledVector(w.u, -c.u.dot(w.u)); if (_u2.lengthSq() > 1e-8) w.g.lookAt(_u3.copy(w.g.position).add(_u2.normalize()));
    }
    for (const w of this.waves) if ((w.hp <= 0 || w.done) && !w.gone) { w.gone = true; this.scene.remove(w.g); if (w.hp <= 0) this.fx.burst(...w.g.position.toArray(), hueCss(this.nations[w.owner].hue), 12, 5, .6); }
    this.waves = this.waves.filter(w => !w.gone);
    // loyalty fills: the city joins
    for (const c of this.cities) for (const k in c.loy) { const id = +k, need = this.need(c); if (c.loy[k] >= need && c.owner !== id && this.nations[id].alive && this.canTake(id, c)) { const via = this.routes.some(r => r.owner === id && r.to === c) ? 'trade' : 'culture'; for (const pn of Panes) if (!(this.nations[id].player && this.nations[id].p === pn.i)) pn.toast(`${c.name} ${via === 'trade' ? 'signs on with' : 'chooses to join'} the ${this.nations[id].name}.`); this.capture(c, id, via); break; } }
    for (const n of this.nations) if (!n.player && n.alive) { n.think -= dt; if (n.think <= 0) { n.think = rand(5, 8); this.ai(n); } }
    for (const q of this.pl) this.updShip(q, dt);
    this.updClouds(dt); this.fx.update(dt);
    Disc.update(dt, p => this.pl[p]);
    for (const q of this.pl) {
      const goal = Math.ceil(this.cities.length * this.goalShare());
      if (this.held(q.p) >= goal && !Flow.ready[q.p]) playerDone(q.p, this.forceStyle(q.p), this.summary(q.p));
      if (!this.mine(q.p).length && !q.lost) { q.lost = true; const c = this.cities.filter(x => x.owner < 0)[0] || this.cities.find(x => !x.capital) || this.cities[0]; toastP(q.p, 'Your nation fell, but your people rally in exile.', 'bad'); this.nations[q.p].alive = true; this.capture(c, q.p, 'culture'); q.u.copy(c.u); this.fixHeading(q); }
      if (this.mine(q.p).length) q.lost = false;
    }
  },
  ai(n) {
    const mine = this.mine(n.id); if (!mine.length) return;
    const free = this.cities.filter(c => c.owner < 0).sort((a, b) => Math.min(...mine.map(m => m.u.angleTo(a.u))) - Math.min(...mine.map(m => m.u.angleTo(b.u))));
    const myWaves = this.waves.filter(w => w.owner === n.id).length;
    // at war with a player: armies at their nearest city
    for (let p = 0; p < G.mode; p++) if (n.war[p] && n.spice >= CIV_COST.invade && !this.waves.some(w => w.owner === n.id && w.to.owner === p) && Math.random() < .35) { const tg = this.mine(p).sort((a, b) => Math.min(...mine.map(m => m.u.angleTo(a.u))) - Math.min(...mine.map(m => m.u.angleTo(b.u))))[0]; if (tg) { this.invade(n.id, tg, true); return; } }
    if (n.style === 'military' && n.spice >= CIV_COST.invade && myWaves < 2 && free[0]) this.invade(n.id, free[0], true);
    else if (n.style === 'trade' && n.spice >= CIV_COST.trade && this.routes.filter(r => r.owner === n.id).length < 3) { const tg = free.find(c => !this.routes.some(r => r.owner === n.id && r.to === c)); if (tg) { n.spice -= CIV_COST.trade; this.addRoute(n.id, this.nearOwn(n.id, tg.u), tg); } }
    else if (n.style === 'culture' && n.spice >= 120 && free[0] && Math.random() < .3) this.invade(n.id, free[0], true);
    // feelings drift: allies and peaceful neighbours warm up, militarists eye the strongest player
    for (let p = 0; p < G.mode; p++) { if (n.war[p]) continue; if (n.style === 'military' && this.mine(p).length > mine.length + 2) n.att[p] -= 2; else n.att[p] += .5; if (n.att[p] < -55) { n.war[p] = true; toastP(p, `The ${n.name} declare war on you!`, 'bad'); Sfx.bad(p); } }
  },
  forceStyle(p) { const s = this.nations[p].stat, force = s.mil, peace = s.culture + s.ally * 2, trade = s.trade; return force > peace + trade ? 'aggr' : peace > force + trade ? 'social' : trade > force && trade > peace ? 'mixed' : force > peace ? 'aggr' : peace > force ? 'social' : 'mixed'; },
  summary(p) { const s = this.nations[p].stat; return [`Cities taken by force ${s.mil}, through trade ${s.trade}, by inspiration ${s.culture}. Alliances ${s.ally}.`, 'Your space agency launches its first ship.']; },
  evolveHint(p) { return `press ${KEYLABEL[p].menu} for your nation menu`; },
  updShip(q, dt) {
    const menu = Menus[q.p].isOpen, dir = menu ? { x: 0, z: 0, m: 0 } : dirOf(q.p), boost = held(q.p, 'a3') && !menu ? 2.1 : 1, n = this.nations[q.p];
    const right = _u1.crossVectors(q.h, q.u).normalize(), want = _u2.copy(q.h).multiplyScalar(-dir.z).addScaledVector(right, dir.x);
    q.vel.lerp(want.multiplyScalar(.36 * boost * dir.m * (G.players[q.p].mods.speed || 1)), Math.min(1, dt * 5));
    const sp = q.vel.length();
    if (sp > 1e-5) { const ax = _u3.crossVectors(q.u, q.vel).normalize(); _q1.setFromAxisAngle(ax, sp * dt); q.u.applyQuaternion(_q1).normalize(); q.h.applyQuaternion(_q1); q.vel.applyQuaternion(_q1); this.fixHeading(q); }
    const pos = this.surf(q.u, 13); q.ship.position.copy(pos); q.ship.up.copy(q.u);
    const face = sp > .02 ? _u2.copy(q.vel).normalize() : q.h; q.face = (q.face || q.h.clone()).lerp(face, Math.min(1, dt * 6)).normalize();
    _u3.copy(pos).add(q.face); q.ship.lookAt(_u3); q.bank = lerp(q.bank, -dir.x * .4, Math.min(1, dt * 4)); q.ship.rotateZ(q.bank);
    // inspiring: hold the key over a city
    const c = this.near(q), insp = held(q.p, 'a4') && !menu && c && this.canTake(q.p, c);
    q.inspiring = insp ? c : null;
    if (insp) { const k = G.players[q.p].mods.social * (1 + n.bonus.inspire); c.loy[q.p] = (c.loy[q.p] || 0) + 3 * k * dt; if (Math.random() < dt * 8) this.fx.burst(...this.surf(c.u, 4).toArray(), hueCss(G.players[q.p].hue), 3, 3, .8); }
    q.ring.visible = !!insp; if (insp) { const ph = (this.t * .9) % 1; q.ring.position.copy(this.surf(c.u, .5 + ph * 9)); this.orient(q.ring, c.u); q.ring.rotateX(-Math.PI / 2); q.ring.scale.setScalar(3 + ph * 6); q.ring.material.opacity = .7 * (1 - ph); }
  },
  updClouds(dt) {
    const m = new THREE.Object3D(); this.clouds.forEach((c, i) => { c.u.applyAxisAngle(c.ax, c.sp * dt).normalize(); m.position.copy(c.u).multiplyScalar(PR + 9); m.quaternion.setFromUnitVectors(_UP, c.u); m.scale.set(c.s * 1.7, c.s * .3, c.s); m.updateMatrix(); this.cloudM.setMatrixAt(i, m.matrix); });
    this.cloudM.instanceMatrix.needsUpdate = true;
  },
  camFor(i, cam, dt) {
    const q = this.pl[i]; if (!q) return; const k = dt ? Math.min(1, dt * 3) : 1;
    _tv.copy(q.u).multiplyScalar(PR + 64).addScaledVector(q.h, -44); cam.position.lerp(_tv, k); cam.up.copy(q.u); cam.lookAt(_u1.copy(q.u).multiplyScalar(PR + 2).addScaledVector(q.h, 16));
  },
  /* the planet hides whatever is on its far side */
  facing(i, wp) { return _u3.copy(cams[i].position).sub(wp).dot(wp) > 0; },
  compassTarget(q) {
    const p = q.p;
    if (q.compass === 1) { const s = Disc.list.filter(s => !s.found[p]).sort((a, b) => a.u.angleTo(q.u) - b.u.angleTo(q.u))[0]; if (s) return { wp: s.wp, u: s.u, label: `${s.icon} wonder`, col: '#ffe08a' }; }
    if (q.compass === 2) { const c = this.nations[p].cap && this.nations[p].cap.owner === p ? this.nations[p].cap : this.mine(p)[0]; if (c) return { wp: c.wp, u: c.u, label: '★ home', col: hueCss(G.players[p].hue) }; }
    const c = this.cities.filter(c => this.canTake(p, c)).sort((a, b) => a.u.angleTo(q.u) - b.u.angleTo(q.u))[0]; return c ? { wp: c.wp, u: c.u, label: `◎ ${c.name}`, col: '#f2b544' } : null;
  },
  labels(i) {
    const pane = Panes[i], q = this.pl[i]; if (!q) return; const ctx = this.near(q);
    for (const c of this.cities) {
      if (c.u.angleTo(q.u) > 1.05 || !this.facing(i, c.wp)) continue; const s = project(_tv.copy(c.wp).addScaledVector(c.u, 8), i); if (!s) continue; const on = c.owner >= 0 ? this.nations[c.owner] : null;
      const mineLoy = c.owner !== i ? Math.min(1, (c.loy[i] || 0) / this.need(c)) : 0, siege = this.waves.some(w => w.to === c && w.u.angleTo(c.u) < .04);
      pane.label(s.x, s.y, `<span style="color:${on ? hueCss(on.hue, 70, 74) : '#e2dcef'}">${esc(c.name)}${c.capital ? ' ★' : ''}</span><small>${on ? (on.id === i ? 'yours' + (c.focus ? ' · ' + CIV_FOCUS[c.focus].name.toLowerCase() : '') : esc(on.name)) : 'independent'}${on && this.hostile(i, c.owner) ? ' · war' : ''}${on && !on.player && on.ally[i] ? ' · ally' : ''}${siege ? ' · <b style="color:#ff7a59">under siege</b>' : ''}</small>${mineLoy > 0 ? `<div class="relbar"><i style="width:${(mineLoy * 100).toFixed(0)}%"></i></div>` : ''}`, ctx === c ? 'sel' : '');
    }
    const t = this.compassTarget(q); if (t && !edgeMark(pane, i, t.wp.x, t.wp.y, t.wp.z, t.label, t.col, !this.facing(i, t.wp)) && t.u.angleTo(q.u) > .1) { const v = project(t.wp, i); if (v) pane.label(v.x, v.y + 28, `<small style="color:${t.col}">▲ compass</small>`); }
    Disc.labels(i, p => this.pl[p], s => s.y, null);
    if (G.mode === 2) { const o = this.pl[other(i)], wp = o.ship.position; if (this.facing(i, wp)) { const v = project(wp, i); if (v) pane.label(v.x, v.y - 8, `<span style="color:${hueCss(G.players[o.p].hue)}">P${o.p + 1}</span>`); } }
    this.fx.labels(i);
  },
  beforeRender(i, cam) {
    const q = this.pl[i]; if (!q) return;
    /* light comes over each player's shoulder so their part of the world is always readable */
    this.sunL.position.copy(cam.position).addScaledVector(cam.up, 140).addScaledVector(_u1.set(1, 0, 0).applyQuaternion(cam.quaternion), -110);
    const pane = Panes[i], n = this.nations[i], c = this.near(q), goal = Math.ceil(this.cities.length * this.goalShare()), held = this.held(i);
    pane.meter('pl', held, goal, `${held} of ${goal} cities`);
    pane.stat('sp', `${Math.floor(n.spice)} +${this.income(n).toFixed(1)}`); pane.stat('ci', this.mine(i).length); pane.stat('al', this.allies(i).length); pane.stat('won', `${Disc.count(i)}/${Disc.list.length}`);
    const can = c && this.canTake(i, c);
    pane.acts([
      { act: 'a1', label: !c ? 'City' : c.owner === i ? 'Manage' : 'Trade', off: !c, hot: !!c },
      { act: 'a2', label: `Army ${CIV_COST.invade}`, off: !can || n.spice < CIV_COST.invade },
      { act: 'a4', label: 'Inspire', off: !can, hot: !!q.inspiring },
      { act: 'a3', label: 'Boost' }, { act: 'menu', label: 'Nation' }, { act: 'back', label: 'Compass' }]);
    pane.prompt(!c ? '' : c.owner === i ? `${c.name} · your city · walls ${c.fort}/3` : can ? `${c.name} · loyalty to you ${Math.min(100, Math.round((c.loy[i] || 0) / this.need(c) * 100))}% · defences ${Math.round(c.def)}` : `${c.name} · ${this.why(i, c)}`);
  },
  memoryBonus(p) { this.nations[p].spice += 30; return '+30 spice.'; },
  calm(p) { return !this.waves.some(w => w.to.owner === p && w.u.angleTo(w.to.u) < .1); },
  chronicle: [
    { id: 'volcano', title: 'The mountain wakes', when(p) { return this.mine(p).some(c => !c.capital); }, text(p) { const c = this.mine(p).filter(c => !c.capital).sort(() => Math.random() - .5)[0]; (this._vc = this._vc || [])[p] = c; return `The mountain above ${c.name} is smoking. The ground shakes every hour.`; },
      choices: [
        { label: 'Evacuate the city', desc: 'Everyone lives, but its defences fall to almost nothing for a while.', go(p) { const c = this._vc[p]; if (c && c.owner === p) c.def = c.maxdef * .1; return 'The city empties into the hills, then slowly comes home.'; } },
        { label: 'Trust the mountain', desc: 'Half the time the ash makes the fields rich (+90 spice). Half the time the city is lost.', go(p) { const c = this._vc[p]; if (!c || c.owner !== p) return ''; if (Math.random() < .5) { this.nations[p].spice += 90; return 'The ash settles on the fields. +90 spice.'; } this.freeCity(c); return `${c.name} is buried. Survivors rebuild it as an independent city.`; } }] },
    { id: 'plague', title: 'A plague on the roads', text: 'A sickness is travelling with the caravans from city to city.',
      choices: [
        { label: 'Close the roads', desc: 'Your trade routes stop for good. Your cities stay healthy.', go(p) { this.dropRoutes(r => r.owner === p); return 'The caravans stop.'; } },
        { label: 'Keep trading', desc: 'Every city you hold loses half its defences while it recovers.', go(p) { for (const c of this.mine(p)) c.def *= .5; return 'The sickness runs its course.'; } }] },
    { id: 'signal', title: 'A voice from the stars', text: 'Your radio towers have picked up a signal from beyond the sky. It repeats every few hours, patient as a heartbeat.',
      choices: [
        { label: 'Answer it', desc: 'The empires of the galaxy will know your name before you arrive: every one starts friendlier in the space stage.', go(p) { G.players[p].lore = { ...(G.players[p].lore || {}), answered: true }; return 'You send a reply into the dark. Someone, somewhere, will hear it.'; } },
        { label: 'Stay quiet', desc: '+60 spice from the defence budget you save.', go(p) { this.nations[p].spice += 60; return '+60 spice.'; } }] },
    { id: 'inventor', title: 'A great inventor', text: 'A brilliant engineer asks for funding. She can build one thing well.',
      choices: [
        { label: 'Fund the rocket', desc: '80 spice. Your first starship launches with better engines.', ok(p) { return this.nations[p].spice >= 80; }, go(p) { this.nations[p].spice -= 80; G.players[p].lore = { ...(G.players[p].lore || {}), rocket: true }; return 'The test flights go well. Space will be closer than you think.'; } },
        { label: 'Fund the cannon', desc: '80 spice. Your armies are 25% stronger for the rest of this age.', ok(p) { return this.nations[p].spice >= 80; }, go(p) { this.nations[p].spice -= 80; this.nations[p].bonus.army += .25; return 'Your armies roll out with new guns.'; } }] },
    { id: 'refugees', title: 'Refugees at the border', when(p) { return this.nations.some(n => !n.player && n.alive); }, text(p) { const o = this.nations.filter(n => !n.player && n.alive).sort(() => Math.random() - .5)[0]; (this._rf = this._rf || [])[p] = o; return `Thousands of people are fleeing the ${o.name} and asking to cross into your land.`; },
      choices: [
        { label: 'Take them in', desc: 'They bring stories of you home: +40 loyalty in their nearest city. Their leaders resent it.', go(p) { const o = this._rf[p]; if (!o) return ''; const c = this.mine(o.id).sort((a, b) => a.u.angleTo(this.pl[p].u) - b.u.angleTo(this.pl[p].u))[0]; if (c) c.loy[p] = (c.loy[p] || 0) + 40; o.att[p] -= 12; return c ? `${c.name} thinks better of you now.` : 'They settle in quietly.'; } },
        { label: 'Send them back', desc: 'The ' + 'nation they fled likes you more: +15 attitude.', go(p) { const o = this._rf[p]; if (o) o.att[p] = Math.min(100, o.att[p] + 15); return 'The border stays shut.'; } }] },
  ],
  musicMood() { let m = 0; for (const q of this.pl) { if (this.waves.some(w => w.to.owner === q.p && w.u.angleTo(w.to.u) < .3)) m = 1; else if (this.nations.some(n => !n.player && n.alive && n.war[q.p])) m = Math.max(m, .45); if (q.inspiring) m = Math.max(m, .3); } return m; },
  exit() {},
};
