// SOLARA — HUD: dense always-on interface. Mission top-left; big money,
// clock and gold stars top-right; PCPD panel top-center; weapon bar
// bottom; circular minimap + district + respect bottom-left; radio + car
// bottom-right; dialogue bottom-center; context prompt; map overlay;
// title screen. DOM refs all use the *El suffix — no element ever
// shadows a method (the toast() method uses this.toastEl, never a
// property named toast). Re-authored for the @witty-meteor-32
// recording-M build.
import { WEAPONS, RADIO, MISSIONS, DISTRICTS, LANDMARKS, SIDE_JOBS, standingLabel, dist2d } from './config.js';

export class HUD {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.missionEl = $('hud-mission');
    this.missionTitleEl = $('hud-mission-title');
    this.missionStageEl = $('hud-mission-stage');
    this.missionBarEl = $('hud-mission-bar');
    this.missionObjEl = $('hud-mission-obj');
    this.missionNextEl = $('hud-mission-next');
    this.moneyEl = $('hud-money');
    this.clockEl = $('hud-clock');
    this.starsEl = $('hud-stars');
    this.wantedBadgeEl = $('hud-wanted-badge');
    this.rankNameEl = $('hud-rank-name');
    this.rpFillEl = $('hud-rp-fill');
    this.rpTextEl = $('hud-rp-text');
    this.pcpdEl = $('hud-pcpd');
    this.pcpdCountEl = $('hud-pcpd-count');
    this.pcpdAirEl = $('hud-pcpd-air');
    this.pcpdListEl = $('hud-pcpd-list');
    this.evadeEl = $('hud-evade');
    this.weaponsEl = $('hud-weapons');
    this.minimapEl = $('hud-minimap');
    this.minimapCtx = this.minimapEl ? this.minimapEl.getContext('2d') : null;
    this.healthFillEl = $('hud-health-fill');
    this.healthTextEl = $('hud-health-text');
    this.armourFillEl = $('hud-armour-fill');
    this.armourTextEl = $('hud-armour-text');
    // District readout under the minimap: name, standing pill, one-line blurb.
    this.districtEl = $('hud-district');
    this.districtStandEl = $('hud-district-stand');
    this.districtDescEl = $('hud-district-desc');
    this.respectEl = $('hud-respect');
    this.radioEl = $('hud-radio-freq');
    this.radioGenreEl = $('hud-radio-genre');
    this.songEl = $('hud-song');
    this.speedEl = $('hud-speed-num');
    this.carNameEl = $('hud-car-name');
    this.carCondEl = $('hud-car-cond');
    this.carCondBarEl = $('hud-car-cond-bar');
    this.carCondFillEl = $('hud-car-cond-fill');
    this.gearEl = $('hud-gear');
    this.dialogueEl = $('hud-dialogue');
    this.dialogueWhoEl = $('hud-dialogue-who');
    this.dialogueRoleEl = $('hud-dialogue-role');
    this.dialogueTextEl = $('hud-dialogue-text');
    this.dialogueReplyEl = $('hud-dialogue-reply');
    this.portraitEl = $('hud-portrait');
    this.portraitCtx = this.portraitEl ? this.portraitEl.getContext('2d') : null;
    this.crosshairEl = $('hud-crosshair');
    this.promptEl = $('hud-prompt');
    this.toastEl = $('hud-toast');
    this.titleEl = $('screen-title');
    this.mapEl = $('screen-map');
    this.mapCanvasEl = $('map-canvas');
    this.mapCtx = this.mapCanvasEl ? this.mapCanvasEl.getContext('2d') : null;
    this.mapMissionsEl = $('map-missions');
    this.mapStatsEl = $('map-stats');
    this.mapFooterEl = $('map-footer');
    // Act title card: big act label + title, shown when an act opens.
    this.actCardEl = $('hud-actcard');
    this.actCardTitleEl = $('hud-actcard-title');
    this.actCardSubEl = $('hud-actcard-sub');
    this.crewEl = $('hud-crew');
    this.introEl = $('screen-intro');
    this.timerEl = $('hud-timer');
    this.dialogueTimer = 0;
    this.toastTimer = 0;
    this.actTimer = 0;
    this.lastPcpdKey = '';
    this.lastAmmoKey = '';
    this.lastCrewKey = '';
    this.lastStarsKey = '';
    this.lastStageBarKey = '';
    this.lastBadgeKey = '';
    // Full-map view state: centre (world coords), zoom, waypoint (world).
    this.mapView = { cx: -40, cz: 0, zoom: 1, waypoint: null };
    this.mapDrag = null;
    this.buildWeaponBar();
    this.buildCrewBar();
    this.bindMapInput();
  }

  // Ammo text: mag/reserve, ∞ for fists. Locked slots show their stock
  // greyed out — the weapon exists in the arsenal, it just is not earned.
  static ammoText(w) {
    if (w.ammo === Infinity) return '∞';
    return w.reserve > 0 ? `${w.ammo}/${w.reserve}` : `${w.ammo}`;
  }

  buildWeaponBar() {
    if (!this.weaponsEl) return;
    this.weaponsEl.innerHTML = '';
    this.slotEls = [];
    for (const w of WEAPONS) {
      const d = document.createElement('div');
      d.className = 'wslot' + (w.locked ? ' locked' : '');
      d.innerHTML = `<span class="wkey">${w.slot}</span><span class="wname">${w.name}</span><span class="wammo">${HUD.ammoText(w)}</span>`;
      this.weaponsEl.appendChild(d);
      this.slotEls.push(d);
    }
  }

  // Full weapon-bar refresh from the live state (mag/reserve per slot).
  // Cached on a key so the per-frame call is a no-op when nothing changed.
  setWeapons(weapons) {
    if (!this.slotEls || !weapons) return;
    const key = JSON.stringify(weapons.map((w) => [w.ammo, w.active, w.locked]));
    if (key === this.lastAmmoKey) return;
    this.lastAmmoKey = key;
    weapons.forEach((w, i) => {
      const el = this.slotEls[i];
      if (!el) return;
      el.classList.toggle('active', !!w.active);
      el.classList.toggle('locked', !!w.locked);
      const a = el.querySelector('.wammo');
      if (a) a.textContent = w.ammo;
      const n = el.querySelector('.wname');
      if (n && n.textContent !== w.name) n.textContent = w.name;
    });
  }

  setWeapon(slot, ammo) {
    if (!this.slotEls) return;
    this.slotEls.forEach((el, i) => {
      el.classList.toggle('active', i === slot - 1);
      if (i === slot - 1 && ammo !== undefined) {
        const a = el.querySelector('.wammo');
        if (a) a.textContent = ammo === Infinity ? '∞' : ammo;
      }
    });
  }

  setAmmo(slot, ammo) {
    if (!this.slotEls || !this.slotEls[slot - 1]) return;
    const a = this.slotEls[slot - 1].querySelector('.wammo');
    if (a) a.textContent = ammo === Infinity ? '∞' : ammo;
  }

  // Crew ability bar: one slot per crew member (Z/X/C) with a name and a
  // cooldown readout. Built once; setCrew refreshes the text and state.
  buildCrewBar() {
    if (!this.crewEl) return;
    this.crewEl.innerHTML = '';
    this.crewSlotEls = [];
    const slots = [{ key: 'Z', name: 'MARA' }, { key: 'X', name: 'SULLY' }, { key: 'C', name: 'KIKI' }];
    for (const c of slots) {
      const d = document.createElement('div');
      d.className = 'cslot ready';
      d.innerHTML = `<span class="ckey">${c.key}</span><span class="cname">${c.name}</span><span class="ccd">READY</span>`;
      this.crewEl.appendChild(d);
      this.crewSlotEls.push(d);
    }
  }

  // Crew refresh: a ready slot glows green, a cooling slot shows seconds.
  // Cached on a key so the per-frame call costs nothing while idle.
  setCrew(crew) {
    if (!this.crewSlotEls || !crew) return;
    const key = JSON.stringify(crew.map((c) => [c.ready, Math.ceil(c.cdLeft)]));
    if (key === this.lastCrewKey) return;
    this.lastCrewKey = key;
    crew.forEach((c, i) => {
      const el = this.crewSlotEls[i];
      if (!el) return;
      el.classList.toggle('ready', !!c.ready);
      el.classList.toggle('cooling', !c.ready);
      const cd = el.querySelector('.ccd');
      if (cd) cd.textContent = c.ready ? 'READY' : Math.ceil(c.cdLeft) + 's';
    });
  }

  // Act title card: big golden "ACT I — HOMECOMING", gone after a few
  // seconds or one click. The caller (main) never shows it in shot mode.
  showActCard(act) {
    if (!this.actCardEl) return;
    if (this.actCardTitleEl) this.actCardTitleEl.textContent = act.act;
    if (this.actCardSubEl) this.actCardSubEl.textContent = act.title;
    this.actCardEl.classList.add('show');
    this.actTimer = 2.8;
  }

  hideActCard() {
    if (this.actCardEl) this.actCardEl.classList.remove('show');
    this.actTimer = 0;
  }

  // Full-map input, bound to the canvas: wheel zooms, drag pans, a plain
  // click drops a waypoint, right-click clears it.
  bindMapInput() {
    const cv = this.mapCanvasEl;
    if (!cv) return;
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const v = this.mapView;
      v.zoom = Math.min(3, Math.max(0.6, v.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    }, { passive: false });
    cv.addEventListener('pointerdown', (e) => {
      this.mapDrag = { x: e.clientX, y: e.clientY, moved: 0, cx: this.mapView.cx, cz: this.mapView.cz };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.mapDrag) return;
      const dx = e.clientX - this.mapDrag.x, dy = e.clientY - this.mapDrag.y;
      this.mapDrag.moved = Math.max(this.mapDrag.moved, Math.abs(dx) + Math.abs(dy));
      if (this.mapDrag.moved > 5) {
        const v = this.mapView;
        const sc = this.mapScale();
        v.cx = this.mapDrag.cx - dx / sc;
        v.cz = this.mapDrag.cz - dy / sc;
      }
    });
    cv.addEventListener('pointerup', (e) => {
      if (this.mapDrag && this.mapDrag.moved <= 5) {
        const r = cv.getBoundingClientRect();
        this.mapView.waypoint = this.canvasToMap(e.clientX - r.left, e.clientY - r.top);
      }
      this.mapDrag = null;
    });
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.mapView.waypoint = null;
    });
    if (this.actCardEl) this.actCardEl.addEventListener('click', () => this.hideActCard());
  }

  // Map transform: world coords -> canvas pixels. The base scale fits the
  // whole island; zoom multiplies it; (cx, cz) is the world point at the
  // canvas centre.
  mapScale() {
    const v = this.mapView;
    return Math.min(520 / 500, 380 / 420) * v.zoom;
  }

  mapToCanvas(x, z) {
    const v = this.mapView;
    const sc = this.mapScale();
    return { x: 260 + (x - v.cx) * sc, y: 190 + (z - v.cz) * sc };
  }

  canvasToMap(cx, cy) {
    const v = this.mapView;
    const sc = this.mapScale();
    return { x: v.cx + (cx - 260) / sc, y: v.cz + (cy - 190) / sc };
  }

  // Portrait for the dialogue box: a stylised 90x90 face per character,
  // drawn once per speaker — Lupe (dark hair, pink streak, pink frame),
  // Kai (red cap, orange jacket), Sully (grey cap, blue frame), Marco
  // (dark hair, moustache, green frame), Aurora (blonde, purple frame),
  // Mara (dark bob, teal frame), Brandt (bald, gold frame).
  drawPortrait(who) {
    const cx = this.portraitCtx;
    if (!cx || !this.portraitEl) return;
    const key = (who || 'Lupe').toLowerCase();
    const conf = {
      lupe: { hair: '#1a1a22', streak: '#ff5da2', frame: '#ff5da2', skin: '#d9a986', feat: 'streak' },
      kai: { hair: '#c22e2e', streak: null, frame: '#ff6a1a', skin: '#d9a986', feat: 'cap' },
      sully: { hair: '#8a8a92', streak: null, frame: '#7db8ff', skin: '#c99a72', feat: 'cap' },
      marco: { hair: '#1a1a10', streak: null, frame: '#7dff8a', skin: '#c99a72', feat: 'moustache' },
      aurora: { hair: '#f2d13c', streak: null, frame: '#c99aff', skin: '#e8b898', feat: 'long' },
      mara: { hair: '#1a1a22', streak: null, frame: '#2fb5a8', skin: '#d9a986', feat: 'bob' },
      brandt: { hair: '#2a2a30', streak: null, frame: '#ffd23f', skin: '#c99a72', feat: 'bald' },
    }[key] || { hair: '#1a1a22', streak: null, frame: '#ff5da2', skin: '#d9a986', feat: 'bob' };
    cx.clearRect(0, 0, 90, 90);
    cx.fillStyle = '#241a2e';
    cx.fillRect(0, 0, 90, 90);
    // Shoulders / jacket.
    cx.fillStyle = key === 'kai' ? '#ff6a1a' : key === 'lupe' ? '#ff5da2' : '#3a4a5a';
    cx.fillRect(0, 68, 90, 22);
    // Face.
    cx.fillStyle = conf.skin;
    cx.beginPath();
    cx.arc(45, 42, 22, 0, Math.PI * 2);
    cx.fill();
    // Hair / feature.
    cx.fillStyle = conf.hair;
    if (conf.feat === 'cap') {
      cx.beginPath();
      cx.arc(45, 34, 22, Math.PI, 0);
      cx.fill();
      cx.fillRect(22, 30, 46, 6);
      cx.fillRect(45, 22, 30, 5); // brim
    } else if (conf.feat === 'long') {
      cx.beginPath();
      cx.arc(45, 34, 23, Math.PI, 0);
      cx.fill();
      cx.fillRect(20, 34, 8, 34);
      cx.fillRect(62, 34, 8, 34);
    } else if (conf.feat === 'bob') {
      cx.beginPath();
      cx.arc(45, 36, 23, Math.PI, 0);
      cx.fill();
      cx.fillRect(21, 36, 10, 26);
      cx.fillRect(59, 36, 10, 26);
    } else if (conf.feat === 'bald') {
      cx.beginPath();
      cx.arc(45, 36, 20, Math.PI, 0);
      cx.fill();
    } else { // streak / default
      cx.beginPath();
      cx.arc(45, 34, 23, Math.PI, 0);
      cx.fill();
      if (conf.streak) {
        cx.fillStyle = conf.streak;
        cx.fillRect(56, 16, 7, 26);
      }
    }
    if (conf.feat === 'moustache') {
      cx.fillStyle = '#1a1a10';
      cx.fillRect(36, 50, 18, 4);
    }
    // Eyes.
    cx.fillStyle = '#1a1a1a';
    cx.beginPath();
    cx.arc(37, 42, 2.5, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.arc(53, 42, 2.5, 0, Math.PI * 2);
    cx.fill();
    this.portraitEl.style.borderColor = conf.frame;
  }

  // Role tag per contact, shown beside the name in the dialogue box.
  static roleFor(who) {
    return {
      Lupe: 'FIXER · PIER SHACK',
      Sully: 'MECHANIC · SULLY’S GARAGE',
      Marco: 'RUNNER · NORTH GATE',
      Aurora: 'DRIVER · MARINA',
      Mara: 'FIXER · MARINA',
      Brandt: 'COLLECTOR · DOWNTOWN',
      Kai: 'DRIVER · SOLARA',
    }[(who || 'Lupe')] || 'FIXER · SOLARA';
  }

  say(text, who, role) {
    if (!this.dialogueEl) return;
    this.dialogueWhoEl.textContent = (who || 'LUPE').toUpperCase() + ':';
    if (this.dialogueRoleEl) this.dialogueRoleEl.textContent = role || HUD.roleFor(who);
    this.dialogueTextEl.textContent = text;
    if (this.dialogueReplyEl) this.dialogueReplyEl.classList.remove('show');
    this.drawPortrait(who);
    this.dialogueEl.classList.add('show');
    this.dialogueTimer = 6;
  }

  // Kai's reply line under the fixer's quote, in Kai's orange.
  reply(text) {
    if (!this.dialogueReplyEl) return;
    this.dialogueReplyEl.textContent = 'KAI: ' + text;
    this.dialogueReplyEl.classList.add('show');
  }

  setCrosshair(show) {
    if (!this.crosshairEl) return;
    this.crosshairEl.classList.toggle('show', !!show);
  }

  toast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    this.toastTimer = 2.5;
  }

  // Hide the toast immediately (staged shots: the mission-start toast
  // would sit on top of the PCPD panel at top-centre).
  hideToast() {
    if (this.toastEl) this.toastEl.classList.remove('show');
    this.toastTimer = 0;
  }

  // PCPD response panel: unit count + response CODE in the header, AIR
  // UNIT DEPLOYED at 3+ stars, first five units live, then a "+N more"
  // line. Each row reads NAME + distance + status (PELICAN-11 39 m
  // PURSUIT), so the panel scans like a dispatch board. Cached on a key
  // so the per-frame call is a no-op while nothing moves. CODE bands:
  // 1 star = CODE 1, 2–3 stars = CODE 2, 4–5 stars = CODE 3.
  static pcpdCode(stars) {
    if (stars <= 0) return 0;
    if (stars <= 1) return 1;
    if (stars <= 3) return 2;
    return 3;
  }

  setPcpd(units, airDeployed, code) {
    if (!this.pcpdListEl) return;
    if (!units || units.length === 0) {
      this.pcpdEl.classList.add('hidden');
      return;
    }
    this.pcpdEl.classList.remove('hidden');
    const codeText = code ? ` · CODE ${code}` : '';
    if (this.pcpdCountEl) this.pcpdCountEl.textContent = `${units.length} ${units.length === 1 ? 'UNIT' : 'UNITS'}${codeText}`;
    if (this.pcpdAirEl) this.pcpdAirEl.classList.toggle('show', !!airDeployed);
    const shown = units.slice(0, 5);
    const key = JSON.stringify(shown) + '|' + (airDeployed ? '1' : '0') + '|' + units.length + '|' + code;
    if (key === this.lastPcpdKey) return;
    this.lastPcpdKey = key;
    let html = shown.map((u) =>
      `<div class="pcpd-row"><span class="pcpd-name">${u.name}</span><span class="pcpd-dist">${u.dist}m</span><span class="pcpd-status">${u.status}</span></div>`
    ).join('');
    if (units.length > shown.length) html += `<div class="pcpd-more">+${units.length - shown.length} more</div>`;
    this.pcpdListEl.innerHTML = html;
  }

  setPrompt(text) {
    if (!this.promptEl) return;
    if (text) {
      this.promptEl.textContent = text;
      this.promptEl.classList.add('show');
    } else {
      this.promptEl.classList.remove('show');
    }
  }

  showTitle(show) { if (this.titleEl) this.titleEl.classList.toggle('hidden', !show); }
  showIntro(show) { if (this.introEl) this.introEl.classList.toggle('hidden', !show); }
  showMap(show) { if (this.mapEl) this.mapEl.classList.toggle('hidden', !show); }

  // Per-frame refresh (10 Hz from main). Most per-frame calls are keyed
  // no-ops when nothing changed; the map renders only while open.
  update(state, dt) {
    if (!state) return;
    this.dialogueTimer -= dt;
    if (this.dialogueTimer <= 0 && this.dialogueEl) this.dialogueEl.classList.remove('show');
    this.toastTimer -= dt;
    if (this.toastTimer <= 0 && this.toastEl) this.toastEl.classList.remove('show');
    this.actTimer -= dt;
    if (this.actTimer <= 0 && this.actCardEl) this.actCardEl.classList.remove('show');
    // Mission panel: chapter · title, stage x/y, progress bar, objective,
    // and the next chapter's name.
    const m = state.mission;
    if (this.missionEl) this.missionEl.classList.toggle('hidden', !m);
    if (m) {
      if (this.missionTitleEl) this.missionTitleEl.textContent = `${m.chapter} · ${m.title}`;
      if (this.missionStageEl) this.missionStageEl.textContent = `STAGE ${m.stage}/${m.stages}`;
      const barKey = `${m.stage}/${m.stages}`;
      if (barKey !== this.lastStageBarKey) {
        this.lastStageBarKey = barKey;
        if (this.missionBarEl) this.missionBarEl.innerHTML = Array.from({ length: m.stages }, (_, i) => `<span class="seg${i < m.stage ? ' filled' : ''}"></span>`).join('');
      }
      if (this.missionObjEl) this.missionObjEl.textContent = m.objective;
      if (this.missionNextEl) this.missionNextEl.textContent = m.next ? `NEXT: ${m.next}` : '';
    }
    // Top-right: money (locale commas), clock, stars + wanted badge.
    if (this.moneyEl) this.moneyEl.textContent = '$' + (state.money || 0).toLocaleString('en-US');
    if (this.clockEl) this.clockEl.textContent = state.clock || '';
    if (this.starsEl) {
      const stars = Math.max(0, Math.min(5, state.stars || 0));
      const key = `${stars}`;
      if (key !== this.lastStarsKey) {
        this.lastStarsKey = key;
        this.starsEl.innerHTML = Array.from({ length: 5 }, (_, i) => i < stars ? '<span class="star-lit">★</span>' : '<span class="star-dim">☆</span>').join('');
      }
    }
    const badge = state.wantedLabel || '';
    if (badge !== this.lastBadgeKey) {
      this.lastBadgeKey = badge;
      if (this.wantedBadgeEl) {
        if (badge) {
          this.wantedBadgeEl.textContent = badge;
          this.wantedBadgeEl.className = 'show ' + (badge === 'IN SIGHT' ? 'insight' : badge === 'HIDDEN' ? 'hidden-badge' : '');
        } else {
          this.wantedBadgeEl.textContent = '';
          this.wantedBadgeEl.className = '';
        }
      }
    }
    // Rank + respect: name, RP bar, numeric RP text.
    if (this.rankNameEl) this.rankNameEl.textContent = state.rankName || '';
    if (this.rpFillEl) this.rpFillEl.style.width = (state.rpPct || 0) + '%';
    if (this.rpTextEl) this.rpTextEl.textContent = state.rpText || '';
    // PCPD panel + evading line.
    this.setPcpd(state.pcpdUnits, state.airDeployed, state.code);
    if (this.evadeEl) {
      if (state.evadeText) {
        this.evadeEl.textContent = state.evadeText;
        this.evadeEl.classList.add('show');
      } else {
        this.evadeEl.classList.remove('show');
      }
    }
    // Weapons + crew bars (cached refreshes).
    this.setWeapons(state.weapons);
    if (state.crew) this.setCrew(state.crew);
    // Health / armour bars.
    if (this.healthFillEl) this.healthFillEl.style.width = (state.health || 0) + '%';
    if (this.healthTextEl) this.healthTextEl.textContent = 'HEALTH ' + Math.round(state.health || 0);
    if (this.armourFillEl) this.armourFillEl.style.width = (state.armour || 0) + '%';
    if (this.armourTextEl) this.armourTextEl.textContent = 'ARMOUR ' + Math.round(state.armour || 0);
    // District + respect readout under the minimap.
    if (this.districtEl && state.district) {
      this.districtEl.textContent = state.district.name;
      const sv = state.district.standing;
      this.districtStandEl.textContent = `${standingLabel(sv)} · ${sv}`;
      this.districtStandEl.className = sv >= 70 ? 'stand-friendly' : sv >= 40 ? 'stand-neutral' : 'stand-wary';
      this.districtDescEl.textContent = state.district.desc;
    }
    if (this.respectEl) this.respectEl.textContent = 'RESPECT ' + (state.respect ?? 0);
    // Radio: station + genre + track.
    if (this.radioEl) this.radioEl.textContent = state.radio.freq;
    if (this.radioGenreEl) this.radioGenreEl.textContent = ' — ' + state.radio.genre;
    if (this.songEl) this.songEl.textContent = state.radio.song;
    // Car HUD: name, condition, speed, gear.
    if (state.car) {
      this.carNameEl.textContent = state.car.name;
      this.carCondEl.textContent = state.car.condText;
      this.carCondBarEl.classList.remove('hidden');
      this.carCondFillEl.style.width = state.car.cond + '%';
      this.carCondFillEl.style.background = state.car.cond > 60 ? '#4caf50' : state.car.cond > 30 ? '#ffb300' : '#ff5a4e';
      this.speedEl.textContent = state.car.speed;
      this.gearEl.textContent = state.car.gear;
    } else {
      this.carNameEl.textContent = 'ON FOOT';
      this.carCondEl.textContent = '';
      this.carCondBarEl.classList.add('hidden');
      this.speedEl.textContent = state.speed || '0';
      this.gearEl.textContent = '';
    }
    // Mission timer bar (timed missions only).
    if (state.timerText) {
      this.timerEl.textContent = state.timerText;
      this.timerEl.classList.add('show');
    } else if (this.timerEl) {
      this.timerEl.classList.remove('show');
    }
    // Minimap + full map (full map only while open).
    this.drawMinimap(state);
    if (this.mapEl && !this.mapEl.classList.contains('hidden')) this.renderMap(state);
  }

  // Circular minimap: blue ocean, cream sand strip, dark grey city,
  // gold beach road, dark blocks, green waypoint, red/grey/black blips,
  // yellow target ring, Kai's wedge at the centre, direction "N".
  drawMinimap(state) {
    const ctx = this.minimapCtx;
    if (!ctx || !this.minimapEl) return;
    const S = this.minimapEl.width || 150;
    const R = 120;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.scale(S / R, S / R); // layout is authored at 120 units, canvas is 150
    ctx.save();
    ctx.beginPath();
    ctx.arc(R / 2, R / 2, 58, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#2f7fb5';
    ctx.fillRect(0, 0, R, R);
    ctx.fillStyle = '#e8d5a0';
    ctx.fillRect(0, 0, 15, R);
    ctx.fillStyle = '#3a3a42';
    ctx.fillRect(15, 0, 105, R);
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(24, 0, 3, R);
    ctx.fillStyle = '#2a2a30';
    for (let gx = 0; gx < 7; gx++) for (let gz = 0; gz < 7; gz++) ctx.fillRect(31 + gx * 12, 8 + gz * 12, 9, 9);
    const px = state.player.x ?? 0;
    const pz = state.player.z ?? 0;
    const scale = R / 460;
    const toM = (x, z) => [60 + (x + 230) * scale, 60 + (z + 230) * scale];
    // Waypoint (green X) and target ring (yellow circle).
    if (state.waypoint) {
      const [wx, wy] = toM(state.waypoint.x, state.waypoint.z);
      ctx.strokeStyle = '#7dff5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx - 4, wy - 4); ctx.lineTo(wx + 4, wy + 4);
      ctx.moveTo(wx + 4, wy - 4); ctx.lineTo(wx - 4, wy + 4);
      ctx.stroke();
    }
    if (state.target) {
      const [tx, ty] = toM(state.target.x, state.target.z);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (state.blips) for (const b of state.blips) {
      const [bx, by] = toM(b.x, b.z);
      ctx.fillStyle = b.col || '#fff';
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Kai's wedge (orange triangle, pointing where he faces).
    const [cx, cy] = toM(px, pz);
    const yaw = state.player.yaw ?? 0;
    ctx.fillStyle = '#ff6a1a';
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(yaw) * 7, cy - Math.cos(yaw) * 7);
    ctx.lineTo(cx + Math.sin(yaw + 2.5) * 6, cy - Math.cos(yaw + 2.5) * 6);
    ctx.lineTo(cx + Math.sin(yaw - 2.5) * 6, cy - Math.cos(yaw - 2.5) * 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#1a1a22';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(R / 2, R / 2, 58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', R / 2, 12);
    ctx.restore(); // undo the 150/120 scale
  }

  // Full map: dark city grid with ocean, beach road, district names,
  // landmarks, jobs, waypoint, mission blips and a zoom/pan hint.
  renderMap(state) {
    const ctx = this.mapCtx;
    if (!ctx || !this.mapCanvasEl) return;
    const W = 520, H = 380;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f141c';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1a3a5a';
    const sc = this.mapScale();
    const left = 260 + (-230 - this.mapView.cx) * sc;
    ctx.fillRect(left, 0, 230 * sc, H);
    ctx.fillStyle = '#e8d5a0';
    ctx.fillRect(260 + (-200 - this.mapView.cx) * sc, 0, 17 * sc, H);
    const beach = this.mapToCanvas(-160, 0);
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(beach.x - 1, 0, 2, H);
    ctx.fillStyle = '#2a2a30';
    for (let gx = 0; gx < 7; gx++) for (let gz = 0; gz < 7; gz++) {
      const p = this.mapToCanvas(-160 + gx * 40 + 20, -160 + gz * 40 + 20);
      ctx.fillRect(p.x - 4 * sc, p.y - 4 * sc, 8 * sc, 8 * sc);
    }
    // District labels.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const p = this.mapToCanvas(d.x, d.z);
      ctx.fillText(d.name, p.x, p.y);
    }
    // Landmarks (green), jobs (yellow), waypoint (green X), mission blips (yellow ring).
    for (const lm of LANDMARKS) {
      const p = this.mapToCanvas(lm.x, lm.z);
      ctx.fillStyle = '#7dff5e';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText(lm.label, p.x, p.y - 8);
    }
    for (const j of SIDE_JOBS) {
      const p = this.mapToCanvas(j.x, j.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText(j.label, p.x, p.y - 8);
    }
    if (state.waypoint) {
      const p = this.mapToCanvas(state.waypoint.x, state.waypoint.z);
      ctx.strokeStyle = '#7dff5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 6, p.y - 6); ctx.lineTo(p.x + 6, p.y + 6);
      ctx.moveTo(p.x + 6, p.y - 6); ctx.lineTo(p.x - 6, p.y + 6);
      ctx.stroke();
    }
    if (state.target) {
      const p = this.mapToCanvas(state.target.x, state.target.z);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Kai's wedge.
    const cp = this.mapToCanvas(state.player.x, state.player.z);
    ctx.fillStyle = '#ff6a1a';
    ctx.beginPath();
    ctx.moveTo(cp.x + Math.sin(state.player.yaw) * 8, cp.y - Math.cos(state.player.yaw) * 8);
    ctx.lineTo(cp.x + Math.sin(state.player.yaw + 2.5) * 6, cp.y - Math.cos(state.player.yaw + 2.5) * 6);
    ctx.lineTo(cp.x + Math.sin(state.player.yaw - 2.5) * 6, cp.y - Math.cos(state.player.yaw - 2.5) * 6);
    ctx.closePath();
    ctx.fill();
    if (this.mapMissionsEl) {
      this.mapMissionsEl.innerHTML = MISSIONS.map((m, i) => `<div class="map-job${i === state.missionIdx ? ' current' : ''}">CH.${i + 1} · ${m.title} — $${m.reward}</div>`).join('');
    }
    if (this.mapStatsEl) {
      this.mapStatsEl.textContent = `DISTRICTS HELD ${state.districtsHeld || 0}/7 · RESPECT ${state.respect || 0} · CASH $${(state.money || 0).toLocaleString('en-US')}`;
    }
    if (this.mapFooterEl) {
      this.mapFooterEl.textContent = 'Click to set waypoint · Drag to pan · Scroll to zoom · Right-click clears · M / ESC closes';
    }
  }
}
