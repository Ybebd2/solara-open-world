// SOLARA v3 — the entry point and the game loop. This file wires the city,
// the player, the cars, the traffic, the police, the missions, the HUD and
// the sound together, and runs the frame loop. It also owns the save (cash,
// the mission chain, respect, unlocked weapons, collectibles, the player's
// spot) in localStorage, and the screenshot mode (?shot=) that stages the
// dossier's images.
//
// v3: a golden-hour clock that drives the sky into dusk; respect that grows
// on escapes and missions, with an escape reward ($ + respect) when the
// wanted level clears; Sully's Garage (E in a car by the garage) with three
// upgrades; five weapon slots (Q cycles, 1-5 select, 3-5 cost cash to
// unlock); a radio (R switches stations); a police helicopter at 3+ stars;
// a full map (M) with districts, a route line, the mission list and stats;
// a pre-start intro — an attract-mode camera sweeping over the sunset city
// behind the title screen, with NEW GAME and CONTROLS; mission dialogue from
// Lupe, Sully, Marco, Brandt and Aurora; ten Sunset Shard collectibles; and
// a "Press F — Carjack <car>" prompt at the driver's door.

import * as THREE from 'three';
import { CONFIG, GARAGE_UPGRADES, makeRandom, pick, clamp } from './config.js';
import { buildWorld } from './world.js';
import { Car, Traffic, Pedestrians } from './vehicles.js';
import { Player, FollowCamera } from './player.js';
import { Wanted, Police } from './police.js';
import { MissionManager, MISSIONS } from './missions.js';
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
const traffic = new Traffic(scene, world, CONFIG.TRAFFIC_COUNT);
const pedestrians = new Pedestrians(scene, world, CONFIG.PED_COUNT);
const police = new Police(scene, world);
const wanted = new Wanted();
const missions = new MissionManager();
const sound = new Sound();
const hud = new HUD();

// Parked cars the player can steal, lined up along the roads. A mix of
// sedans, sports cars, pickups and vans, in bright colours.
const parkedCars = [];
{
  const rand = makeRandom(555);
  const roads = world.roads.horizontal.concat(world.roads.vertical);
  const types = ['sedan', 'sports', 'pickup', 'van'];
  for (let i = 0; i < CONFIG.PARKED_COUNT; i++) {
    const road = pick(rand, roads);
    const along = -world.half + rand() * world.half * 2;
    const x = road.z !== undefined ? along : road.x + (rand() < 0.5 ? 4.5 : -4.5);
    const z = road.z !== undefined ? road.z + (rand() < 0.5 ? 4.5 : -4.5) : along;
    const heading = road.z !== undefined ? (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rand() < 0.5 ? 0 : Math.PI);
    parkedCars.push(new Car(scene, x, z, heading, pick(rand, [0xc0392b, 0x2e6db4, 0xe8e8e8, 0xf5c542, 0x7a4a9e, 0x2e8b57, 0xf27ea9, 0xff7a1a]), false, pick(rand, types)));
  }
}

