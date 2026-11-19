// SOLARA v3 — the HUD and the menus. The HUD is DOM plus 2D canvas maps:
// a circular minimap (roads, buildings, ocean, player, traffic, police,
// mission marker, garage and shop markers) and a full map overlay (M) with
// districts, a legend, a yellow route line to the objective, the 8-mission
// list and the stats.
//
// v3 dense HUD: mission panel top-left (job name, stage x/8, current
// objective, next objective); money, clock and wanted stars top-right — BIG
// money, prominent gold stars; weapon slots 1-5 as a numbered bar below
// (1 FISTS infinite, 2 pistol with ammo, 3-5 LOCKED with a price); a PCPD
// response panel top-center while wanted (unit callsigns, live distances in
// metres, SEARCHING/PURSUIT/SPOTLIGHT status, the evading %); circular
// minimap + district name + respect meter bottom-left; radio station and
// song + vehicle name, condition %, speed and gear bottom-right; a dialogue
// box bottom-center; a "Press F - Carjack <car>" prompt centre screen. The
// health bar changes colour with the player's condition (green, amber, red)
// and the health label blinks while health is critical; the speedometer
// shows REV while the car rolls backwards.

import { DISTRICTS } from './config.js';

export class HUD {
  constructor() {
    this.hud = document.getElementById('hud');
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.fullMap = document.getElementById('fullMap');
    this.fullMapCtx = this.fullMap ? this.fullMap.getContext('2d') : null;
    this.wantedEl = document.getElementById('wanted');
    this.cashEl = document.getElementById('cash');
    this.clockEl = document.getElementById('clock');
    this.weaponBarEl = document.getElementById('weaponBar');
    this.pcpdEl = document.getElementById('pcpd');
    this.pcpdUnitsEl = document.getElementById('pcpdUnits');
    this.pcpdEvadeEl = document.getElementById('pcpdEvade');
    this.objectiveTitleEl = document.getElementById('objectiveTitle');
    this.objectiveEl = document.getElementById('objectiveText');
    this.objectiveNextEl = document.getElementById('objectiveNext');
    this.healthFill = document.getElementById('healthFill');
    this.healthLabel = document.getElementById('healthLabel');
    this.ammoEl = document.getElementById('ammo');
    this.speedEl = document.getElementById('speed');
    this.carInfoEl = document.getElementById('carInfo');
    this.radioEl = document.getElementById('radio');
    this.districtEl = document.getElementById('district');
    this.respectFill = document.getElementById('respectFill');
    this.respectLabel = document.getElementById('respectLabel');
    this.dialogueEl = document.getElementById('dialogue');
    this.dialogueSpeakerEl = document.getElementById('dialogueSpeaker');
    this.dialogueTextEl = document.getElementById('dialogueText');
    this.promptEl = document.getElementById('prompt');
    this.toastEl = document.getElementById('toast');
    this.hintEl = document.getElementById('hint');
    this.toastTimer = 0;
    this.dialogueTimer = 0;
    this._weaponHtml = '';
    this._pcpdHtml = '';
    this._lastState = null;
  }

  show() { this.hud.classList.remove('hidden'); }
  hide() { this.hud.classList.add('hidden'); }

  toast(msg, seconds = 3) {
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = '1';
    this.toastTimer = seconds;
  }

  // A line of dialogue from a character, shown bottom-center for a while.
  dialogue(speaker, text, seconds = 6) {
    this.dialogueSpeakerEl.textContent = speaker;
    this.dialogueTextEl.textContent = text;
    this.dialogueEl.classList.remove('hidden');
    this.dialogueTimer = seconds;
  }

  clearDialogue() {
    this.dialogueEl.classList.add('hidden');
    this.dialogueTimer = 0;
  }

  // The centre-screen interaction prompt ("Press F - Carjack Comet").
  setPrompt(text) {
    if (!text) {
      this.promptEl.classList.add('hidden');
      return;
    }
    this.promptEl.textContent = text;
    this.promptEl.classList.remove('hidden');
  }

