// Main — the Game. Wires world, traffic, player, police, wanted, missions,
// districts, HUD, audio, garage and save into one loop. State machine:
// intro (6 s, skippable) → title → playing ⇄ paused. ?shot=<name> stages
// a frozen dossier shot instead. Exposes window.__solaraGame,
// __solaraError and __solaraShotReady for the test harness.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, RADIO } from './config.js';
import { World } from './world.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Wanted } from './wanted.js';
import { Missions } from './missions.js';
import { Districts } from './districts.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { Sound } from './sound.js';
import { Garage } from './garage.js';
import { Save } from './save.js';
import { applyShot } from './shots.js';

export class Game {
  constructor() {
    this.state = 'intro';
    this.introT = 0;
    this.money = 400;
    this.respect = 0;
    this.escapes = 0;
    this.hours = WORLD.startHours;
    this.radioIdx = 0;
    this.shotMode = null;
    this.shotCamera = null;
    this.shotReady = false;
    this.camYaw = 0;
    this.keys = new Set();
    this.crewCd = { Z: 0, X: 0, C: 0 };
    this.loyalty = 100;
    this.lookoutUntil = 0;
    this.mapOpen = false;
    this.nextShootAt = 0; // real-time pistol cooldown (ms)

    // Renderer + scene + golden-hour light.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    document.body.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffd9a0);
    this.scene.fog = new THREE.Fog(0xffd9a0, 120, 420);
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(-60, 4, 50);

    const sun = new THREE.DirectionalLight(0xffb347, 1.6);
    sun.position.set(-80, 60, 40);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffd9c0, 0.75));
    this.sun = sun;

    // Systems.
    this.world = new World(this.scene);
    this.traffic = new Traffic(this.scene);
    this.player = new Player(this.scene, this.camera);
    this.player.group.position.set(-60, 0, 30);
    this.police = new Police(this.scene);
    this.wanted = new Wanted();
    this.missions = new Missions(this.scene);
    this.districts = new Districts();
    this.hud = new HUD(document.body);
    this.audio = new AudioEngine();
    this.sound = new Sound(this.audio);
    this.garage = new Garage(this);
    this.save = new Save(this);

    this.hud.setDialogue(
      'Lupe', 'FIXER · PIER SHACK',
      'Borrowed wheels, Kai. The coupe sits on Beach Road — bring it back clean.',
      'On it. Nobody even sees me coming.'
    );

    this.bindInput();
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Shot mode: stage immediately, freeze the loop, signal readiness.
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      this.state = 'playing';
      this.respect = 57; // staged rank: RUNNER
      try {
        applyShot(shot, this);
      } catch (e) {
        window.__solaraError = String(e && e.message || e);
      }
      this.hud.showOverlay(null);
      this.render();
      window.__solaraGame = this;
      if (!window.__solaraError) window.__solaraError = null;
      return;
    }
    window.__solaraGame = this;
    window.__solaraError = null;
  }

  get duskT() {
    return Math.max(0, Math.min(1, (this.hours - WORLD.duskStart) / WORLD.duskSpan));
  }
  get rp() {
    return this.respect * 20 + this.escapes * 150;
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.audio.ensure();
      this.audio.resume();
      if (e.code === 'Enter') this.advance();
      if (e.code === 'KeyP') this.togglePause();
      if (e.code === 'KeyM') this.toggleMap();
      if (e.code === 'KeyR') {
        this.radioIdx = (this.radioIdx + 1) % RADIO.length;
        this.audio.setStation(this.radioIdx);
      }
      if (e.code === 'KeyF') this.interact();
      if (e.code === 'F8') { if (this.save.write()) this.hud.toast('Game saved'); }
      if (e.code === 'F9') { if (this.save.load()) this.hud.toast('Game loaded'); }
      if (e.code === 'KeyZ') this.useCrew('Z');
      if (e.code === 'KeyX') this.useCrew('X');
      if (e.code === 'KeyC') this.useCrew('C');
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 5) this.player.setWeapon(n);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.state === 'playing') {
        this.audio.ensure();
        this.shoot();
      }
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  advance() {
    if (this.state === 'intro') {
      this.state = 'title';
      this.hud.showOverlay('title');
    } else if (this.state === 'title') {
      this.state = 'playing';
      this.hud.showOverlay(null);
      this.audio.ensure();
      this.audio.setStation(this.radioIdx);
    }
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.hud.showOverlay('paused');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.hud.showOverlay(null);
    }
  }

  toggleMap() {
    if (this.state !== 'playing') return;
    this.mapOpen = !this.mapOpen;
    // The map is the minimap grown large: reuse the HUD overlay text.
    this.hud.toast(this.mapOpen ? `MAP — ${this.districts.name} · ${this.districts.list.map((d) => d.name).join(' · ')}` : '');
  }

  useCrew(key) {
    if (this.state !== 'playing') return;
    if (this.crewCd[key] > 0) return;
    const cdScale = 1 - Math.min(0.4, (100 - this.loyalty) * 0.004);
    if (key === 'Z') {
      // MARA / GHOST: −1 star, blocked if a cruiser is within 30 m.
      const near = this.police.cruisers.some(
        (c) => Math.hypot(c.x - this.player.x, c.z - this.player.z) < 30
      );
      if (near || this.wanted.stars === 0) return;
      this.wanted.removeStar(1);
      this.crewCd.Z = 80 * cdScale;
      this.hud.toast('MARA · GHOST — plates swapped, −1★');
    } else if (key === 'X') {
      // SULLY / PIT CREW: full repair, only in a car.
      if (!this.player.car) return;
      this.player.car.condition = 100;
      this.crewCd.X = 55 * cdScale;
      this.hud.toast('SULLY · PIT CREW — car repaired 100%');
    } else if (key === 'C') {
      // KIKI / LOOKOUT: reveal patrols for 20 s.
      this.lookoutUntil = performance.now() + 20000;
      this.crewCd.C = 70 * cdScale;
      this.hud.toast('KIKI · LOOKOUT — patrols revealed 20 s');
    }
  }

  interact() {
    if (this.state !== 'playing') return;
    if (this.player.car) {
      this.player.enterCar();
      return;
    }
    const car = this.traffic.nearestParked(this.player.x, this.player.z, 6);
    if (car) {
      this.player.enterCar(car);
      this.garage.applyTo(car);
      this.wanted.addStar(1); // carjack
      this.sound.siren();
    }
  }

  shoot() {
    if (this.state !== 'playing') return;
    if (performance.now() < this.nextShootAt) return;
    if (!this.player.onFoot) return;
    if (this.player.weaponSlot !== 2) return;
    if (this.player.weaponAmmo <= 0) return;
    this.nextShootAt = performance.now() + 120;
    this.player.weaponAmmo -= 1;
    this.sound.shoot();
    this.player.aimRay();
    const hits = this.player.raycaster.intersectObjects(
      this.police.officers.map((o) => o.mesh), true
    );
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.officer) obj = obj.parent;
      const target = obj ? obj.userData.officer : null;
      if (target) {
        target.health -= 34;
        if (target.health <= 0) {
          this.police.removeOfficer(target);
          this.hud.toast('Officer down');
        }
      }
    }
  }

  wasted() {
    this.sound.wasted();
    this.money = Math.max(0, this.money - 100);
    this.wanted.stars = 0;
    this.wanted.evading = 0;
    if (this.player.car) this.player.enterCar();
    this.player.group.position.set(-250, 0, 20);
    this.player.health = 100;
    this.player.armour = 0;
    this.hud.toast('WASTED — Mercy Clinic patched you up · −$100');
    this.hud.setDialogue('Lupe', 'FIXER · PIER SHACK', 'You look rough, Kai. Shake it off — the city doesn\'t wait.', '');
  }

  update(dt) {
    // Clock: golden hour drifts slowly forward.
    this.hours += dt * 0.004;
    if (this.hours > 20) this.hours = 17.42;
    const duskT = this.duskT;

    // Sky + fog follow the dusk.
    const day = new THREE.Color(0xffd9a0);
    const dusk = new THREE.Color(0x3a1c4a);
    this.scene.background.copy(day).lerp(dusk, duskT);
    this.scene.fog.color.copy(this.scene.background);
    this.sun.intensity = 1.6 - duskT * 0.7;

    // Cooldowns.
    for (const k of ['Z', 'X', 'C']) this.crewCd[k] = Math.max(0, this.crewCd[k] - dt);

    this.player.move(this.keys, dt, this.camYaw);
    // Camera yaw eases behind the player.
    let dy = this.player.yaw - this.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.camYaw += dy * Math.min(1, 3 * dt);

    this.traffic.update(dt, duskT);
    this.police.update(dt, this.player, this.wanted);
    this.wanted.update(dt, this.player, this.police);

    // Missions.
    const ev = this.missions.update(dt, this.player);
    if (ev && !ev.failed) {
      this.money += ev.reward;
      this.respect += ev.respect;
      this.districts.onJobDone();
      this.hud.toast(`+$${ev.reward.toLocaleString()} · +${ev.respect} RESPECT`);
      this.sound.pickup();
      this.hud.setDialogue(ev.mission.giver, 'FIXER · PIER SHACK', 'Job done. The city notices, Kai.', 'Always.');
    }

    // Officers shoot when close (armour absorbs first).
    for (const o of this.police.officers) {
      const d = Math.hypot(o.x - this.player.x, o.z - this.player.z);
      if (d < 16 && Math.random() < dt * 0.5) {
        let dmg = 8;
        if (this.player.armour > 0) {
          const absorbed = Math.min(this.player.armour, dmg);
          this.player.armour -= absorbed;
          dmg -= absorbed;
        }
        this.player.health -= dmg;
        if (this.player.health <= 0) this.wasted();
      }
    }

    // Car condition wears on hard impacts (cruiser rams).
    if (this.player.car) {
      for (const c of this.police.cruisers) {
        const d = Math.hypot(c.x - this.player.car.x, c.z - this.player.car.z);
        if (d < 3.5 && c.speed > 6) {
          this.player.car.condition = Math.max(0, this.player.car.condition - dt * 6);
        }
      }
    }

    this.districts.update(this.player.x, this.player.z);
    this.world.update(dt, duskT, this.hours);
    this.audio.setEngine(this.player.car ? Math.abs(this.player.car.speed) / 26 : 0);
    this.hud.update(this);

    // Camera: follow behind the player (or the frozen shot camera).
    if (this.shotCamera) {
      this.camera.position.set(...this.shotCamera.pos);
      this.camera.lookAt(...this.shotCamera.look);
    } else {
      const px = this.player.x, pz = this.player.z;
      const back = 9 + (this.player.car ? 4 : 0);
      const cx = px - Math.sin(this.camYaw) * back;
      const cz = pz - Math.cos(this.camYaw) * back;
      const cy = this.player.car ? 4.5 : 3.2;
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(px, 1.4, pz);
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    const clock = new THREE.Clock();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      if (this.state === 'intro') {
        this.introT += dt;
        if (this.introT > 6) {
          this.state = 'title';
          this.hud.showOverlay('title');
        }
        this.render();
        return;
      }
      if (this.state !== 'playing') {
        this.render();
        return;
      }
      if (this.shotMode) {
        // Frozen in shot mode: render the staged frame, no simulation.
        this.render();
        return;
      }
      this.update(dt);
      this.render();
    };
    loop();
  }
}

// Boot when loaded as the page entry.
try {
  const game = new Game();
  window.__solaraGame = game;
  if (!game.shotMode) game.start();
} catch (e) {
  window.__solaraError = String(e && e.message || e);
  window.__solaraGame = null;
}
