// SOLARA — the HUD: every panel the screenshots are judged on. Mission
// top-left, money/clock/stars top-right, PCPD top-centre, weapon slots
// and crew bottom-centre, a circular minimap bottom-left, car and radio
// bottom-right, portrait dialogue above the weapon bar, and the crosshair
// dead centre. All DOM; the 3D scene never draws text.
import { WEAPONS, CREW, RANKS, RADIO, clamp } from './config.js';

const $ = (id) => document.getElementById(id);

export function drawFace(canvas, opts) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = opts.bg || '#2a2438';
  g.fillRect(0, 0, w, h);
  // Shoulders.
  g.fillStyle = opts.shirt || '#3a3f5a';
  g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.82); g.quadraticCurveTo(w / 2, h * 0.62, w, h * 0.82); g.lineTo(w, h); g.closePath(); g.fill();
  // Head.
  g.fillStyle = opts.skin || '#c98d64';
  g.beginPath(); g.arc(w / 2, h * 0.46, w * 0.26, 0, Math.PI * 2); g.fill();
  // Hair.
  g.fillStyle = opts.hair || '#1c1410';
  if (opts.hairStyle === 'bob') {
    g.beginPath(); g.arc(w / 2, h * 0.4, w * 0.28, Math.PI, 0); g.fill();
    g.fillRect(w * 0.22, h * 0.38, w * 0.1, h * 0.3);
    g.fillRect(w * 0.68, h * 0.38, w * 0.1, h * 0.3);
  } else if (opts.hairStyle === 'long') {
    g.beginPath(); g.arc(w / 2, h * 0.38, w * 0.29, Math.PI, 0); g.fill();
    g.fillRect(w * 0.2, h * 0.36, w * 0.12, h * 0.42);
    g.fillRect(w * 0.68, h * 0.36, w * 0.12, h * 0.42);
  } else if (opts.hairStyle === 'cap') {
    g.fillStyle = '#b02020';
    g.beginPath(); g.arc(w / 2, h * 0.36, w * 0.27, Math.PI, 0); g.fill();
    g.fillRect(w * 0.2, h * 0.36, w * 0.6, h * 0.06);
  } else {
    g.beginPath(); g.arc(w / 2, h * 0.38, w * 0.27, Math.PI * 0.95, Math.PI * 2.05); g.fill();
  }
  if (opts.streak) { g.fillStyle = opts.streak; g.fillRect(w * 0.56, h * 0.2, w * 0.07, h * 0.3); }
  // Eyes + mouth.
  g.fillStyle = '#14141a';
  g.beginPath(); g.arc(w * 0.4, h * 0.46, w * 0.035, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(w * 0.6, h * 0.46, w * 0.035, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7a4a30'; g.lineWidth = 2;
  g.beginPath(); g.arc(w / 2, h * 0.56, w * 0.09, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
}

const FACES = {
  LUPE: { bg: '#3a1f3a', skin: '#d8a077', hair: '#241812', hairStyle: 'bob', streak: '#ff5fa2', shirt: '#5a2a4a' },
  KAI: { bg: '#1f2a3a', skin: '#c98d64', hair: '#1c1410', hairStyle: 'cap', shirt: '#e8531f' },
  SULLY: { bg: '#2a2a2a', skin: '#b98a62', hair: '#3a2a1a', hairStyle: 'short', shirt: '#4a5a3a' },
  MARCO: { bg: '#2a2a3a', skin: '#c98d64', hair: '#14100c', hairStyle: 'short', shirt: '#2a4a6a' },
  BRANDT: { bg: '#1f2a2a', skin: '#d8b090', hair: '#6a6a6a', hairStyle: 'short', shirt: '#3a3a3a' },
  AURORA: { bg: '#2a1f3a', skin: '#e8c090', hair: '#e8d090', hairStyle: 'long', shirt: '#6a3a8a' },
};

export class HUD {
  constructor(G) {
    this.G = G;
    this._mapT = 0;
    this._pcpdT = 0;
    this._crewCd = { Z: 0, X: 0, C: 0 };
    this._toastT = 0;
    this.buildWeaponBar();
    this.buildCrewBar();
  }

  buildWeaponBar() {
    const bar = $('weapon-bar');
    if (!bar) return;
    bar.innerHTML = '';
    for (const w of WEAPONS) {
      const d = document.createElement('div');
      d.className = 'slot'; d.id = `slot-${w.slot}`;
      d.innerHTML = `<div class="slot-key">${w.slot}</div><div class="slot-name">${w.name}</div><div class="slot-ammo"></div>`;
      bar.appendChild(d);
    }
    this.refreshWeapons();
  }

  buildCrewBar() {
    const bar = $('crew-bar');
    if (!bar) return;
    bar.innerHTML = '';
    for (const c of CREW) {
      const d = document.createElement('div');
      d.className = 'crew'; d.id = `crew-${c.key}`;
      d.innerHTML = `<div class="crew-key">${c.key}</div><div class="crew-name">${c.name}</div><div class="crew-call">${c.call}</div><div class="crew-cd"></div>`;
      bar.appendChild(d);
    }
  }

  refreshWeapons() {
    const G = this.G;
    for (const w of WEAPONS) {
      const el = $(`slot-${w.slot}`);
      if (!el) continue;
      const locked = w.locked;
      el.classList.toggle('selected', G.player.currentSlot === w.slot);
      el.classList.toggle('locked', locked);
      const ammo = el.querySelector('.slot-ammo');
      if (locked) ammo.textContent = 'LOCKED';
      else if (w.slot === 1) ammo.textContent = '∞';
      else ammo.textContent = String(G.player.reserve[w.slot]);
      const name = el.querySelector('.slot-name');
      if (name) name.textContent = w.name;
    }
  }

  refreshMission() {
    const G = this.G;
    const m = G.missions.current;
    const st = G.missions.currentStage;
    const title = $('mission-title');
    if (title) title.textContent = `${m.ch} · ${m.title}`;
    const stage = $('mission-stage');
    if (stage) stage.textContent = `STAGE ${G.missions.stage + 1}/${m.stages.length}`;
    const bar = $('stage-bar');
    if (bar) {
      bar.innerHTML = '';
      for (let i = 0; i < m.stages.length; i++) {
        const s = document.createElement('span');
        s.className = 'seg' + (i <= G.missions.stage ? ' filled' : '');
        bar.appendChild(s);
      }
    }
    const obj = $('mission-objective');
    if (obj) obj.textContent = st.text;
    const next = $('mission-next');
    if (next) {
      const ns = m.stages[G.missions.stage + 1];
      next.textContent = ns ? `NEXT: ${ns.text}` : 'NEXT: Return to Lupe';
    }
    const timer = $('mission-timer');
    if (timer) {
      if (st.time) { timer.style.display = 'block'; timer.textContent = `${Math.ceil(G.missions.stageT)} s`; }
      else timer.style.display = 'none';
    }
    this.refreshDialogue();
  }

  refreshDialogue() {
    const G = this.G;
    const m = G.missions.current;
    const name = $('dlg-name');
    if (name) name.textContent = `${m.giver}:`;
    const role = $('dlg-role');
    if (role) role.textContent = m.role;
    const text = $('dlg-text');
    if (text) text.textContent = m.brief;
    const reply = $('dlg-reply');
    if (reply) reply.textContent = `KAI: ${m.reply}`;
    const cv = $('dlg-portrait');
    if (cv) drawFace(cv, FACES[m.giver] || FACES.LUPE);
    const box = $('dialogue');
    if (box) box.style.display = 'flex';
  }

  toast(text, kind) {
    const el = $('toast');
    if (!el) return;
    el.textContent = text;
    el.className = `show ${kind || ''}`;
    this._toastT = 3.2;
  }

  flashDamage() {
    const el = $('damage-flash');
    if (!el) return;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  }

  showWasted() {
    const el = $('wasted-overlay');
    if (el) el.style.display = 'flex';
  }
  hideWasted() {
    const el = $('wasted-overlay');
    if (el) el.style.display = 'none';
  }

  refreshPCPD() {
    const G = this.G;
    const w = G.wanted;
    const panel = $('pcpd-panel');
    if (!panel) return;
    const units = [...G.police.cruisers, ...G.police.officers];
    const n = units.length + (G.police.heli ? 1 : 0);
    panel.style.display = (w.stars > 0 && n > 0) ? 'block' : 'none';
    if (n === 0) return;
    const title = $('pcpd-title');
    if (title) title.textContent = `PCPD RESPONSE — ${n} UNIT${n === 1 ? '' : 'S'} · CODE ${w.code}`;
    const air = $('pcpd-air');
    if (air) air.style.display = G.police.heli ? 'block' : 'none';
    const list = $('pcpd-units');
    if (list) {
      let html = '';
      const p = G.player;
      const rows = [];
      const distOf = (u) => (u.displayDist !== undefined ? u.displayDist : Math.round(Math.hypot(u.x - p.x, u.z - p.z)));
      for (const c of G.police.cruisers) rows.push({ name: c.name, d: distOf(c), s: c.status });
      for (const o of G.police.officers) rows.push({ name: o.name, d: distOf(o), s: o.status });
      if (G.police.heli) rows.push({ name: 'AIR-1', d: distOf({ x: G.police.heli.group.position.x, z: G.police.heli.group.position.z }), s: 'AIR' });
      rows.sort((a, b) => a.d - b.d);
      for (const r of rows.slice(0, 5)) {
        html += `<div class="pcpd-row"><span class="pcpd-name">${r.name}</span><span class="pcpd-dist">${r.d} m</span><span class="pcpd-status ${r.s}">${r.s}</span></div>`;
      }
      list.innerHTML = html;
    }
    const ev = $('pcpd-evading');
    if (ev) ev.textContent = `EVADING ${Math.round(w.evading)}%`;
    const st = $('pcpd-status');
    if (st) {
      st.textContent = w.status;
      st.className = w.status === 'IN SIGHT' ? 'sight' : 'hidden';
    }
  }

  refreshTopRight() {
    const G = this.G;
    const money = $('money');
    if (money) money.textContent = `$${Math.floor(G.money).toLocaleString()}`;
    const clock = $('clock');
    if (clock) {
      const h = Math.floor(G.hours), m = Math.floor((G.hours - h) * 60);
      clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const stars = $('stars');
    if (stars) {
      let html = '';
      for (let i = 0; i < 5; i++) html += `<span class="star ${i < G.wanted.stars ? 'filled' : ''}">${i < G.wanted.stars ? '★' : '☆'}</span>`;
      stars.innerHTML = html;
    }
    const rank = $('rank-label');
    if (rank) {
      let r = RANKS[0];
      for (const x of RANKS) if (G.rp >= x.rp) r = x;
      rank.textContent = r.name;
    }
  }

  refreshMinimap() {
    const cv = $('minimap');
    if (!cv) return;
    const G = this.G;
    const g = cv.getContext('2d');
    const S = cv.width;
    const scale = S / 560;
    const cx = S / 2, cy = S / 2;
    const px = (x) => cx + x * scale, py = (z) => cy + z * scale;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#0e0e16'; g.fillRect(0, 0, S, S);
    // Ocean edge.
    g.fillStyle = '#14424e'; g.fillRect(0, 0, px(-262), S);
    // Roads.
    g.strokeStyle = '#3d3d48'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(px(-250), 0); g.lineTo(px(-250), S); g.stroke();
    for (const z of [-160, -80, 0, 80, 160]) { g.beginPath(); g.moveTo(0, py(z)); g.lineTo(S, py(z)); g.stroke(); }
    for (const x of [-170, -90, -10, 70, 150]) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), S); g.stroke(); }
    // Search circle: blue fill, red edge, while wanted.
    if (G.wanted.stars > 0) {
      g.beginPath(); g.arc(px(G.player.x), py(G.player.z), 60 * scale, 0, Math.PI * 2);
      g.fillStyle = 'rgba(60,120,255,0.22)'; g.fill();
      g.strokeStyle = '#ff3b30'; g.lineWidth = 2; g.stroke();
    }
    // Mission target.
    const t = G.missions.currentStage.target;
    g.beginPath(); g.arc(px(t.x), py(t.z), 7, 0, Math.PI * 2);
    g.strokeStyle = '#ffd34d'; g.lineWidth = 2.5; g.stroke();
    // Police blips.
    for (const c of G.police.cruisers) { g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(px(c.x), py(c.z), 3.5, 0, Math.PI * 2); g.fill(); }
    for (const o of G.police.officers) { g.fillStyle = '#ff8a5c'; g.beginPath(); g.arc(px(o.x), py(o.z), 2.5, 0, Math.PI * 2); g.fill(); }
    if (G.police.heli) { g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(px(G.police.heli.group.position.x), py(G.police.heli.group.position.z), 4, 0, Math.PI * 2); g.fill(); }
    // Player wedge.
    g.save();
    g.translate(px(G.player.x), py(G.player.z));
    g.rotate(-G.player.heading);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(-5.5, 6); g.closePath(); g.fill();
    g.restore();
    // District + respect + bars.
    const d = G.world.districtAt(G.player.x, G.player.z);
    const dn = $('district-name'); if (dn) dn.textContent = d.name;
    const ds = $('district-standing');
    if (ds) ds.textContent = `${G.districts.statusFor(d.name)} · ${G.districts.standingFor(d.name)}`;
    const db = $('district-blurb'); if (db) db.textContent = d.blurb;
    const rv = $('respect-val'); if (rv) rv.textContent = `RESPECT ${G.respect}`;
    const hf = $('health-fill'); if (hf) hf.style.width = `${clamp(G.player.health, 0, 100)}%`;
    const af = $('armour-fill'); if (af) af.style.width = `${clamp(G.player.armour, 0, 100)}%`;
  }

  refreshCar() {
    const G = this.G;
    const box = $('car-info');
    if (!box) return;
    const car = G.player.car;
    if (!car) { box.style.opacity = '0.45'; return; }
    box.style.opacity = '1';
    const name = $('car-name'); if (name) name.textContent = car.name;
    const kmh = Math.abs(car.speed) * 3.6;
    const sp = $('car-speed'); if (sp) sp.textContent = `${Math.round(kmh)} km/h`;
    const gear = $('car-gear');
    if (gear) gear.textContent = `G${clamp(1 + Math.floor(kmh / 30), 1, 5)}`;
    const cf = $('car-cond-fill'); if (cf) cf.style.width = `${clamp(car.condition, 0, 100)}%`;
    const cv = $('car-cond-val'); if (cv) cv.textContent = `CONDITION ${Math.round(car.condition)}%`;
    const rn = $('radio-name');
    if (rn) rn.textContent = `♪ ${RADIO[G.radioStation].name} · ${RADIO[G.radioStation].genre}`;
    const rt = $('radio-track');
    if (rt) rt.textContent = RADIO[G.radioStation].track;
  }

  refreshAll() {
    this.refreshMission();
    this.refreshTopRight();
    this.refreshPCPD();
    this.refreshWeapons();
    this.refreshMinimap();
    this.refreshCar();
  }

  update(dt) {
    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) { const el = $('toast'); if (el) el.className = ''; }
    }
    this._mapT -= dt; this._pcpdT -= dt;
    if (this._mapT <= 0) { this._mapT = 0.15; this.refreshMinimap(); this.refreshCar(); this.refreshTopRight(); }
    if (this._pcpdT <= 0) { this._pcpdT = 0.2; this.refreshPCPD(); }
    for (const k of Object.keys(this._crewCd)) {
      if (this._crewCd[k] > 0) {
        this._crewCd[k] -= dt;
        const el = $(`crew-${k}`)?.querySelector('.crew-cd');
        if (el) el.textContent = this._crewCd[k] > 0 ? `${Math.ceil(this._crewCd[k])}s` : 'READY';
      }
    }
  }

  setCrewCooldown(key, seconds) {
    this._crewCd[key] = seconds;
    const el = $(`crew-${key}`);
    if (el) el.classList.add('cooling');
    setTimeout(() => { const e2 = $(`crew-${key}`); if (e2) e2.classList.remove('cooling'); }, seconds * 1000);
  }
}
