// SOLARA — main: the game orchestrator. State machine (intro → title →
// playing, plus map / paused / shot), third-person camera, input,
// carjacking, shooting, crew abilities, police/wanted wiring, HUD feed,
// save/load, and the four frozen dossier shots. Re-authored for the
// @witty-meteor-32 recording-M build.
import * as THREE from '../vendor/three.module.min.js';
import { WEAPONS, RADIO, RANKS, rankFor, condLabel, dist2d, clamp, CLOCK } from './config.js';
import { World } from './world.js';
import { Car } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Wanted } from './wanted.js';
import { Missions } from './missions.js';
import { Districts } from './districts.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { blip, starSting } from './sound.js';
import { Garage } from './garage.js';
import { saveGame, loadGame } from './save.js';
import { ShotManager } from './shots.js';
import { CREW, crewCooldown } from './config.js';

const DAY_START = CLOCK.startHours; // 17:25 — golden hour opens
const DAY_END = CLOCK.duskHours;    // 19:22 — night has fallen
const HOURS_PER_SEC = 1 / CLOCK.secondsPerHour; // one game-hour per four real minutes

export class SOLARA {
  constructor() {
    const params = new URLSearchParams(location.search);
    const shotParam = parseInt(params.get('shot') || '0', 10);
    this.shotMode = shotParam >= 1 && shotParam <= 4 ? shotParam : 0;
    this.autoplay = params.has('autoplay');

    // Renderer on the page canvas.
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(-140, 40, -60);
    this.camera.lookAt(-100, 0, 0);

    // Error hook: any page error is recorded for the test harness.
    window.__solaraError = null;
    window.addEventListener('error', (e) => { window.__solaraError = String(e.message || e.error); });
    window.addEventListener('unhandledrejection', (e) => { window.__solaraError = String(e.reason); });

    // Systems.
    this.world = new World(this.scene);
    this.traffic = new Traffic(this.scene);
    this.police = new Police(this.scene);
    this.player = new Player(this.scene, this.camera);
    this.wanted = new Wanted();
    this.districts = new Districts();
    this.hud = new HUD();
    this.audio = new AudioEngine();
    this.garage = new Garage();
    this.missions = new Missions(this.scene, this.hud, (act) => {
      // Act title card: live play only — never in shot mode.
      if (!this.shotMode && this.state === 'playing') this.hud.showActCard(act);
    });
    this.shots = new ShotManager(this);

    // Kai's own coupe: orange wedge sports car, parked at the beach
    // road kerb near the pier — the car the player starts beside.
    // Yellower orange (0xf59a23) so it still reads orange under the
    // pink dusk light instead of going red.
    this.playerCar = new Car('sports', -154.75, 6, Math.PI, 0xf59a23);
    this.scene.add(this.playerCar.mesh);

    // Run state.
    this.state = 'intro';
    this.introT = 0;
    this.elapsed = 0;
    this.hours = DAY_START;
    this.duskT = 0;
    this.dayT = 0;
    this.money = 400;   // mission 1 pays $400 → $800 on completion
    this.respect = 0;
    this.rp = 0;
    this.station = 0;
    this.songIdx = 0;
    this.songTimer = 0;
    this.radioTimer = 0;
    this.officerShotTimer = 0;
    this.camYawOffset = 0;
    this.camYaw = 0;
    this.keys = new Set();
    this.dragging = false;
    this.lastX = 0;
    this.shotReady = false;
    this.pausedFrom = null;
    this.loyalty = 0;
    this.kikiActive = 0; // seconds of patrol reveal left

    // Crew abilities: ready flag + cooldown seconds left. Loyalty
    // (+1 per finished job, max 10) trims each cooldown 3% a point,
    // never below half the base cooldown.
    this.crew = CREW.map((c) => ({ key: c.key, name: c.name, ready: true, cdLeft: 0, cdMax: c.cooldown }));

    this.bindInput();
    window.addEventListener('resize', () => this.onResize());

    // Opening line from Lupe as the intro fades.
    this.hud.say('Kai. You made it home. The city missed you — and so did I.', 'Lupe');

    // Expose the live game for the test harness (GTA-core) and shots.
    window.__solaraGame = this;
    window.__solaraShotReady = false;

    if (this.shotMode) {
      // Frozen dossier shot: stage it, render once, signal readiness.
      this.state = 'playing';
      this.hud.showIntro(false);
      this.hud.showTitle(false);
      this.renderShot(this.shotMode);
    } else if (this.autoplay) {
      this.startPlaying();
    }

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // Getters the save system and harness read.
  get missionIndex() { return this.missions.index; }
  get px() { return this.player.x; }
  get pz() { return this.player.z; }

  // ---- state transitions -------------------------------------------------

  startPlaying() {
    if (this.state === 'playing') return;
    this.state = 'playing';
    this.hud.showIntro(false);
    this.hud.showTitle(false);
    this.audio.ensure();
    if (!this.started) {
      this.started = true;
      this.missions.startMission(0);
    }
  }

  toTitle() {
    this.state = 'title';
    this.hud.showIntro(false);
    this.hud.showTitle(true);
  }

  skipIntro() {
    if (this.state === 'intro') this.toTitle();
  }

  toggleMap() {
    if (this.state === 'playing') {
      this.state = 'map';
      this.hud.showMap(true);
      this.hud.mapView.cx = this.player.x;
      this.hud.mapView.cz = this.player.z;
      this.hud.renderMap(this.hudState());
    } else if (this.state === 'map') {
      this.state = 'playing';
      this.hud.showMap(false);
    }
  }

  togglePause() {
    if (this.state === 'playing') {
      this.pausedFrom = 'playing';
      this.state = 'paused';
      this.hud.toast('PAUSED — P to resume');
    } else if (this.state === 'paused') {
      this.state = this.pausedFrom || 'playing';
    }
  }

  // ---- input -------------------------------------------------------------

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.state === 'intro') { this.skipIntro(); return; }
      if (this.state === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') this.startPlaying();
        return;
      }
      if (this.state === 'paused') {
        if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
        return;
      }
      if (this.state === 'map') {
        if (e.code === 'KeyM' || e.code === 'Escape') this.toggleMap();
        return;
      }
      if (this.state !== 'playing' || this.shotMode) return;
      switch (e.code) {
        case 'KeyM': this.toggleMap(); break;
        case 'KeyP': case 'Escape': this.togglePause(); break;
        case 'KeyR': this.cycleRadio(); break;
        case 'KeyF': case 'KeyE': this.interact(); break;
        case 'Space': e.preventDefault(); this.shoot(); break;
        case 'KeyZ': this.useCrew(0); break;
        case 'KeyX': this.useCrew(1); break;
        case 'KeyC': this.useCrew(2); break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
          this.player.setWeapon(parseInt(e.code.slice(-1), 10)); blip(this.audio, 520); break;
        case 'F8': this.doSave(); break;
        case 'F9': this.doLoad(); break;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => {
      if (this.state === 'intro') { this.skipIntro(); return; }
      if (this.state === 'playing' && !this.shotMode) {
        this.dragging = true;
        this.lastX = e.clientX;
        if (this.player.onFoot && this.player.weapon === 2) this.shoot();
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.camYawOffset += (e.clientX - this.lastX) * 0.005;
      this.lastX = e.clientX;
    });
    window.addEventListener('pointerup', () => { this.dragging = false; });
    const startBtn = document.getElementById('title-start');
    if (startBtn) startBtn.addEventListener('click', () => this.startPlaying());
    const resumeBtn = document.getElementById('title-continue');
    if (resumeBtn) resumeBtn.addEventListener('click', () => { this.doLoad(); this.startPlaying(); });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---- actions -----------------------------------------------------------

  cycleRadio() {
    this.station = (this.station + 1) % RADIO.length;
    this.songIdx = 0;
    this.audio.setStation(this.station);
    this.hud.toast('RADIO — ' + RADIO[this.station].freq + ' · ' + RADIO[this.station].genre);
    blip(this.audio, 660);
  }

  // F near a car: get in (own coupe — no heat) or carjack a traffic car
  // (+1 star). F in a car: get out behind it.
  interact() {
    if (!this.player.onFoot) {
      this.player.exitCar();
      blip(this.audio, 440);
      return;
    }
    const px = this.player.x, pz = this.player.z;
    let car = null;
    let jack = false;
    if (dist2d(px, pz, this.playerCar.x, this.playerCar.z) <= 4.5) {
      car = this.playerCar;
    } else {
      car = this.traffic.nearestCar(px, pz, 4.5);
      jack = !!car;
    }
    if (!car) return;
    if (jack) {
      this.traffic.claim(car);
      this.wanted.addStars(1);
      starSting(this.audio);
      this.hud.toast(`CARJACKED ${car.name.toUpperCase()} — +1★`);
    } else {
      blip(this.audio, 520);
    }
    this.player.enterCar(car);
    this.audio.ensure();
  }

  // Shoot the pistol: one round from the mag, ray from the chest along
  // the camera facing. An officer hit loses 34 health (100→66).
  shoot() {
    if (this.state !== 'playing' || this.shotMode) return;
    if (!this.player.onFoot || this.player.weapon !== 2) return;
    if (this.player.weaponAmmo <= 0) { blip(this.audio, 180); return; }
    this.player.weaponAmmo -= 1;
    this.audio.gunshot();
    const ray = this.player.aimRay();
    const targets = [];
    for (const o of this.police.officers) targets.push(o.mesh);
    for (const c of this.police.cruisers) targets.push(c.mesh);
    for (const c of this.traffic.cars) targets.push(c.mesh);
    const hits = ray.intersectObjects(targets, true);
    if (hits.length > 0) {
      // Walk up to the group that owns the hit mesh.
      let hit = hits[0].object;
      while (hit.parent && hit.parent !== this.scene) hit = hit.parent;
      const off = this.police.officers.find((o) => o.mesh === hit);
      if (off) {
        off.health -= 34;
        if (off.health <= 0) {
          this.scene.remove(off.mesh);
          this.police.officers.splice(this.police.officers.indexOf(off), 1);
          this.money += 50;
          this.hud.toast('OFFICER DOWN — +$50');
        } else {
          this.hud.toast(`HIT — OFFICER ${off.health} HP`);
        }
      } else {
        const cruiser = this.police.cruisers.find((c) => c.mesh === hit);
        if (cruiser) cruiser.damage(12);
        else {
          const car = this.traffic.cars.find((c) => c.mesh === hit);
          if (car) car.damage(12);
        }
      }
    }
  }

  // Crew abilities: Z MARA ghost (−1★, blocked if a cruiser is within
  // 30 m), X SULLY pit crew (repair the car to 100%), C KIKI lookout
  // (reveal every patrol for 20 s). Each use starts its cooldown
  // (loyalty-trimmed) — a blocked use costs nothing.
  useCrew(i) {
    const c = this.crew[i];
    if (!c || !c.ready) return;
    const def = CREW[i];
    if (i === 0) {
      if (this.wanted.stars <= 0) { this.hud.toast('GHOST — no heat to lose'); return; }
      const px = this.player.x, pz = this.player.z;
      const near = this.police.cruisers.some((cr) => dist2d(px, pz, cr.x, cr.z) < 30);
      if (near) { this.hud.toast('GHOST BLOCKED — cruiser too close'); return; }
      this.wanted.addStars(-1);
      this.hud.toast('MARA — GHOST · −1★');
    } else if (i === 1) {
      if (this.player.onFoot || !this.player.car) { this.hud.toast('PIT CREW — get in a car first'); return; }
      this.player.car.condition = 100;
      this.hud.toast('SULLY — PIT CREW · car repaired 100%');
    } else {
      this.kikiActive = def.duration;
      this.hud.toast('KIKI — LOOKOUT · patrols revealed 20s');
    }
    c.ready = false;
    c.cdLeft = crewCooldown(def, this.loyalty);
    blip(this.audio, 700);
  }

  applyDamage(n) {
    let left = n;
    if (this.player.armour > 0) {
      const absorbed = Math.min(this.player.armour, left);
      this.player.armour -= absorbed;
      left -= absorbed;
    }
    this.player.health -= left;
    if (this.player.health <= 0) this.wasted();
  }

  wasted() {
    if (!this.player.onFoot) this.player.exitCar();
    this.player.health = 100;
    this.player.armour = 0;
    this.money = Math.max(0, this.money - 100);
    this.wanted.clear();
    this.police.removeAll();
    this.player.setPos(-250, 20); // respawn at the pier
    this.player.heading = Math.PI / 2;
    this.player.updateGroup();
    this.hud.say('WASTED — Mercy Clinic patched you up · −$100', 'Kai');
    this.hud.toast('WASTED');
  }

  doSave() {
    const ok = saveGame(this);
    this.hud.toast(ok ? 'GAME SAVED' : 'SAVE FAILED');
  }

  doLoad() {
    const s = loadGame();
    if (!s) { this.hud.toast('NO SAVE FOUND'); return; }
    this.money = s.money; this.respect = s.respect; this.rp = s.rp || 0;
    this.hours = s.hours; this.player.setPos(s.px, s.pz);
    this.missions.startMission(s.missionIndex || 0);
    this.hud.toast('GAME LOADED');
  }

  // ---- camera ------------------------------------------------------------

  setCamera(pos, lookAt) {
    this.camera.position.set(pos[0], pos[1], pos[2]);
    this.camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
    this.fixedCamera = { pos: pos.slice(), lookAt: lookAt.slice() };
  }

  // Third-person follow: behind the player (or the car), over the
  // shoulder, with a drag orbit offset. Camera yaw drives on-foot
  // movement (W walks away from the camera).
  updateCamera(dt) {
    const p = this.player;
    const inCar = !p.onFoot && p.car;
    const cx = inCar ? p.car.x : p.x;
    const cz = inCar ? p.car.z : p.z;
    const heading = inCar ? p.car.heading : p.heading;
    const yaw = heading + this.camYawOffset;
    const dist = inCar ? 9.5 : 6.5;
    const height = inCar ? 4.2 : 3.1;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const tx = cx - fx * dist, tz = cz - fz * dist;
    const k = 1 - Math.pow(0.0001, dt); // smooth follow
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.position.y += ((inCar ? 1.2 : 1.0) + height - this.camera.position.y) * k;
    if (this.camera.position.y < 1.2) this.camera.position.y = 1.2;
    this.camera.lookAt(cx + fx * 6, inCar ? 1.4 : 1.5, cz + fz * 6);
    // Camera facing (flattened) drives on-foot movement.
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    this.camYaw = Math.atan2(fwd.x, -fwd.z);
    p.camYaw = this.camYaw;
  }

  // ---- HUD state ---------------------------------------------------------
  // Nested shape the HUD consumes: mission, money/clock/stars, rank,
  // PCPD rows, weapons, crew, health/armour, district, radio, car,
  // minimap + map data. The PCPD panel is forced empty at 0 stars so
  // a staged officer in shot 1 never leaks a panel into the frame.

  hudState() {
    const p = this.player;
    const px = p.x, pz = p.z;
    const si = this.missions.stageInfo(px, pz);
    const cur = this.missions.current;
    const rk = rankFor(this.rp);
    const d = this.districts.info(px, pz);
    const st = RADIO[this.station];
    const inCar = !p.onFoot && !!p.car;
    const stars = this.wanted.stars;
    const weapons = WEAPONS.map((w, i) => ({
      name: w.name,
      ammo: i === 0 ? '∞' : i === 1 ? String(p.weaponAmmo) : String(w.ammo),
      active: p.weapon === w.slot,
      locked: !!p.weaponLocked[i],
    }));
    const blips = [];
    if (this.kikiActive > 0) {
      for (const c of this.police.cruisers) blips.push({ x: c.x, z: c.z, col: '#ff5a4e' });
      for (const o of this.police.officers) blips.push({ x: o.mesh.position.x, z: o.mesh.position.z, col: '#ff5a4e' });
      if (this.police.heli) blips.push({ x: this.police.heli.group.position.x, z: this.police.heli.group.position.z, col: '#ff5a4e' });
    }
    return {
      mission: cur ? {
        chapter: `CH.${this.missions.index + 1}`,
        title: cur.title,
        stage: si.index,
        stages: si.total,
        objective: si.text,
        next: si.next,
      } : null,
      missionIdx: this.missions.index,
      money: this.money,
      clock: this.clockText(),
      stars,
      wantedLabel: stars > 0 ? (this.wanted.hidden ? 'HIDDEN' : 'IN SIGHT') : '',
      rankName: rk.name,
      rpPct: rk.next ? clamp(((this.rp - RANKS[rk.index].at) / (rk.next - RANKS[rk.index].at)) * 100, 0, 100) : 100,
      rpText: rk.next ? `RP ${this.rp} / ${rk.next}` : `RP ${this.rp} — MAX`,
      pcpdUnits: stars > 0 ? this.police.unitsForHud(px, pz, this.wanted.evading) : [],
      airDeployed: this.police.airDeployed,
      code: HUD.pcpdCode(stars),
      evadeText: stars > 0 && this.wanted.evading > 0 ? `EVADING ${Math.floor(this.wanted.evading)}%` : '',
      weapons,
      crew: this.crew,
      health: p.health,
      armour: p.armour,
      district: { name: d.name, standing: d.value, desc: d.desc },
      respect: this.respect,
      radio: { freq: st.freq, genre: st.genre, song: st.songs[this.songIdx % st.songs.length] },
      car: inCar ? {
        name: p.car.name,
        condText: `${condLabel(p.car.condition)} ${Math.round(p.car.condition)}%`,
        cond: p.car.condition,
        speed: String(Math.round(Math.abs(p.car.speed) * 3.6)),
        gear: 'G' + p.car.gear,
      } : null,
      speed: String(Math.round(p.speed * 3.6)),
      timerText: this.missions.timerLeft ? `⏱ ${this.missions.timerLeft}s` : '',
      player: { x: px, z: pz, yaw: p.heading },
      waypoint: this.hud.mapView.waypoint,
      target: cur ? cur.target : null,
      blips,
      districtsHeld: Object.values(this.districts.standing).filter((v) => v >= 70).length,
    };
  }

  clockText() {
    const hh = Math.floor(this.hours);
    const mm = Math.floor((this.hours - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  // ---- shots -------------------------------------------------------------

  renderShot(n) {
    // Stage the shot (positions, HUD text, dialogue, stars), then settle
    // the world once — sky, lamps, neon, halos — and render a still.
    this.shots['stage' + n]();
    this.dayT = clamp((this.hours - DAY_START) / (DAY_END - DAY_START), 0, 1);
    this.duskT = clamp((this.hours - 18.0) / 1.5, 0, 1);
    this.world.update(this.dayT, 0);
    this.traffic.setDusk(this.duskT);
    this.police.setDusk(this.duskT);
    this.playerCar.setDusk(this.duskT);
    if (this.player.car) this.player.car.setDusk(this.duskT);
    // HUD refresh for the frozen frame: mission, stars, PCPD rows,
    // minimap, dialogue, toast. Crosshair on the two Kai-first shots.
    this.hud.update(this.hudState(), 0);
    this.hud.setCrosshair(n === 1 || n === 2);
    this.renderer.render(this.scene, this.camera);
    this.shotReady = true;
    window.__solaraShotReady = true;
  }

  // ---- frame -------------------------------------------------------------

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.shotMode) {
      // Frozen dossier shot: keep repainting the same still.
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.elapsed += dt;

    // Clock + dusk advance (held at nightfall).
    if (this.state === 'playing') this.hours = Math.min(DAY_END, this.hours + dt * HOURS_PER_SEC);
    this.dayT = clamp((this.hours - DAY_START) / (DAY_END - DAY_START), 0, 1);
    this.duskT = clamp((this.hours - 18.0) / 1.5, 0, 1);
    this.world.update(this.dayT, this.elapsed);
    this.traffic.setDusk(this.duskT);
    this.police.setDusk(this.duskT);
    this.playerCar.setDusk(this.duskT);

    if (this.state === 'intro') {
      this.introT += dt;
      // Slow orbit over the beach road while the intro card shows.
      const t = this.elapsed * 0.08;
      this.camera.position.set(-100 + Math.sin(t) * 90, 42, Math.cos(t) * 90);
      this.camera.lookAt(-160, 2, 0);
      if (this.introT > 6) this.toTitle();
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.state === 'title') {
      const t = this.elapsed * 0.05;
      this.camera.position.set(-100 + Math.sin(t) * 90, 42, Math.cos(t) * 90);
      this.camera.lookAt(-160, 2, 0);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.state === 'map') {
      this.hud.renderMap(this.hudState());
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.state === 'paused') {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.state !== 'playing') {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // ---- live play ----
    const p = this.player;
    const input = {
      forward: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      back: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
      right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    };
    if (p.onFoot) {
      p.update(dt, input);
    } else if (p.car) {
      const throttle = (input.forward ? 1 : 0) - (input.back ? 0.6 : 0);
      const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      p.car.drive(dt, throttle, steer);
      this.audio.setEngine(p.car.speed);
      // Radio arpeggio while driving.
      this.radioTimer += dt;
      if (this.radioTimer > 0.12) { this.radioTimer = 0; this.audio.radioTick(); }
      this.songTimer += dt;
      if (this.songTimer > 25) { this.songTimer = 0; this.songIdx = (this.songIdx + 1) % RADIO[this.station].songs.length; }
    }
    this.updateCamera(dt);
    this.traffic.update(dt);

    // Police + wanted.
    const px = p.x, pz = p.z;
    const speed = p.onFoot ? p.speed : (p.car ? Math.abs(p.car.speed) : 0);
    const closest = this.police.update(dt, px, pz, this.wanted.stars, speed);
    this.wanted.update(dt, closest === Infinity ? 999 : closest, speed);
    if (this.wanted.escaped) {
      this.money += 150;
      this.rp += 150;
      this.hud.toast('ESCAPED — +$150 · +150 RP');
      this.audio.cash();
    }
    this.audio.siren(this.wanted.stars > 0);

    // Cruiser rams: close contact hurts (armour first).
    for (const c of this.police.cruisers) {
      if (dist2d(c.x, c.z, px, pz) < 3.5) {
        if (p.onFoot) this.applyDamage(10 * dt);
        else { p.car.damage(6 * dt); this.applyDamage(2 * dt); }
      }
    }
    // Officers shoot when close on foot.
    if (p.onFoot && this.police.officers.length > 0) {
      this.officerShotTimer += dt;
      if (this.officerShotTimer > 1.2) {
        this.officerShotTimer = 0;
        const near = this.police.officers.some((o) => dist2d(o.mesh.position.x, o.mesh.position.z, px, pz) < 30);
        if (near) this.applyDamage(6);
      }
    }

    // Missions.
    const ev = this.missions.update(dt, px, pz, !p.onFoot);
    if (ev && ev.type === 'complete') {
      const m = ev.mission;
      const respectGain = m.respect || 10; // config per-mission (M2 = 12 → +240 RP)
      this.money += m.reward;
      this.respect += respectGain;
      this.rp += respectGain * 20;
      this.loyalty = Math.min(10, this.loyalty + 1);
      this.districts.bumpAt(m.target.x, m.target.z, 8);
      this.hud.toast(`JOB DONE — +$${m.reward.toLocaleString('en-US')} · +${respectGain} respect · +${respectGain * 20} RP`);
      this.audio.cash();
      this.doSave();
    } else if (ev && ev.type === 'failed') {
      this.hud.toast('JOB FAILED — RETRY');
    }

    // Crew cooldowns + Kiki reveal timer.
    for (const c of this.crew) {
      if (!c.ready) {
        c.cdLeft -= dt;
        if (c.cdLeft <= 0) { c.ready = true; c.cdLeft = 0; }
      }
    }
    if (this.kikiActive > 0) this.kikiActive = Math.max(0, this.kikiActive - dt);

    // HUD.
    const s = this.hudState();
    this.hud.update(s, dt);
    this.hud.setCrosshair(p.onFoot && p.weapon === 2 && p.aiming);
    // Context prompt: nearest car to steal / enter.
    if (p.onFoot) {
      const nearOwn = dist2d(px, pz, this.playerCar.x, this.playerCar.z) <= 4.5;
      const nearCar = nearOwn ? this.playerCar : this.traffic.nearestCar(px, pz, 4.5);
      if (nearCar) this.hud.setPrompt(nearCar === this.playerCar ? `Press F · Enter ${nearCar.name}` : `Press F · Steal ${nearCar.name}`);
      else this.hud.setPrompt('');
    } else {
      this.hud.setPrompt('Press F · Exit car');
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Boot: one live game on the page canvas.
export function boot() {
  new SOLARA();
}
