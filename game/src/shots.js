// Shots — frozen renders of the live game for the dossier (?shot=<name>).
// stageShot(game, name) sets the exact state from shots.json (mission,
// clock, wanted, PCPD units, dialogue, toast) and frames the camera,
// then the caller sets window.__solaraShotReady. Shot mode freezes the
// simulation, so the staged state never drifts before the screenshot.
import * as THREE from '../vendor/three.module.min.js';
import { makeCar } from './vehicles.js';

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}
function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

// A simple civilian ped. opts: shirt, pants, armsOut (fleeing), jog (runner).
export function makePed(scene, x, z, opts = {}) {
  const g = new THREE.Group();
  const shirt = lam(opts.shirt || 0xd98880);
  const pants = lam(opts.pants || 0x2e3440);
  const skin = lam(0xc68e5e);
  const torso = box(0.55, 0.7, 0.32, shirt);
  torso.position.y = 1.1;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.66;
  g.add(head);
  const legL = box(0.2, 0.7, 0.22, pants);
  legL.position.set(-0.14, 0.35, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legR);
  const armL = box(0.16, 0.6, 0.18, shirt);
  const armR = armL.clone();
  if (opts.armsOut) {
    // Fleeing: arms thrown out to the sides.
    armL.position.set(-0.55, 1.35, 0);
    armL.rotation.z = 1.2;
    armR.position.set(0.55, 1.35, 0);
    armR.rotation.z = -1.2;
  } else if (opts.jog) {
    armL.position.set(-0.32, 1.25, 0.15);
    armL.rotation.x = -0.9;
    armR.position.set(0.32, 1.25, -0.15);
    armR.rotation.x = 0.9;
    legL.rotation.x = 0.5;
    legR.rotation.x = -0.5;
  } else {
    armL.position.set(-0.36, 1.2, 0);
    armR.position.set(0.36, 1.2, 0);
  }
  g.add(armL);
  g.add(armR);
  g.position.set(x, 0, z);
  g.rotation.y = opts.yaw || 0;
  scene.add(g);
  return g;
}

export function makeDog(scene, x, z, yaw = 0) {
  const g = new THREE.Group();
  const fur = lam(0x8b5a2b);
  const body = box(0.9, 0.45, 0.4, fur);
  body.position.y = 0.45;
  g.add(body);
  const head = box(0.35, 0.35, 0.35, fur);
  head.position.set(0.55, 0.65, 0);
  g.add(head);
  const ear = box(0.12, 0.25, 0.12, lam(0x5a3a1a));
  ear.position.set(0.5, 0.9, 0.12);
  g.add(ear);
  for (const [dx, dz] of [[0.35, 0.14], [0.35, -0.14], [-0.35, 0.14], [-0.35, -0.14]]) {
    const leg = box(0.12, 0.4, 0.12, fur);
    leg.position.set(dx, 0.2, dz);
    g.add(leg);
  }
  const tail = box(0.35, 0.1, 0.1, fur);
  tail.position.set(-0.6, 0.6, 0);
  tail.rotation.z = 0.5;
  g.add(tail);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  scene.add(g);
  return g;
}

// Place a cruiser at an exact spot with an exact name/status (shot 2).
// dir is the VISUAL facing: rotation.y = atan2(-dz, dx) for a forward
// direction (dx, dz). The car does not move in shot mode, so the
// police-update movement quirk never applies.
function placeCruiser(game, name, x, z, faceX, faceZ, status) {
  const dx = faceX - x, dz = faceZ - z;
  const dir = Math.atan2(-dz, dx);
  const car = makeCar('cruiser', { name, x, z, dir });
  car.name = name;
  car.status = status;
  car.speed = 0;
  car.topSpeed = 13;
  car.accel = 10;
  if (status === 'WRECKED') {
    car.mesh.rotation.z = 0.12; // listing, wrecked
    car.mesh.position.y = -0.15;
  }
  game.scene.add(car.mesh);
  game.police.cruisers.push(car);
  return car;
}

function setPlaying(game) {
  game.state = 'playing';
  game.hud.showOverlay(null);
}

function frameCamera(game, px, py, pz, lx, ly, lz) {
  game.camera.position.set(px, py, pz);
  game.camera.lookAt(lx, ly, lz);
  game.camera.updateProjectionMatrix();
}