// The game object the screenshot stager and the loop share.
const game = {
  state: 'menu',
  scene, camera, world, player, traffic, pedestrians, police, wanted, missions, hud, sound,
  parkedCars,
  cash: 0,
  respect: 0,
  collectiblesFound: 0,
  escapes: 0,
  takedowns: 0,
  inCar: false,
  playerCar: null,
  carStolen: false,
  wasWanted: false,
  escapePaid: false,
  quietTimer: 0,
  ramCooldown: 0,
  keys: {},
  mouseDown: false,
  aiming: false,
  // A click queues one shot the next frame consumes, so a quick press is
  // never lost between frames (important when the frame rate is low).
  shootQueued: false,
  // An F press queues one punch the same way (F also carjacks near a car).
  punchQueued: false,
  camYaw: 0,
  camPitch: 0.32,
  pointerLocked: false,
  saveTimer: 0,
  isDusk: false,
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
  // Put the player into a car (used by the E/F keys and by the shot stager).
  enterCar(car, silent = false) {
    if (!car) return null;
    this.playerCar = car;
    this.inCar = true;
    this.carStolen = true;
    player.group.visible = false;
    if (!silent) {
      wanted.add(CONFIG.HEAT_PER_CAR_STEAL);
      pedestrians.scare(car.pos.x, car.pos.z, 20);
      pedestrians.spawnFleeingOwner(car.pos.x, car.pos.z);
      sound.sirenBlip();
      hud.toast(`Stole a ${car.name} — the owner ran off, the police are coming`, 3);
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
  // The HUD state, built fresh each frame from the live game.
  buildHudState() {
    const m = missions.current();
    const next = missions.next();
    const pos = this.inCar && this.playerCar ? this.playerCar.pos : player.pos;
    const heading = this.inCar && this.playerCar ? this.playerCar.heading : player.camYaw;
    const st = sound.station();
    const song = sound.song();
    const speed = this.playerCar ? this.playerCar.speed : 0;
    const gear = !this.inCar ? '' : speed > 0.5 ? 'D' : speed < -0.5 ? 'R' : 'N';
    return {
      stars: wanted.stars,
      evading: wanted.evading,
      cash: this.cash,
      clock: formatClock(world.clockHours),
      missionTitle: m ? `JOB ${missions.index + 1}/8 — ${m.title}` : 'ALL JOBS DONE',
      missionNext: next ? next.title : null,
      objective: m ? m.text : 'All missions done — Solara is yours.',
      health: player.health,
      ammo: player.ammo,
      ammoMax: player.ammoMax,
      ammoBySlot: player.ammoBySlot,
      speed, gear,
      inCar: this.inCar,
      carName: this.playerCar ? this.playerCar.name : '',
      carCondition: this.playerCar ? this.playerCar.condition : 100,
      timeLeft: missions.timeLeft(),
      district: world.districtAt(pos.x, pos.z),
      respect: this.respect,
      weapons: player.weapons,
      weaponIndex: player.weaponIndex,
      radioStation: `${st.name} ${st.freq} — ${st.tag}`,
      radioSong: `${song.artist} — ${song.title}`,
      pcpdUnits: police.units(pos),
      playerPos: pos,
      playerHeading: heading,
      world, traffic: traffic.cars, policeCars: police.cars, heli: police.heli,
      missionTarget: missions.targetPos(world.places),
      places: world.places,
    };
  },
  refreshHud() {
    hud.update(this.buildHudState());
  },
};

function formatClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// A handle for live inspection (automated playtests read the game state).
window.__solara = game;

// ----- Input -----
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  game.keys[e.code] = true;
  if (e.code === 'KeyP') {
    if (game.state === 'playing') pauseGame();
    else if (game.state === 'paused') resumeGame();
    else if (game.state === 'map') closeMap();
    else if (game.state === 'garage') closeGarage();
  } else if (e.code === 'Escape') {
    if (game.state === 'map') closeMap();
    else if (game.state === 'garage') closeGarage();
    else if (game.state === 'paused') resumeGame();
  } else if (e.code === 'KeyM') {
    if (game.state === 'playing') openMap();
    else if (game.state === 'map') closeMap();
  } else if (e.code === 'KeyR' && game.state === 'playing') {
    const st = sound.nextStation();
    const song = sound.song();
    hud.toast(`${st.name} ${st.freq} — ${song.artist} — ${song.title}`, 3);
  } else if (e.code === 'KeyH' && game.state === 'playing') {
    sound.horn();
  } else if (e.code === 'KeyQ' && game.state === 'playing' && !game.inCar) {
    const name = player.cycleWeapon();
    if (name) hud.toast(`Weapon: ${name}`, 2);
  } else if (e.code.startsWith('Digit') && game.state === 'playing' && !game.inCar) {
    const i = parseInt(e.code.slice(5), 10) - 1;
    if (i >= 0 && i < player.weapons.length) {
      const w = player.weapons[i];
      if (w.locked) {
        // Buy the locked weapon with cash, then select it.
        if (game.cash >= w.price) {
          game.cash -= w.price;
          player.unlockWeapon(i);
          player.selectWeapon(i);
          sound.pickup();
          hud.toast(`Unlocked the ${w.name} — $${w.price}`, 3);
        } else {
          hud.toast(`The ${w.name} costs $${w.price} — you have $${game.cash}`, 3);
        }
      } else if (player.selectWeapon(i)) {
        hud.toast(`Weapon: ${w.name}`, 2);
      }
    }
  } else if (e.code === 'KeyF' && game.state === 'playing' && !game.inCar) {
    // F carjacks a nearby car; away from a car it punches.
    const car = game.nearestCarTo(player.pos.x, player.pos.z, 6);
    if (car) game.enterCar(car);
    else game.punchQueued = true;
  } else if (e.code === 'KeyE' && game.state === 'playing') {
    if (game.inCar) {
      // In a car by the garage, E opens Sully's Garage; otherwise it exits.
      const g = world.places.garage;
      if (Math.hypot(game.playerCar.pos.x - g.x, game.playerCar.pos.z - g.z) < 14) openGarage();
      else game.exitCar();
    } else {
      const car = game.nearestCarTo(player.pos.x, player.pos.z, 6);
      if (car) game.enterCar(car);
      else {
        // E by the arms shop explains how to buy weapons.
        const a = world.places.armsShop;
        if (Math.hypot(player.pos.x - a.x, player.pos.z - a.z) < 12) {
          hud.toast('Arms Shop — press 3, 4 or 5 to buy a weapon', 4);
        }
      }
    }
  }
});
window.addEventListener('keyup', (e) => { game.keys[e.code] = false; });
canvas.addEventListener('mousedown', (e) => {
  if (game.state === 'playing' && !game.pointerLocked) {
    canvas.requestPointerLock?.();
  }
  if (game.state === 'playing') {
    if (e.button === 0) {
      game.mouseDown = true;
      game.shootQueued = true;
    } else if (e.button === 2) {
      game.aiming = true;
    }
  }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) game.mouseDown = false;
  if (e.button === 2) game.aiming = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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
  const w = player.currentWeapon();
  let best = null;
  let bestD = w.range;
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
      game.takedowns += 1;
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
      game.takedowns += 1;
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
    // version stamps the save format, so a later version can migrate or
    // ignore an older save instead of misreading it.
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify({
      version: 3,
      cash: game.cash,
      missionIndex: missions.index,
      missionsDone: missions.done,
      respect: game.respect,
      unlockedWeapons: player.weapons.map((w, i) => (w.unlocked ? i : -1)).filter((i) => i >= 0),
      collectibles: game.collectiblesFound,
      escapes: game.escapes,
      takedowns: game.takedowns,
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
  onControls: () => { sound.click(); menus.showControls(); },
  onControlsClose: () => { sound.click(); menus.hideControls(); },
  onResume: () => { sound.click(); resumeGame(); },
  onRestart: () => { sound.click(); startGame(true); },
  onRetry: () => { sound.click(); startGame(false); },
  onMapResume: () => { sound.click(); closeMap(); },
  onMapSave: () => { saveGame(); sound.click(); hud.toast('Game saved', 2); },
  onMapLoad: () => { sound.click(); closeMap(); startGame(true); hud.toast('Save loaded', 2); },
  onMapQuit: () => { sound.click(); quitToTitle(); },
  onGarageLeave: () => { sound.click(); closeGarage(); },
});

function showMissionDialogue() {
  const m = missions.current();
  if (m) hud.dialogue(m.speaker, m.dialogue, 7);
}

function startGame(fromSave) {
  const save = fromSave ? loadSave() : null;
  menus.hideStart();
  menus.hideOver();
  menus.hidePause();
  menus.hideMap();
  menus.hideGarage();
  hud.show();
  game.state = 'playing';
  player.health = CONFIG.PLAYER_HEALTH;
  player.ammo = CONFIG.PISTOL_AMMO;
  wanted.clear();
  police.clear();
  missions.start();
  game.cash = 0;
  game.respect = 0;
  game.collectiblesFound = 0;
  game.escapes = 0;
  game.takedowns = 0;
  if (save) {
    game.cash = save.cash || 0;
    missions.index = Math.min(save.missionIndex || 0, MISSIONS.length - 1);
    missions.done = save.missionsDone || 0;
    game.respect = save.respect || 0;
    game.collectiblesFound = save.collectibles || 0;
    game.escapes = save.escapes || 0;
    game.takedowns = save.takedowns || 0;
    for (const i of save.unlockedWeapons || []) {
      if (player.weapons[i]) player.weapons[i].unlocked = true;
    }
    // Re-take the first N shards so a loaded save keeps its count.
    world.collectibles.forEach((c, i) => {
      if (i < game.collectiblesFound) {
        c.taken = true;
        c.mesh.visible = false;
      } else {
        c.taken = false;
        c.mesh.visible = true;
      }
    });
    player.place(save.x ?? world.places.pier.x, save.z ?? world.places.pier.z, 0);
    player.health = save.health ?? CONFIG.PLAYER_HEALTH;
  } else {
    player.place(world.places.pier.x, world.places.pier.z - 4, Math.PI);
    world.collectibles.forEach((c) => { c.taken = false; c.mesh.visible = true; });
  }
  game.camYaw = player.heading;
  player.camYaw = game.camYaw;
  game.inCar = false;
  game.playerCar = null;
  game.carStolen = false;
  game.wasWanted = false;
  game.escapePaid = false;
  const m = missions.current();
  if (m) hud.toast(`${m.title} — ${m.text}`, 5);
  showMissionDialogue();
  saveGame();
}

function pauseGame() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  menus.showPause(`Cash $${game.cash.toLocaleString('en-US')} · Missions ${missions.done}/8 · Respect ${Math.round(game.respect)}`);
  document.exitPointerLock?.();
}

