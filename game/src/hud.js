// SOLARA — the HUD: mission panel, money/clock/stars, PCPD response,
// weapon bar, circular minimap, dialogue portraits, toasts, overlays.
import { WEAPONS, RANKS, RADIO, fmtMoney, fmtClock, clamp } from './config.js';

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

function drawPortrait(canvas, who) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  // Backdrop.
  g.fillStyle = who === 'lupe' ? '#ff5fa2' : who === 'kai' ? '#2a9d8f' : '#3a4a6b';
  g.fillRect(0, 0, W, H);
  // Face.
  g.fillStyle = '#c98a5e';
  g.beginPath(); g.arc(W / 2, H * 0.52, W * 0.3, 0, Math.PI * 2); g.fill();
  // Hair.
  g.fillStyle = who === 'lupe' ? '#1c1218' : who === 'kai' ? '#14100c' : '#8a8a8a';
  g.beginPath(); g.arc(W / 2, H * 0.42, W * 0.31, Math.PI, 0); g.fill();
  g.fillRect(W * 0.19, H * 0.36, W * 0.1, H * 0.3);
  g.fillRect(W * 0.71, H * 0.36, W * 0.1, H * 0.3);
  if (who === 'lupe') {
    g.fillStyle = '#ff5fa2';
    g.fillRect(W * 0.62, H * 0.2, W * 0.08, H * 0.42);
  }
  // Eyes.
  g.fillStyle = '#14100c';
  g.beginPath(); g.arc(W * 0.4, H * 0.52, W * 0.035, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(W * 0.6, H * 0.52, W * 0.035, 0, Math.PI * 2); g.fill();
  // Smile.
  g.strokeStyle = '#7a3a2a';
  g.lineWidth = 2;
  g.beginPath(); g.arc(W / 2, H * 0.6, W * 0.1, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  // Shoulders.
  g.fillStyle = who === 'lupe' ? '#e8b4d0' : who === 'kai' ? '#2a9d8f' : '#4a5a7a';
  g.beginPath(); g.arc(W / 2, H * 1.05, W * 0.42, Math.PI, 0); g.fill();
}

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud');
    this._toasts = [];
    this._build();
  }

  _build() {
    const r = this.root;
    // Mission panel, top-left.
    this.missionPanel = el('div', 'panel mission', r);
    this.missionChapter = el('div', 'mission-chapter', this.missionPanel);
    this.missionTitle = el('div', 'mission-title', this.missionPanel);
    this.missionStage = el('div', 'mission-stage', this.missionPanel);
    this.stageBar = el('div', 'stage-bar', this.missionPanel);
    for (let i = 0; i < 4; i++) el('div', 'stage-seg', this.stageBar);
    this.missionNext = el('div', 'mission-next', this.missionPanel);
    this.missionTimer = el('div', 'mission-timer', this.missionPanel);

    // Top-right: money, clock, stars.
    this.topRight = el('div', 'top-right', r);
    this.moneyEl = el('div', 'money', this.topRight);
    this.clockEl = el('div', 'clock', this.topRight);
    this.starsEl = el('div', 'stars', this.topRight);
    for (let i = 0; i < 5; i++) {
      const s = el('span', 'star', this.starsEl);
      s.textContent = '★';
    }
    this.sightBadge = el('div', 'sight-badge', this.topRight);
    this.evadeEl = el('div', 'evade', this.topRight);

    // PCPD response panel, top-centre.
    this.pcpd = el('div', 'panel pcpd', r);
    this.pcpdTitle = el('div', 'pcpd-title', this.pcpd);
    this.pcpdRows = el('div', 'pcpd-rows', this.pcpd);
    this.pcpdAir = el('div', 'pcpd-air', this.pcpd);

    // Minimap + district, bottom-left.
    this.mapWrap = el('div', 'map-wrap', r);
    this.minimap = el('canvas', 'minimap', this.mapWrap);
    this.minimap.width = 190; this.minimap.height = 190;
    this.districtEl = el('div', 'district', this.mapWrap);
    this.respectEl = el('div', 'respect', this.mapWrap);

    // Weapon bar + car, bottom-right.
    this.bottomRight = el('div', 'bottom-right', r);
    this.weaponBar = el('div', 'weapon-bar', this.bottomRight);
    this.slots = [];
    for (let i = 0; i < 5; i++) {
      const s = el('div', 'slot', this.weaponBar);
      el('div', 'slot-key', s).textContent = String(i + 1);
      const nm = el('div', 'slot-name', s);
      const am = el('div', 'slot-ammo', s);
      this.slots.push({ el: s, nm, am });
    }
    this.carEl = el('div', 'car-info', this.bottomRight);
    this.carName = el('div', 'car-name', this.carEl);
    this.carCond = el('div', 'car-cond', this.carEl);
    this.carSpeed = el('div', 'car-speed', this.carEl);
    this.radioEl = el('div', 'radio', this.bottomRight);

    // Crosshair.
    this.crosshair = el('div', 'crosshair', r);
    el('div', 'cross-dot', this.crosshair);

    // Dialogue, bottom-centre.
    this.dialogue = el('div', 'dialogue', r);
    this.dlgPortrait = el('canvas', 'portrait', this.dialogue);
    this.dlgPortrait.width = 96; this.dlgPortrait.height = 96;
    const dlgBody = el('div', 'dlg-body', this.dialogue);
    this.dlgName = el('div', 'dlg-name', dlgBody);
    this.dlgText = el('div', 'dlg-text', dlgBody);
    this.dlgReply = el('div', 'dlg-reply', dlgBody);

    // Toasts.
    this.toastWrap = el('div', 'toasts', r);

    // Overlays.
    this.intro = el('div', 'overlay intro', r);
    el('div', 'game-title', this.intro).textContent = 'SOLARA';
    el('div', 'game-sub', this.intro).textContent = 'AN OPEN-WORLD CRIME STORY';
    el('div', 'game-hint', this.intro).textContent = 'Press ENTER to begin';
    this.title = el('div', 'overlay title', r);
    el('div', 'game-title', this.title).textContent = 'SOLARA';
    const menu = el('div', 'title-menu', this.title);
    for (const t of ['NEW GAME', 'CONTINUE', 'CONTROLS']) el('div', 'menu-item', menu).textContent = t;
    el('div', 'game-hint', this.title).textContent = 'Press ENTER to play';
    this.pauseOv = el('div', 'overlay pause', r);
    el('div', 'game-title', this.pauseOv).textContent = 'PAUSED';
    el('div', 'game-hint', this.pauseOv).textContent = 'P to resume · M map · F8 save · F9 load';
    this.wastedOv = el('div', 'overlay wasted', r);
    el('div', 'wasted-big', this.wastedOv).textContent = 'WASTED';
    this.wastedSub = el('div', 'game-hint', this.wastedOv);
    this.mapOv = el('div', 'overlay map', r);
    this.mapCanvas = el('canvas', 'big-map', this.mapOv);
    this.mapCanvas.width = 640; this.mapCanvas.height = 640;
    this.mapHint = el('div', 'game-hint', this.mapOv);
    this.mapHint.textContent = 'Wheel to zoom · drag to pan · click to set waypoint · M to close';
    this.garageOv = el('div', 'overlay garage', r);
    el('div', 'game-title', this.garageOv).textContent = "SULLY'S GARAGE";
    this.garageList = el('div', 'garage-list', this.garageOv);
    el('div', 'game-hint', this.garageOv).textContent = 'Press 1-3 to buy · G to close';
  }

  toast(text, sub = '') {
    const t = el('div', 'toast', this.toastWrap);
    t.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    this._toasts.push(t);
    setTimeout(() => { t.remove(); }, 4200);
    while (this._toasts.length > 3) this._toasts.shift().remove();
  }

  showDialogue(who, name, role, text, reply = '') {
    drawPortrait(this.dlgPortrait, who);
    this.dlgName.textContent = `${name} · ${role}`;
    this.dlgText.textContent = text;
    this.dlgReply.textContent = reply ? `Kai: “${reply}”` : '';
    this.dialogue.classList.add('show');
    clearTimeout(this._dlgTimer);
    this._dlgTimer = setTimeout(() => this.dialogue.classList.remove('show'), 7000);
  }

  showOverlay(which) {
    for (const o of [this.intro, this.title, this.pauseOv, this.wastedOv, this.mapOv, this.garageOv]) {
      o.classList.remove('show');
    }
    if (which) which.classList.add('show');
  }

  update() {
    const g = this.game;
    // Mission panel.
    const m = g.missions;
    if (m.done) {
      this.missionChapter.textContent = 'ALL JOBS DONE';
      this.missionTitle.textContent = 'GOLDEN HOUR COMPLETE';
      this.missionStage.textContent = '8 / 8';
      this.missionNext.textContent = 'Solara is yours, Kai.';
      this.missionTimer.textContent = '';
    } else if (m.current) {
      const job = m.current;
      this.missionChapter.textContent = `${job.chapter} · ${job.title}`;
      this.missionTitle.textContent = job.stages[m.stage] ? job.stages[m.stage].text : job.brief;
      this.missionStage.textContent = `STAGE ${m.stage + 1}/${job.stages.length}`;
      const segs = this.stageBar.children;
      for (let i = 0; i < segs.length; i++) {
        segs[i].classList.toggle('filled', i <= m.stage);
      }
      this.missionNext.textContent = `NEXT: ${job.giver} — ${job.brief}`;
      this.missionTimer.textContent = job.timed ? `⏱ ${Math.max(0, Math.ceil(m.timer))}s` : '';
    }
    // Top-right.
    this.moneyEl.textContent = fmtMoney(g.money);
    this.clockEl.textContent = fmtClock(g.hours);
    const stars = this.starsEl.children;
    for (let i = 0; i < 5; i++) stars[i].classList.toggle('lit', i < g.wanted.stars);
    if (g.wanted.stars > 0) {
      this.sightBadge.textContent = g.wanted.inSight ? 'IN SIGHT' : 'HIDDEN';
      this.sightBadge.className = 'sight-badge ' + (g.wanted.inSight ? 'sight' : 'hidden');
      this.evadeEl.textContent = `EVADING ${Math.round(g.wanted.evading)}%`;
      this.evadeEl.style.display = 'block';
    } else {
      this.sightBadge.textContent = 'CLEAN';
      this.sightBadge.className = 'sight-badge clean';
      this.evadeEl.style.display = 'none';
    }
    // PCPD panel.
    const units = g.police.cruisers.map((c) => ({ name: c.unit || 'PCPD', d: Math.round(Math.hypot(c.x - g.player.x, c.z - g.player.z)), status: c.status || 'SEARCHING' }))
      .concat(g.police.officers.map((o) => ({ name: o.name, d: Math.round(Math.hypot(o.x - g.player.x, o.z - g.player.z)), status: o.status || 'PURSUIT' })));
    const wrecked = units.filter((u) => u.status === 'WRECKED').length;
    this.pcpdTitle.textContent = g.wanted.stars > 0
      ? `PCPD RESPONSE — ${units.length} UNITS · CODE ${g.wanted.code}`
      : 'PCPD RESPONSE — NO HEAT';
    this.pcpdRows.innerHTML = units.slice(0, 5).map((u) =>
      `<div class="pcpd-row"><span>${u.name}</span><span>${u.d} m</span><span class="st-${u.status}">${u.status}</span></div>`).join('')
      + (wrecked ? `<div class="pcpd-note">${wrecked} wrecked · search grid active</div>` : '');
    this.pcpdAir.textContent = g.police.heli ? '✦ AIR UNIT DEPLOYED' : '';
    this.pcpd.style.display = g.wanted.stars > 0 || g.police.heli ? 'block' : 'none';
    // Weapon bar.
    const unlocked = m.index;
    WEAPONS.forEach((w, i) => {
      const s = this.slots[i];
      const locked = unlocked < w.unlock;
      s.el.classList.toggle('selected', g.player.weapon === w.id);
      s.el.classList.toggle('locked', locked);
      s.nm.textContent = locked ? 'LOCKED' : w.name;
      s.am.textContent = locked ? '' : (w.ammo === Infinity ? '∞' : (g.player.weapon === w.id ? (g.player.weaponAmmo === Infinity ? '∞' : g.player.weaponAmmo) : w.ammo));
    });
    // Car + radio.
    if (g.player.car) {
      const c = g.player.car;
      this.carName.textContent = c.name.toUpperCase();
      this.carCond.innerHTML = `CONDITION <div class="cond-bar"><div style="width:${clamp(c.condition, 0, 100)}%"></div></div> ${Math.round(c.condition)}%`;
      this.carSpeed.textContent = `${Math.round(Math.abs(c.speed) * 3.6)} km/h`;
      const gear = Math.abs(c.speed) < 1 ? 'N' : 'G' + clamp(1 + Math.floor(Math.abs(c.speed) / 10), 1, 5);
      this.carSpeed.textContent += ` · ${gear}`;
      this.carEl.style.display = 'block';
    } else {
      this.carEl.style.display = 'none';
    }
    const st = RADIO[g.radioStation];
    this.radioEl.textContent = `♪ ${st.name} · ${st.song}`;
    // Crosshair only when armed on foot.
    this.crosshair.style.display = (!g.player.onFoot || g.player.weapon <= 1) ? 'none' : 'block';
    // Minimap.
    this._drawMinimap();
    const d = g.districts.current;
    this.districtEl.textContent = `${d.name} · ${g.districts.standingLabel} ${d.standing}%`;
    const rank = [...RANKS].reverse().find((r) => g.respect * 20 >= r.rp) || RANKS[0];
    this.respectEl.textContent = `RESPECT ${g.respect} · ${rank.name}`;
  }

  _drawMinimap() {
    const c = this.minimap.getContext('2d');
    const W = this.minimap.width, H = this.minimap.height;
    const g = this.game;
    c.clearRect(0, 0, W, H);
    c.save();
    c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#20242e';
    c.fillRect(0, 0, W, H);
    const scale = W / 640;
    const px = W / 2 - g.player.x * scale;
    const pz = H / 2 - g.player.z * scale;
    // Roads.
    c.strokeStyle = '#3a3f4a';
    c.lineWidth = 5;
    for (let i = -4; i <= 4; i++) {
      const p = i * 64;
      c.beginPath(); c.moveTo(px + p * scale, 0); c.lineTo(px + p * scale, H); c.stroke();
      c.beginPath(); c.moveTo(0, pz + p * scale); c.lineTo(W, pz + p * scale); c.stroke();
    }
    // Ocean.
    c.fillStyle = '#2fa8b8';
    c.fillRect(px + 250 * scale, 0, W, H);
    // Mission target.
    const t = g.missions.target();
    if (t) {
      c.fillStyle = '#ffc93a';
      c.beginPath(); c.arc(px + t.x * scale, pz + t.z * scale, 6, 0, Math.PI * 2); c.fill();
    }
    // Wanted search circle + red edge.
    if (g.wanted.stars > 0) {
      c.strokeStyle = g.wanted.inSight ? '#ff4040' : '#4a90e8';
      c.lineWidth = 2;
      c.beginPath(); c.arc(W / 2, H / 2, 34 + (100 - g.wanted.evading) * 0.3, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(74,144,232,0.12)';
      c.beginPath(); c.arc(W / 2, H / 2, 34 + (100 - g.wanted.evading) * 0.3, 0, Math.PI * 2); c.fill();
    }
    // Police dots.
    c.fillStyle = '#ff4040';
    for (const cr of g.police.cruisers) {
      c.beginPath(); c.arc(px + cr.x * scale, pz + cr.z * scale, 4, 0, Math.PI * 2); c.fill();
    }
    if (g.police.heli) {
      c.fillStyle = '#ff9040';
      c.beginPath(); c.arc(px + g.police.heli.group.position.x * scale, pz + g.police.heli.group.position.z * scale, 5, 0, Math.PI * 2); c.fill();
    }
    // Player arrow.
    c.fillStyle = '#ffd23a';
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(g.player.heading || 0);
    c.beginPath(); c.moveTo(0, -8); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
    c.restore();
  }

  drawBigMap() {
    const c = this.mapCanvas.getContext('2d');
    const W = this.mapCanvas.width, H = this.mapCanvas.height;
    const g = this.game;
    c.fillStyle = '#1c2029';
    c.fillRect(0, 0, W, H);
    const z = this._mapZoom || 1;
    const ox = this._mapOX || 0, oy = this._mapOY || 0;
    const scale = (W / 640) * z;
    const px = W / 2 - g.player.x * scale + ox;
    const pz = H / 2 - g.player.z * scale + oy;
    // Districts.
    c.font = 'bold 13px Arial';
    for (const d of g.districts.list) {
      c.fillStyle = 'rgba(74,144,232,0.14)';
      c.fillRect(px + d.x0 * scale, pz + d.z0 * scale, (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.strokeRect(px + d.x0 * scale, pz + d.z0 * scale, (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
      c.fillStyle = '#cfd6e4';
      c.fillText(d.name, px + d.x0 * scale + 6, pz + d.z0 * scale + 18);
    }
    // Roads.
    c.strokeStyle = '#3a3f4a';
    c.lineWidth = 4;
    for (let i = -4; i <= 4; i++) {
      const p = i * 64;
      c.beginPath(); c.moveTo(px + p * scale, 0); c.lineTo(px + p * scale, H); c.stroke();
      c.beginPath(); c.moveTo(0, pz + p * scale); c.lineTo(W, pz + p * scale); c.stroke();
    }
    // Garage + mission target + waypoint.
    c.fillStyle = '#39e6a3';
    c.font = 'bold 15px Arial';
    c.fillText('G SULLY’S GARAGE', px + 60 * scale, pz - 120 * scale);
    const t = g.missions.target();
    if (t) {
      c.fillStyle = '#ffc93a';
      c.beginPath(); c.arc(px + t.x * scale, pz + t.z * scale, 8, 0, Math.PI * 2); c.fill();
    }
    if (g.waypoint) {
      c.fillStyle = '#ff5fa2';
      c.beginPath(); c.arc(px + g.waypoint.x * scale, pz + g.waypoint.z * scale, 7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ff5fa2';
      c.beginPath(); c.moveTo(px + g.player.x * scale, pz + g.player.z * scale);
      c.lineTo(px + g.waypoint.x * scale, pz + g.waypoint.z * scale); c.stroke();
    }
    // Player.
    c.fillStyle = '#ffd23a';
    c.beginPath(); c.arc(px + g.player.x * scale, pz + g.player.z * scale, 7, 0, Math.PI * 2); c.fill();
  }
}
