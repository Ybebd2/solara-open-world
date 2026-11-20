// SOLARA — main game boot + loop. Kai Mercer in a golden-hour coastal
// city: 8-job chain from fixer Lupe, carjack + driving, 5-star PCPD with
// helicopter at 3 stars, dusk halos, garage, map, radio, crew Z/X/C,
// wasted/respawn, pause, save/load F8/F9, dense HUD + minimap.
// Written fresh from the behavioural spec under recording T.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, WEAPONS, RADIO, CREW, TUNING } from './config.js';
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

// Seeded RNG so ?seed=1 replays deterministically (stars, spawns).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
if (seedParam !== null) {
  const seed = Number(seedParam) || 1;
  Math.random = mulberry32(seed);
}
const shotName = params.get('shot');

const DUSK = { skyDay: new THREE.Color(0xffd9a0), skyDusk: new THREE.Color(0x2a1a3a) };

export class Game {
  constructor() {
    this.state = 'intro';       // intro | title | playing | paused
    this.shotMode = false;
    this.money = 400;
    this.respect = 0;
    this.rp = 0;                // rank points = respect*20 + escapes*150
    this.escapes = 0;
    this.hours = WORLD.startHours;
    this.radioIdx = 2;          // SOLARA 98.3
    this.duskT = 0;
    this.introTimer = 0;
    this.nextShootAt = 0;       // real-time (ms) shoot cooldown
    this.crewCd = { Z: 0, X: 0, C: 0 };
    this.lookoutUntil = 0;
    this.mapOpen = false;
    this.keys = new Set();
    this.camYaw = 0;
    this.dialogueTimer = 0;

    // Renderer / scene / camera.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    document.body.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = DUSK.skyDay.clone();
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1200);
    this.camera.position.set(-240, 6, 60);
    this.sun = new THREE.DirectionalLight(0xffb347, 1.4);
    this.sun.position.set(-120, 140, 60);
    this.scene.add(this.sun);
    this.scene.add(new THREE.HemisphereLight(0xffd9a0, 0x2a2a3a, 0.9));

    // World systems.
    this.world = new World(this.scene);
    this.traffic = new Traffic(this.scene);
    this.player = new Player(this.scene, this.camera);
    this.police = new Police(this.scene);
    this.wanted = new Wanted();
    this.missions = new Missions(this.scene);
    this.districts = new Districts();
    this.garage = new Garage(this);
    this.save = new Save(this);
    this.audio = new AudioEngine();
    this.sound = new Sound(this.audio);
    this.hud = new HUD(document.body);