function resumeGame() {
  if (game.state !== 'paused') return;
  game.state = 'playing';
  menus.hidePause();
}

function openMap() {
  if (game.state !== 'playing') return;
  game.state = 'map';
  document.exitPointerLock?.();
  const list = MISSIONS.map((m, i) => ({
    num: i + 1,
    title: m.title,
    reward: `$${m.reward}`,
    state: i < missions.index ? 'done' : i === missions.index ? 'current' : '',
  }));
  const stats = [
    ['Cash', `$${game.cash.toLocaleString('en-US')}`],
    ['Story', `${missions.done}/8`],
    ['Sunset Shards', `${game.collectiblesFound}/10`],
    ['Respect', Math.round(game.respect)],
    ['Escapes', game.escapes],
    ['Takedowns', game.takedowns],
    ['Races won', 0],
  ];
  hud.fillMapPanel(list, stats);
  hud.drawFullMap(game.buildHudState());
  menus.showMap();
}

function closeMap() {
  if (game.state !== 'map') return;
  game.state = 'playing';
  menus.hideMap();
}

// Sully's Garage: buy upgrades for the car the player is driving.
function openGarage() {
  if (!game.playerCar || game.state !== 'playing') return;
  game.state = 'garage';
  document.exitPointerLock?.();
  renderGarage();
  menus.showGarage();
}

