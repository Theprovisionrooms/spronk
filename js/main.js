/* Lineage | main. Intellectual property of Sidedoor Digital. */
'use strict';
/* ============================== TITLE, PAUSE, ENDING, LOOP ============================== */
const STAGES = [CellStage, CreatureStage, TribeStage, CivStage, SpaceStage];
function startStage(i) { G.stage = i; setStage(STAGES[i]); }

const TitleStage = {
  enter() {
    const sc = this.scene = new THREE.Scene(); sc.background = new THREE.Color(0x07243f); sc.fog = new THREE.FogExp2(0x0a2e50, .016);
    sc.add(new THREE.HemisphereLight(0xaee8ff, 0x0b1a2e, 1.7)); const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(10, 30, 10); sc.add(d);
    const r = mulberry32(Date.now() & 0xffff); this.cells = [];
    const kinds = ['grazer', 'hunter', 'schooler', 'drifter'], bodies = kinds.map(k => bakeBody(genCell(r, k), { res: .08 }));
    for (let i = 0; i < 22; i++) { const B = bodies[i % 4], cr = new Creature(B, rand(1, 2.8), { shadow: false }); sc.add(cr.group); this.cells.push({ cr, x: rand(-55, 55), z: rand(-35, 35), y: rand(-12, 2), a: rand(0, TAU), sp: rand(1.5, 4) }); }
    const n = 1500, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p[i * 3] = rand(-90, 90); p[i * 3 + 1] = rand(-20, 20); p[i * 3 + 2] = rand(-60, 60); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); sc.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfe6ff, size: .4, map: dotTexture(), transparent: true, opacity: .6, depthWrite: false })));
    this.t = 0;
  },
  update(dt) { this.t += dt; for (const k of this.cells) { k.a += Math.sin(this.t * .3 + k.x) * dt * .4; k.x += Math.cos(k.a) * k.sp * dt; k.z += Math.sin(k.a) * k.sp * dt; if (Math.abs(k.x) > 65) k.a = Math.PI - k.a; if (Math.abs(k.z) > 42) k.a = -k.a; k.cr.update(dt, k.x, k.z, k.a, () => k.y); } },
  camFor(i, cam) { cam.position.set(Math.sin(this.t * .05) * 8, 36, 28); cam.lookAt(0, -4, 0); },
  exit() { for (const k of this.cells) k.cr.dispose(); },
};
function openTitle() {
  G.mode = 1; setupPanes(); setStage(TitleStage); $('#stagebar').hidden = true; $('#accord').hidden = true;
  const save = loadSave(), names = [makeName(), makeName()]; let hues = [180, 30], mode = 2;
  const html = () => `<div class="eyebrow">An evolution game · cell to galaxy · one keyboard, two rival species</div>
    <div class="wordmark">Line<em>age</em></div>
    <p>Two species start in the same tide pool. Mould your creature in the editor, befriend or hunt the wildlife, raise a tribe, unite a planet and reach the heart of the galaxy. Every stage leaves a legacy that stays with you. Fight your rival, or sign an accord and prosper together.</p>
    <div class="row" style="margin-top:10px"><div class="seg"><button data-act="mode" data-arg="2" class="${mode === 2 ? 'on' : ''}">Two players · split screen</button><button data-act="mode" data-arg="1" class="${mode === 1 ? 'on' : ''}">One player</button></div></div>
    <div class="players">${[0, 1].slice(0, mode).map(p => `<div class="pcard"><h4><i style="background:${hueCss(hues[p])}"></i>${mode === 2 ? 'Player ' + (p + 1) : 'Your species'}</h4>
      <div class="field"><label for="n${p}">Species name</label><input type="text" id="n${p}" maxlength="14" value="${esc(names[p])}" autocomplete="off"></div>
      <div class="field"><label for="h${p}">Colour</label><input type="range" id="h${p}" min="0" max="350" step="10" value="${hues[p]}"></div>
      <div class="keys">${mode === 2 ? (p === 0 ? '<kbd>Arrows</kbd><span>Move</span><kbd>/ . ; \'</kbd><span>Moves 1 to 4</span><kbd>Enter</kbd><span>Interact, nest, editor</span><kbd>Right Shift</kbd><span>Switch moves, back</span>' : '<kbd>WASD</kbd><span>Move</span><kbd>F G R T</kbd><span>Moves 1 to 4</span><kbd>E</kbd><span>Interact, nest, editor</span><kbd>Q</kbd><span>Switch moves, back</span>') :
      '<kbd>Arrows or WASD</kbd><span>Move</span><kbd>/ . ; \' or F G R T</kbd><span>Moves 1 to 4</span><kbd>Enter or E</kbd><span>Interact, nest, editor</span><kbd>Shift or Q</kbd><span>Switch moves, back</span>'}<kbd>Mouse</kbd><span>The editor</span><kbd>Esc</kbd><span>Pause</span></div></div>`).join('')}</div>
    <p style="font-size:12.5px">Game controllers work too: two controllers play as P1 and P2.</p>
    <div class="row"><button class="btn primary" data-act="new">Begin as single cells</button>${save ? `<button class="btn" data-act="cont">Continue · ${STAGE_NAMES[save.stage] || 'Cell'} stage · ${save.players.map(p => esc(p.name)).join(' vs ')}</button>` : ''}</div>
    <div class="promise"><div><b>Mould anything</b>Drag the spine, fatten it, and snap on mouths, eyes, legs, arms, horns, wings and more. Parts decide your abilities.</div><div><b>A living world</b>Herds, hunters, night stalkers and gentle giants, all built from the same parts, living their own lives.</div><div><b>Dying is fine</b>You always hatch again at your nest and carry on.</div><div><b>Worth the journey</b>Every world hides wonders on the horizon. Evolve when you are ready, not when a clock says so.</div><div><b>Rivals or allies</b>Compete with your rival, raid them, or sign an accord for Shared Prosperity.</div></div>
    <details><summary>Start at a later stage</summary><div class="row">${STAGE_NAMES.map((n, i) => `<button class="btn" data-act="skip" data-arg="${i}">${i + 1}. ${n}</button>`).join('')}</div><p style="font-size:12px">Skipped stages count as Adaptive legacies with a starter body.</p></details>`;
  const grab = () => { for (let p = 0; p < mode; p++) { const n = $('#n' + p), h = $('#h' + p); if (n) names[p] = (n.value || '').trim().replace(/[^\p{L}\p{N} '\-]/gu, '').slice(0, 14) || makeName(); if (h) hues[p] = +h.value; } };
  const begin = (skip = 0) => {
    grab(); G.mode = mode; G.seed = (Math.random() * 1e9) | 0; G.accord = false; G.accordStages = 0; G.stage = skip;
    G.players = names.slice(0, mode).map((n, p) => newPlayer(p, n, hues[p]));
    for (const P of G.players) { P.cell = starterCell(P); P.dna = 0; if (skip > 0) { P.diet = 'omni'; P.body = starterCreature(P); for (let i = 0; i < skip; i++) addLegacy(P, i, 'mixed'); } }
    Modal.close(); setupPanes(); startStage(skip);
  };
  Modal.open(html(), {
    mode: v => { grab(); mode = +v; Modal.rerender(html()); }, new: () => begin(0), skip: v => begin(+v),
    cont: () => { G.mode = save.mode; G.stage = save.stage; G.accord = save.accord; G.accordStages = save.accordStages || 0; G.seed = save.seed || 1; G.players = save.players; for (const P of G.players) { recalcMods(P); P.unlocked = P.unlocked || []; P.journal = P.journal || []; } Modal.close(); setupPanes(); startStage(G.stage); },
  }, { noPause: true, onOpen: sh => { for (let p = 0; p < 2; p++) { const h = sh.querySelector('#h' + p); if (h) h.addEventListener('input', () => { hues[p] = +h.value; h.closest('.pcard').querySelector('h4 i').style.background = hueCss(hues[p]); }); } } });
}
function onEscape() {
  if (Editor.active) return;
  if (Modal.isOpen) { if (Modal.opts.closable) Modal.close(); return; }
  for (const m of Menus) if (m.isOpen) { m.close(); return; }
  openPause();
}
function openPause() {
  if (!S || S === TitleStage || Editor.active) return;
  const html = () => `<div class="eyebrow">Paused · ${STAGE_NAMES[G.stage]} stage</div><h2>${G.players.map(p => esc(p.name)).join(' vs ')}</h2>
    <p>Progress saves at the start of each stage.</p>
    <div class="results">${G.players.map((P, p) => `<div><div class="eyebrow">${G.mode === 2 ? 'P' + (p + 1) + ' · ' : ''}${esc(P.name)} · lineage</div>${P.legacies.length ? P.legacies.map(legacyCard).join('<div style="height:6px"></div>') : '<p>No legacies yet.</p>'}${modsHTML(P)}<div class="eyebrow" style="margin-top:12px">Journal</div>${Disc.journalHTML(P)}</div>`).join('')}</div>
    <div class="row"><button class="btn primary" data-act="resume">Resume <kbd>Esc</kbd></button><button class="btn" data-act="gfx">Graphics: ${Q.pref === 'auto' ? `Auto (${Q.b.name})` : Q.b.name}</button>${G.mode === 2 ? `<button class="btn" data-act="pad">One controller plays as: P${(Input.padOwner >= 0 ? Input.padOwner : 1) + 1}</button>` : ''}<button class="btn" data-act="restart">Restart this stage</button><button class="btn" data-act="quit">Quit to title</button></div>`;
  Modal.open(html(), {
    resume: () => Modal.close(), restart: () => { Modal.close(); startStage(G.stage); }, quit: () => { Modal.close(); openTitle(); },
    gfx: () => { const order = ['auto', 'low', 'medium', 'high'], nx = order[(order.indexOf(Q.pref) + 1) % order.length]; Q.pref = nx; Q.save(); Q.set(nx === 'auto' ? Q.auto : nx, true); Modal.rerender(html()); },
    pad: () => { Input.padOwner = (Input.padOwner >= 0 ? Input.padOwner : 1) === 1 ? 0 : 1; Modal.rerender(html()); },
  }, { closable: true });
}
$('#b-menu').addEventListener('click', () => { if (!Modal.isOpen) openPause(); });
$('#b-sound').addEventListener('click', e => { Sfx.init(); Sfx.on = !Sfx.on; e.currentTarget.textContent = Sfx.on ? 'Sound' : 'Muted'; });

function showEnding(kind, winner) {
  const titles = { core: winner >= 0 ? `${G.players[winner].name} reached the galactic core` : 'The galactic core', federation: 'A galaxy united', conquest: winner >= 0 ? `The galaxy belongs to the ${G.players[winner].name}` : 'Conquest', joint: 'Together at the heart of the galaxy' };
  const tone = P => { const a = styleCount(P, 'aggr'), s = styleCount(P, 'social'), m = styleCount(P, 'mixed'); return a > s && a >= m ? 'aggr' : s > a && s >= m ? 'social' : 'mixed'; };
  const epi = P => ({ aggr: `The ${P.name} never forgot the taste of the first hunt. Every step from cell to starship was taken by force.`, social: `The ${P.name} won by being listened to: a grazing cell, a singer, a culture, and finally a voice the galaxy followed.`, mixed: `The ${P.name} were never one thing. They ate what they found, befriended what they could, and fought what they couldn't.` })[tone(P)];
  const shared = G.mode === 2 ? `<p>${G.accordStages ? `The two species spent ${G.accordStages} of 5 stages in accord.` : 'The two species stayed rivals to the very end.'}</p>` : '';
  Modal.open(`<div class="eyebrow">The end${winner >= 0 && G.mode === 2 ? ` · P${winner + 1} wins` : ''}</div><h2>${esc(titles[kind] || 'The end')}</h2>${shared}
    <div class="results">${G.players.map((P, p) => `<div><div class="eyebrow">${G.mode === 2 ? 'P' + (p + 1) + ' · ' : ''}${esc(P.name)} · ${STYLE_WORD[tone(P)]} lineage</div><p>${esc(epi(P))}</p>${P.legacies.map(legacyCard).join('<div style="height:6px"></div>')}${modsHTML(P)}<div class="eyebrow" style="margin-top:12px">Wonders found on the way · ${(P.journal || []).length}</div>${Disc.journalHTML(P)}</div>`).join('')}</div>
    <div class="row"><button class="btn primary" data-act="again">Evolve new species</button><button class="btn" data-act="stay">Keep exploring</button></div>`, {
    again: () => { clearSave(); Modal.close(); openTitle(); }, stay: () => Modal.close(),
  });
}

/* ---------- loop ---------- */
let lastT = performance.now(), menuTick = 0, editing = false;
function frame(now) {
  const real = Math.max(0, (now - lastT) / 1000); lastT = now;
  /* slow machines get up to three fixed-size steps per frame so the game keeps real-time pace instead of slow motion */
  const steps = Math.min(3, Math.max(1, Math.ceil(real / .05 - .001))), dt = Math.min(.05, real / steps);
  try {
    Q.tick(real); /* resolution changes happen before drawing, so a resize never shows a blank frame */
    pollPads();
    if (Editor.active !== editing) { editing = Editor.active; $('#app').classList.toggle('editing', editing); if (!editing) resize(); }
    if (Editor.active) { Editor.update(dt); Editor.render(); }
    else if (S) {
      if (!G.paused) for (let k = 0; k < steps; k++) { gameClock += dt; S.update(dt); if (G.paused || Editor.active) break; }
      if (S.scene) { for (let i = 0; i < Panes.length; i++) if (S.camFor) S.camFor(i, cams[i], G.paused || S._snap > 0 ? 0 : dt * steps);  if (S._snap > 0) S._snap--; render(); for (let i = 0; i < Panes.length; i++) { Panes[i].beginLabels(); if (S.labels) safely(() => S.labels(i)); Panes[i].endLabels(); } }
    }
    menuTick -= real; if (menuTick <= 0) { menuTick = .25; for (const m of Menus) m.tick(); }
  } catch (e) { console.error(e); if (!frame.err || now - frame.err > 8000) { frame.err = now; toastAll('Something went wrong, but the game carried on: ' + e.message, 'bad'); } }
  requestAnimationFrame(frame);
}
function boot() {
  if (!window.THREE) { $('#loading').textContent = 'Could not load the 3D engine. Check your connection and reload.'; return; }
  setupPanes(); initRenderer(); $('#loading').hidden = true; openTitle(); requestAnimationFrame(frame);
}
boot();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(()=>{});
