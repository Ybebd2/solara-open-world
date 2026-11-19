// SOLARA — HUD: dense always-on interface. Mission top-left; big money,
// clock and gold stars top-right; PCPD panel top-center; weapon bar
// bottom; circular minimap + district + respect bottom-left; radio + car
// bottom-right; dialogue bottom-center; context prompt; map overlay;
// title screen. DOM refs all use the *El suffix — no element ever
// shadows a method (the toast() method uses this.toastEl, never a
// property named toast). Built fresh for the @witty-meteor-32 build.
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
    cx.fillStyle = '#241a2e'; cx.fillRect(0, 0, 90, 90);
    // Shoulders / jacket.
    cx.fillStyle = key === 'kai' ? '#ff6a1a' : key === 'lupe' ? '#ff5da2' : '#3a4a5a';
    cx.fillRect(0, 68, 90, 22);
    // Face.
    cx.fillStyle = conf.skin;
    cx.beginPath(); cx.arc(45, 42, 22, 0, Math.PI * 2); cx.fill();
    // Hair / feature.
    cx.fillStyle = conf.hair;
    if (conf.feat === 'cap') {
      cx.beginPath(); cx.arc(45, 34, 22, Math.PI, 0); cx.fill();
      cx.fillRect(22, 30, 46, 6);
      cx.fillRect(45, 22, 30, 5); // brim
    } else if (conf.feat === 'long') {
      cx.beginPath(); cx.arc(45, 34, 23, Math.PI, 0); cx.fill();
      cx.fillRect(20, 34, 8, 34); cx.fillRect(62, 34, 8, 34);
    } else if (conf.feat === 'bob') {
      cx.beginPath(); cx.arc(45, 36, 23, Math.PI, 0); cx.fill();
      cx.fillRect(21, 36, 10, 26); cx.fillRect(59, 36, 10, 26);
    } else if (conf.feat === 'bald') {
      cx.beginPath(); cx.arc(45, 36, 20, Math.PI, 0); cx.fill();
    } else { // streak / default
      cx.beginPath(); cx.arc(45, 34, 23, Math.PI, 0); cx.fill();
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
    cx.beginPath(); cx.arc(37, 42, 2.5, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(53, 42, 2.5, 0, Math.PI * 2); cx.fill();
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
    if (text) { this.promptEl.textContent = text; this.promptEl.classList.add('show'); }
    else this.promptEl.classList.remove('show');
  }

  showTitle(show) { if (this.titleEl) this.titleEl.classList.toggle('hidden', !show); }
  showIntro(show) { if (this.introEl) this.introEl.classList.toggle('hidden', !show); }
  showMap(show) { if (this.mapEl) this.mapEl.classList.toggle('hidden', !show); }

  update(s) {
    // s is the live state bag from main.hudState(): money, hours, stars,
    // rank, rp, mission, district, radio, car, weapons, evading, wanted,
    // position, heading, police, target, health, armour.
    if (this.moneyEl) this.moneyEl.textContent = '$' + Math.floor(s.money).toLocaleString('en-US');
    if (this.clockEl) {
      const h = Math.floor(s.hours), m = Math.floor((s.hours - h) * 60);
      this.clockEl.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
    if (this.starsEl) {
      // Per-star spans: filled stars saturated gold #FFC83D, empty ones
      // dark-grey outlines — so 3 gold + 2 grey reads at a glance.
      const key = String(s.stars);
      if (key !== this.lastStarsKey) {
        this.lastStarsKey = key;
        let html = '';
        for (let i = 0; i < 5; i++) {
          html += i < s.stars
            ? '<span class="star-lit">★</span>'
            : '<span class="star-dim">☆</span>';
        }
        this.starsEl.innerHTML = html;
      }
    }
    // Wanted badge: IN SIGHT (red) while a unit sees Kai, HIDDEN (blue)
    // while the search grid runs and the EVADING meter climbs.
    if (this.wantedBadgeEl) {
      const bkey = s.stars > 0 ? (s.hidden ? 'HIDDEN' : 'IN SIGHT') : '';
      if (bkey !== this.lastBadgeKey) {
        this.lastBadgeKey = bkey;
        if (!bkey) this.wantedBadgeEl.classList.remove('show');
        else {
          this.wantedBadgeEl.textContent = bkey;
          this.wantedBadgeEl.className = 'show ' + (bkey === 'HIDDEN' ? 'hidden-badge' : 'insight');
        }
      }
    }
    if (this.rankNameEl) this.rankNameEl.textContent = s.rank || '';
    if (this.rpFillEl) this.rpFillEl.style.width = (s.rpNext ? Math.min(100, (s.rp / s.rpNext) * 100) : 100) + '%';
    if (this.rpTextEl) this.rpTextEl.textContent = s.rpNext
      ? `${Math.floor(s.rp).toLocaleString('en-US')}/${s.rpNext.toLocaleString('en-US')} RP`
      : `${Math.floor(s.rp).toLocaleString('en-US')} RP · MAX`;
    if (this.missionTitleEl) this.missionTitleEl.textContent = `CH.${s.missionIndex + 1} · ${s.missionTitle}`;
    if (this.missionStageEl) this.missionStageEl.textContent = s.missionStage || '';
    // Stage bar: one segment per stage, filled gold-orange up to the
    // current stage — the 4-segment bar the top-3 panels all show.
    if (this.missionBarEl) {
      const bkey = `${s.stageIndex || 0}/${s.stageTotal || 0}`;
      if (bkey !== this.lastStageBarKey) {
        this.lastStageBarKey = bkey;
        const segs = this.missionBarEl.querySelectorAll('.seg');
        segs.forEach((el, i) => el.classList.toggle('filled', i < (s.stageIndex || 0)));
      }
    }
    if (this.missionObjEl) this.missionObjEl.textContent = s.objective;
    if (this.missionNextEl) this.missionNextEl.textContent = s.nextObjective ? 'NEXT: ' + s.nextObjective : '';
    if (this.timerEl) {
      if (s.timer > 0) { this.timerEl.textContent = s.timer + 's'; this.timerEl.classList.add('show'); }
      else this.timerEl.classList.remove('show');
    }
    if (this.evadeEl) {
      if (s.wanted) { this.evadeEl.textContent = 'EVADING ' + Math.floor(s.evading) + '%'; this.evadeEl.classList.add('show'); }
      else this.evadeEl.classList.remove('show');
    }
    if (this.healthFillEl) this.healthFillEl.style.width = Math.max(0, Math.min(100, s.health)) + '%';
    if (this.healthTextEl) this.healthTextEl.textContent = 'HEALTH ' + Math.round(s.health);
    if (this.armourFillEl) this.armourFillEl.style.width = Math.max(0, Math.min(100, s.armour)) + '%';
    if (this.armourTextEl) this.armourTextEl.textContent = 'ARMOUR ' + Math.round(s.armour);
    // District readout: name, standing pill (WARY / NEUTRAL / FRIENDLY +
    // value, coloured by band), and the one-line blurb.
    if (this.districtEl) this.districtEl.textContent = s.district;
    if (this.districtStandEl && s.districtLabel) {
      this.districtStandEl.textContent = `${s.districtLabel} · ${Math.round(s.districtStanding)}`;
      this.districtStandEl.className = 'stand-' + s.districtLabel.toLowerCase();
    }
    if (this.districtDescEl) this.districtDescEl.textContent = s.districtDesc || '';
    if (this.respectEl) this.respectEl.textContent = 'RESPECT ' + s.respect;
    if (this.radioEl) this.radioEl.textContent = s.radio;
    if (this.radioGenreEl) this.radioGenreEl.textContent = s.radioGenre ? ' — ' + s.radioGenre : '';
    if (this.songEl) this.songEl.textContent = s.song;
    if (this.speedEl) this.speedEl.textContent = s.inCar ? String(Math.round(s.carSpeed * 3.6)) : '0';
    if (this.carNameEl) this.carNameEl.textContent = s.inCar ? s.carName : 'ON FOOT';
    if (this.carCondEl) this.carCondEl.textContent = s.inCar ? `${Math.round(s.carCond)}% ${s.carCondLabel}` : '';
    if (this.carCondFillEl) this.carCondFillEl.style.width = (s.inCar ? Math.max(0, Math.min(100, s.carCond)) : 0) + '%';
    if (this.carCondBarEl) this.carCondBarEl.style.display = s.inCar ? '' : 'none';
    if (this.gearEl) this.gearEl.textContent = s.inCar ? 'G' + s.carGear : '';
    this.setWeapons(s.weapons);
    this.setCrew(s.crew);
    // Waypoint for the minimap route line (set on the full map, read here).
    this.waypoint = s.waypoint || null;
    this.drawMinimap(s);
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= 1 / 60;
      if (this.dialogueTimer <= 0) this.dialogueEl.classList.remove('show');
    }
    // Act card counts down from showActCard, then dismisses itself.
    if (this.actTimer > 0) {
      this.actTimer -= 1 / 60;
      if (this.actTimer <= 0) this.hideActCard();
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= 1 / 60;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
  }

  drawMinimap(s) {
    const ctx = this.minimapCtx;
    if (!ctx) return;
    const W = 150, H = 150, R = 75;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(10,16,28,0.85)'; ctx.fillRect(0, 0, W, H);
    // World -210..210 maps onto the 150px circle.
    const sc = W / 420;
    const px = (x) => (x + 210) * sc, py = (z) => (z + 210) * sc;
    // Roads.
    ctx.strokeStyle = 'rgba(200,200,220,0.5)'; ctx.lineWidth = 2;
    for (let v = -160; v <= 160; v += 40) {
      ctx.beginPath(); ctx.moveTo(px(v), py(-200)); ctx.lineTo(px(v), py(200)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(-200), py(v)); ctx.lineTo(px(200), py(v)); ctx.stroke();
    }
    // Ocean on the west edge (shoreline x=-190).
    ctx.fillStyle = 'rgba(40,110,170,0.8)'; ctx.fillRect(0, 0, px(-190), H);
    // Waypoint route: dashed gold line from the player, white dot at the end.
    if (this.waypoint) {
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(px(s.px), py(s.pz)); ctx.lineTo(px(this.waypoint.x), py(this.waypoint.y)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(px(this.waypoint.x), py(this.waypoint.y), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // District names at their centres.
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2;
      ctx.fillText(d.name, px(cx), py(cz));
    }
    // Landmark + side-job chips: a coloured square with a letter.
    ctx.font = 'bold 8px sans-serif';
    for (const lm of [...LANDMARKS, ...SIDE_JOBS]) {
      const lx = px(lm.x), ly = py(lm.z);
      ctx.fillStyle = lm.color;
      ctx.fillRect(lx - 3, ly - 3, 6, 6);
      ctx.fillStyle = '#0c1420';
      ctx.fillText(lm.icon, lx, ly + 3);
    }
    // Search grid while wanted: a blue circle around the player with a
    // red edge — the PCPD cordon closing in (or the HIDDEN variant's
    // search area while the EVADING meter climbs).
    if (s.wanted) {
      ctx.fillStyle = 'rgba(59,130,246,0.18)';
      ctx.beginPath(); ctx.arc(px(s.px), py(s.pz), 34, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px(s.px), py(s.pz), 34, 0, Math.PI * 2); ctx.stroke();
    }
    // Target beacon.
    if (s.target) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(px(s.target.x), py(s.target.z), 5, 0, Math.PI * 2); ctx.fill();
    }
    // Police dots. Kiki's LOOKOUT reveals every patrol (officers + heli);
    // otherwise only the cruisers show.
    const dots = s.reveal && s.policeAll ? s.policeAll : (s.police || []);
    ctx.fillStyle = '#ff4444';
    for (const u of dots) {
      if (u.x !== undefined) { ctx.beginPath(); ctx.arc(px(u.x), py(u.z), 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // Player arrow (rotates with heading).
    ctx.save();
    ctx.translate(px(s.px), py(s.pz));
    ctx.rotate(-s.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N', R, 13);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(R, R, R - 1, 0, Math.PI * 2); ctx.stroke();
  }

  // Full map (M): district fills + names + standing, roads, pier,
  // landmark chips with labels, gold route to the target, white route to
  // the waypoint, and a footer with the objective + distances.
  renderMap(s) {
    if (!this.mapEl || this.mapEl.classList.contains('hidden')) return;
    if (this.mapMissionsEl) {
      this.mapMissionsEl.innerHTML = MISSIONS.map((m, i) =>
        `<div class="map-job${i === s.missionIndex ? ' current' : ''}${i < s.missionIndex ? ' done' : ''}">${i + 1}. ${m.title} — ${m.contact}</div>`
      ).join('');
    }
    if (this.mapStatsEl) {
      this.mapStatsEl.textContent = `Money $${Math.floor(s.money)} · ${s.rank || ''} · ${Math.floor(s.rp)} RP · Respect ${s.respect} · Wanted ${'★'.repeat(s.stars)}${'☆'.repeat(5 - s.stars)} · ${s.district}`;
    }
    // Footer: current objective + distance, plus waypoint distance.
    if (this.mapFooterEl) {
      const parts = [];
      if (s.target) {
        const d = dist2d(s.px, s.pz, s.target.x, s.target.z);
        parts.push(`${s.objective || 'Objective'} · ${(d / 1000).toFixed(2)} km`);
      }
      const wp = this.mapView.waypoint;
      if (wp) {
        const dw = dist2d(s.px, s.pz, wp.x, wp.y);
        parts.push(`WAYPOINT · ${(dw / 1000).toFixed(2)} km`);
      }
      this.mapFooterEl.textContent = parts.join('   ·   ') || (s.objective || '');
    }
    const ctx = this.mapCtx;
    if (!ctx) return;
    const W = 520, H = 380;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0c1420'; ctx.fillRect(0, 0, W, H);
    const px = (x) => this.mapToCanvas(x, 0).x;
    const py = (z) => this.mapToCanvas(0, z).y;
    const sc = this.mapScale();
    // Ocean (west) + sand strip (shoreline x=-190, road edge x=-160).
    ctx.fillStyle = '#1e5f8a';
    ctx.fillRect(0, 0, px(-190), H);
    ctx.fillStyle = '#d9b98a';
    ctx.fillRect(px(-190), 0, px(-160) - px(-190), H);
    // District fills: translucent colour + name + standing.
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const hex = '#' + d.color.toString(16).padStart(6, '0');
      const x0 = px(d.x0), y0 = py(d.z0), x1 = px(d.x1), y1 = py(d.z1);
      ctx.fillStyle = hex; ctx.globalAlpha = 0.16;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.globalAlpha = 0.55; ctx.strokeStyle = hex; ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.globalAlpha = 1;
      const val = s.standing ? (s.standing[d.name] ?? 55) : 55;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText(d.name, cx, cy - 2);
      ctx.fillStyle = '#ffd9a0'; ctx.font = '11px sans-serif';
      ctx.fillText(`${standingLabel(val)} · ${val}`, cx, cy + 13);
    }
    // Roads.
    ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = Math.max(2, 5 * (sc / 0.9));
    for (let v = -160; v <= 160; v += 40) {
      ctx.beginPath(); ctx.moveTo(px(v), 0); ctx.lineTo(px(v), H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, py(v)); ctx.lineTo(W, py(v)); ctx.stroke();
    }
    // Pier deck.
    ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(px(-262), py(20)); ctx.lineTo(px(-178), py(20)); ctx.stroke();
    // Landmarks + side jobs: icon chip + label.
    ctx.font = 'bold 11px sans-serif';
    for (const lm of [...LANDMARKS, ...SIDE_JOBS]) {
      const p = this.mapToCanvas(lm.x, lm.z);
      ctx.fillStyle = lm.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0c1420'; ctx.textAlign = 'center';
      ctx.fillText(lm.icon, p.x, p.y + 4);
      ctx.fillStyle = '#e8ecf4'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(lm.label, p.x + 11, p.y + 4);
      ctx.font = 'bold 11px sans-serif';
    }
    // Route lines: gold dashed player -> target, white dashed player -> waypoint.
    ctx.setLineDash([8, 6]);
    if (s.target) {
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px(s.px), py(s.pz)); ctx.lineTo(px(s.target.x), py(s.target.z)); ctx.stroke();
    }
    const wp = this.mapView.waypoint;
    if (wp) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px(s.px), py(s.pz)); ctx.lineTo(px(wp.x), py(wp.y)); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(px(wp.x), py(wp.y), 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0c1420'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('W', px(wp.x), py(wp.y) + 3);
    }
    ctx.setLineDash([]);
    // Target beacon + player dot.
    if (s.target) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(px(s.target.x), py(s.target.z), 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(px(s.px), py(s.pz), 6, 0, Math.PI * 2); ctx.fill();
    // Zoom / pan hint.
    ctx.fillStyle = '#8fa0b8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Wheel — zoom · Drag — pan · Click — waypoint · Right-click — clear', 8, H - 8);
  }
}
