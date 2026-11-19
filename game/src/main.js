// SOLARA — the game: state machine, loop, input, driving, shooting,
// crew, garage, map, radio, save/load, and the shot hook.
import * as THREE from '../vendor/three.module.min.js';
import { buildWorld } from './world.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Wanted } from './wanted.js';
import { Missions } from './missions.js';
import { Districts } from './districts.js';
import { Garage } from './garage.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { SoundFX } from './sound.js';
import { SaveGame } from './save.js';
import { applyShot } from './shots.js';
import { WORLD, WEAPONS, CREW, RADIO, clamp, mulberry32 } from './config.js';

export class Game {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.seed = parseInt(params.get('seed') || '1', 10) || 1;
    this.shotName = params.get('shot') || null;
    this.rng = mulberry32(this.seed);

    this.state = 'intro';
    this.shotMode = false;
    this.fixedCamera = false;
    this.hours = 17.42;
    this.duskT = 0;
    this.money = 400;
    this.respect = 57;
    this.radioStation = 0;
    this.waypoint = null;
    this.time = 0;
    this.camYaw = 0;
    this._introT = 0;
    this._wastedT = 0;
    this._crewCd = {};
    this._crewLoyalty = 100;
    this._mapDrag = null;

    // Renderer / scene / camera.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);
    this.camera.position.set(-230, 4, -20);

    // Systems.
    this.world = buildWorld(this.scene, this.seed);
    this.traffic = new Traffic(this.scene, this.seed);
    this.player = new Player(this.scene);
    this.player.camera = this.camera;
    this.player.group.position.set(WORLD.spawnX, 0, WORLD.spawnZ);
    this.police = new Police(this.scene, this.seed);
    this.wanted = new Wanted();
    this.missions = new Missions();
    this.missions.resetTimer();
    this.districts = new Districts();
    this.garage = new Garage();
    this.audio = new AudioEngine();
    this.sound = new SoundFX(this.audio);
    this.save = new SaveGame();
    this.hud = new HUD(this);

    // Mission wiring.
    this.missions.onComplete = (job) => {
      this.money += job.reward;
      this.respect += job.respect;
      this.districts.jobDone();
      this.hud.toast(`+$${job.reward.toLocaleString('en-US')}`, `+${job.respect} respect`);
      this.sound.cash();
      const next = this.missions.current;
      const giver = next ? next.giver : 'Lupe';
      this.hud.showDialogue(giver.toLowerCase(), giver, 'FIXER · SOLARA',
        job.reward >= 4000 ? 'That was the big one, Kai. Golden hour suits you.' : 'Clean work. The city noticed.',
        'Always.');
    };
    this.missions.onStage = (job, stage) => {
      if (stage === 1 && job.title === 'BORROWED WHEELS') {
        this.hud.showDialogue('lupe', 'Lupe', 'FIXER · PIER SHACK',
          'The coupe sits on Beach Road — bring it back clean.', 'On it.');
      }
    };
    this.missions.onFail = (job) => {
      this.player.group.position.set(WORLD.spawnX, 0, WORLD.spawnZ);
      this.hud.toast('JOB FAILED — time ran out', 'Back to the pier. Try again.');
    };
    this.garage.onBuy = (up) => {
      if (up.id === 'paint') this.respect += 10;
      this.hud.toast(`${up.name} installed`, `−$${up.cost}`);
      this.sound.cash();
    };

    this.keys = new Set();
    this._bindInput();
    this.hud.showOverlay(this.hud.intro);
    this._loop = this._loop.bind(this);

