// SOLARA — bootstrap: renderer, scene, camera, the game object the test
// drives (window.__solaraGame), input, the state machine (intro -> title
// -> playing), the follow camera and the frame loop. Shot mode (?shot=)
// skips the intro and freezes the simulation so the staged frame holds.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, WEAPONS, RADIO, clamp, lerp } from './config.js';
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

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '1', 10) || 1;

export function startGame() {
  const G = {
    config: { spawn: WORLD.spawn, WORLD },
    state: 'intro',
    hours: 17.42,
    money: 400,
    respect: 67,
    rp: 0,
    radioStation: 0,
    shotMode: null,
    seed: SEED,
  };
  Object.defineProperty(G, 'duskT', { get() { return clamp((G.hours - 18) / 1.5, 0, 1); } });

  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  G.renderer = renderer;
  G.scene = new THREE.Scene();
  G.scene.fog = new THREE.Fog(0xd98a6a, 120, 620);
  G.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 2000);
  G.camera.position.set(-230, 4, 10);
  G.camera.lookAt(-250, 1, 20);

  // Systems, in dependency order.
  G.world = buildWorld(G);
  G.traffic = new Traffic(G);
  G.player = new Player(G);
  G.police = new Police(G);
  G.wanted = new Wanted(G);
  G.missions = new Missions(G);
  G.districts = new Districts(G);
  G.garage = new Garage(G);
  G.hud = new HUD(G);
  G.audio = new AudioEngine();
  G.sound = new SoundFX();
  G.save = new SaveGame(G);
  G.missions.resetTimer();

  // Test API.
  G.interact = () => G.player.interact();
  G.shoot = () => G.player.shoot();
  G.cameraForward = () => {
    const p = G.player;
    // Camera-forward on the ground plane, from the camera toward the player.
    const dx = p.x - G.camera.position.x, dz = p.z - G.camera.position.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: dx / len, z: dz / len };
  };
  window.__solaraGame = G;
  window.__solaraError = null;
  window.__solaraShotReady = false;

  // ---- input ----
  const keys = new Set();
  const input = { forward: false, back: false, left: false, right: false, sprint: false, aim: false };
  const syncInput = () => {
    input.forward = keys.has('KeyW') || keys.has('ArrowUp');
    input.back = keys.has('KeyS') || keys.has('ArrowDown');
    input.left = keys.has('KeyA') || keys.has('ArrowLeft');
    input.right = keys.has('KeyD') || keys.has('ArrowRight');
    input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.aim = keys.has('Space') || mouseDown;
  };
  let mouseDown = false;
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    syncInput();
    if (e.code === 'Enter') advance();
    if (e.code === 'KeyF') G.player.interact();
    if (e.code === 'Space') { e.preventDefault(); if (G.state === 'playing') G.player.shoot(); }
    if (e.code === 'KeyR') cycleRadio();
    if (e.code === 'KeyM') toggleMap();
    if (e.code === 'KeyP') togglePause();
    if (e.code === 'KeyZ') useCrew('Z');
    if (e.code === 'KeyX') useCrew('X');
    if (e.code === 'KeyC') useCrew('C');
    if (e.code === 'F8') { G.save.write(); G.hud.toast('Saved', 'good'); }
    if (e.code === 'F9') { G.save.apply(G.save.read()); G.hud.toast('Loaded', 'good'); }
    const n = parseInt(e.code.replace('Digit', ''), 10);
    if (n >= 1 && n <= 5) G.player.setWeapon(n);
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); syncInput(); });
  addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; syncInput(); if (G.state === 'playing') G.player.shoot(); }
    if (e.button === 2) { G.player.setAimPose(true); }
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0) { mouseDown = false; syncInput(); }
    if (e.button === 2) { G.player.setAimPose(false); }
  });
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('resize', () => {
    G.camera.aspect = innerWidth / innerHeight;
    G.camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function advance() {
    if (G.state === 'intro') { G.state = 'title'; showOverlay('title'); }
    else if (G.state === 'title') { G.state = 'playing'; showOverlay(null); G.audio.ensure(); G.audio.start(G.radioStation); }
  }
  function showOverlay(which) {
    for (const id of ['intro-overlay', 'title-overlay', 'pause-overlay']) {
      const el = document.getElementById(id);
      if (el) el.style.display = id === `${which}-overlay` ? 'flex' : 'none';
    }
  }
  function cycleRadio() {
    G.radioStation = (G.radioStation + 1) % RADIO.length;
    G.audio.setStation(G.radioStation);
    G.hud.refreshCar();
  }
  function toggleMap() {
    const el = document.getElementById('map-overlay');
    if (!el) return;
    const open = el.style.display !== 'flex';
    el.style.display = open ? 'flex' : 'none';
    if (open) G.hud.refreshMinimap();
  }
  function togglePause() {
    if (G.state === 'playing') { G.state = 'paused'; showOverlay('pause'); }
    else if (G.state === 'paused') { G.state = 'playing'; showOverlay(null); }
  }
  function useCrew(key) {
    const G2 = G;
    if (G2.state !== 'playing') return;
    if (key === 'Z') {
      // MARA / GHOST: -1 star, blocked when a cruiser is within 30 m.
      const near = G2.police.cruisers.some((c) => Math.hypot(c.x - G2.player.x, c.z - G2.player.z) < 30);
      if (near) { G2.hud.toast('MARA: too hot — a cruiser is on you', 'bad'); return; }
      if (G2.wanted.stars === 0) { G2.hud.toast('MARA: no heat to lose', 'bad'); return; }
      G2.wanted.stars = Math.max(0, G2.wanted.stars - 1);
      G2.hud.setCrewCooldown('Z', 80);
      G2.hud.toast('MARA GHOST — heat down', 'good');
    } else if (key === 'X') {
      // SULLY / PIT CREW: repair the car to 100%.
      if (!G2.player.car) { G2.hud.toast('SULLY: get in a car first', 'bad'); return; }
      G2.player.car.condition = 100;
      G2.hud.setCrewCooldown('X', 55);
      G2.hud.toast('SULLY PIT CREW — repaired', 'good');
    } else if (key === 'C') {
      // KIKI / LOOKOUT: reveal patrols on the minimap for 20 s.
      G2.hud.setCrewCooldown('C', 70);
      G2.hud.toast('KIKI LOOKOUT — patrols revealed', 'good');
    }
  }

  // ---- intro auto-advance + shot mode ----
  showOverlay('intro');
  const introT = setTimeout(() => { if (G.state === 'intro') { G.state = 'title'; showOverlay('title'); } }, 6000);
  if (SHOT) {
    clearTimeout(introT);
    G.state = 'playing';
    showOverlay(null);
    // Stage after the first frame so the renderer exists.
    requestAnimationFrame(() => applyShot(G, SHOT));
  }

  // ---- frame loop ----
  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (G.state === 'playing' && !G.shotMode) {
      G.hours += dt * 0.0016;
      G.player.update(dt, input);
      G.traffic.update(dt);
      G.police.update(dt);
      G.wanted.update(dt);
      G.missions.update(dt);
      G.world.update(G.hours);
      G.traffic.setDusk(G.duskT);
      G.hud.update(dt);
      // Beacon follows the current mission target.
      const t = G.missions.currentStage.target;
      G.world.beacon.beam.position.set(t.x, 30, t.z);
      G.world.beacon.ring.position.set(t.x, 0.08, t.z);
      // Follow camera: behind the player (or the car), a touch to the right.
      const p = G.player;
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      const rx = Math.cos(p.heading), rz = -Math.sin(p.heading);
      const back = p.onFoot ? 5.4 : 8.2;
      const up = p.onFoot ? 2.7 : 3.6;
      const side = p.onFoot ? 1.5 : 1.2;
      camPos.set(p.x - fx * back + rx * side, up, p.z - fz * back + rz * side);
      G.camera.position.lerp(camPos, Math.min(1, 5 * dt));
      G.camera.lookAt(p.x + fx * 4, 1.3, p.z + fz * 4);
    } else if (G.shotMode) {
      G.world.update(G.hours);
    }
    renderer.render(G.scene, G.camera);
  }
  frame();

  // Load a save if one exists (fresh players start clean).
  G.save.apply(G.save.read());
  G.hud.refreshAll();
  return G;
}

// Boot: any failure surfaces as __solaraError so the test can report it.
try {
  startGame();
} catch (err) {
  window.__solaraError = String(err && err.message ? err.message : err);
  window.__solaraGame = window.__solaraGame || null;
  console.error(err);
}
