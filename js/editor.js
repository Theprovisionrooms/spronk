/* Lineage | editor. Intellectual property of Sidedoor Digital. */
'use strict';
/* ============================== THE EDITOR ==============================
   Full-screen, mouse-driven, used for both cells and creatures.
   Drag vertebrae to reshape the spine, drag an end outwards to grow it, scroll to fatten or thin,
   click a part then click the body to attach it (mirrored automatically), drag parts to move them,
   scroll on a part to resize it, right-click a part or vertebra to remove it. Paint and test-drive tabs. */
const Editor = {
  active: false,
  open(p, kind, opts = {}) {
    const P = G.players[p]; this.p = p; this.P = P; this.kind = kind; this.opts = opts; this.active = true; G.paused = true;
    this.body = JSON.parse(JSON.stringify(kind === 'cell' ? P.cell : P.body)); this.orig = JSON.parse(JSON.stringify(this.body));
    this.wallet = opts.dna ?? 0; this.wallet0 = this.wallet; this.undo = []; this.tab = 'build'; this.cat = PART_CATS[kind][0][0];
    this.carry = null; this.drag = null; this.hover = null; this.selPart = -1; this.dirty = 2; this.lastBake = 0; this.t = 0; this.anim = null; this.test = false;
    this.yaw = kind === 'cell' ? 0 : -.35; this.pitch = kind === 'cell' ? 1.05 : .22; this.dist = kind === 'cell' ? 3.5 : 4;
    this.buildScene(); this.buildUI(); this.rebake(true);
    for (const m of Menus) m.close();
    Sfx.good(p);
  },
  close(save) {
    if (!this.active) return;
    if (save) { if (this.kind === 'cell') this.P.cell = this.body; else this.P.body = this.body; }
    else this.wallet = this.wallet0;
    const cb = this.opts.onDone, wallet = this.wallet; this.active = false; G.paused = false;
    if (this.cr) this.cr.dispose(); disposeScene(this.scene); this.scene = null; this.cr = null;
    this.ui.remove(); this.ui = null; for (const c of cams) if (c.view && c.view.enabled) c.clearViewOffset();
    if (cb) cb(save, wallet);
  },
  /* ---------- scene ---------- */
  buildScene() {
    const sc = this.scene = new THREE.Scene(), cell = this.kind === 'cell';
    sc.background = new THREE.Color(cell ? 0x0b2a4a : 0x2a2350); sc.fog = new THREE.Fog(cell ? 0x0b2a4a : 0x2a2350, 12, 40);
    sc.add(new THREE.HemisphereLight(cell ? 0x9fe0ff : 0xffe8d0, cell ? 0x0a1830 : 0x2a2040, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 8, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const c = key.shadow.camera; c.left = -6; c.right = 6; c.top = 6; c.bottom = -6; sc.add(key);
    const rim = new THREE.DirectionalLight(cell ? 0x5ce1e6 : 0xb48cff, 1.2); rim.position.set(-6, 3, -6); sc.add(rim);
    if (cell) {
      const n = 600, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p[i * 3] = rand(-15, 15); p[i * 3 + 1] = rand(-6, 3); p[i * 3 + 2] = rand(-15, 15); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); sc.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfe6ff, size: .06, transparent: true, opacity: .6 })));
      const dish = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64), litMat({ color: 0x14406a, roughness: .6, transparent: true, opacity: .65 })); dish.rotation.x = -Math.PI / 2; dish.position.y = -.7; dish.receiveShadow = true; sc.add(dish);
    } else {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.9, .4, 64), litMat({ color: 0x4a3f7a, roughness: .7 })); ped.position.y = -.2; ped.receiveShadow = true; sc.add(ped);
      const top = new THREE.Mesh(new THREE.CircleGeometry(3.5, 64), litMat({ color: 0x6b5fa8, roughness: .85 })); top.rotation.x = -Math.PI / 2; top.position.y = .005; top.receiveShadow = true; sc.add(top);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.55, .04, 8, 96), new THREE.MeshBasicMaterial({ color: 0xf2b544 })); ring.rotation.x = Math.PI / 2; ring.position.y = .01; sc.add(ring);
    }
    this.handleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, depthTest: false });
    this.handleHot = new THREE.MeshBasicMaterial({ color: 0xf2b544, transparent: true, opacity: .9, depthTest: false });
    this.handles = new THREE.Group(); this.handles.renderOrder = 10; sc.add(this.handles);
    this.marks = new THREE.Group(); sc.add(this.marks);
    this.ray = new THREE.Raycaster(); this.cam = cams[0];
  },
  rebake(full) {
    const res = full ? undefined : (this.kind === 'cell' ? .07 : .085);
    let B; try { B = bakeBody(this.body, { res, center: false, exact: true }); } catch (e) { console.error(e); toastP(this.p, 'That shape could not be built. Undoing.', 'bad'); this.doUndo(); return; }
    if (this.cr) { this.cr.dispose(); this.B.geometry.dispose(); this.B.pick.dispose(); }
    this.B = B; this.cr = new Creature(B, 1); this.scene.add(this.cr.group);
    this.pickMesh = new THREE.Mesh(B.pick); this.pickMesh.position.y = this.dragDy !== undefined ? this.dragDy - B.dy : 0; this.pickMesh.updateMatrixWorld(true);
    this.cr.group.position.y = this.pickMesh.position.y;
    this.syncHandles(); this.dirty = 0; this.lastBake = performance.now(); this.fullBaked = !!full; this.refreshPanels();
  },
  syncHandles() {
    while (this.handles.children.length) this.handles.remove(this.handles.children[0]);
    const g = sharedGeo('hsph', () => new THREE.SphereGeometry(1, 12, 8)), oy = this.pickMesh ? this.pickMesh.position.y : 0;
    this.B.sp.forEach((v, i) => { const m = new THREE.Mesh(g, this.hover && this.hover.kind === 'spine' && this.hover.i === i || (this.drag && this.drag.kind === 'spine' && this.drag.i === i) ? this.handleHot : this.handleMat); m.position.set(v.x, v.y + oy, v.z); m.scale.setScalar(.045 + v.r * .07); m.renderOrder = 10; m.userData.i = i; m.visible = this.tab === 'build' && !this.carry; this.handles.add(m); });
  },
  /* ---------- UI ---------- */
  buildUI() {
    const P = this.P, cell = this.kind === 'cell', ui = this.ui = document.createElement('div'); ui.id = 'editor';
    ui.innerHTML = `
      <div class="ed-top"><div class="ed-who"><i style="background:${hueCss(P.hue)}"></i><span>${G.mode === 2 ? 'P' + (this.p + 1) + ' · ' : ''}${esc(P.name)}</span><b>${cell ? 'Cell editor' : 'Creature editor'}</b></div>
        <div class="ed-tabs"><button data-tab="build" class="on">Build</button><button data-tab="paint">Paint</button><button data-tab="test">Test drive</button></div>
        <div class="ed-dna"><span>DNA</span><b id="ed-dna">0</b></div><div class="ed-cx"><span>Complexity</span><div class="bar"><i id="ed-cx"></i></div></div>
        <div class="ed-btns"><button data-act="undo" title="Undo (Ctrl+Z)">Undo</button><button data-act="cancel">Cancel</button><button data-act="done" class="primary">Done</button></div></div>
      <div class="ed-left" id="ed-left"></div>
      <div class="ed-right" id="ed-right"></div>
      <div class="ed-hint" id="ed-hint"></div>
      <div class="ed-tip" id="ed-tip" hidden></div>`;
    $('#app').appendChild(ui);
    ui.querySelector('.ed-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; this.setTab(b.dataset.tab); });
    ui.querySelector('.ed-btns').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; if (b.dataset.act === 'undo') this.doUndo(); else if (b.dataset.act === 'cancel') this.close(false); else this.finish(); });
    const left = ui.querySelector('#ed-left');
    left.addEventListener('pointerdown', e => {
      const t = e.target.closest('[data-part]'); if (t) { e.preventDefault(); const id = t.dataset.part, d = PARTS[id]; if (this.isLocked(id)) { toastP(this.p, 'Locked. Dig up bone piles in the creature stage to unlock it.', 'warn'); return; } if (this.wallet < d.cost) { toastP(this.p, `Not enough DNA (needs ${d.cost}).`, 'bad'); Sfx.bad(); return; } if (this.partCount() >= MAX_PARTS[this.kind]) { toastP(this.p, 'Too complex. Remove a part first.', 'bad'); return; } this.carry = { id }; this.carryFromDrag = true; this.syncHandles(); Sfx.click(); return; }
      const c = e.target.closest('[data-cat]'); if (c) { this.cat = c.dataset.cat; this.renderLeft(); return; }
      const sw = e.target.closest('[data-sw]'); if (sw) { this.pushUndo(); this.body.paint[sw.dataset.sw] = +sw.dataset.v; this.dirty = 2; this.renderLeft(); return; }
      const pt = e.target.closest('[data-pat]'); if (pt) { this.pushUndo(); this.body.paint.pattern = pt.dataset.pat; this.dirty = 2; this.renderLeft(); return; }
      const an = e.target.closest('[data-anim]'); if (an) { this.playAnim(an.dataset.anim); return; }
      const sh = e.target.closest('[data-shape]'); if (sh) { this.shapeAction(sh.dataset.shape); return; }
    });
    left.addEventListener('input', e => { if (e.target.id === 'ed-light') { this.body.paint.l1 = +e.target.value; this.dirty = 2; } });
    const cv = $('#gl');
    this.onDown = e => this.mouseDown(e); this.onMove = e => this.mouseMove(e); this.onUp = e => this.mouseUp(e); this.onWheel = e => this.wheel(e); this.onKey = e => this.key(e); this.onCtx = e => e.preventDefault();
    cv.addEventListener('pointerdown', this.onDown); window.addEventListener('pointermove', this.onMove); window.addEventListener('pointerup', this.onUp); cv.addEventListener('wheel', this.onWheel, { passive: false }); window.addEventListener('keydown', this.onKey, true); cv.addEventListener('contextmenu', this.onCtx);
    const cleanup = () => { cv.removeEventListener('pointerdown', this.onDown); window.removeEventListener('pointermove', this.onMove); window.removeEventListener('pointerup', this.onUp); cv.removeEventListener('wheel', this.onWheel); window.removeEventListener('keydown', this.onKey, true); cv.removeEventListener('contextmenu', this.onCtx); };
    const rm = ui.remove.bind(ui); ui.remove = () => { cleanup(); rm(); };
    this.renderLeft();
  },
  setTab(t) { this.tab = t; this.carry = null; this.test = t === 'test'; this.ui.querySelectorAll('.ed-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); if (!this.test && this.cr) { this.cr.st = {}; } this.renderLeft(); this.syncHandles(); },
  isLocked(id) { const d = PARTS[id]; return d.lock && !this.P.unlocked.includes(id); },
  partCount() { return this.body.parts.length; },
  thumb(id) { THUMBS.ensure(); return THUMBS.get(id); },
  renderLeft() {
    const L = this.ui.querySelector('#ed-left'), cell = this.kind === 'cell';
    if (this.tab === 'build') {
      const cats = PART_CATS[this.kind];
      L.innerHTML = `<div class="ed-cats">${cats.map(([k, n]) => `<button data-cat="${k}" class="${k === this.cat ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="ed-grid">${Object.values(PARTS).filter(d => d.cat === this.cat).map(d => { const lk = this.isLocked(d.id); return `<div class="ed-part${lk ? ' locked' : ''}${this.wallet < d.cost ? ' poor' : ''}" data-part="${d.id}"><img src="${this.thumb(d.id)}" alt=""><b>${esc(d.name)}</b><span>${lk ? 'Locked' : d.cost + ' DNA'}</span><em>${Object.entries(d.stats).map(([k, v]) => `${(cell ? CELL_ABIL : ABIL)[k] || k} ${v}`).join(' · ') || (d.diet ? DIET_WORD[d.diet] || '' : '')}${d.diet && Object.keys(d.stats).length ? ' · ' + (DIET_WORD[d.diet] || '') : ''}</em></div>`; }).join('')}</div>
        <div class="ed-shape"><button data-shape="grow">Add vertebra</button><button data-shape="shrink">Remove vertebra</button><button data-shape="fatter">Fatter</button><button data-shape="thinner">Thinner</button></div>`;
    } else if (this.tab === 'paint') {
      const p = this.body.paint, sw = key => Array.from({ length: 18 }, (_, i) => i * 20).map(h => `<i data-sw="${key}" data-v="${h}" class="${p[key] === h ? 'on' : ''}" style="background:${hueCss(h, key === 'h3' ? 55 : 65, key === 'h3' ? 62 : 50)}"></i>`).join('');
      L.innerHTML = `<div class="ed-paint"><h4>Base colour</h4><div class="sw">${sw('h1')}</div><label class="ed-l" for="ed-light">Shade</label><input id="ed-light" type="range" min=".25" max=".75" step=".05" value="${p.l1 ?? .5}">
        <h4>Pattern colour</h4><div class="sw">${sw('h2')}</div><h4>Detail colour</h4><div class="sw">${sw('h3')}</div>
        <h4>Pattern</h4><div class="pats">${PATTERNS.map(n => `<button data-pat="${n}" class="${p.pattern === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>`;
    } else {
      const acts = cell ? [['bite', 'Bite']] : [['bite', 'Bite'], ['strike', 'Strike'], ['sing', 'Sing'], ['dance', 'Dance'], ['charm', 'Charm'], ['pose', 'Pose'], ['sleep', 'Sleep']];
      L.innerHTML = `<div class="ed-paint"><h4>Test drive</h4><p>Your ${cell ? 'cell' : 'creature'} roams the ${cell ? 'dish' : 'stage'}. Try its moves.</p><div class="pats">${acts.map(([k, n]) => `<button data-anim="${k}">${n}</button>`).join('')}</div></div>`;
    }
    this.refreshPanels();
  },
  refreshPanels() {
    if (!this.ui) return; const cell = this.kind === 'cell', ab = abilities(this.body), names = cell ? CELL_ABIL : ABIL;
    this.ui.querySelector('#ed-dna').textContent = Math.floor(this.wallet);
    this.ui.querySelector('#ed-cx').style.width = clamp(this.partCount() / MAX_PARTS[this.kind] * 100, 0, 100) + '%';
    this.ui.querySelector('#ed-right').innerHTML = `<h4>Abilities</h4>${Object.entries(names).map(([k, n]) => `<div class="ab-row${ab.A[k] ? '' : ' zero'}"><span>${n}</span><div class="pips">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= ab.A[k] ? 'on' : ''}"></i>`).join('')}</div></div>`).join('')}
      <div class="ab-meta"><span>Diet</span><b>${ab.diet === 'none' ? 'no mouth!' : DIET_WORD[ab.diet]}</b></div>${cell ? '' : `<div class="ab-meta"><span>Legs</span><b>${this.B ? this.B.limbs.filter(l => l.kind === 'leg' && l.reach).length : 0} touching ground</b></div>`}
      ${ab.mouths === 0 ? '<p class="warn">Add a mouth or you cannot eat.</p>' : ''}${!cell && this.B && !this.B.limbs.some(l => l.kind === 'leg' && l.reach) ? '<p class="warn">No legs reach the ground: it will slither slowly.</p>' : ''}`;
    const hint = this.carry ? `Click the body to attach the ${PARTS[this.carry.id].name.toLowerCase()}. Off-centre parts are mirrored. Right-click or Esc to drop it.` :
      this.tab === 'build' ? 'Drag the white dots to reshape the spine. Pull an end outwards to grow it. Scroll on the body to fatten it. Drag parts to move them, scroll on a part to resize (Shift+scroll for limb length), right-click to remove. Right-drag to turn the view.' :
      this.tab === 'paint' ? 'Pick colours and a pattern. Right-drag to turn the view.' : 'Watch your creature move. Right-drag to turn the view.';
    this.ui.querySelector('#ed-hint').textContent = hint;
  },
  finish() {
    const ab = abilities(this.body);
    if (ab.mouths === 0) { toastP(this.p, 'Your creature needs a mouth.', 'bad'); Sfx.bad(); return; }
    if (this.kind === 'creature' && !this.body.parts.some(pl => PARTS[pl.id] && PARTS[pl.id].cat === 'leg') && !this.confirmNoLegs) { this.confirmNoLegs = true; toastP(this.p, 'No legs: it will slither slowly. Press Done again to keep it.', 'warn'); return; }
    this.close(true);
  },
  /* ---------- undo ---------- */
  pushUndo() { this.undo.push(JSON.stringify({ b: this.body, w: this.wallet })); if (this.undo.length > 60) this.undo.shift(); },
  doUndo() { const s = this.undo.pop(); if (!s) return; const o = JSON.parse(s); this.body = o.b; this.wallet = o.w; this.selPart = -1; this.dirty = 2; this.renderLeft(); Sfx.click(); },
  /* ---------- spine edits ---------- */
  limits() { return this.kind === 'cell' ? { min: 2, max: 6, rmin: .22, rmax: .95, smin: .2, smax: .7 } : { min: 3, max: 12, rmin: .08, rmax: .8, smin: .16, smax: .7 }; },
  insertVertebra(at) { // insert between at-1 and at, shifting part anchors
    const sp = this.body.spine, a = sp[at - 1], b = sp[at]; sp.splice(at, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, r: (a.r + b.r) / 2 });
    for (const pl of this.body.parts) { if (pl.s >= at) pl.s += 1; else if (pl.s > at - 1) pl.s = at - 1 + (pl.s - (at - 1)) * 2; }
  },
  removeVertebra(i) {
    const sp = this.body.spine, L = this.limits(); if (sp.length <= L.min) { toastP(this.p, 'The spine cannot get any shorter.', 'warn'); return false; }
    sp.splice(i, 1); for (const pl of this.body.parts) { if (pl.s > i) pl.s = Math.max(0, pl.s - 1); pl.s = clamp(pl.s, 0, sp.length - 1); } return true;
  },
  shapeAction(a) {
    const sp = this.body.spine, L = this.limits(); this.pushUndo();
    if (a === 'grow') { if (sp.length >= L.max) { toastP(this.p, 'The spine is as long as it can be.', 'warn'); return; } const n = sp.length, last = sp[n - 1], prev = sp[n - 2]; sp.push({ x: last.x + (last.x - prev.x), y: last.y + (last.y - prev.y), z: last.z + (last.z - prev.z), r: Math.max(L.rmin, last.r * .8) }); }
    else if (a === 'shrink') this.removeVertebra(sp.length - 1);
    else for (const v of sp) v.r = clamp(v.r * (a === 'fatter' ? 1.1 : .9), L.rmin, L.rmax);
    this.dirty = 2;
  },
  constrain(i) {
    const sp = this.body.spine, L = this.limits();
    for (let j = i + 1; j < sp.length; j++) this.spacing(sp[j - 1], sp[j], L);
    for (let j = i - 1; j >= 0; j--) this.spacing(sp[j + 1], sp[j], L);
  },
  spacing(a, b, L) { const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1e-4, t = clamp(d, L.smin, L.smax); if (t !== d) { b.x = a.x + dx / d * t; b.y = a.y + dy / d * t; b.z = a.z + dz / d * t; } },
  /* ---------- mouse ---------- */
  ndc(e) { const r = $('#gl').getBoundingClientRect(); return new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); },
  rayAt(e) { this.ray.setFromCamera(this.ndc(e), this.cam); return this.ray; },
  hitBody(e) { if (!this.pickMesh) return null; const h = this.rayAt(e).intersectObject(this.pickMesh, false)[0]; if (!h) return null; const p = h.point.clone(); p.y -= this.pickMesh.position.y; return p; },
  hitHandle(e) { if (this.tab !== 'build') return null; const h = this.rayAt(e).intersectObjects(this.handles.children, false)[0]; return h ? h.object.userData.i : null; },
  hitPart(e) {
    if (this.tab !== 'build' || !this.B) return null; const r = $('#gl').getBoundingClientRect(); let best = null, bd = 22;
    for (const a of this.B.anchors) { if (!this.body.parts[a.i]) continue; const v = a.p.clone(); v.y += this.pickMesh.position.y; v.addScaledVector(a.n, .08); v.project(this.cam); if (v.z > 1) continue; const sx = (v.x + 1) / 2 * r.width + r.left, sy = (1 - v.y) / 2 * r.height + r.top, d = Math.hypot(sx - e.clientX, sy - e.clientY); if (d < bd) { bd = d; best = a; } }
    return best;
  },
  planeHit(e) { const n = this.kind === 'cell' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1), pl = new THREE.Plane(n, 0), o = new THREE.Vector3(); if (!this.rayAt(e).ray.intersectPlane(pl, o)) return null; return o; },
  anchorFromHit(p) { const sp = this.B.sp, s = nearestS(sp, p), c = spinePoint(sp, s), d = p.clone().sub(c); if (d.lengthSq() < 1e-6) d.set(0, 1, 0); d.normalize(); return { s, dx: +d.x.toFixed(3), dy: +d.y.toFixed(3), dz: Math.abs(d.z) < .12 ? 0 : +d.z.toFixed(3) }; },
  mouseDown(e) {
    if (!this.active) return; Sfx.init(); e.preventDefault(); this.downAt = { x: e.clientX, y: e.clientY };
    if (e.button === 2) {
      if (this.carry) { this.carry = null; this.dirty = 2; this.syncHandles(); this.refreshPanels(); return; }
      const a = this.hitPart(e); if (a) { this.removePart(a.i); return; }
      const hi = this.hitHandle(e); if (hi !== null) { this.pushUndo(); if (this.removeVertebra(hi)) this.dirty = 2; else this.undo.pop(); return; }
      this.drag = { kind: 'orbit', x: e.clientX, y: e.clientY }; return;
    }
    if (this.carry) { this.placeCarry(e); return; }
    if (this.tab === 'build') {
      const hi = this.hitHandle(e); if (hi !== null) { this.pushUndo(); this.drag = { kind: 'spine', i: hi }; this.dragDy = this.B.dy; return; }
      const a = this.hitPart(e); if (a) { this.pushUndo(); this.drag = { kind: 'part', i: a.i, mirror: a.mirror }; this.selPart = a.i; this.dragDy = this.B.dy; return; }
    }
    this.drag = { kind: 'orbit', x: e.clientX, y: e.clientY };
  },
  mouseMove(e) {
    if (!this.active) return; this.mouse = e;
    const d = this.drag;
    if (d && d.kind === 'orbit') { this.yaw -= (e.clientX - d.x) * .008; this.pitch = clamp(this.pitch + (e.clientY - d.y) * .006, -.2, 1.45); d.x = e.clientX; d.y = e.clientY; return; }
    if (d && d.kind === 'spine') {
      const h = this.planeHit(e); if (!h) return; const sp = this.body.spine, i = d.i, v = sp[i], L = this.limits();
      v.x = h.x; v.y = this.kind === 'cell' ? 0 : clamp(h.y - (this.dragDy ?? this.B.dy), -.3 - (this.dragDy ?? this.B.dy), 3.2); if (this.kind === 'cell') v.z = clamp(h.z, -2.5, 2.5); else v.z = 0;
      v.x = clamp(v.x, -3.2, 3.2);
      // pulling an end outwards grows the spine
      if ((i === 0 || i === sp.length - 1) && sp.length < L.max) { const nb = sp[i === 0 ? 1 : sp.length - 2], gap = Math.hypot(v.x - nb.x, v.y - nb.y, v.z - nb.z); if (gap > L.smax * .98) { this.insertVertebra(i === 0 ? 1 : sp.length - 1); if (i !== 0) d.i = sp.length - 1; Sfx.click(); } }
      this.constrain(d.i); this.dirty = Math.max(this.dirty, 1); return;
    }
    if (d && d.kind === 'part') { const h = this.hitBody(e); if (!h) return; const pl = this.body.parts[d.i], an = this.anchorFromHit(h); pl.s = an.s; pl.dx = an.dx; pl.dy = an.dy; pl.dz = d.mirror ? -an.dz : an.dz; if (d.mirror) pl.dz = -an.dz; this.dirty = Math.max(this.dirty, 1); return; }
    // hover
    const prev = this.hover; this.hover = null; const hi = this.hitHandle(e); if (hi !== null) this.hover = { kind: 'spine', i: hi }; else { const a = this.hitPart(e); if (a) this.hover = { kind: 'part', i: a.i }; }
    if ((prev && prev.i) !== (this.hover && this.hover.i) || (prev && prev.kind) !== (this.hover && this.hover.kind)) this.syncHandles();
    $('#gl').style.cursor = this.carry ? 'copy' : this.hover ? 'grab' : 'default';
    const tip = this.ui.querySelector('#ed-tip');
    if (this.hover && this.hover.kind === 'part' && this.body.parts[this.hover.i]) { const pl = this.body.parts[this.hover.i], dd = PARTS[pl.id]; tip.hidden = false; tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 10 + 'px'; tip.innerHTML = `<b>${esc(dd.name)}</b><span>size ${(pl.scale || 1).toFixed(1)}${LIMB_CATS.has(dd.cat) ? ` · length ${(pl.len || dd.len).toFixed(1)}` : ''}</span>`; } else tip.hidden = true;
    if (this.carry) { const h = this.hitBody(e); this.carry.at = h ? this.anchorFromHit(h) : null; this.dirty = Math.max(this.dirty, 1); }
  },
  mouseUp(e) {
    if (!this.active) return;
    if (this.carry && this.carryFromDrag && this.downAt === undefined) { /* palette drag released over canvas */ if (e.target === $('#gl')) this.placeCarry(e); }
    this.carryFromDrag = false; this.downAt = undefined;
    if (this.drag && (this.drag.kind === 'spine' || this.drag.kind === 'part')) { this.dragDy = undefined; this.dirty = 2; }
    this.drag = null;
  },
  placeCarry(e) {
    const h = this.hitBody(e); if (!h) { toastP(this.p, 'Drop parts onto the body.', 'warn'); return; }
    const d = PARTS[this.carry.id], an = this.anchorFromHit(h); if (this.wallet < d.cost) { this.carry = null; return; }
    this.pushUndo(); this.wallet -= d.cost;
    const pl = { id: d.id, s: an.s, dx: an.dx, dy: an.dy, dz: an.dz, scale: 1 }; if (LIMB_CATS.has(d.cat)) pl.len = d.len;
    this.body.parts.push(pl); this.selPart = this.body.parts.length - 1; this.carry = null; this.dirty = 2; Sfx.good(); this.renderLeft(); this.syncHandles();
  },
  removePart(i) { const pl = this.body.parts[i]; if (!pl) return; this.pushUndo(); this.wallet += PARTS[pl.id] ? PARTS[pl.id].cost : 0; this.body.parts.splice(i, 1); this.selPart = -1; this.dirty = 2; Sfx.click(); this.renderLeft(); },
  wheel(e) {
    if (!this.active) return; e.preventDefault(); const dir = e.deltaY < 0 ? 1 : -1;
    if (this.tab === 'build') {
      const a = this.hitPart(e);
      if (a) { const pl = this.body.parts[a.i], d = PARTS[pl.id]; this.pushUndo(); if (e.shiftKey && LIMB_CATS.has(d.cat)) pl.len = clamp((pl.len || d.len) + dir * .1, .4, 2.6); else pl.scale = clamp((pl.scale || 1) + dir * .1, .4, 2.2); this.dirty = Math.max(this.dirty, 1); clearTimeout(this.wt); this.wt = setTimeout(() => this.dirty = 2, 250); return; }
      const hi = this.hitHandle(e); const hb = hi === null ? this.hitBody(e) : null;
      if (hi !== null || hb) { const i = hi !== null ? hi : Math.round(nearestS(this.B.sp, hb)), v = this.body.spine[i], L = this.limits(); this.pushUndo(); v.r = clamp(v.r + dir * .025, L.rmin, L.rmax); this.dirty = Math.max(this.dirty, 1); clearTimeout(this.wt); this.wt = setTimeout(() => this.dirty = 2, 250); return; }
    }
    this.dist = clamp(this.dist * (dir > 0 ? .92 : 1.08), 2.5, 16); this.autoDist = 0;
  },
  key(e) {
    if (!this.active) return; if (e.target && (e.target.tagName === 'INPUT')) return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); e.stopPropagation(); this.doUndo(); return; }
    if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); if (this.carry) { this.carry = null; this.dirty = 2; this.syncHandles(); } else this.finish(); return; }
    if ((e.code === 'Delete' || e.code === 'Backspace') && this.selPart >= 0) { e.preventDefault(); e.stopPropagation(); this.removePart(this.selPart); return; }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { this.yaw += .15; e.stopPropagation(); e.preventDefault(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { this.yaw -= .15; e.stopPropagation(); e.preventDefault(); }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { this.pitch = clamp(this.pitch + .1, -.2, 1.45); e.stopPropagation(); e.preventDefault(); }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { this.pitch = clamp(this.pitch - .1, -.2, 1.45); e.stopPropagation(); e.preventDefault(); }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); e.stopPropagation(); this.finish(); }
    e.stopPropagation();
  },
  playAnim(k) { this.anim = { k, t: 1.6 }; Sfx.note(rint(0, 6)); },
  /* ---------- per frame ---------- */
  update(dt) {
    if (!this.active) return; this.t += dt;
    // live preview of a part being carried
    if (this.dirty) {
      const now = performance.now(), full = this.dirty === 2 && !this.drag;
      if (full || now - this.lastBake > 70) {
        if (this.carry && this.carry.at) { const d = PARTS[this.carry.id]; this.body.parts.push({ id: d.id, ...this.carry.at, scale: 1, len: LIMB_CATS.has(d.cat) ? d.len : undefined, _ghost: true }); this.rebake(false); this.body.parts.pop(); }
        else this.rebake(full);
      }
    }
    const cr = this.cr; if (!cr) return;
    const st = cr.st; for (const k in st) delete st[k];
    if (this.anim) { this.anim.t -= dt; st[this.anim.k] = this.anim.k === 'bite' || this.anim.k === 'strike' ? (Math.sin(this.anim.t * 9) > 0 ? 1 : 0) : true; if (this.anim.t <= 0) this.anim = null; }
    if (this.test) { const R = this.kind === 'cell' ? 2 : 2.2, a = this.t * .5; cr.update(dt, Math.cos(a) * R, Math.sin(a) * R, a + Math.PI / 2, () => 0); }
    else cr.update(dt, 0, 0, 0, () => 0);
    const oy = this.pickMesh ? this.pickMesh.position.y : 0; cr.group.position.y = this.test ? 0 : oy;
    // camera orbit around the body
    const h = this.kind === 'cell' ? 0 : Math.max(.6, this.B.height * .5), tgt = new THREE.Vector3(0, h, 0), fit = Math.max(this.B.len, this.B.height) * (this.kind === 'cell' ? 1.6 : 1.5); if (!this.drag) this.autoDist = lerp(this.autoDist || fit, fit, Math.min(1, dt * 2)); const dist = Math.max(this.dist, this.autoDist || 0);
    const cp = Math.cos(this.pitch); this.cam.position.set(Math.sin(this.yaw) * cp * dist, h + Math.sin(this.pitch) * dist, Math.cos(this.yaw) * cp * dist); this.cam.lookAt(tgt);
  },
  render() {
    if (!this.active || !this.scene) return;
    renderer.shadowMap.needsUpdate = true; const cam = this.cam; if (cam.view && cam.view.enabled) cam.clearViewOffset();
    const L = 270, R = 210, w = Math.max(200, W - (W > 900 ? L + R : 0)), x = W > 900 ? L : 0;
    cam.aspect = w / H; cam.fov = 45; cam.updateProjectionMatrix();
    renderer.setViewport(0, 0, W, H); renderer.setScissor(0, 0, W, H); renderer.setClearColor(this.scene.background); renderer.clear(); renderer.setViewport(x, 0, w, H); renderer.setScissor(x, 0, w, H);
    if (!Q.b.post) { renderer.setClearColor(this.scene.background && this.scene.background.isColor ? this.scene.background : 0x000000, 1); renderer.render(this.scene, cam); } else Post.draw(this.scene, cam, { x, y: 0, w, h: H }, { bloom: .35, vig: .2 });
  },
};
/* part thumbnails rendered once with the main renderer */
const THUMBS = {
  map: new Map(), done: false,
  ensure() {
    if (this.done || !renderer) return; this.done = true;
    const S2 = 96, rt = new THREE.WebGLRenderTarget(S2, S2, { colorSpace: THREE.SRGBColorSpace }), sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1, .05, 50), px = new Uint8Array(S2 * S2 * 4), cv = document.createElement('canvas'); cv.width = cv.height = S2; const g2 = cv.getContext('2d');
    sc.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(2, 3, 4); sc.add(dl);
    const paint = { h1: 30, h2: 200, h3: 50, l1: .55, pattern: 'none' };
    const prevTarget = renderer.getRenderTarget(), prevVp = new THREE.Vector4(); renderer.getViewport(prevVp);
    renderer.setScissorTest(false);
    for (const d of Object.values(PARTS)) {
      let geo;
      if (LIMB_CATS.has(d.cat)) { const B = bakeBody({ kind: 'creature', spine: [{ x: .02, y: 0, z: 0, r: .08 }, { x: -.02, y: 0, z: 0, r: .08 }], parts: [{ id: d.id, s: 0, dx: 0, dy: -1, dz: 0, scale: 1, len: d.len }], paint }, { res: .04, center: false }); geo = B.geometry; }
      else { const gb = new GeoBuilder(); for (const piece of partPieces(d.id)) gb.addGeo(prim(piece.g), piece.m, paintColor(piece.col, paint), piece.mat, 0, 0, 0); geo = gb.build(); }
      const m = new THREE.Mesh(geo, [BODY_MATS[0], BODY_MATS[1], new THREE.MeshBasicMaterial({ vertexColors: true })]); sc.add(m);
      geo.computeBoundingBox(); const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()).length() || 1;
      cam.position.set(c.x + sz * 1.1, c.y + sz * .7, c.z + sz * 1.4); cam.lookAt(c);
      renderer.setRenderTarget(rt); renderer.setViewport(0, 0, S2, S2); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, S2, S2, px); const img = g2.createImageData(S2, S2);
      for (let y = 0; y < S2; y++) img.data.set(px.subarray((S2 - 1 - y) * S2 * 4, (S2 - y) * S2 * 4), y * S2 * 4);
      g2.putImageData(img, 0, 0); this.map.set(d.id, cv.toDataURL()); sc.remove(m); geo.dispose();
    }
    renderer.setRenderTarget(prevTarget); renderer.setViewport(prevVp); renderer.setScissorTest(true); renderer.setClearColor(0x000000, 1); rt.dispose();
  },
  get(id) { return this.map.get(id) || ''; },
};
