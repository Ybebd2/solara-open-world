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
    // Camera NORTH of Kai looking SOUTH, so the beach, umbrellas and
    // ocean sit behind him (the old north-facing camera showed only
    // blank building backs). Kai faces WEST in left profile to the
    // north camera, pistol level toward the target ped and the coupe.
    setMission(g, 1, 2, 800, 10);
    g.hours = shotHours(17, 53);
    g.player.group.position.set(-70, 0, 14);
    g.player.yaw = -Math.PI / 2; // facing west, left profile to camera
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
    // The orange coupe, parked on the south sidewalk in frame left.
    const coupe = g.traffic.parked[0];
    coupe.x = -80; coupe.z = 12; coupe.dir = Math.PI;
    coupe.sync();
    // Target ped 15 m west, in frame left.
    makePed(g.scene, -85, 14, { color: 0x7fb3d5, yaw: Math.PI / 2 });
    // Jogger + dog on the far side of the road, in frame right.
    makePed(g.scene, -58, 30, { color: 0x2ee6c8, yaw: -Math.PI / 2 });
    makeDog(g.scene, -55.5, 32);
    // Two beach peds on the sand, small against the ocean.
    makePed(g.scene, -80, 106, { color: 0xf2c14e, yaw: 0 });
    makePed(g.scene, -62, 110, { color: 0xe86a1f, yaw: Math.PI });
    // North of Kai looking south: Kai ~30% of frame height, beach +
    // umbrellas + ocean horizon behind him.
    g.camera.position.set(-67, 2.2, 8);
    g.camera.lookAt(-72, 1.3, 14);
  } else if (name === '2-drive') {
    // Three stars, four PCPD units, hero cruiser three-quarter to camera.
    // Reframed tight: the old camera sat 52 m from Kai and he read as
    // a dot. Now the cruiser sits 10 m from Kai and the camera 22 m
    // from Kai, so both read large in frame.
    setMission(g, 1, 2, 800, 10);
    g.hours = shotHours(18, 23);
    g.player.group.position.set(40, 0, 0);
    g.player.yaw = -Math.PI / 2; // facing west, toward the cruiser
    g.player.group.rotation.y = g.player.yaw;
    g.player.group.visible = true;
    g.player.onFoot = true;
    g.player.car = null;
    g.player.setWeapon(2);
    g.wanted.stars = 3;
    g.wanted.evading = 15;
    g.wanted.inSight = true;
    // Hero cruiser 10 m west of the player; faces the camera.
    const hero = placeCruiser(g, 'PELICAN-11', 10, 'PURSUIT', { pos: { x: 30, z: 0 } });
    // Face the camera: visual yaw atan2(-dz, dx) toward (18, 9).
    hero.dir = Math.atan2(-(9 - 0), (18 - 30));
    hero.sync();
    placeCruiser(g, 'MANTA-32', 30, 'SEARCHING', { pos: { x: 70, z: 3 } });
    placeCruiser(g, 'BARRACUDA-18', 55, 'SEARCHING', { pos: { x: 95, z: -3 } });
    placeCruiser(g, 'GECKO-25', 13, 'WRECKED', { pos: { x: 52, z: -6 } });
    // Red motorcycle + rider near the zebra, two fleeing peds.
    const moto = makeCar('motorcycle', { x: 48, z: 3, dir: 0 });
    g.scene.add(moto.mesh);
    makePed(g.scene, 34, -12, { flee: true, color: 0xf2c14e, yaw: Math.PI });
    makePed(g.scene, 46, -12, { flee: true, color: 0xa569bd, yaw: 0 });
    g.hud.setDialogue('Lupe', 'FIXER · PIER SHACK',
      'PCPD is on you. Lose them before the pier.',
      'They\'ll have to catch me first.');
    g.camera.position.set(20, 3.0, 8.5);
    g.camera.lookAt(33, 1.2, 0);
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
    // Reframed WEST onto the neon block: the old camera looked down
    // an empty street and the MO'S / SOLARA signs sat 120 m out of
    // frame. Now the coupe sits under the neon, the heli is big in the
    // upper third, and two cruisers fill the PCPD panel (no more
    // "0 UNITS" beside 4 stars).
    setMission(g, 3, 3, 3100, 36);
    g.hours = shotHours(19, 19);
    g.radioIdx = 0; // PUERTO 88.3
    g.missions.timer = 90;
    // Player in the coupe on the road at (-70,-3), heading west to neon.
    const coupe = g.traffic.parked[0];
    const pi = g.traffic.parked.indexOf(coupe);
    if (pi >= 0) g.traffic.parked.splice(pi, 1);
    coupe.x = -70; coupe.z = -3; coupe.dir = Math.PI;
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
    // Two cruisers on the player's tail.
    const c1 = placeCruiser(g, 'PELICAN-11', 15, 'PURSUIT', { pos: { x: -84, z: 3 } });
    c1.dir = Math.PI; c1.sync();
    placeCruiser(g, 'MANTA-32', 31, 'SEARCHING', { pos: { x: -100, z: -8 } });
    // Helicopter overhead, closer and lower than before: fuselage
    // upper-third, rotor disc + spotlight cone visible. Placed LEFT
    // of the view axis so the PCPD panel (top-centre) does not hide it.
    g.police.spawnHeli(-98, -14);
    g.police.heli.group.position.set(-98, 17, -14);
    g.police.heli.x = -98;
    g.police.heli.z = -14;
    // The spotlight ground ellipse is built for the 55 m patrol height;
    // at the staged 17 m it would sit underground — drop it to the road.
    for (const child of g.police.heli.group.children) {
      if (child.geometry && child.geometry.type === 'CircleGeometry') {
        child.position.y = -16.9;
      }
    }
    g.hud.setDialogue('Marco', 'DRIVER · NORTH GATE',
      'Ninety seconds, Kai. The tide waits for no one.',
      'Then I\'d better fly.');
    // Low behind the coupe, looking west up the street at the neon
    // (MO'S at -120, SOLARA at -100) and the heli above it.
    g.camera.position.set(-58, 2.5, 8);
    g.camera.lookAt(-95, 7, -25);
  } else {
    throw new Error(`unknown shot: ${name}`);
  }

  // Hide the mission beacon + ground ring in shot mode: the 40 m
  // yellow pillar reads as a stray light shaft in a frozen frame.
  g.missions.beacon.visible = false;
  g.missions.ring.visible = false;

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