// --- Shot 1: Kai on foot on Beach Road, pistol raised, Lupe on the radio.
// Camera: side profile from the south, Kai lower-third, ~33% screen height
// (camera ~6 m south), target ped 15 m west, pistol level + bright silver.
function shot1(game) {
  setPlaying(game);
  game.hours = 17 + 53 / 60 + 0.001;
  game.missions.index = 1; // BORROWED WHEELS
  game.missions.stage = 2;
  game.missions.moveBeacon();
  game.money = 400;
  game.respect = 0;

  // Kai on Beach Road near the coupe, facing west at the target ped.
  game.player.group.position.set(-70, 0, 8);
  game.player.group.rotation.y = -Math.PI / 2;
  game.player.yaw = -Math.PI / 2;
  game.player.onFoot = true;
  game.player.car = null;
  game.player.group.visible = true;
  game.player.setWeapon(2); // VESPER 9, ammo 12, reserve 71
  game.player.weaponAmmo = 12;

  // Target ped 15 m west of Kai.
  makePed(game.scene, -85, 8, { shirt: 0x7fb3d5, pants: 0x2e3440, yaw: Math.PI / 2 });
  // Jogger + dog on the beach side (top-3 detail).
  makePed(game.scene, -96, 30, { shirt: 0xf2c14e, pants: 0x222831, jog: true, yaw: -Math.PI / 2 });
  makeDog(game.scene, -94, 32, -Math.PI / 2);

  game.hud.setDialogue('Lupe', 'FIXER · PIER SHACK',
    'Borrowed wheels, Kai. The coupe sits on Beach Road — bring it back clean.',
    'On it. Nobody even sees me coming.');
  game.hud.toast('+$1,200 · +12 RESPECT');

  // Camera ~6 m south of Kai, slightly above chest height, looking at his
  // chest so he sits lower-third at ~33% of the frame height.
  frameCamera(game, -70, 1.7, 14.5, -70, 1.15, 8);
}

// --- Shot 2: three stars, four PCPD units, hero cruiser three-quarter.
// Camera: hero cruiser (PELICAN-11) in the foreground, Kai near a car,
// zebra crossing in frame. Wanted 3 stars, IN SIGHT, evading 15%.
function shot2(game) {
  setPlaying(game);
  game.hours = 18 + 23 / 60 + 0.001;
  game.missions.index = 1; // BORROWED WHEELS
  game.missions.stage = 2;
  game.missions.moveBeacon();
  game.money = 400;

  // Kai on foot downtown, near the zebra crossing at x=40.
  game.player.group.position.set(40, 0, -8);
  game.player.group.rotation.y = Math.PI;
  game.player.yaw = Math.PI;
  game.player.onFoot = true;
  game.player.car = null;
  game.player.group.visible = true;
  game.player.setWeapon(2);
  game.player.weaponAmmo = 12;

  // Wanted: 3 stars, IN SIGHT, evading 15%.
  game.wanted.stars = 3;
  game.wanted.evading = 15;
  game.wanted.inSight = true;

  // Four PCPD units at the exact distances the panel shows.
  // Hero cruiser PELICAN-11, 39 m, PURSUIT, three-quarter toward camera
  // (faced east-north so its front + red light bar read from the south).
  placeCruiser(game, 'PELICAN-11', 63, 24, 72, 20, 'PURSUIT');
  // Second cruiser far behind.
  placeCruiser(game, 'MANTA-32', -20, -61, 40, -8, 'SEARCHING');
  placeCruiser(game, 'BARRACUDA-18', 140, 90, 40, -8, 'SEARCHING');
  placeCruiser(game, 'GECKO-25', 10, -29, 40, -8, 'WRECKED');

  // Two peds fleeing on the sidewalk, arms out.
  makePed(game.scene, 34, -14, { shirt: 0xd98880, armsOut: true, yaw: 0.4 });
  makePed(game.scene, 48, -14, { shirt: 0x85c1e9, armsOut: true, yaw: -0.3 });

  // Red motorcycle + rider pulled in near the zebra so it reads in frame.
  const moto = game.traffic.cars.find((c) => c.type === 'motorcycle');
  if (moto) { moto.x = 48; moto.z = 8.5; moto.dir = Math.PI; moto.speed = 0; moto.sync(); }

  game.hud.setDialogue('Lupe', 'FIXER · PIER SHACK',
    'Three stars, Kai. Lose them before the heli comes out.',
    'Working on it.');
  game.hud.toast('WANTED ★★★ · EVADING 15%');

  // Camera south-east, looking north-west: hero cruiser foreground
  // (~20% width, front three-quarter), Kai + zebra mid-frame left.
  frameCamera(game, 78, 3.5, 30, 58, 1.2, 18);
}

