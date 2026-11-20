// Shot staging — the 4 frozen dossier renders of the live game.
// Each shot sets the exact game state from the shots.json spec, places
// the camera, and freezes the simulation so the staged state never
// drifts. Written fresh from the spec under recording T.
import * as THREE from '../vendor/three.module.min.js';
import { makeCar } from './vehicles.js';

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}
function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

// A civilian pedestrian. Fleeing peds throw their arms out.
export function makePed(scene, x, z, opts = {}) {
  const g = new THREE.Group();
  const shirt = lam(opts.color || 0xd98880);
  const pants = lam(0x2c3e50);
  const skin = lam(0xc68e5e);
  const torso = box(0.55, 0.7, 0.32, shirt);
  torso.position.y = 1.1;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.65;
  g.add(head);
  const legL = box(0.2, 0.7, 0.22, pants);
  legL.position.set(-0.14, 0.35, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legR);
  // Arms: out to the sides when fleeing, down otherwise.
  for (const sx of [-1, 1]) {
    const arm = box(0.16, 0.6, 0.18, shirt);
    if (opts.flee) {
      arm.position.set(sx * 0.45, 1.35, 0);
      arm.rotation.z = sx * 1.2;
    } else {
      arm.position.set(sx * 0.36, 1.05, 0);
    }
    g.add(arm);
  }
  g.position.set(x, 0, z);
  g.rotation.y = opts.yaw || 0;
  scene.add(g);
  return g;
}