    // Kai starts at the pier shack; Lupe opens the chain.
    this.player.group.position.set(-250, 0, 20);
    this.player.yaw = Math.PI / 2;
    this.player.group.rotation.y = this.player.yaw;
    this.hud.setDialogue('Lupe', 'FIXER · PIER SHACK',
      'Kai. Eight jobs, one city. Start at the pier — and keep it clean.',
      'Back in Solara. Let\'s get to work.');
    this.districts.update(this.player.x, this.player.z);
    this.bindInput();
    this.clock = new THREE.Clock();
    this.buildMapOverlay();
  }

  buildMapOverlay() {
    const div = document.createElement('div');
    div.id = 'mapoverlay';
    div.style.cssText = 'position:fixed;inset:0;background:rgba(8,10,20,.92);display:none;z-index:20;align-items:center;justify-content:center;flex-direction:column;color:#fff;font-family:Arial,sans-serif';
    div.innerHTML = '<h2 style="letter-spacing:4px;margin:0 0 8px">SOLARA — MAP</h2><canvas id="bigmap" width="640" height="520" style="border:2px solid #f2c14e;border-radius:8px"></canvas><p style="color:#9fb3c8;font-size:13px">Click to set a waypoint · M / Esc to close</p>';
    document.body.appendChild(div);
    this.mapDiv = div;
    this.mapCanvas = div.querySelector('#bigmap');
    div.addEventListener('click', (e) => {
      const r = this.mapCanvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 640 - 320;
      const z = ((e.clientY - r.top) / r.height) * 520 - 260;
      this.waypoint = { x, z };
    });
  }

  drawMap() {
    const ctx = this.mapCanvas.getContext('2d');
    const W = 640, H = 520;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0e1a2a'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#3a4a5c'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    // District labels.
    ctx.fillStyle = '#ffd98a'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
    for (const d of this.districts.list) {
      const x = ((d.x + 320) / 640) * W;
      const y = ((d.z + 260) / 520) * H;
      ctx.fillText(`${d.name} · ${d.standing}`, x, y);
    }
    // Mission beacon.
    const t = this.missions.current.target;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(((t.x + 320) / 640) * W, ((t.z + 260) / 520) * H, 8, 0, Math.PI * 2); ctx.fill();
    // Waypoint.
    if (this.waypoint) {
      ctx.strokeStyle = '#2ee6c8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(((this.waypoint.x + 320) / 640) * W, ((this.waypoint.z + 260) / 520) * H, 10, 0, Math.PI * 2); ctx.stroke();
    }
    // Player.
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(((this.player.x + 320) / 640) * W, ((this.player.z + 260) / 520) * H, 6, 0, Math.PI * 2); ctx.fill();
    // Police.
    ctx.fillStyle = '#ff3b30';
    for (const c of this.police.cruisers) {
      ctx.beginPath(); ctx.arc(((c.x + 320) / 640) * W, ((c.z + 260) / 520) * H, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  bindInput() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.audio.ensure(); this.audio.resume();
      if (e.code === 'Enter') {
        if (this.state === 'intro') { this.state = 'title'; this.hud.showOverlay('title'); }
        else if (this.state === 'title') { this.startPlaying(); }
      } else if (e.code === 'KeyP') {
        if (this.state === 'playing') { this.state = 'paused'; this.hud.showOverlay('paused'); }
        else if (this.state === 'paused') { this.state = 'playing'; this.hud.showOverlay(null); }
      } else if (e.code === 'KeyM') {
        if (this.state === 'playing') {
          this.mapOpen = !this.mapOpen;
          this.mapDiv.style.display = this.mapOpen ? 'flex' : 'none';
          if (this.mapOpen) this.drawMap();
        }
      } else if (e.code === 'Escape' && this.mapOpen) {
        this.mapOpen = false; this.mapDiv.style.display = 'none';
      } else if (e.code === 'KeyR' && this.state === 'playing') {
        this.radioIdx = (this.radioIdx + 1) % RADIO.length;
        this.audio.setStation(this.radioIdx);
      } else if (e.code === 'KeyF' && this.state === 'playing') {
        this.interact();
      } else if ((e.code === 'KeyZ' || e.code === 'KeyX' || e.code === 'KeyC') && this.state === 'playing') {
        this.useCrew(e.code.slice(3));
      } else if (e.code === 'F8' && this.state === 'playing') {
        if (this.save.write()) this.hud.toast('SAVED');
      } else if (e.code === 'F9' && this.state === 'playing') {
        if (this.save.load()) { this.hud.toast('LOADED'); this.districts.update(this.player.x, this.player.z); }
        else this.hud.toast('NO SAVE YET');
      } else if (/^Digit[1-5]$/.test(e.code) && this.state === 'playing') {
        const slot = Number(e.code.slice(5));
        if (!this.player.setWeapon(slot)) this.hud.toast('LOCKED — finish jobs to unlock');
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousedown', (e) => {
      this.audio.ensure(); this.audio.resume();
      if (e.button === 0 && this.state === 'playing' && !this.mapOpen) this.shoot();
    });
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  startPlaying() {
    this.state = 'playing';
    this.hud.showOverlay(null);
    this.audio.setStation(this.radioIdx);
  }

  interact() {
    if (this.player.car) {
      const car = this.player.car;
      this.player.enterCar();
      this.traffic.parked.push(car);
      return;
    }
    const car = this.traffic.nearestParked(this.player.x, this.player.z, 6);
    if (!car) return;
    const i = this.traffic.parked.indexOf(car);
    if (i >= 0) this.traffic.parked.splice(i, 1);
    this.player.enterCar(car);
    this.garage.applyTo(car);
    this.wanted.addStar(1);
    this.sound.siren();
    this.hud.toast('CARJACKED +1 ★');
  }

  // Fire the VESPER 9. Horizontal chest ray + real-time 120 ms cooldown.
  shoot() {
    if (this.state !== 'playing' && !this.shotMode) return;
    if (this.player.weaponSlot !== 2) return;
    if (this.player.weaponAmmo <= 0) { this.hud.toast('MAG EMPTY'); return; }
    const now = performance.now();
    if (now < this.nextShootAt) return;
    this.nextShootAt = now + 120;
    this.player.weaponAmmo -= 1;
    this.sound.shoot();
    this.player.aimRay();
    const meshes = this.police.officers.map((o) => o.mesh);
    for (const c of this.police.cruisers) meshes.push(c.mesh);
    const hits = this.player.raycaster.intersectObjects(meshes, true);
    if (!hits.length) return;
    // Walk up from the hit child to the object carrying userData.officer.
    let obj = hits[0].object;
    while (obj && !obj.userData.officer && !obj.userData.cruiser) obj = obj.parent;
    if (!obj) return;
    if (obj.userData.officer) {
      const off = obj.userData.officer;
      off.health -= TUNING.shotDamage;
      if (off.health <= 0) {
        this.police.removeOfficer(off);
        this.hud.toast('OFFICER DOWN');
      }
    } else if (obj.userData.cruiser) {
      const car = obj.userData.cruiser;
      car.condition = Math.max(0, car.condition - 10);
      if (car.condition <= 0) car.status = 'WRECKED';
    }
  }

  useCrew(key) {
    const now = performance.now();
    if (now < this.crewCd[key]) return;
    const c = CREW[key];
    if (key === 'Z') {
      // GHOST: −1 star, blocked if a cruiser is within 30 m.
      let nearest = Infinity;
      for (const cr of this.police.cruisers) {
        nearest = Math.min(nearest, Math.hypot(cr.x - this.player.x, cr.z - this.player.z));
      }
      if (nearest < TUNING.ghostBlockDist) {
        this.hud.toast('GHOST BLOCKED — cruiser too close');
        return;
      }
      if (this.wanted.stars === 0) { this.hud.toast('NO HEAT TO CLEAR'); return; }
      this.wanted.removeStar(1);
      this.escapes += 1;
      this.rp = this.respect * 20 + this.escapes * 150;
      this.crewCd.Z = now + c.cooldown * 1000;
      this.hud.toast('MARA · GHOST — heat down');
    } else if (key === 'X') {
      if (!this.player.car) { this.hud.toast('PIT CREW needs a car'); return; }
      this.player.car.condition = 100;
      this.crewCd.X = now + c.cooldown * 1000;
      this.hud.toast('SULLY · PIT CREW — repaired');
    } else if (key === 'C') {
      this.lookoutUntil = now + 20000;
      this.crewCd.C = now + c.cooldown * 1000;
      this.hud.toast('KIKI · LOOKOUT — patrols revealed 20 s');
    }
  }

  wasted() {
    this.sound.wasted();
    this.hud.toast('WASTED — Mercy Clinic · −$100');
    this.money = Math.max(0, this.money - 100);
    this.player.health = 100;
    this.player.armour = 0;
    this.wanted.stars = 0;
    this.wanted.evading = 0;
    this.police.removeHeli();
    if (this.player.car) { this.traffic.parked.push(this.player.car); this.player.enterCar(); }
    this.player.group.position.set(-250, 0, 20);
    this.player.group.visible = true;
    this.player.onFoot = true;
    this.player.yaw = Math.PI / 2;
    this.player.group.rotation.y = this.player.yaw;
    this.districts.update(this.player.x, this.player.z);
  }

  update(dt) {
    // Clock + dusk.
    this.hours += dt / 120;
    if (this.hours > 23.9) this.hours = 17.42;
    this.duskT = THREE.MathUtils.clamp((this.hours - WORLD.duskStart) / WORLD.duskSpan, 0, 1);

    // Intro auto-advance (~6 s).
    if (this.state === 'intro') {
      this.introTimer += dt;
      if (this.introTimer > 6) { this.state = 'title'; this.hud.showOverlay('title'); }
    }
    if (this.state !== 'playing') return;

    // Movement. camYaw is the CAMERA yaw: the chase camera sits
    // behind the player (back = yaw + PI), so the camera's forward is
    // the player's facing — camYaw must be yaw + PI. (The old code
    // assigned camYaw = yaw, which flips the W direction every frame:
    // the player vibrated ±0.3 m and never actually walked.)
    this.player.move(this.keys, dt, this.camYaw);
    this.camYaw = this.player.yaw + Math.PI;

    // Systems.
    this.traffic.update(dt, this.duskT);
    this.police.update(dt, this.player, this.wanted);
    this.wanted.update(dt, this.player, this.police);
    this.districts.update(this.player.x, this.player.z);

    // Officer contact damage — armour soaks first.
    for (const o of [...this.police.officers]) {
      const d = Math.hypot(o.x - this.player.x, o.z - this.player.z);
      if (d < 2 && this.player.onFoot) {
        let dmg = 12 * dt;
        if (this.player.armour > 0) {
          const soak = Math.min(this.player.armour, dmg);
          this.player.armour -= soak; dmg -= soak;
        }
        this.player.health -= dmg;
        if (this.player.health <= 0) { this.wasted(); break; }
      }
    }

    // Missions.
    const ev = this.missions.update(dt, this.player);
    if (ev) {
      if (ev.failed) {
        this.hud.toast('JOB FAILED — the tide waits for no one');
      } else {
        this.money += ev.reward;
        this.respect += ev.respect;
        this.rp = this.respect * 20 + this.escapes * 150;
        this.districts.onJobDone();
        this.sound.pickup();
        this.hud.toast(`+$${ev.reward.toLocaleString()} · +${ev.respect} RESPECT`);
        const m = this.missions.current;
        this.hud.setDialogue(m.giver, `${m.giver.toUpperCase()} · ${m.ch}`, m.next, '');
      }
    }

    // World + audio.
    this.world.update(dt, this.duskT, this.hours);
    const carSpeed = this.player.car ? Math.abs(this.player.car.speed) / 26 : 0;
    this.audio.setEngine(carSpeed);

    // Sun + sky follow dusk.
    this.scene.background.copy(DUSK.skyDay).lerp(DUSK.skyDusk, this.duskT);
    this.sun.intensity = 1.4 - this.duskT * 0.7;
    this.sun.color.setHex(this.duskT > 0.5 ? 0xff8c42 : 0xffb347);

    // Chase camera (third person, behind the player).
    if (!this.shotMode) {
      const back = this.player.yaw + Math.PI;
      const cx = this.player.x + Math.sin(back) * 9;
      const cz = this.player.z + Math.cos(back) * 9;
      this.camera.position.lerp(new THREE.Vector3(cx, 4.2, cz), Math.min(1, dt * 6));
      this.camera.lookAt(this.player.x - Math.sin(this.player.yaw) * 6, 1.6, this.player.z - Math.cos(this.player.yaw) * 6);
    }

    this.hud.update(this);
    if (this.mapOpen) this.drawMap();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  loop() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.shotMode) {
      // Frozen staging: HUD reflects the staged state, world does not move.
      this.hud.update(this);
      this.render();
    } else {
      this.update(dt);
      this.render();
    }
    requestAnimationFrame(() => this.loop());
  }

  start() {
    if (shotName) {
      // Shot mode: stage the frozen shot, then signal readiness.
      this.state = 'playing';
      this.shotMode = true;
      this.hud.showOverlay(null);
      try {
        stageShot(this, shotName);
      } catch (e) {
        window.__solaraError = String(e && e.message ? e.message : e);
        window.__solaraShotReady = false;
        return;
      }
      this.render();
      this.hud.update(this);
      window.__solaraShotReady = true;
    }
    this.loop();
  }
}

let game = null;
try {
  game = new Game();
  window.__solaraGame = game;
  window.__solaraError = null;
  window.__solaraShotReady = false;
  game.start();
} catch (e) {
  window.__solaraGame = game;
  window.__solaraError = String(e && e.message ? e.message : e);
  window.__solaraShotReady = false;
}