// --- Shot 3: orange coupe at dusk, headlights on, traffic clustered at
// the zebra. Camera high behind the coupe, storefronts in frame.
// Coupe VIREO GT, condition 100, G3, 88 km/h, radio SOLARA 98.3.
function shot3(game) {
  setPlaying(game);
  game.hours = 18 + 48 / 60 + 0.001;
  game.missions.index = 2; // SHARK TAX
  game.missions.stage = 2;
  game.missions.moveBeacon();
  game.money = 1600; // 400 + 1200 from job 2

  // Player in the coupe downtown, driving east on the road.
  const coupe = game.traffic.parked[0];
  coupe.x = 40; coupe.z = -3; coupe.dir = 0;
  coupe.speed = 24.4; // 88 km/h
  coupe.condition = 100;
  coupe.sync();
  game.player.car = coupe;
  game.player.onFoot = false;
  game.player.group.visible = false;
  game.player.group.position.set(coupe.x, 0, coupe.z);
  game.player.yaw = 0;
  game.player.setWeapon(2); // HUD shows VESPER 9 · 12 · 71, not infinity
  game.player.weaponAmmo = 12;
  game.radioIdx = 2; // SOLARA 98.3

  // Cluster the traffic around the zebra crossing at x=40.
  const spots = [
    { type: 'taxi', x: 56, z: -3, dir: 0 },
    { type: 'van', x: 28, z: 3, dir: Math.PI },
    { type: 'pickup', x: 48, z: 8.5, dir: 0 },
    { type: 'motorcycle', x: 44, z: -8.5, dir: Math.PI },
    { type: 'sedan', x: 66, z: 3, dir: 0 },
    { type: 'sedan', x: 22, z: -8.5, dir: Math.PI },
    { type: 'bus', x: 82, z: -8.5, dir: 0 },
  ];
  game.traffic.cars.forEach((c, i) => {
    const s = spots[i % spots.length];
    c.x = s.x; c.z = s.z; c.dir = s.dir;
    c.speed = 0;
    c.sync();
  });

  // Ped mid-flee on the zebra, arms out.
  makePed(game.scene, 40, 2, { shirt: 0xf2c14e, armsOut: true, yaw: Math.PI });

  game.hud.setDialogue('Lupe', 'FIXER · PIER SHACK',
    'Middle stall, Kai. The shark tax is due.',
    'Collecting.');
  game.hud.toast('SHARK TAX · STAGE 2/4');

  // Camera high behind the coupe, looking east down the road at the
  // traffic cluster + storefronts. Coupe ~19-20% of frame width.
  frameCamera(game, 27, 6, 1, 52, 1.0, -4);
}

// --- Shot 4: four stars, helicopter overhead, neon + nightfall.
// Camera low behind the coupe, looking up the street at the neon and the
// heli. Coupe VIREO GT, condition 82, G2, 65 km/h, radio PUERTO 88.3.
function shot4(game) {
  setPlaying(game);
  game.hours = 19 + 19 / 60 + 0.001;
  game.missions.index = 3; // TIDE RUNNER
  game.missions.stage = 3;
  game.missions.moveBeacon();
  game.missions.timer = 90;
  game.money = 3100; // 400 + 1200 + 1500

  // Player in the coupe west downtown, heading west toward the neon strip.
  // (-10,-3) sits on the road in DOWNTOWN (nearest centre) yet close
  // enough to MO'S + SOLARA for the neon to read. Rear toward the camera.
  // The camera stays on the road (z=0) clear of the palm row at z=-18.
  const coupe = game.traffic.parked[0];
  coupe.x = -10; coupe.z = -3; coupe.dir = Math.PI;
  coupe.speed = 18; // 65 km/h
  coupe.condition = 82;
  coupe.sync();
  game.player.car = coupe;
  game.player.onFoot = false;
  game.player.group.visible = false;
  game.player.group.position.set(coupe.x, 0, coupe.z);
  game.player.yaw = Math.PI;
  game.player.setWeapon(2);
  game.player.weaponAmmo = 12;
  game.radioIdx = 0; // PUERTO 88.3

  // Wanted: 4 stars, IN SIGHT, evading 22%, heli up.
  game.wanted.stars = 4;
  game.wanted.evading = 22;
  game.wanted.inSight = true;
  // Heli placed closer + lower (y=25) so it reads clearly in the
  // upper-third, bigger and silhouetted against the dusk sky; the
  // spotlight cone still reaches the street and the ground ellipse is
  // simply hidden below the asphalt.
  const heli = game.police.spawnHeli(-40, -30);
  heli.x = -40; heli.z = -30;
  heli.group.position.set(-40, 25, -30);

  game.hud.setDialogue('Marco', 'DRIVER · MARINA',
    'Ninety seconds, Kai. The tide waits for no one.',
    'Floor it.');
  game.hud.toast('TIDE RUNNER · 90 s · STAGE 3/4');

  // Camera low behind the coupe (east of it, on the road), looking west
  // and slightly up: coupe foreground below, neon strip mid-frame, heli
  // upper-right.
  frameCamera(game, 4, 1.6, 0, -120, 12, -28);
}

const SHOTS = { '1-start': shot1, '2-drive': shot2, '3-mission': shot3, '4-chase': shot4 };

export function stageShot(game, name) {
  const fn = SHOTS[name];
  if (!fn) throw new Error(`unknown shot: ${name}`);
  fn(game);
  // District + respect follow the staged player position (the loop is
  // frozen in shot mode, so update() never runs to set them).
  game.districts.update(game.player.x, game.player.z);
  // Dusk state for the staged hour (halos, lit windows, stars).
  game.updateDusk();
  game.world.update(0.016, game.duskT, game.hours);
  for (const c of [...game.traffic.cars, ...game.traffic.parked]) c.update(0.016, game.duskT);
  for (const c of game.police.cruisers) c.update(0.016, game.duskT);
}