function renderGarage() {
  const car = game.playerCar;
  document.getElementById('garageCar').textContent = car
    ? `${car.name} — Condition ${Math.round(car.condition)}% · Cash $${game.cash.toLocaleString('en-US')}`
    : 'No car.';
  const box = document.getElementById('garageUpgrades');
  box.innerHTML = GARAGE_UPGRADES.map((u) => {
    const owned = car && car.upgrades[u.id];
    const afford = game.cash >= u.price;
    return `<div class="upgrade"><div><b>${u.name}</b> — ${u.desc}</div><span>${owned ? 'OWNED' : '$' + u.price}</span><button data-upgrade="${u.id}" ${owned || !afford ? 'disabled' : ''}>${owned ? 'OWNED' : 'BUY'}</button></div>`;
  }).join('');
  box.querySelectorAll('button[data-upgrade]').forEach((btn) => {
    btn.addEventListener('click', () => buyUpgrade(btn.getAttribute('data-upgrade')));
  });
}

function buyUpgrade(id) {
  const car = game.playerCar;
  const u = GARAGE_UPGRADES.find((x) => x.id === id);
  if (!car || !u || car.upgrades[id] || game.cash < u.price) return;
  game.cash -= u.price;
  car.upgrades[id] = true;
  if (id === 'armor') car.repair();
  if (id === 'paint') {
    // A fresh golden paint job: recolour the body.
    car.mesh.children[0].material = car.mesh.children[0].material.clone();
    car.mesh.children[0].material.color.setHex(0xffd23f);
  }
  sound.pickup();
  hud.toast(`${u.name} installed on your ${car.name}`, 3);
  renderGarage();
  saveGame();
}