    window.__solaraGame = this;
    window.__solaraError = null;
    window.__solaraShotReady = false;

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  _bindInput() {
    addEventListener('keydown', (e) => {
      this.audio.unlock();
      if (e.code === 'Enter') { this._advance(); return; }
      if (this.state !== 'playing' && this.state !== 'map') return;
      this.keys.add(e.code);
      if (e.code === 'KeyM') { this._toggleMap(); return; }
      if (e.code === 'KeyP') { this._togglePause(); return; }
      if (e.code === 'KeyR') {
        this.radioStation = (this.radioStation + 1) % RADIO.length;
        this.audio.setRadio(this.radioStation, true);
        return;
      }
      if (e.code === 'KeyG') { this._garageAction(); return; }
      if (e.code === 'F8') { const d = this.save.save(this); this.hud.toast(d ? 'GAME SAVED' : 'SAVE FAILED'); return; }
      if (e.code === 'F9') {
        const d = this.save.load();
        if (d && this.save.apply(this, d)) this.hud.toast('GAME LOADED');
        else this.hud.toast('NO SAVE FOUND');
        return;
      }
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        const w = WEAPONS.find((x) => x.id === n);
        if (w) {
          if (this.missions.index < w.unlock) this.hud.toast(`${w.name} LOCKED`, `Finish ${w.unlock} jobs first`);
          else { this.player.setWeapon(n); this.sound.click(); }
        }
        return;
      }
      if (e.code === 'KeyZ' || e.code === 'KeyX' || e.code === 'KeyC') this._crew(e.code === 'KeyZ' ? 0 : e.code === 'KeyX' ? 1 : 2);
      if (this.state === 'map' && e.code === 'Escape') this._toggleMap();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('mousedown', (e) => {
      this.audio.unlock();
      if (e.button === 0 && this.state === 'playing') this.shoot();
    });
    // Map interactions.
    this.hud.mapCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.hud._mapZoom = clamp((this.hud._mapZoom || 1) * (e.deltaY < 0 ? 1.15 : 0.87), 0.6, 3);
      this.hud.drawBigMap();
    }, { passive: false });
    this.hud.mapCanvas.addEventListener('mousedown', (e) => { this._mapDrag = { x: e.clientX, y: e.clientY }; });
    addEventListener('mousemove', (e) => {
      if (!this._mapDrag || this.state !== 'map') return;
      this.hud._mapOX = (this.hud._mapOX || 0) + (e.clientX - this._mapDrag.x);
      this.hud._mapOY = (this.hud._mapOY || 0) + (e.clientY - this._mapDrag.y);
      this._mapDrag = { x: e.clientX, y: e.clientY };
      this.hud.drawBigMap();
    });
    addEventListener('mouseup', (e) => {
      if (this._mapDrag && this.state === 'map') {
        const moved = Math.hypot(e.clientX - this._mapDrag.x, e.clientY - this._mapDrag.y);
        if (moved < 4) {
          const r = this.hud.mapCanvas.getBoundingClientRect();
          const z = this.hud._mapZoom || 1;
          const scale = (640 / 640) * z;
          const wx = ((e.clientX - r.left - 320 - (this.hud._mapOX || 0)) / scale) + this.player.x;
          const wz = ((e.clientY - r.top - 320 - (this.hud._mapOY || 0)) / scale) + this.player.z;
          this.waypoint = { x: clamp(wx, -315, 315), z: clamp(wz, -315, 315) };
          this.hud.drawBigMap();
          this.hud.toast('WAYPOINT SET');
        }
      }
      this._mapDrag = null;
    });
  }

  _advance() {
    if (this.state === 'intro') {
      this.state = 'title';
      this.hud.showOverlay(this.hud.title);
    } else if (this.state === 'title') {
      this.state = 'playing';
      this.hud.showOverlay(null);
      this.sound.click();
    }
  }

  _togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.hud.showOverlay(this.hud.pauseOv);
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.hud.showOverlay(null);
    }
  }

  _toggleMap() {
    if (this.state === 'playing') {
      this.state = 'map';
      this.hud.showOverlay(this.hud.mapOv);
      this.hud.drawBigMap();
    } else if (this.state === 'map') {
      this.state = 'playing';
      this.hud.showOverlay(null);
    }
  }

  _garageAction() {
    if (!this.garage.near(this.player.x, this.player.z)) {
      if (this.state === 'playing') this.hud.toast("SULLY'S GARAGE", 'Drive to the green S on the map');
      return;
    }
    const res = this.garage.buyNext(this.money);
    if (res.ok) {
      this.money -= res.upgrade.cost;
      this.hud.showOverlay(this.hud.garageOv);
      this._renderGarageList();
    } else {
      this.hud.toast(res.reason === 'broke' ? 'NOT ENOUGH CASH' : 'ALL UPGRADES OWNED');
    }
  }

  _renderGarageList() {
    this.hud.garageList.innerHTML = this.garage.list().map((u, i) =>
      `<div class="garage-row"><span>${i + 1}. ${u.name} — ${u.desc}</span><span>${u.owned ? 'OWNED' : '$' + u.cost}</span></div>`).join('');
  }

  _crew(i) {
    const c = CREW[i];
    const now = this.time;
    if ((this._crewCd[i] || 0) > now) {
      this.hud.toast(`${c.name} — cooling down`, `${Math.ceil(this._crewCd[i] - now)}s`);
      return;
    }
    if (c.id === 'MARA') {
      if (this.wanted.stars === 0) { this.hud.toast('MARA / GHOST', 'No heat to lose'); return; }
      const near = this.police.cruisers.some((cr) => Math.hypot(cr.x - this.player.x, cr.z - this.player.z) < 30);
      if (near) { this.hud.toast('MARA / GHOST', 'Too hot — a cruiser is right on you'); return; }
      this.wanted.removeStars(1);
    } else if (c.id === 'SULLY') {
      if (!this.player.car) { this.hud.toast('SULLY / PIT CREW', 'Get in a car first'); return; }
      this.player.car.condition = 100;
    } else {
      this.hud.toast('KIKI / LOOKOUT', 'Patrols marked on the minimap for 20s');
    }
    this._crewCd[i] = now + c.cooldown;
    this._crewLoyalty = Math.max(50, this._crewLoyalty - 3);
    this.hud.toast(`${c.name} — ${c.desc}`, `Loyalty ${this._crewLoyalty}%`);
  }

  interact() {
    if (this.state !== 'playing' && !this.shotMode) return;
    if (this.player.onFoot) {
      // Enter the nearest parked car.
      let best = null, bd = 1e9;
      for (const c of this.traffic.parked) {
        const d = Math.hypot(c.mesh.position.x - this.player.x, c.mesh.position.z - this.player.z);
        if (d < bd) { bd = d; best = c; }
      }
      if (best && bd < 5) {
        this.player.enterCar(best);
        this.wanted.addStars(1);
        this.hud.toast(`CARJACKED ${best.name.toUpperCase()}`, '+1 star');
        this.sound.carjack();
        for (const p of this.traffic.peds) {
          if (Math.hypot(p.group.position.x - this.player.x, p.group.position.z - this.player.z) < 14) p.flee = 3;
        }
      }
    } else {
      this.player.exitCar();
    }
  }

  shoot() {
    if (this.state !== 'playing' && !this.shotMode) return;
    if (!this.player.onFoot || this.player.weapon <= 1) return;
    if (this.player.weaponAmmo !== Infinity && this.player.weaponAmmo <= 0) {
      this.hud.toast('MAG EMPTY', 'Press 2 to reload the VESPER');
      return;
    }
    if (this.player.weaponAmmo !== Infinity) this.player.weaponAmmo--;
    this.sound.shot();
    this.player.aimRay();
    const meshes = [];
    for (const o of this.police.officers) meshes.push(o.mesh);
    const hits = this.player.raycaster.intersectObjects(meshes, true);
    if (hits.length > 0) {
      const target = this._officerFromMesh(hits[0].object);
      if (target) {
        const killed = this.police.damageOfficer(target, 34);
        this.sound.hit();
        this.hud.toast(killed ? 'OFFICER DOWN' : 'HIT — OFFICER WOUNDED', killed ? '+1 takedown' : '');
      }
    } else {
      // Aim assist: if the ray passes close by an officer's chest, count it.
      const ray = this.player.raycaster.ray;
      let best = null, bestD = 1.1;
      for (const o of this.police.officers) {
        const chest = new THREE.Vector3(o.mesh.position.x, 1.3, o.mesh.position.z);
        const toChest = chest.clone().sub(ray.origin);
        const along = toChest.dot(ray.direction);
        if (along < 0 || along > 60) continue;
        const closest = ray.origin.clone().add(ray.direction.clone().multiplyScalar(along));
        const d = closest.distanceTo(chest);
        if (d < bestD) { bestD = d; best = o; }
      }
      if (best) {
        const killed = this.police.damageOfficer(best, 34);
        this.sound.hit();
        this.hud.toast(killed ? 'OFFICER DOWN' : 'HIT — OFFICER WOUNDED', killed ? '+1 takedown' : '');
      }
    }
    // Muzzle flash.
    this._flash = 0.06;
  }

  _officerFromMesh(obj) {
    let o = obj;
    while (o) {
      const found = this.police.officers.find((x) => x.mesh === o);
      if (found) return found;
      o = o.parent;
    }
    return null;
  }

  _onPlayerShot(dmg) {
    if (this.state !== 'playing') return;
    this.player.takeDamage(dmg);
    if (this.player.health <= 0) {
      this.state = 'wasted';
      this._wastedT = 0;
      this.money = Math.max(0, this.money - 100);
      this.wanted.stars = 0;
      this.hud.wastedSub.textContent = 'Mercy Clinic patched you up · −$100';
      this.hud.showOverlay(this.hud.wastedOv);
      this.sound.wasted();
    }
  }

  _driveCar(dt) {
    const car = this.player.car;
    if (!car) return;
    const k = this.keys;
    const engine = this.garage.owned.includes('engine') ? 1.15 : 1;
    const top = car.topSpeed * engine;
    if (k.has('KeyW')) car.speed = Math.min(car.speed + car.accel * dt, top);
    else if (k.has('KeyS')) car.speed = Math.max(car.speed - car.accel * 1.4 * dt, -9);
    else car.speed *= Math.max(0, 1 - 1.4 * dt);
    if (Math.abs(car.speed) > 0.4) {
      const steer = (k.has('KeyA') ? 1 : 0) - (k.has('KeyD') ? 1 : 0);
      car.angle += steer * 1.7 * dt * clamp(Math.abs(car.speed) / 8, 0.2, 1) * Math.sign(car.speed);
    }
    car.mesh.rotation.y = car.angle;
    car.mesh.position.x = clamp(car.mesh.position.x + Math.sin(car.angle) * car.speed * dt, -312, 312);
    car.mesh.position.z = clamp(car.mesh.position.z + Math.cos(car.angle) * car.speed * dt, -312, 312);
    car.sync();
    car.condition = clamp(car.condition - Math.abs(car.speed) * dt * 0.02, 0, 100);
    for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.36;
    this.audio.setEngine(Math.abs(car.speed) / top, true);
  }

  _camera(dt) {
    if (this.fixedCamera) return;
    const target = this.player.onFoot ? this.player.group.position : this.player.car.mesh.position;
    const heading = this.player.onFoot ? this.player.heading : this.player.car.angle;
    // Ease the camera yaw toward the heading.
    let da = heading - this.camYaw;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    this.camYaw += da * Math.min(1, dt * 3);
    const dist = this.player.onFoot ? 6.5 : 10;
    const height = this.player.onFoot ? 3.2 : 3.8;
    const cx = target.x - Math.sin(this.camYaw) * dist;
    const cz = target.z - Math.cos(this.camYaw) * dist;
    this.camera.position.x += (cx - this.camera.position.x) * Math.min(1, dt * 5);
    this.camera.position.y += (height - this.camera.position.y) * Math.min(1, dt * 5);
    this.camera.position.z += (cz - this.camera.position.z) * Math.min(1, dt * 5);
    this.camera.lookAt(target.x, target.y + 1.4, target.z);
  }

  _update(dt) {
    this.time += dt;
    this.hours += dt * 0.004;
    if (this.hours >= 24) this.hours -= 24;
    this.duskT = clamp((this.hours - 18) / 1.5, 0, 1);
    this.world.update(this.duskT, this.hours);

    if (this.state === 'intro') {
      this._introT += dt;
      if (this._introT > 6) this._advance();
    }
    if (this.state === 'wasted') {
      this._wastedT += dt;
      if (this._wastedT > 2.5) {
        this.player.health = 100;
        this.player.armour = 0;
        this.player.group.position.set(WORLD.spawnX, 0, WORLD.spawnZ);
        if (this.player.car) this.player.exitCar();
        this.state = 'playing';
        this.hud.showOverlay(null);
      }
      this._camera(dt);
      return;
    }
    if (this.state !== 'playing' && this.state !== 'map') {
      this._camera(dt);
      return;
    }

    // Driving / walking.
    if (this.player.onFoot) {
      this.player.update(dt, this.keys, this.camYaw);
      this.audio.setEngine(0, false);
    } else {
      this._driveCar(dt);
    }
    // F interacts (edge-triggered via keydown is unreliable in headless;
    // poll the key set here with a latch).
    if (this.keys.has('KeyF') && !this._fLatch) {
      this._fLatch = true;
      this.interact();
    }
    if (!this.keys.has('KeyF')) this._fLatch = false;

    const pPos = { x: this.player.x, z: this.player.z };
    this.traffic.update(dt, this.duskT, pPos, this.time);
    this.police.update(dt, this.player, this.wanted.stars, (dmg) => this._onPlayerShot(dmg));
    const escaped = this.wanted.update(dt, this.police, pPos);
    if (escaped > 0) {
      this.money += escaped;
      this.hud.toast('ESCAPED THE HEAT', `+$${escaped}`);
    }
    this.missions.update(dt, pPos.x, pPos.z);
    this.districts.update(pPos.x, pPos.z);
    this._camera(dt);
    this.hud.update();
    if (this._flash > 0) this._flash -= dt;
  }

  _loop() {
    requestAnimationFrame(this._loop);
    if (this.shotMode) {
      // Frozen render for the dossier screenshot.
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const dt = Math.min(this._clock.getDelta(), 0.05);
    try {
      this._update(dt);
    } catch (e) {
      window.__solaraError = String(e && e.message || e);
      throw e;
    }
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    this._clock = new THREE.Clock();
    // First frame, then stage a dossier shot if requested.
    this.renderer.render(this.scene, this.camera);
    this.hud.update();
    if (this.shotName) {
      try {
        applyShot(this, this.shotName);
      } catch (e) {
        window.__solaraError = String(e && e.message || e);
      }
    }
    this._loop();
  }
}

export function startGame() {
  try {
    const game = new Game();
    game.start();
    return game;
  } catch (e) {
    window.__solaraError = String(e && e.message || e);
    window.__solaraGame = window.__solaraGame || null;
    throw e;
  }
}

// The page loads this module directly: boot immediately.
startGame();