// A small dog (the jogger's).
export function makeDog(scene, x, z) {
  const g = new THREE.Group();
  const fur = lam(0x8b5a2b);
  const body = box(0.7, 0.35, 0.3, fur);
  body.position.y = 0.35;
  g.add(body);
  const head = box(0.3, 0.28, 0.28, fur);
  head.position.set(0.45, 0.5, 0);
  g.add(head);
  const tail = box(0.3, 0.08, 0.08, fur);
  tail.position.set(-0.45, 0.5, 0);
  tail.rotation.z = 0.6;
  g.add(tail);
  for (const [dx, dz] of [[-0.25, -0.12], [0.25, -0.12], [-0.25, 0.12], [0.25, 0.12]]) {
    const leg = box(0.08, 0.3, 0.08, fur);
    leg.position.set(dx, 0.15, dz);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  g.rotation.y = 0.5;
  scene.add(g);
  return g;
}

// Place a named PCPD cruiser at an exact distance from the player with
// a given status. Returns the car. dir faces the camera when given.
export function placeCruiser(game, name, dist, status, opts = {}) {
  const car = makeCar('cruiser', { x: 0, z: 0, dir: opts.dir || 0 });
  car.name = name;
  car.status = status;
  // Position at `dist` metres from the player along `angle` (radians,
  // measured like Math.atan2(dx, dz) from the player).
  const a = opts.angle !== undefined ? opts.angle : 0;
  car.x = game.player.x + Math.sin(a) * dist;
  car.z = game.player.z + Math.cos(a) * dist;
  if (opts.pos) { car.x = opts.pos.x; car.z = opts.pos.z; }
  car.sync();
  car.mesh.userData.cruiser = car;
  game.police.cruisers.push(car);
  game.scene.add(car.mesh);
  return car;
}

// Clock hours for a shot: HH:MM plus a +0.001 epsilon so float floor()
// lands on the right minute (17:53 not 17:52).
function shotHours(h, m) {
  return h + m / 60 + 0.001;
}

function setMission(game, index, stage, money, respect) {
  game.missions.index = index;
  game.missions.stage = stage;
  game.missions.moveBeacon();
  game.money = money;
  game.respect = respect;
  game.rp = respect * 20 + game.escapes * 150;
}

export function stageShot(game, name) {
  const g = game;
  g.state = 'playing';
  g.shotMode = true;
  g.hud.showOverlay(null);
  // Clear any live police (fresh boot has none, but be safe).
  for (const c of [...g.police.cruisers]) g.scene.remove(c.mesh);
  g.police.cruisers = [];
  for (const o of [...g.police.officers]) g.scene.remove(o.mesh);
  g.police.officers = [];
  if (g.police.heli) g.police.removeHeli();

  if (name === '1-start') {
    // Kai on foot on Beach Road, pistol raised, Lupe on the radio.
    setMission(g, 1, 2, 800, 10);
    g.hours = shotHours(17, 53);
    g.player.group.position.set(-70, 0, 14);
    g.player.yaw = -Math.PI / 2; // facing west, side profile
    g.player.group.rotation.y = g.player.yaw;
    g.player.group.visible = true;
    g.player.onFoot = true;
    g.player.car = null;
    g.player.setWeapon(2);
    g.wanted.stars = 0;
    g.hud.setDialogue('Lupe', 'FIXER · PIER SHACK',
      'Borrowed wheels, Kai. The coupe sits on Beach Road — bring it back clean.',
      'On it. Nobody even sees me coming.');
    g.hud.toast('+$1,200 · +12 RESPECT');
    // Target ped 15 m west (out of frame at this camera distance).
    makePed(g.scene, -85, 14, { color: 0x7fb3d5, yaw: Math.PI / 2 });
    // Jogger + dog on the beach side, in frame left.
    makePed(g.scene, -88, 6, { color: 0x2ee6c8, yaw: -Math.PI / 2 });
    makeDog(g.scene, -85.5, 8);
    // Side profile from the south, Kai lower-third, full body.
    g.camera.position.set(-70, 2.4, 21.5);
    g.camera.lookAt(-70, 1.35, 14);
  } else if (name === '2-drive') {
    // Three stars, four PCPD units, hero cruiser three-quarter to camera.
    setMission(g, 1, 2, 800, 10);
    g.hours = shotHours(18, 23);
    g.player.group.position.set(40, 0, 0);
    g.player.yaw = Math.PI / 2;
    g.player.group.rotation.y = g.player.yaw;
    g.player.group.visible = true;
    g.player.onFoot = true;
    g.player.car = null;
    g.player.setWeapon(2);
    g.wanted.stars = 3;
    g.wanted.evading = 15;
    g.wanted.inSight = true;
    // Hero cruiser 39 m west of the player on the road; camera 13 m
    // west of it, so the cruiser reads ~20% width and Kai sits beyond it.
    const hero = placeCruiser(g, 'PELICAN-11', 39, 'PURSUIT', { pos: { x: 1, z: 0 } });
    // Face the camera (south-west of the cruiser) for a front three-quarter.
    hero.dir = Math.atan2(-(6 - 0), (-12 - 1));
    hero.sync();
    placeCruiser(g, 'MANTA-32', 80, 'SEARCHING', { pos: { x: 120, z: 3 } });
    placeCruiser(g, 'BARRACUDA-18', 140, 'SEARCHING', { pos: { x: -100, z: -3 } });
    placeCruiser(g, 'GECKO-25', 37, 'WRECKED', { pos: { x: 40, z: -37 } });
    // Red motorcycle + rider near the zebra, two fleeing peds.
    const moto = makeCar('motorcycle', { x: 48, z: 3, dir: 0 });
    g.scene.add(moto.mesh);
    makePed(g.scene, 30, 14, { flee: true, color: 0xf2c14e, yaw: Math.PI });
    makePed(g.scene, 50, 14, { flee: true, color: 0xa569bd, yaw: 0 });
    g.hud.setDialogue('Lupe', 'FIXER · PIER SHACK',
      'PCPD is on you. Lose them before the pier.',
      'They\'ll have to catch me first.');
    g.camera.position.set(-12, 3.5, 6);
    g.camera.lookAt(12, 1.2, 0);
  } else if (name === '3-mission') {
    // The orange coupe at dusk, traffic clustered around a zebra.
    setMission(g, 2, 2, 2000, 22);
    g.hours = shotHours(18, 48);
    g.radioIdx = 2; // SOLARA 98.3
    // Player in the coupe (the parked VIREO GT), 88 km/h, G3.
    const coupe = g.traffic.parked[0];
    const pi = g.traffic.parked.indexOf(coupe);
    if (pi >= 0) g.traffic.parked.splice(pi, 1);
    coupe.x = 30; coupe.z = -3; coupe.dir = 0;
    coupe.speed = 88 / 3.6;
    coupe.condition = 100;
    coupe.sync();
    g.player.enterCar(coupe);
    // enterCar hides the group but leaves it at the pier — move it onto
    // the car so districts/HUD read the staged position, not PIER.
    g.player.group.position.set(coupe.x, 0, coupe.z);
    g.player.setWeapon(2);
    g.wanted.stars = 0;
    // Traffic cluster around the zebra at x=40.
    const cluster = [
      { type: 'taxi', x: 48, z: 3, dir: Math.PI },
      { type: 'van', x: 52, z: -8.5, dir: 0 },
      { type: 'pickup', x: 36, z: 8.5, dir: Math.PI },
      { type: 'motorcycle', x: 44, z: -3, dir: 0 },
      { type: 'sedan', x: 56, z: 3, dir: Math.PI },
      { type: 'sedan', x: 28, z: -8.5, dir: 0 },
      { type: 'bus', x: 60, z: -3, dir: 0 },
    ];
    cluster.forEach((c, i) => {
      const car = g.traffic.cars[i];
      if (!car) return;
      // Swap the moving car to the cluster type by rebuilding its mesh.
      if (car.type !== c.type) {
        g.scene.remove(car.mesh);
        const repl = makeCar(c.type, { x: c.x, z: c.z, dir: c.dir });
        repl.speed = 0;
        g.traffic.cars[i] = repl;
        g.scene.add(repl.mesh);
      } else {
        car.x = c.x; car.z = c.z; car.dir = c.dir; car.speed = 0;
        car.sync();
      }
    });
    // Ped mid-flee on the zebra.
    makePed(g.scene, 42, 0, { flee: true, color: 0xe86a1f, yaw: Math.PI / 2 });
    g.hud.setDialogue('Lupe', 'FIXER · PIER SHACK',
      'Three stalls, no receipts. The middle one pays first.',
      'On my way. Keep the engine warm.');
    // High behind the coupe, traffic + storefronts in frame. Aim low at
    // the coupe so it sits mid-frame, clear of the dialogue panel.
    g.camera.position.set(20, 8, 6);
    g.camera.lookAt(36, 0, -2);
  } else if (name === '4-chase') {
    // Four stars, helicopter overhead, neon and nightfall.
    setMission(g, 3, 3, 3100, 36);
    g.hours = shotHours(19, 19);
    g.radioIdx = 0; // PUERTO 88.3
    g.missions.timer = 90;
    // Player in the coupe on the road at (-10,-3), heading west to neon.
    const coupe = g.traffic.parked[0];
    const pi = g.traffic.parked.indexOf(coupe);
    if (pi >= 0) g.traffic.parked.splice(pi, 1);
    coupe.x = -10; coupe.z = -3; coupe.dir = Math.PI;
    coupe.speed = 65 / 3.6;
    coupe.condition = 82;
    coupe.sync();
    g.player.enterCar(coupe);
    // enterCar hides the group but leaves it at the pier — move it onto
    // the car so districts/HUD read the staged position, not PIER.
    g.player.group.position.set(coupe.x, 0, coupe.z);
    g.player.setWeapon(2);
    g.wanted.stars = 4;
    g.wanted.evading = 22;
    g.wanted.inSight = true;
    // Helicopter overhead: spawn then drop to (-40, 25, -30) so it sits
    // in the upper-third with rotor disc + spotlight cone visible.
    g.police.spawnHeli(-40, -30);
    g.police.heli.group.position.set(-40, 25, -30);
    g.police.heli.x = -40;
    g.police.heli.z = -30;
    g.hud.setDialogue('Marco', 'DRIVER · NORTH GATE',
      'Ninety seconds, Kai. The tide waits for no one.',
      'Then I\'d better fly.');
    // Low behind the coupe, ON THE ROAD clear of the palm rows (z=±18),
    // looking up the street at the neon and the heli. Low camera (y=2)
    // so the coupe sits mid-frame, clear of the dialogue panel, while
    // the heli stays in the upper third.
    g.camera.position.set(2, 2, 8);
    g.camera.lookAt(-30, 6, -18);
  } else {
    throw new Error(`unknown shot: ${name}`);
  }

  // District from the staged position (the frozen loop never runs it).
  g.districts.update(g.player.x, g.player.z);
  // Dusk + world lighting for the staged hour.
  g.duskT = THREE.MathUtils.clamp((g.hours - 18) / 1.5, 0, 1);
  g.world.update(0, g.duskT, g.hours);
  for (const c of g.traffic.cars) c.update(0, g.duskT);
  for (const c of g.traffic.parked) c.update(0, g.duskT);
  // Sun + sky for the staged hour.
  g.scene.background.copy(new THREE.Color(0xffd9a0)).lerp(new THREE.Color(0x2a1a3a), g.duskT);
  g.sun.intensity = 1.4 - g.duskT * 0.7;
  g.sun.color.setHex(g.duskT > 0.5 ? 0xff8c42 : 0xffb347);
  return true;
}
