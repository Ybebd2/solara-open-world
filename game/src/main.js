// SOLARA — main entrypoint. Builds the game, runs the loop, and exposes
// the hooks the dossier tooling reads: window.__solaraGame,
// window.__solaraError and window.__solaraShotReady.
//
// Kai Mercer, golden-hour coastal city. WASD walk/drive, Shift sprint,
// F enter/carjack (+1 star), click shoot the VESPER 9, 1-5 weapons,
// R radio, M map, P pause, Z/X/C crew, F8 save, F9 load.
// 8-job chain (mission 4 is a 90 s timed delivery), 5 wanted stars,
// cruisers + officers + helicopter at 3 stars, EVADING meter, wasted
// respawn at the pier -$100.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, RADIO, CREW, TUNING } from './config.js';
import { World } from './world.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Wanted } from './wanted.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { Districts } from './districts.js';
import { Garage } from './garage.js';
import { Save } from './save.js';
import { AudioEngine } from './audio.js';
import { Sound } from './sound.js';
import { stageShot } from './shots.js';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export class Game {
  constructor() {
    this.state = 'intro';
    this.shotMode = false;
    this.shotName = null;
    this.seed = 1;

    this.money = 400;
    this.respect = 0;
    this.rp = 0;
    this.hours = WORLD.startHours;
    this.radioIdx = 2; // SOLARA 98.3
    this.keys = new Set();
    this.camYaw = 0;
    this.nextShootAt = 0; // real-time (ms) pistol cooldown
    this.crewCd = { Z: 0, X: 0, C: 0 };
    this.lookoutUntil = 0;
    this.introAt = performance.now();
    this.paused = false;
    this.mapOpen = false;
    this.wastedAt = 0;

    // --- Renderer / scene / camera.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffd9a0);
    this.scene.fog = new THREE.Fog(0xffd9a0, 120, 520);
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(-250, 4, 40);

    // Golden-hour sun + soft ambient.
    this.sun = new THREE.DirectionalLight(0xffb347, 1.6);
    this.sun.position.set(-120, 90, 60);
    this.scene.add(this.sun);
    this.ambient = new THREE.AmbientLight(0xffe0b8, 0.75);
    this.scene.add(this.ambient);
    this.duskLight = new THREE.DirectionalLight(0x8a5a9e, 0.0);
    this.duskLight.position.set(100, 60, -80);
    this.scene.add(this.duskLight);

    // --- Systems.
    this.world = new World(this.scene);
    this.traffic = new Traffic(this.scene);
    this.player = new Player(this.scene, this.camera);
    this.player.group.position.set(-250, 0, 20);
    this.police = new Police(this.scene);
    this.wanted = new Wanted();
    this.missions = new Missions(this.scene);
    this.districts = new Districts();
    this.garage = new Garage(this);
    this.save = new Save(this);
    this.audio = new AudioEngine();
    this.sound = new Sound(this.audio);
    this.hud = new HUD(document.body);
    this.hud.setDialogue('Lupe', 'FIXER · PIER SHACK',
      'Borrowed wheels, Kai. The coupe sits on Beach Road — bring it back clean.',
      'On it. Nobody even sees me coming.');

    this.duskT = 0;
    this.bindInput();
    this.mapEl = this.buildMapOverlay();

    // Expose the hooks the tooling reads.
    window.__solaraGame = this;
    window.__solaraError = null;

    // Shot staging (?shot=1-start&seed=1) freezes the scene after setup.
    const q = new URLSearchParams(window.location.search);
    const shot = q.get('shot');
    const seed = parseInt(q.get('seed') || '1', 10);
    if (!Number.isNaN(seed)) this.seed = seed;
    if (shot) {
      this.shotMode = true;
      this.shotName = shot;
      try {
        stageShot(this, shot);
      } catch (e) {
        window.__solaraError = String(e && e.message || e);
      }
      this.hud.update(this);
      this.updateDusk();
      this.renderer.render(this.scene, this.camera);
      if (!window.__solaraError) window.__solaraShotReady = true;
    }

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.lastT = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  get duskTValue() { return this.duskT; }

  buildMapOverlay() {
    const d = document.createElement('div');
    d.id = 'solara-map';
    d.style.cssText = 'position:fixed;inset:0;background:rgba(8,12,24,.92);z-index:20;display:none;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:Arial,sans-serif';
    d.innerHTML = '<h2 style="letter-spacing:4px;margin:0 0 12px">SOLARA — MAP</h2>' +
      '<div id="solara-map-dist" style="font-size:15px;line-height:1.9;text-align:left"></div>' +
      '<div style="margin-top:16px;color:#9fb3c8;font-size:13px">M close · click a district to set a waypoint</div>';
    document.body.appendChild(d);
    const list = d.querySelector('#solara-map-dist');
    for (const dist of this.districts.list) {
      const row = document.createElement('div');
      row.textContent = `${dist.name} · NEUTRAL ${dist.standing}%`;
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        this.hud.toast(`Waypoint: ${dist.name}`);
        this.toggleMap(false);
      });
      list.appendChild(row);
    }
    return d;
  }

  toggleMap(force) {
    this.mapOpen = force !== undefined ? force : !this.mapOpen;
    this.mapEl.style.display = this.mapOpen ? 'flex' : 'none';
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.audio.ensure();
      this.audio.resume();
      if (e.code === 'Enter') {
        if (this.state === 'intro') { this.state = 'title'; this.hud.showOverlay('title'); }
        else if (this.state === 'title') { this.state = 'playing'; this.hud.showOverlay(null); }
        else if (this.state === 'wasted') { this.respawn(); }
      } else if (e.code === 'KeyF') {
        if (this.state === 'playing') this.interact();
      } else if (e.code === 'KeyP') {
        if (this.state === 'playing') { this.state = 'paused'; this.hud.showOverlay('paused'); }
        else if (this.state === 'paused') { this.state = 'playing'; this.hud.showOverlay(null); }
      } else if (e.code === 'KeyM') {
        if (this.state === 'playing') this.toggleMap();
      } else if (e.code === 'KeyR') {
        if (this.state === 'playing') {
          this.radioIdx = (this.radioIdx + 1) % RADIO.length;
          this.audio.setStation(this.radioIdx);
        }
      } else if (e.code === 'KeyZ' || e.code === 'KeyX' || e.code === 'KeyC') {
        if (this.state === 'playing') this.useCrew(e.code.slice(3));
      } else if (e.code === 'F8') {
        if (this.state === 'playing' && this.save.write()) this.hud.toast('Saved.');
      } else if (e.code === 'F9') {
        if (this.state === 'playing' && this.save.load()) this.hud.toast('Loaded save.');
      } else if (e.code.startsWith('Digit')) {
        const slot = parseInt(e.code.slice(5), 10);
        if (this.state === 'playing' && slot >= 1 && slot <= 5) this.player.setWeapon(slot);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.audio.ensure();
      this.audio.resume();
      if (this.state === 'playing' && !this.mapOpen) this.shoot();
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  interact() {
    if (this.player.car) {
      this.player.enterCar(); // exit
      return;
    }
    const car = this.traffic.nearestParked(this.player.x, this.player.z, 6);
    if (!car) return;
    this.player.enterCar(car);
    const i = this.traffic.parked.indexOf(car);
    if (i >= 0) this.traffic.parked.splice(i, 1);
    this.wanted.addStar(1); // carjack
    this.hud.toast('Carjacked +1 ★');
    this.sound.siren();
  }

  shoot() {
    // Real-time cooldown: a game-time cooldown never decays in headless
    // (~0.4 fps), which blocked shooting entirely in the test harness.
    const now = performance.now();
    if (now < this.nextShootAt) return;
    if (this.player.weaponSlot !== 2) return;
    if (this.player.weaponAmmo <= 0) { this.hud.toast('Mag empty — switch weapon'); return; }
    this.nextShootAt = now + 120;
    this.player.weaponAmmo -= 1;
    this.sound.shoot();
    // Horizontal chest ray: a downward camera ray passes over a 1.85 m
    // officer's head at 6 m, so shots would never land.
    const ray = this.player.aimRay();
    const meshes = [];
    for (const o of this.police.officers) meshes.push(o.mesh);
    const hits = this.player.raycaster.intersectObjects(meshes, true);
    if (hits.length > 0) {
      let node = hits[0].object;
      let off = null;
      while (node) {
        if (node.userData && node.userData.officer) { off = node.userData.officer; break; }
        node = node.parent;
      }
      if (off) {
        off.health -= TUNING.shotDamage;
        if (off.health <= 0) {
          this.police.removeOfficer(off);
          this.hud.toast('Officer down');
        }
      }
    }
    void ray;
  }

  useCrew(key) {
    const now = performance.now();
    if (now < this.crewCd[key]) { this.hud.toast('Crew on cooldown'); return; }
    if (key === 'Z') {
      // MARA / GHOST: -1 star, blocked if a cruiser is within 30 m.
      let near = Infinity;
      for (const c of this.police.cruisers) {
        near = Math.min(near, Math.hypot(c.x - this.player.x, c.z - this.player.z));
      }
      if (near < TUNING.ghostBlockDist) { this.hud.toast('MARA: too hot — cruiser too close'); return; }
      if (this.wanted.stars === 0) { this.hud.toast('MARA: already clean'); return; }
      this.wanted.removeStar(1);
      this.crewCd.Z = now + CREW.Z.cooldown * 1000;
      this.hud.toast('MARA · GHOST — heat down');
    } else if (key === 'X') {
      // SULLY / PIT CREW: full repair in the car.
      if (!this.player.car) { this.hud.toast('SULLY: get in a car first'); return; }
      this.player.car.condition = 100;
      this.crewCd.X = now + CREW.X.cooldown * 1000;
      this.hud.toast('SULLY · PIT CREW — car repaired');
    } else if (key === 'C') {
      // KIKI / LOOKOUT: patrols revealed for 20 s.
      this.lookoutUntil = now + 20000;
      this.crewCd.C = now + CREW.C.cooldown * 1000;
      this.hud.toast('KIKI · LOOKOUT — patrols revealed 20 s');
    }
  }

  respawn() {
    this.player.group.position.set(-250, 0, 20);
    this.player.group.visible = true;
    this.player.onFoot = true;
    this.player.car = null;
    this.player.health = 100;
    this.player.armour = 0;
    this.money = Math.max(0, this.money - 100);
    this.wanted.stars = 0;
    this.wanted.evading = 0;
    this.state = 'playing';
    this.hud.showOverlay(null);
    this.hud.toast('Back on your feet — -$100');
  }

  updateDusk() {
    this.duskT = clamp((this.hours - WORLD.duskStart) / WORLD.duskSpan, 0, 1);
    const t = this.duskT;
    // Sky deepens from golden day to dusk purple; sun dims, dusk light rises.
    const sky = new THREE.Color(0xffd9a0).lerp(new THREE.Color(0x2a1a3a), t);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    this.sun.intensity = 1.6 - t * 0.9;
    this.duskLight.intensity = t * 0.7;
    this.ambient.intensity = 0.75 - t * 0.3;
  }

  update(dt) {
    // Clock.
    this.hours += dt * 0.005;
    if (this.hours >= 24) this.hours -= 24;
    this.updateDusk();

    // Intro auto-advances after ~6 s (skippable with Enter).
    if (this.state === 'intro' && performance.now() - this.introAt > 6000) {
      this.state = 'title';
      this.hud.showOverlay('title');
    }
    if (this.state !== 'playing') return;

    // Player.
    this.player.move(this.keys, dt, this.camYaw);
    // Smooth camera yaw follows the player's facing.
    let diff = this.player.yaw - this.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.camYaw += diff * Math.min(1, 3 * dt);

    // World + traffic + police + wanted.
    this.world.update(dt, this.duskT, this.hours);
    this.traffic.update(dt, this.duskT);
    this.police.update(dt, this.player, this.wanted);
    this.wanted.update(dt, this.player, this.police);

    // Officer contact damage (armour soaks first).
    for (const o of [...this.police.officers]) {
      const d = Math.hypot(o.x - this.player.x, o.z - this.player.z);
      if (this.player.onFoot && d < 2) {
        let dmg = 8 * dt;
        if (this.player.armour > 0) {
          const soak = Math.min(this.player.armour, dmg);
          this.player.armour -= soak; dmg -= soak;
        }
        this.player.health -= dmg;
      }
    }
    if (this.player.health <= 0 && this.state === 'playing') {
      this.state = 'wasted';
      this.sound.wasted();
      this.hud.showOverlay('wasted');
      this.hud.ovTitle.textContent = 'WASTED';
      this.hud.ovText.textContent = 'The PCPD got you. You wake up at the pier, $100 lighter.';
      this.hud.ovHint.textContent = 'Press ENTER to get back up';
      return;
    }

    // Missions.
    const ev = this.missions.update(dt, this.player);
    if (ev) {
      if (ev.failed) {
        this.hud.toast(`${ev.mission.title}: time up — run it again`);
      } else {
        this.money += ev.reward;
        this.respect += ev.respect;
        this.rp += ev.respect * 20;
        this.districts.onJobDone();
        this.hud.toast(`+$${ev.reward.toLocaleString()} · +${ev.respect} RESPECT`);
        this.sound.pickup();
        this.hud.setDialogue('Lupe', 'FIXER · PIER SHACK',
          'Clean work, Kai. Next one pays better.',
          'Always does.');
      }
    }
    // Escape bonus: a star dropped by evading.
    if (this._starsBefore !== undefined && this.wanted.stars < this._starsBefore) {
      this.rp += 150;
    }
    this._starsBefore = this.wanted.stars;

    this.districts.update(this.player.x, this.player.z);
    this.audio.setEngine(this.player.car ? Math.abs(this.player.car.speed) / 26 : 0);
    this.hud.update(this);
  }

  updateCamera(dt) {
    if (this.shotMode) return; // staged shot camera stays fixed
    const p = this.player;
    const fwdX = Math.sin(p.yaw), fwdZ = Math.cos(p.yaw);
    const dist = p.car ? 11 : 8;
    const height = p.car ? 4.2 : 3.6;
    const tx = p.x - fwdX * dist;
    const tz = p.z - fwdZ * dist;
    const ty = height;
    const k = 1 - Math.exp(-dt * 4);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (ty - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(p.x + fwdX * 3, 1.5, p.z + fwdZ * 3);
  }

  loop(t) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0.001, (t - this.lastT) / 1000));
    this.lastT = t;
    if (!this.shotMode) {
      this.update(dt);
      this.updateCamera(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }
}

try {
  new Game();
} catch (e) {
  window.__solaraError = String(e && e.message || e);
  console.error(e);
}
