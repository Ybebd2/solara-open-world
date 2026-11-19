// SOLARA — the entry point and the game loop. This file wires the city, the
// player, the cars, the traffic, the police, the missions, the HUD and the
// sound together, and runs the frame loop. It also owns the save (cash, the
// mission chain, the player's spot) in localStorage, and the screenshot mode
// (?shot=) that stages the dossier's images.

import * as THREE from 'three';
import { CONFIG, makeRandom, pick, clamp } from './config.js';
import { buildWorld, hitsBuilding } from './world.js';
import { Car, Traffic, Pedestrians } from './vehicles.js';
import { Player, FollowCamera } from './player.js';
import { Wanted, Police } from './police.js';
import { MissionManager } from './missions.js';
import { Sound } from './audio.js';
import { HUD, bindMenus } from './hud.js';
import { shotFromUrl, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
const world = buildWorld(scene);
const followCam = new FollowCamera(camera);

const player = new Player(scene);
const traffic = new Traffic(scene, world, 14);
const pedestrians = new Pedestrians(scene, world, 22);
const police = new Police(scene, world);
const wanted = new Wanted();
const missions = new MissionManager();
const sound = new Sound();
const hud = new HUD();

// Parked cars the player can steal, lined up along the roads.
const parkedCars = [];
{
  const rand = makeRandom(555);
  const roads = world.roads.horizontal.concat(world.roads.vertical);
  for (let i = 0; i < 10; i++) {
    const road = pick(rand, roads);
    const along = -world.half + rand() * world.half * 2;
    const x = road.z !== undefined ? along : road.x + (rand() < 0.5 ? 4.5 : -4.5);
    const z = road.z !== undefined ? road.z + (rand() < 0.5 ? 4.5 : -4.5) : along;
    const heading = road.z !== undefined ? (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rand() < 0.5 ? 0 : Math.PI);
    parkedCars.push(new Car(scene, x, z, heading, pick(rand, [0xc0392b, 0x2e6db4, 0xe8e8e8, 0xf5c542, 0x7a4a9e, 0x2e8b57])));
  }
}

// The game object the screenshot stager and the loop share.
const game = {
  state: 'menu',
  scene, camera, world, player, traffic, pedestrians, police, wanted, missions, hud, sound,
  parkedCars,
  cash: 0,
  inCar: false,
  playerCar: null,
  carStolen: false,
  wasWanted: false,
  quietTimer: 0,
  keys: {},
  mouseDown: false,
  camYaw: 0,
  camPitch: 0.32,
  pointerLocked: false,
  saveTimer: 0,
  // The nearest car (parked or traffic) to a point, for entering and for shots.
  nearestCarTo(x, z, maxDist = 8) {
    let best = null;
    let bestD = maxDist;
    for (const c of [...parkedCars, ...traffic.cars]) {
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  },
  // Put the player into a car (used by the E key and by the shot stager).
  enterCar(car, silent = false) {
    if (!car) return null;
    this.playerCar = car;
    this.inCar = true;
    this.carStolen = true;
    player.group.visible = false;
    if (!silent) {
      wanted.add(CONFIG.HEAT_PER_CAR_STEAL);
      pedestrians.scare(car.pos.x, car.pos.z, 20);
      sound.sirenBlip();
      hud.toast(`Stole a ${car.name} — the police are coming`, 3);
    }
    return car;
  },
  exitCar() {
    if (!this.playerCar) return;
    const car = this.playerCar;
    player.place(car.pos.x + Math.sin(car.heading + Math.PI / 2) * 2.5, car.pos.z + Math.cos(car.heading + Math.PI / 2) * 2.5, car.heading);
    player.group.visible = true;
    this.playerCar = null;
    this.inCar = false;
    this.carStolen = false;
  },
  refreshHud() {
    const m = missions.current();
    hud.update({
      stars: wanted.stars,
      cash: this.cash,
      objective: m ? `${m.title}: ${m.text}` : 'All missions done — Solara is yours.',
      health: player.health,
      ammo: player.ammo,
      ammoMax: player.ammoMax,
      speed: this.playerCar ? this.playerCar.speed : 0,
      inCar: this.inCar,
      timeLeft: missions.timeLeft(),
      playerPos: this.inCar ? this.playerCar.pos : player.pos,
      playerHeading: this.inCar ? this.playerCar.heading : player.camYaw,
      world, traffic: traffic.cars, policeCars: police.cars,
      missionTarget: missions.targetPos(world.places),
    });
  },
};

// ----- Input -----
window.addEventListener('keydown', (e) => {
  game.keys[e.code] = true;
  if (e.code === 'KeyP' && game.state === 'playing') pauseGame();
  else if (e.code === 'KeyP' && game.state === 'paused') resumeGame();
  if (e.code === 'KeyM' && game.state === 'playing') {
    const m = missions.current();
    hud.toast(m ? `${m.title}: ${m.text}` : 'All missions done.', 4);
  }
  if (e.code === 'KeyE' && game.state === 'playing') {
    if (game.inCar) game.exitCar();
    else {
      const car = game.nearestCarTo(player.pos.x, player.pos.z, 6);
      if (car) game.enterCar(car);
    }
  }
});
window.addEventListener('keyup', (e) => { game.keys[e.code] = false; });
canvas.addEventListener('click', () => {
  if (game.state === 'playing' && !game.pointerLocked) {
    canvas.requestPointerLock?.();
  }
  if (game.state === 'playing') game.mouseDown = true;
});
window.addEventListener('mouseup', () => { game.mouseDown = false; });
document.addEventListener('pointerlockchange', () => {
  game.pointerLocked = document.pointerLockElement === canvas;
});
document.addEventListener('mousemove', (e) => {
  if (!game.pointerLocked || game.state !== 'playing') return;
  game.camYaw -= e.movementX * 0.0028;
  game.camPitch = clamp(game.camPitch + e.movementY * 0.0022, -0.15, 1.1);
  player.camYaw = game.camYaw;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ----- Combat callbacks -----
function onShoot() {
  sound.shoot();
  // Hitscan: the nearest officer or pedestrian roughly in front of the player.
  const dir = new THREE.Vector3(Math.sin(player.camYaw), 0, Math.cos(player.camYaw));
  let best = null;
  let bestD = CONFIG.PISTOL_RANGE;
  const targets = [];
  for (const o of police.officers) targets.push({ pos: o.pos, kind: 'officer', ref: o });
  for (const p of pedestrians.list) targets.push({ pos: new THREE.Vector3(p.x, 0, p.z), kind: 'ped', ref: p });
  for (const t of targets) {
    const to = new THREE.Vector3(t.pos.x - player.pos.x, 0, t.pos.z - player.pos.z);
    const d = to.length();
    if (d < 1 || d > bestD) continue;
    to.normalize();
    if (to.dot(dir) > 0.86) { best = t; bestD = d; }
  }
  if (best) {
    if (best.kind === 'officer') {
      police.officers = police.officers.filter((o) => o !== best.ref);
      best.ref.dispose(scene);
      wanted.add(CONFIG.HEAT_PER_POLICE_HIT);
      hud.toast('Officer down — the heat just went up', 2.5);
    } else {
      pedestrians.list = pedestrians.list.filter((p) => p !== best.ref);
      best.ref.mesh.visible = false;
      pedestrians.scare(best.ref.x, best.ref.z, 18);
      wanted.add(CONFIG.HEAT_PER_PEDESTRIAN_HIT);
    }
  }
}

function onPunch() {
  sound.punch();
  for (const o of [...police.officers]) {
    if (Math.hypot(o.pos.x - player.pos.x, o.pos.z - player.pos.z) < CONFIG.PUNCH_RANGE) {
      police.officers = police.officers.filter((x) => x !== o);
      o.dispose(scene);
      wanted.add(CONFIG.HEAT_PER_POLICE_HIT);
      hud.toast('You dropped an officer', 2);
      return;
    }
  }
  for (const p of [...pedestrians.list]) {
    if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < CONFIG.PUNCH_RANGE) {
      pedestrians.scare(p.x, p.z, 18);
      wanted.add(CONFIG.HEAT_PER_PEDESTRIAN_HIT);
      hud.toast('That was uncalled for — the heat is up', 2);
      return;
    }
  }
}

// ----- Save / load -----
function saveGame() {
  try {
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify({
      cash: game.cash,
      missionIndex: missions.index,
      missionsDone: missions.done,
      x: player.pos.x, z: player.pos.z,
      health: player.health,
    }));
  } catch { /* storage unavailable; the game still runs */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(CONFIG.SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ----- Flow -----
const menus = bindMenus({
  onPlay: () => { sound.init(); sound.click(); startGame(false); },
  onContinue: () => { sound.init(); sound.click(); startGame(true); },
  onResume: () => { sound.click(); resumeGame(); },
  onRestart: () => { sound.click(); startGame(true); },
  onRetry: () => { sound.click(); startGame(false); },
});

function startGame(fromSave) {
  const save = fromSave ? loadSave() : null;
  menus.hideStart();
  menus.hideOver();
  menus.hidePause();
  hud.show();
  game.state = 'playing';
  player.health = CONFIG.PLAYER_HEALTH;
  player.ammo = CONFIG.PISTOL_AMMO;
  wanted.clear();
  police.clear();
  missions.start();
  game.cash = 0;
  if (save) {
    game.cash = save.cash || 0;
    missions.index = Math.min(save.missionIndex || 0, 5);
    missions.done = save.missionsDone || 0;
    player.place(save.x ?? world.places.pier.x, save.z ?? world.places.pier.z, 0);
    player.health = save.health ?? CONFIG.PLAYER_HEALTH;
  } else {
    player.place(world.places.pier.x, world.places.pier.z - 4, Math.PI);
  }
  game.camYaw = player.heading;
  player.camYaw = game.camYaw;
  game.inCar = false;
  game.playerCar = null;
  game.carStolen = false;
  const m = missions.current();
  if (m) hud.toast(`${m.title} — ${m.text}`, 5);
  saveGame();
}

function pauseGame() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  menus.showPause(`Cash $${game.cash.toLocaleString('en-US')} · Missions ${missions.done}/6`);
  document.exitPointerLock?.();
}

function resumeGame() {
  if (game.state !== 'paused') return;
  game.state = 'playing';
  menus.hidePause();
}

function bustPlayer(reason) {
  if (game.state !== 'playing') return;
  game.state = 'over';
  document.exitPointerLock?.();
  menus.showOver(reason);
  saveGame();
}

// ----- The frame loop -----
const clock = new THREE.Clock();
let firstFrame = true;
let framesRendered = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  // Screenshot mode: the scene is staged and frozen; just render it.
  if (game.state === 'playing' && !game.shotMode) {
    const k = game.keys;
    const input = {
      f: !!k['KeyW'] || !!k['ArrowUp'],
      b: !!k['KeyS'] || !!k['ArrowDown'],
      l: !!k['KeyA'] || !!k['ArrowLeft'],
      r: !!k['KeyD'] || !!k['ArrowRight'],
      run: !!k['ShiftLeft'] || !!k['ShiftRight'],
      jump: !!k['Space'],
      punch: !!k['KeyF'],
      shoot: game.mouseDown,
    };
    // Quiet = no crime this frame; heat decays after a few quiet seconds.
    const crime = game.carStolen && game.inCar ? false : false;
    game.quietTimer += dt;
    wanted.update(dt, game.quietTimer > 4);
    if (wanted.stars > 0) game.wasWanted = true;

    if (game.inCar && game.playerCar) {
      game.playerCar.drive(dt, input, world);
      // Hitting a pedestrian while driving: a crime, and they scatter.
      for (const p of [...pedestrians.list]) {
        if (Math.hypot(p.x - game.playerCar.pos.x, p.z - game.playerCar.pos.z) < 2.2) {
          pedestrians.list = pedestrians.list.filter((x) => x !== p);
          p.mesh.visible = false;
          pedestrians.scare(p.x, p.z, 20);
          wanted.add(CONFIG.HEAT_PER_PEDESTRIAN_HIT);
          game.quietTimer = 0;
          sound.crash();
        }
      }
      // Ramming a police car: a crime too.
      for (const c of police.cars) {
        if (Math.hypot(c.pos.x - game.playerCar.pos.x, c.pos.z - game.playerCar.pos.z) < 4.5 && Math.abs(game.playerCar.speed) > 8) {
          wanted.add(CONFIG.HEAT_PER_POLICE_HIT);
          game.quietTimer = 0;
        }
      }
      followCam.updateDriving(game.playerCar.pos, game.playerCar.heading, game.playerCar.speed);
      sound.update(dt, game.playerCar.speed, wanted.stars);
    } else {
      player.update(dt, input, world, onShoot, onPunch);
      player.camYaw = game.camYaw;
      followCam.update(player.headPos(), game.camYaw, game.camPitch);
      sound.update(dt, player.moving ? (input.run ? 10 : 6) : 0, wanted.stars);
    }

    // Mission progress.
    const pos = game.inCar && game.playerCar ? game.playerCar.pos : player.pos;
    const ev = missions.update(dt, {
      playerPos: pos, places: world.places,
      inCar: game.inCar, carStolen: game.carStolen,
      wantedStars: wanted.stars, wasWanted: game.wasWanted,
    });
    if (ev) {
      if (ev.type === 'complete') {
        game.cash += ev.reward;
        game.wasWanted = false;
        sound.mission();
        hud.toast(`Mission complete: ${ev.title} — +$${ev.reward}`, 4);
        if (missions.finished) {
          hud.toast('All missions done — Solara is yours. King of the city.', 6);
        }
        saveGame();
      } else if (ev.type === 'failed') {
        sound.click();
        hud.toast('Mission failed — try it again (M for the briefing)', 4);
        missions.retry();
      } else if (ev.type === 'collected') {
        sound.pickup();
        hud.toast(`Drop collected — ${ev.left} to go`, 3);
      }
    }

    // Police.
    police.update(dt, wanted.stars, pos, !game.inCar, (dmg) => {
      if (dmg > 0) {
        game.quietTimer = 0;
        if (player.damage(dmg)) bustPlayer('The Solara Police beat you down. Busted.');
      }
    }, () => bustPlayer('The Solara Police cornered you. Busted.'));
    if (player.health <= 0) bustPlayer('You were taken down. Busted.');

    // Traffic and pedestrians keep the city alive.
    traffic.update(dt);
    pedestrians.update(dt);
    // Clouds drift.
    for (const c of world.clouds) {
      c.position.x += dt * 1.2;
      if (c.position.x > 380) c.position.x = -380;
    }
    // Autosave every 20 seconds.
    game.saveTimer += dt;
    if (game.saveTimer > 20) { game.saveTimer = 0; saveGame(); }
    game.refreshHud();
    hud.tick(dt);
  }
  renderer.render(scene, camera);
  framesRendered += 1;
  // Screenshot mode: tell the capture script the staged scene is ready.
  if (shot && framesRendered > 3) window.__shotReady = true;
  if (firstFrame) {
    firstFrame = false;
    menus.hideLoading();
  }
}

// ----- Boot -----
const shot = shotFromUrl();
if (shot) {
  // Screenshot mode: no start screen, stage the shot and render it frozen.
  game.shotMode = true;
  menus.hideStart();
  menus.hideLoading();
  hud.show();
  sound.init = () => {};
  player.place(world.places.pier.x, world.places.pier.z - 4, Math.PI);
  missions.start();
  applyShot(game, shot);
  // Keep the world alive for the shot (traffic, pedestrians, clouds).
  traffic.update(0.5);
  pedestrians.update(0.5);
  game.refreshHud();
} else {
  const save = loadSave();
  menus.showStart(!!save);
}
frame();
