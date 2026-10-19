/* Lineage | ui. Intellectual property of Sidedoor Digital. */
'use strict';

/* ============================== HUD PANES ============================== */
class Pane {
  constructor(i, cls) {
    this.i = i; const el = this.el = document.createElement('div'); el.className = 'pane ' + cls;
    el.innerHTML = `<div class="labels"></div><div class="card"></div><div class="bottom"><div class="chip" hidden></div><div class="prompt"></div><div class="acts"></div></div><div class="ptoasts"></div><div class="wait" hidden></div><div class="pmenu" hidden></div>`;
    this.labelsEl = el.querySelector('.labels'); this.cardEl = el.querySelector('.card'); this.promptEl = el.querySelector('.prompt'); this.actsEl = el.querySelector('.acts');
    this.toastsEl = el.querySelector('.ptoasts'); this.chipEl = el.querySelector('.chip'); this.waitEl = el.querySelector('.wait'); this.menuEl = el.querySelector('.pmenu');
    this.meters = {}; this.stats = {}; this.actKey = ''; this.lastPrompt = null; this.pool = []; this.used = 0;
    $('#panes').appendChild(el);
    this.actsEl.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) { Sfx.init(); dispatchPress(this.i, b.dataset.act); } });
  }
  build({ eyebrow, title, meters = [], stats = [] }) {
    const P = G.players[this.i];
    this.cardEl.innerHTML = `<div class="who"><i style="background:${hueCss(P.hue)}"></i>${G.mode === 2 ? `P${this.i + 1} · ` : ''}${esc(eyebrow)}</div><div class="title">${esc(title)}</div>` +
      meters.map(m => `<div class="meter" data-k="${m.id}"><div class="mlabel"><span>${esc(m.label)}</span><span class="mval"></span></div><div class="bar"><i style="background:${m.color}"></i></div></div>`).join('') +
      (stats.length ? `<dl class="stats">${stats.map(s => `<div data-s="${s.id}"><dt>${esc(s.label)}</dt><dd>–</dd></div>`).join('')}</dl>` : '');
    this.meters = {}; for (const m of meters) { const el = this.cardEl.querySelector(`[data-k="${m.id}"]`); this.meters[m.id] = { bar: el.querySelector('i'), val: el.querySelector('.mval'), last: '', w: '' }; }
    this.stats = {}; for (const s of stats) this.stats[s.id] = { el: this.cardEl.querySelector(`[data-s="${s.id}"] dd`), last: '' };
  }
  meter(id, v, max, txt) { const m = this.meters[id]; if (!m) return; const w = (clamp(v / max, 0, 1) * 100).toFixed(1) + '%'; if (w !== m.w) { m.bar.style.width = w; m.w = w; } const t = txt ?? `${Math.max(0, Math.round(v))}/${Math.round(max)}`; if (t !== m.last) { m.val.textContent = t; m.last = t; } }
  stat(id, v) { const s = this.stats[id]; if (!s) return; v = String(v); if (v !== s.last) { s.el.textContent = v; s.last = v; } }
  acts(list) {
    const key = list.map(a => a.act + a.label + (a.icon || '') + (a.off ? 0 : 1) + (a.hot ? 1 : 0) + (a.lv ?? '')).join('|');
    if (key !== this.actKey) {
      this.actKey = key; const L = KEYLABEL[this.i];
      this.actsEl.innerHTML = list.map(a => a.icon ? `<div class="ab${a.off ? ' off' : ''}${a.hot ? ' hot' : ''}" data-act="${a.act}" title="${esc(a.label)}"><div class="ring"><svg viewBox="0 0 24 24">${ICON[a.icon] || ''}</svg><i class="cd"></i>${a.lv ? `<b class="lv">${a.lv}</b>` : ''}</div><span>${esc(a.label)}</span><kbd>${esc(L[a.act] || a.act)}</kbd></div>`
        : `<div class="act${a.off ? ' off' : ''}${a.hot ? ' hot' : ''}" data-act="${a.act}"><kbd>${esc(L[a.act] || a.act)}</kbd>${esc(a.label)}</div>`).join('');
      this.cdEls = [...this.actsEl.children].map(c => c.querySelector('.cd'));
    }
    list.forEach((a, i) => { const el = this.cdEls && this.cdEls[i]; if (!el) return; const v = clamp(a.cd || 0, 0, 1), s = v > 0 ? `conic-gradient(rgba(8,6,20,.72) ${(v * 360).toFixed(0)}deg, transparent 0)` : 'none'; if (el._s !== s) { el.style.background = s; el._s = s; } });
  }
  chip(t, cls = '') { const k = t + '|' + cls; if (k === this._chip) return; this._chip = k; this.chipEl.hidden = !t; this.chipEl.textContent = t || ''; this.chipEl.className = 'chip ' + cls; }
  prompt(t) { if (t !== this.lastPrompt) { this.promptEl.textContent = t || ''; this.lastPrompt = t; } }
  toast(msg, kind = '') { const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; this.toastsEl.appendChild(t); while (this.toastsEl.children.length > 4) this.toastsEl.firstChild.remove(); setTimeout(() => t.remove(), 4800); }
  wait(on, title = '', sub = '') { this.waitEl.hidden = !on; if (on) { const h = `<b>${esc(title)}</b><span>${esc(sub)}</span>`; if (this.waitEl.innerHTML !== h) this.waitEl.innerHTML = h; } }
  rect() { const r = this.el.getBoundingClientRect(), a = $('#app').getBoundingClientRect(); return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height }; }
  beginLabels() { this.used = 0; }
  label(x, y, html, cls = '') {
    let el = this.pool[this.used]; if (!el) { el = document.createElement('div'); el.className = 'lbl'; this.labelsEl.appendChild(el); this.pool.push(el); el._h = ''; el._c = ''; }
    this.used++; el.hidden = false; el.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px) translate(-50%,-100%)`; el.style.left = '0'; el.style.top = '0';
    if (el._h !== html) { el.innerHTML = html; el._h = html; } const c = 'lbl ' + cls; if (el._c !== c) { el.className = c; el._c = c; }
    return el;
  }
  endLabels() { for (let i = this.used; i < this.pool.length; i++) this.pool[i].hidden = true; }
  clear() { this.chip(''); this.cardEl.innerHTML = ''; this.actsEl.innerHTML = ''; this.actKey = ''; this.prompt(''); this.wait(false); this.beginLabels(); this.endLabels(); this.toastsEl.innerHTML = ''; }
}
let Panes = [], Menus = [];
const ICON = {
  bite: '<path d="M3 8c3-3 15-3 18 0l-2 3-2-2-2 3-2-3-2 3-2-3-2 2zM3 16c3 3 15 3 18 0l-2-3-2 2-2-3-2 3-2-3-2 3-2-2z"/>',
  charge: '<path d="M2 12h12l-4-5h4l6 5-6 5h-4l4-5H2z"/>',
  strike: '<path d="M5 3l3 9-3 9 2 0 4-9-4-9zm6 0l3 9-3 9 2 0 4-9-4-9z"/>',
  spit: '<path d="M12 3c3 5 6 8 6 12a6 6 0 01-12 0c0-4 3-7 6-12z"/>',
  sing: '<path d="M9 4v11.5A3 3 0 117 13a3 3 0 012 .7V6l10-2v9.5A3 3 0 1117 11a3 3 0 012 .7V2z"/>',
  dance: '<path d="M2 14c3-6 5-6 7 0s4 6 7 0 4-6 6-2v3c-2-3-3-2-5 2-3 6-6 6-8 0s-4-6-7 0z"/>',
  charm: '<path d="M12 21C5 15 2 12 2 8a5 5 0 0110-1 5 5 0 0110 1c0 4-3 7-10 13z"/>',
  pose: '<path d="M12 2l3 7 7 .6-5.4 4.6 1.7 7.2L12 17.6 5.7 21.4l1.7-7.2L2 9.6 9 9z"/>',
  jump: '<path d="M12 3l7 8h-4v9H9v-9H5z"/>',
  edit: '<path d="M4 17l10-10 3 3-10 10H4zM15 6l2-2 3 3-2 2z"/>',
  mate: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 20c0-4 3-6 6-6s6 2 6 6zM12 20c0-4 2-6 4-6 3 0 6 2 6 6z"/>',
  swap: '<path d="M4 8h12l-3-3 2-2 6 6-6 6-2-2 3-3H4zm16 8H8l3 3-2 2-6-6 6-6 2 2-3 3h12z"/>',
  dash: '<path d="M3 12l6-6v4h6l6 2-6 2H9v4z"/>',
  shock: '<path d="M13 2L4 14h6l-2 8 10-13h-6z"/>',
  eat: '<path d="M12 4a8 8 0 100 16 8 8 0 000-16zm0 3l5 5-5 5-5-5z"/>',
  menu: '<path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>',
};
function toastAll(msg, kind) { for (const p of Panes) p.toast(msg, kind); }
function toastP(i, msg, kind) { if (Panes[i]) Panes[i].toast(msg, kind); }

/* key-driven per-player menu */
class PMenu {
  constructor(pane) { this.pane = pane; this.p = pane.i; this.el = pane.menuEl; this.isOpen = false; this.cur = 0; this.items = []; this.spec = null;
    this.el.addEventListener('click', e => { const it = e.target.closest('[data-i]'); if (!it) return; Sfx.init(); this.cur = +it.dataset.i; const x = e.target.closest('[data-side]'); if (x) this.key(x.dataset.side); else this.key('a1'); });
  }
  open(spec) { this.spec = spec; this.isOpen = true; this.cur = 0; this.el.hidden = false; this.pane.el.classList.add('menuopen'); this.refresh(); this.cur = this.items.findIndex(i => !i.head); if (this.cur < 0) this.cur = 0; this.render(); Sfx.click(this.p); }
  close() { if (!this.isOpen) return; this.isOpen = false; this.el.hidden = true; this.pane.el.classList.remove('menuopen'); this._last = ''; const s = this.spec; this.spec = null; if (s && s.onClose) s.onClose(); }
  refresh() { if (!this.spec) return; this.items = typeof this.spec.items === 'function' ? this.spec.items() : this.spec.items; if (this.cur >= this.items.length) this.cur = this.items.length - 1; }
  render() {
    if (!this.isOpen) return; const s = this.spec, L = KEYLABEL[this.p];
    const title = typeof s.title === 'function' ? s.title() : s.title, sub = typeof s.sub === 'function' ? s.sub() : s.sub;
    const html = `<div class="eyebrow">${esc(s.eyebrow || 'Menu')}</div><h3>${esc(title)}</h3>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}<div class="list">${this.items.map((it, i) => it.head ? `<div class="mi head">${esc(it.label)}</div>` :
      `<div class="mi${i === this.cur ? ' cur' : ''}${it.disabled ? ' dis' : ''}" data-i="${i}"><span class="l">${esc(it.label)}</span>${it.value !== undefined ? `<span class="v">${it.onLeft ? `<span data-side="left">◀</span> ` : ''}${esc(it.value)}${it.onRight ? ` <span data-side="right">▶</span>` : ''}</span>` : '<span></span>'}${it.desc ? `<span class="d">${esc(it.desc)}</span>` : ''}</div>`).join('')}</div>
      <div class="keys">${G.mode === 2 ? `${L.move} choose · ${L.a1} select · ` : 'Arrows choose · / or F select · '}◀▶ adjust · ${G.mode === 2 ? L.back : 'Shift or Q'} close</div>`;
    if (html !== this._last) { this.el.innerHTML = html; this._last = html; const c = this.el.querySelector('.mi.cur'); if (c) c.scrollIntoView({ block: 'nearest' }); }
  }
  move(d) { const n = this.items.length; if (!n) return; let i = this.cur; for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!this.items[i].head) break; } this.cur = i; Sfx.click(this.p); }
  key(act) {
    const it = this.items[this.cur];
    if (act === 'up') this.move(-1); else if (act === 'down') this.move(1);
    else if (act === 'left') { if (it && it.onLeft && !it.lockLeft) { it.onLeft(); Sfx.click(this.p); } }
    else if (act === 'right') { if (it && it.onRight && !it.disabledRight) { it.onRight(); Sfx.click(this.p); } }
    else if (act === 'a1' || (act === 'menu' && this.spec && this.spec.menuSelects)) { if (it && !it.disabled && !it.head) { if (it.onSelect) { it.onSelect(); Sfx.click(this.p); } else if (it.onRight) { it.onRight(); Sfx.click(this.p); } if (it.close) { this.close(); return; } } else Sfx.bad(this.p); }
    else if (act === 'back' || act === 'menu') { this.close(); return; }
    this.refresh(); this.render();
  }
  tick() { if (this.isOpen && this.spec && this.spec.live) { this.refresh(); this.render(); } }
}

/* shared modal for title, stage reports, pause */
const Modal = {
  el: $('#modal'), sheet: $('#sheet'), isOpen: false, handlers: {}, opts: {},
  open(html, handlers = {}, opts = {}) { this.sheet.innerHTML = html; this.handlers = handlers; this.opts = opts; this.isOpen = true; this.el.hidden = false; G.paused = !opts.noPause; this.sheet.scrollTop = 0; if (opts.onOpen) opts.onOpen(this.sheet); },
  close() { if (!this.isOpen) return; const o = this.opts; this.isOpen = false; this.el.hidden = true; this.sheet.innerHTML = ''; this.opts = {}; G.paused = false; if (o.onClose) o.onClose(); },
  rerender(html) { const st = this.sheet.scrollTop; this.sheet.innerHTML = html; this.sheet.scrollTop = st; if (this.opts.onOpen) this.opts.onOpen(this.sheet); },
  press(p, act) { if (this.opts.onPress) this.opts.onPress(p, act); else if ((act === 'back') && this.opts.closable) this.close(); },
};
Modal.sheet.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; Sfx.init(); Sfx.click(); const f = Modal.handlers[b.dataset.act]; if (f) f(b.dataset.arg, b); });