function closeGarage() {
  if (game.state !== 'garage') return;
  game.state = 'playing';
  menus.hideGarage();
}

function quitToTitle() {
  game.state = 'menu';
  hud.hide();
  hud.clearDialogue();
  menus.hideMap();
  menus.hideGarage();
  menus.hidePause();
  menus.hideOver();
  document.exitPointerLock?.();
  menus.showStart(!!loadSave());
}

function bustPlayer(reason) {
  if (game.state !== 'playing') return;
  game.state = 'over';
  document.exitPointerLock?.();
  sound.busted();
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
  if (game.state === 'menu') {
    // Attract mode: the camera sweeps over the sunset city behind the title
    // screen while traffic and pedestrians keep the city alive.
    const t = performance.now() * 0.00004;
    camera.position.set(Math.sin(t) * 230, 75 + Math.sin(t * 0.7) * 18, Math.cos(t) * 230);
    camera.lookAt(0, 28, 0);
    traffic.update(dt);
    pedestrians.update(dt);
    for (const c of world.clouds) {
      c.position.x += dt * 1.2;
      if (c.position.x > 380) c.position.x = -380;
    }
    // The golden-hour clock drifts slowly even on the title screen.
    game.isDusk = world.setClock(world.clockHours + CONFIG.CLOCK_SPEED * dt * 0.3);
    for (const m of world.streetlights) m.color.setHex(game.isDusk ? 0xffe9a8 : 0x8a7a5a);
  }
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
      punch: game.punchQueued,
      shoot: game.mouseDown || game.shootQueued,
    };
    // A queued shot is consumed only when a shot actually fires (the
    // cooldown being reset proves it); if the cooldown is not ready yet, the
    // queue persists and the shot fires when it is. Shooting does not apply
    // while driving, so a queue left over from a click in a car is dropped.
    if (game.inCar) game.shootQueued = false;
    // Heat decays after a few quiet seconds with no crime.
    game.quietTimer += dt;
    game.ramCooldown = Math.max(0, game.ramCooldown - dt);
    const pos0 = game.inCar && game.playerCar ? game.playerCar.pos : player.pos;
    wanted.update(dt, game.quietTimer > 4, police.anyUnitNear(pos0));
    if (wanted.stars > 0) {
      game.wasWanted = true;
      game.escapePaid = false;
    }
    // Evading to 100% clears the wanted level — the player has escaped.
    if (wanted.stars > 0 && wanted.evading >= 100) wanted.clear();
    // The escape reward: wanted cleared after a chase pays cash + respect.
    if (wanted.stars === 0 && game.wasWanted && !game.escapePaid) {
      game.escapePaid = true;
      game.wasWanted = false;
      game.escapes += 1;
      game.cash += CONFIG.ESCAPE_REWARD_CASH;
      game.respect = Math.min(100, game.respect + CONFIG.RESPECT_PER_ESCAPE);
      sound.pickup();
      hud.toast(`Escaped the PCPD — +$${CONFIG.ESCAPE_REWARD_CASH}, +${CONFIG.RESPECT_PER_ESCAPE} respect`, 4);
    }
    // The golden-hour clock: the sky, sun and fog follow it into dusk.
    game.isDusk = world.setClock(world.clockHours + CONFIG.CLOCK_SPEED * dt);
    for (const m of world.streetlights) m.color.setHex(game.isDusk ? 0xffe9a8 : 0x8a7a5a);

    if (game.inCar && game.playerCar) {
      // Space is the handbrake while driving.
      const driveInput = { ...input, b: input.b || !!k['Space'] };
      game.playerCar.drive(dt, driveInput, world);
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
      // A police car ramming the player's car: a jolt, a crash sound, the
      // player loses speed and the car takes damage — and a collision with a
      // police car is a crime, so the heat goes up. Throttled to one ram a second.
      for (const c of police.cars) {
        const d = Math.hypot(c.pos.x - game.playerCar.pos.x, c.pos.z - game.playerCar.pos.z);
        if (d < CONFIG.POLICE_RAM_DIST && game.ramCooldown <= 0) {
          game.playerCar.speed *= 0.55;
          game.playerCar.damage(6);
          game.ramCooldown = 1.0;
          sound.crash();
          wanted.add(CONFIG.HEAT_PER_POLICE_HIT);
          game.quietTimer = 0;
        }
      }
      followCam.updateDriving(game.playerCar.pos, game.playerCar.heading, game.playerCar.speed);
      sound.update(dt, game.playerCar.speed, wanted.stars);
    } else {
      const cdBefore = player.cooldown;
      const pcBefore = player.punchCooldown;
      player.update(dt, input, world, onShoot, onPunch);
      // A shot fired this frame if the cooldown was reset (it jumps back to
      // 0.28); only then is the queued shot consumed.
      if (player.cooldown > cdBefore) game.shootQueued = false;
      // A punch fired this frame if the punch cooldown was reset; only then
      // is the queued punch consumed.
      if (player.punchCooldown > pcBefore) game.punchQueued = false;
      player.camYaw = game.camYaw;
      followCam.update(player.headPos(), game.camYaw, game.camPitch, game.aiming);
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
        game.respect = Math.min(100, game.respect + CONFIG.RESPECT_PER_MISSION);
        game.wasWanted = false;
        sound.mission();
        hud.toast(`Mission complete: ${ev.title} — +$${ev.reward}, +${CONFIG.RESPECT_PER_MISSION} respect`, 4);
        if (missions.finished) {
          hud.toast('All missions done — Solara is yours. King of the city.', 6);
        } else {
          showMissionDialogue();
        }
        saveGame();
      } else if (ev.type === 'failed') {
        sound.click();
        hud.toast('Mission failed — try it again (M for the map)', 4);
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

    // Sunset Shards: walk or drive over one to collect it.
    for (const c of world.collectibles) {
      if (c.taken) continue;
      if (Math.hypot(c.x - pos.x, c.z - pos.z) < 3) {
        c.taken = true;
        c.mesh.visible = false;
        game.collectiblesFound += 1;
        game.cash += CONFIG.COLLECTIBLE_REWARD;
        sound.pickup();
        hud.toast(`Sunset Shard ${game.collectiblesFound}/10 — +$${CONFIG.COLLECTIBLE_REWARD}`, 3);
      }
    }
    // Shards spin.
    for (const c of world.collectibles) {
      if (!c.taken) {
        c.spin += dt * 2;
        c.mesh.rotation.y = c.spin;
        c.mesh.position.y = 1.4 + Math.sin(performance.now() * 0.003 + c.spin) * 0.25;
      }
    }

    // The carjack prompt: on foot near a car, or in a car by the garage.
    if (!game.inCar) {
      const car = game.nearestCarTo(player.pos.x, player.pos.z, 6);
      if (car) hud.setPrompt(`Press F — Carjack ${car.name}`);
      else {
        const a = world.places.armsShop;
        if (Math.hypot(player.pos.x - a.x, player.pos.z - a.z) < 12) hud.setPrompt('Press E — Arms Shop');
        else hud.setPrompt(null);
      }
    } else {
      const g = world.places.garage;
      if (Math.hypot(game.playerCar.pos.x - g.x, game.playerCar.pos.z - g.z) < 14) hud.setPrompt("Press E — Sully's Garage");
      else hud.setPrompt(null);
    }

    // Traffic and pedestrians keep the city alive. The traffic AI is handed
    // the player's car so it never fights the player's steering.
    traffic.update(dt, game.playerCar);
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