  tick(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.opacity = '0';
    }
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.dialogueEl.classList.add('hidden');
    }
  }

  // state: { stars, evading, cash, clock, missionTitle, missionStage,
  //   missionNext, objective, health, ammo, ammoMax, speed, gear, inCar,
  //   carName, carCondition, timeLeft, district, respect, weapons,
  //   weaponIndex, radioStation, radioSong, pcpdUnits, playerPos,
  //   playerHeading, world, traffic, policeCars, heli, missionTarget, places }
  update(s) {
    this._lastState = s;
    // Wanted stars: filled gold, the rest dim — big and prominent.
    let stars = '';
    for (let i = 0; i < 5; i++) {
      stars += i < s.stars ? '<span>★</span>' : '<span class="off">★</span>';
    }
    this.wantedEl.innerHTML = stars;
    this.cashEl.textContent = '$' + s.cash.toLocaleString('en-US');
    this.clockEl.textContent = s.clock;
    // Mission panel: job name + stage, objective, next job.
    this.objectiveTitleEl.textContent = s.missionTitle;
    let obj = s.objective;
    if (s.timeLeft > 0) obj += ` — ${Math.ceil(s.timeLeft)}s left`;
    this.objectiveEl.textContent = obj;
    this.objectiveNextEl.textContent = s.missionNext ? `NEXT: ${s.missionNext}` : 'FINAL JOB';
    // Weapon bar: five numbered slots; locked ones show their price.
    const wHtml = s.weapons.map((w, i) => {
      const active = i === s.weaponIndex ? ' active' : '';
      const label = w.locked
        ? `${i + 1} ${w.name} · LOCKED $${w.price}`
        : `${i + 1} ${w.name}${w.ammo === Infinity ? ' ∞' : ' ' + s.ammoBySlot[i]}`;
      return `<span class="slot${active}${w.locked ? ' locked' : ''}">${label}</span>`;
    }).join('');
    if (wHtml !== this._weaponHtml) {
      this.weaponBarEl.innerHTML = wHtml;
      this._weaponHtml = wHtml;
    }
    // PCPD response panel: only while wanted. Units with live distances,
    // status, and the evading meter.
    if (s.stars > 0 && s.pcpdUnits) {
      this.pcpdEl.classList.remove('hidden');
      const uHtml = s.pcpdUnits.map((u) => {
        const cls = u.heli ? ' heli' : '';
        return `<div class="unit${cls}"><b>${u.name}</b><span>${u.dist}m</span><i>${u.status}</i></div>`;
      }).join('');
      if (uHtml !== this._pcpdHtml) {
        this.pcpdUnitsEl.innerHTML = uHtml;
        this._pcpdHtml = uHtml;
      }
      this.pcpdEvadeEl.textContent = `EVADING ${Math.round(s.evading)}%`;
    } else {
      this.pcpdEl.classList.add('hidden');
      this._pcpdHtml = '';
    }
    // Health: the bar shrinks and changes colour as the player is hurt —
    // green while healthy, amber when wounded, red when critical — and the
    // label blinks below 25 so a dying player cannot miss it.
    const hp = Math.max(0, Math.round(s.health));
    this.healthFill.style.width = hp + '%';
    this.healthFill.style.background = hp >= 50
      ? 'linear-gradient(90deg, #37d67a, #7dff9a)'
      : hp >= 25
        ? 'linear-gradient(90deg, #e0a52e, #ffd23f)'
        : 'linear-gradient(90deg, #d63a37, #ff5a5a)';
    this.healthLabel.textContent = 'Health ' + hp;
    this.healthLabel.style.color = hp < 25
      ? (Math.floor(performance.now() / 400) % 2 === 0 ? '#ff5a5a' : '#ffffff')
      : '';
    // Respect meter.
    const rp = Math.max(0, Math.min(100, Math.round(s.respect)));
    this.respectFill.style.width = rp + '%';
    this.respectLabel.textContent = `Respect ${rp}`;
    // District name.
    this.districtEl.textContent = s.district;
    // Radio: station + song.
    this.radioEl.innerHTML = s.radioStation
      ? `<b>${s.radioStation}</b> · ${s.radioSong}`
      : '';
    // Car info: name, condition, speed and gear; ammo on foot.
    if (s.inCar) {
      this.carInfoEl.innerHTML = `<b>${s.carName}</b> · Condition ${Math.round(s.carCondition)}%`;
      this.speedEl.textContent = `${Math.round(Math.abs(s.speed) * 3.6)} km/h · ${s.gear}${s.speed < -0.5 ? ' · REV' : ''}`;
      this.ammoEl.textContent = '';
    } else {
      this.carInfoEl.innerHTML = '';
      this.speedEl.textContent = '';
      this.ammoEl.textContent = s.weaponIndex > 0
        ? `Ammo ${s.ammo === Infinity ? '∞' : s.ammo} / ${s.ammoMax === Infinity ? '∞' : s.ammoMax}`
        : '';
    }
    this.drawMinimap(s);
    if (!document.getElementById('mapScreen').classList.contains('hidden')) {
      this.drawFullMap(s);
    }
  }

  drawMinimap(s) {
    const ctx = this.mapCtx;
    const W = this.map.width;
    const H = this.map.height;
    const world = s.world;
    const span = (world.half + 60) * 2;
    const toMap = (x, z) => [W / 2 + (x / span) * W, H / 2 + (z / span) * H];
    ctx.clearRect(0, 0, W, H);
    // Sea and sand at the bottom (south).
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(0, 0, W, H);
    const [bx] = toMap(0, world.half + 14);
    ctx.fillStyle = '#2a7ab8';
    ctx.fillRect(0, bx + 40, W, H - bx - 40);
    ctx.fillStyle = '#e8d9a0';
    ctx.fillRect(0, bx + 22, W, 18);
    // Roads.
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 7;
    for (const r of world.roads.horizontal) {
      const [x0, y] = toMap(-world.half - 14, r.z);
      const [x1] = toMap(world.half + 14, r.z);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    }
    for (const r of world.roads.vertical) {
      const [x, y0] = toMap(r.x, -world.half - 14);
      const [, y1] = toMap(r.x, world.half + 14);
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#6b7280';
    for (const b of world.buildings) {
      const [x0, y0] = toMap(b.minX, b.minZ);
      const [x1, y1] = toMap(b.maxX, b.maxZ);
      ctx.fillRect(x0, y0, Math.max(2, x1 - x0), Math.max(2, y1 - y0));
    }
    // Garage (wrench) and arms shop (crosshair) markers.
    const mark = (place, colour, letter) => {
      const [x, y] = toMap(place.x, place.z);
      ctx.fillStyle = colour;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, x, y);
    };
    if (s.places) {
      mark(s.places.garage, '#19b5a6', 'G');
      mark(s.places.armsShop, '#ff5a5a', 'A');
      mark(s.places.safehouse, '#7dff9a', 'H');
    }
    // Mission marker: a pulsing gold ring.
    if (s.missionTarget) {
      const [mx, my] = toMap(s.missionTarget.x, s.missionTarget.z);
      const pulse = 6 + Math.sin(performance.now() * 0.006) * 2;
      ctx.strokeStyle = '#ffb300';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mx, my, pulse + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffb300';
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
    }
    // Traffic cars: small yellow dots.
    ctx.fillStyle = '#f5c542';
    for (const c of s.traffic) {
      const [x, y] = toMap(c.pos.x, c.pos.z);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Police: red and blue dots. The helicopter: a white ring.
    for (const c of s.policeCars) {
      const [x, y] = toMap(c.pos.x, c.pos.z);
      ctx.fillStyle = '#ff2222';
      ctx.beginPath(); ctx.arc(x - 2, y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2244ff';
      ctx.beginPath(); ctx.arc(x + 2, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    if (s.heli) {
      const [x, y] = toMap(s.heli.pos.x, s.heli.pos.z);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
    }
    // The player: a white arrow pointing where they face.
    const [px, py] = toMap(s.playerPos.x, s.playerPos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(s.playerHeading), Math.cos(s.playerHeading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // The full map (M): districts with names, the legend, a yellow route line
  // from the player to the objective, and the place markers.
  drawFullMap(s) {
    if (!this.fullMapCtx) return;
    const ctx = this.fullMapCtx;
    const W = this.fullMap.width;
    const H = this.fullMap.height;
    const world = s.world;
    const span = (world.half + 80) * 2;
    const toMap = (x, z) => [W / 2 + (x / span) * W, H / 2 + (z / span) * H];
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#141a24';
    ctx.fillRect(0, 0, W, H);
    // District blocks.
    for (const d of DISTRICTS) {
      const [x0, y0] = toMap(d.x0, d.z0);
      const [x1, y1] = toMap(d.x1, d.z1);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = '#cfe8ff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.name.toUpperCase(), (x0 + x1) / 2, (y0 + y1) / 2);
    }
    // Sea and sand.
    const [, by] = toMap(0, world.half + 14);
    ctx.fillStyle = '#2a7ab8';
    ctx.fillRect(0, by + 40, W, H - by - 40);
    ctx.fillStyle = '#e8d9a0';
    ctx.fillRect(0, by + 22, W, 18);
    // Roads.
    ctx.strokeStyle = '#4a4f58';
    ctx.lineWidth = 5;
    for (const r of world.roads.horizontal) {
      const [x0, y] = toMap(-world.half - 14, r.z);
      const [x1] = toMap(world.half + 14, r.z);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    }
    for (const r of world.roads.vertical) {
      const [x, y0] = toMap(r.x, -world.half - 14);
      const [, y1] = toMap(r.x, world.half + 14);
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    }
    // Yellow route line from the player to the objective.
    if (s.missionTarget) {
      const [px, py] = toMap(s.playerPos.x, s.playerPos.z);
      const [tx, ty] = toMap(s.missionTarget.x, s.missionTarget.z);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 6]);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffb300';
      ctx.beginPath(); ctx.arc(tx, ty, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1200';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', tx, ty);
    }
    // Place markers.
    const mark = (place, colour, letter) => {
      const [x, y] = toMap(place.x, place.z);
      ctx.fillStyle = colour;
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, x, y);
    };
    if (s.places) {
      mark(s.places.garage, '#19b5a6', 'G');
      mark(s.places.armsShop, '#ff5a5a', 'A');
      mark(s.places.safehouse, '#7dff9a', 'H');
      mark(s.places.raceStart, '#ffd23f', 'R');
    }
    // The player arrow.
    const [px, py] = toMap(s.playerPos.x, s.playerPos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(s.playerHeading), Math.cos(s.playerHeading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(8, 9); ctx.lineTo(-8, 9); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Fill the map side panel: the 8-mission list and the stats.
  fillMapPanel(missions, stats) {
    const list = document.getElementById('mapMissions');
    list.innerHTML = missions.map((m) => {
      const cls = m.state === 'done' ? 'done' : m.state === 'current' ? 'current' : '';
      return `<div class="mapJob ${cls}"><b>${m.num}. ${m.title}</b><span>${m.reward}</span></div>`;
    }).join('');
    document.getElementById('mapStats').innerHTML = stats.map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join('');
  }
}

// Wire the menu buttons. callbacks: { onPlay, onContinue, onResume,
// onRestart, onRetry, onControls, onControlsClose, onMapResume, onMapSave,
// onMapLoad, onMapQuit, onGarageLeave, onGarageBuy }. Returns helpers to
// show each screen.
export function bindMenus(callbacks) {
  const start = document.getElementById('startScreen');
  const pause = document.getElementById('pauseScreen');
  const over = document.getElementById('overScreen');
  const loading = document.getElementById('loading');
  const mapScreen = document.getElementById('mapScreen');
  const controls = document.getElementById('controlsScreen');
  const garage = document.getElementById('garageScreen');
  const continueBtn = document.getElementById('continueBtn');
  document.getElementById('playBtn').addEventListener('click', () => callbacks.onPlay());
  continueBtn.addEventListener('click', () => callbacks.onContinue());
  document.getElementById('controlsBtn').addEventListener('click', () => callbacks.onControls());
  document.getElementById('controlsCloseBtn').addEventListener('click', () => callbacks.onControlsClose());
  document.getElementById('resumeBtn').addEventListener('click', () => callbacks.onResume());
  document.getElementById('restartBtn').addEventListener('click', () => callbacks.onRestart());
  document.getElementById('retryBtn').addEventListener('click', () => callbacks.onRetry());
  document.getElementById('mapResumeBtn').addEventListener('click', () => callbacks.onMapResume());
  document.getElementById('mapSaveBtn').addEventListener('click', () => callbacks.onMapSave());
  document.getElementById('mapLoadBtn').addEventListener('click', () => callbacks.onMapLoad());
  document.getElementById('mapQuitBtn').addEventListener('click', () => callbacks.onMapQuit());
  document.getElementById('garageLeaveBtn').addEventListener('click', () => callbacks.onGarageLeave());
  return {
    showStart(hasSave) {
      start.classList.remove('hidden');
      pause.classList.add('hidden');
      over.classList.add('hidden');
      mapScreen.classList.add('hidden');
      controls.classList.add('hidden');
      garage.classList.add('hidden');
      loading.classList.add('hidden');
      continueBtn.classList.toggle('hidden', !hasSave);
    },
    showPause(stats) {
      document.getElementById('pauseStats').textContent = stats;
      pause.classList.remove('hidden');
    },
    hidePause() { pause.classList.add('hidden'); },
    showOver(text) {
      document.getElementById('overText').textContent = text;
      over.classList.remove('hidden');
    },
    hideOver() { over.classList.add('hidden'); },
    hideStart() { start.classList.add('hidden'); },
    hideLoading() { loading.classList.add('hidden'); },
    showMap() { mapScreen.classList.remove('hidden'); },
    hideMap() { mapScreen.classList.add('hidden'); },
    showControls() { controls.classList.remove('hidden'); },
    hideControls() { controls.classList.add('hidden'); },
    showGarage() { garage.classList.remove('hidden'); },
    hideGarage() { garage.classList.add('hidden'); },
    isMapOpen() { return !mapScreen.classList.contains('hidden'); },
    isGarageOpen() { return !garage.classList.contains('hidden'); },
  };
}
