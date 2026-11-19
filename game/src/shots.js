// SOLARA — dossier shots: frozen renders of the live game.
// ?shot=1-start | 2-drive | 3-mission | 4-chase  (+ &seed=1)
// Stages the scene deterministically, freezes the loop, then raises
// window.__solaraShotReady so the screenshot runner can capture.
import * as THREE from '../vendor/three.module.min.js';
import { makeCar } from './vehicles.js';
import { WORLD, clamp } from './config.js';

function spotPool(x, z, r, color = 0xfff2b0) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,242,176,0.85)');
  grad.addColorStop(1, 'rgba(255,242,176,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.05, z);
  return m;
}

function makeStall(x, z, rotY) {
  // A street stall: counter + bright orange awning, for the CH.3 collect shot.
  const grp = new THREE.Group();
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1.1, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 }),
  );
  counter.position.y = 0.55;
  grp.add(counter);
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.12, 2.4),
    new THREE.MeshStandardMaterial({ color: 0xff7a00, roughness: 0.6, emissive: 0x903a00, emissiveIntensity: 0.5 }),
  );
  awning.position.set(0, 2.4, 0.2);
  awning.rotation.x = 0.25;
  grp.add(awning);
  for (const s of [-1.6, 1.6]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.6 }),
    );
    pole.position.set(s, 1.2, 1.1);
    grp.add(pole);
  }
  grp.position.set(x, 0, z);
  grp.rotation.y = rotY;
  return grp;
}

function makeNeonSign(x, y, z, rotY) {
  // A standalone pole sign reading MO'S / SOLARA, bright and double-sided.
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g2 = c.getContext('2d');
  g2.clearRect(0, 0, 1024, 512);
  g2.textAlign = 'center';
  g2.textBaseline = 'middle';
  g2.font = 'bold 150px Arial';
  g2.shadowColor = '#39e6c3'; g2.shadowBlur = 40;
  g2.fillStyle = '#39e6c3';
  g2.fillText("MO'S", 512, 120);
  g2.shadowBlur = 12; g2.fillStyle = '#ffffff';
  g2.fillText("MO'S", 512, 120);
  g2.font = 'bold 190px Arial';
  g2.shadowColor = '#ff5fa2'; g2.shadowBlur = 44;
  g2.fillStyle = '#ff5fa2';
  g2.fillText('SOLARA', 512, 330);
  g2.shadowBlur = 12; g2.fillStyle = '#ffffff';
  g2.fillText('SOLARA', 512, 330);
  g2.font = 'bold 56px Arial';
  g2.shadowColor = '#39e6c3'; g2.shadowBlur = 20;
  g2.fillStyle = '#bff5e8';
  g2.fillText('OPEN LATE', 512, 460);
  const tex = new THREE.CanvasTexture(c);
  const grp = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.3, y, 10),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.7 }),
  );
  pole.position.y = y / 2;
  grp.add(pole);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 6),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
  );
  board.position.y = y;
  board.rotation.y = rotY;
  grp.add(board);
  grp.position.set(x, 0, z);
  return grp;
}

export function applyShot(game, name) {
  const g = game;
  g.state = 'playing';
  g.shotMode = true;
  g.hud.showOverlay(null); // hide the intro/title overlay for the frozen shot
  g.hours = 17.9;
  g.duskT = 0;
  // Clear live heat so each shot starts from a known state.
  for (const c of g.police.cruisers) g.scene.remove(c.mesh);
  for (const o of g.police.officers) g.scene.remove(o.mesh);
  g.police.cruisers = [];
  g.police.officers = [];
  if (g.police.heli) { g.scene.remove(g.police.heli.group); g.police.heli = null; }
  g.wanted.stars = 0;
  g.wanted.inSight = false;
  g.wanted.evading = 0;

  const look = (px, py, pz, tx, ty, tz) => {
    g.camera.position.set(px, py, pz);
    g.camera.lookAt(tx, ty, tz);
    g.fixedCamera = true;
  };

  if (name === '1-start') {
    // Kai on foot on Beach Road, pistol raised, Lupe on the line.
    g.missions.index = 1;
    g.missions.stage = 1;
    g.missions.done = false;
    g.player.group.position.set(200, 0, 20);
    g.player.group.rotation.y = Math.PI / 2; // facing east, toward the ocean
    g.player.heading = Math.PI / 2;
    g.player.onFoot = true;
    g.player.car = null;
    g.player.group.visible = true;
    g.player.setWeapon(2);
    g.player.weaponAmmo = 71;
    g.player.reserveAmmo = 71;
    // A target 18 m east of Kai, dead ahead of his aim, in the open road.
    const target = g.traffic.peds[0];
    target.group.position.set(216, 0, 26);
    target.group.rotation.y = -Math.PI / 2; // facing west, toward Kai
    // No car in frame: park the traffic far down the road.
    for (const c of g.traffic.cars) {
      c.mesh.position.set(180 + Math.random() * 40, 0, 220 + Math.random() * 40);
    }
    for (const c of g.traffic.parked) {
      c.mesh.position.set(200, 0, 240);
    }
    // Camera north of Kai, ~4 m off, looking due south down Beach Road.
    look(200, 2.0, 16, 203, 2.0, 25);
    g.hud.showDialogue('lupe', 'Lupe', 'FIXER · PIER SHACK',
      'Borrowed wheels, Kai. The coupe sits on Beach Road — bring it back clean.',
      'On it. Nobody even sees me coming.');
    g.hud.toast('+$1,200', '+12 respect');
    g.hud.update();
  } else if (name === '2-drive') {
    // Three-star escalation on foot beside the carjacked sedan.
    g.missions.index = 1;
    g.missions.stage = 1;
    g.wanted.stars = 3;
    g.wanted.inSight = true;
    g.wanted.evading = 15;
    // Kai beside a carjacked sedan.
    const sedan = g.traffic.parked[0];
    sedan.mesh.position.set(8, 0, 6);
    sedan.mesh.rotation.y = Math.PI / 2;
    sedan.sync();
    g.player.group.position.set(5.4, 0, 6);
    g.player.group.rotation.y = Math.PI / 2;
    g.player.onFoot = true;
    g.player.car = null;
    g.player.group.visible = true;
    g.player.setWeapon(2);
    g.player.weaponAmmo = 68;
    // The four PCPD units at their exact panel distances from Kai.
    const place = (name, dist, status, police) => {
      const car = makeCar({ name: 'PCPD Cruiser', color: 0xf2f2f2, kind: 'sedan', police: true });
      const a = Math.PI * 0.25 + dist * 0.11;
      car.mesh.position.set(
        g.player.group.position.x + Math.cos(a) * dist,
        0,
        g.player.group.position.z + Math.sin(a) * dist,
      );
      car.mesh.rotation.y = Math.atan2(g.player.group.position.x - car.mesh.position.x, g.player.group.position.z - car.mesh.position.z);
      car.angle = car.mesh.rotation.y;
      car.unit = name;
      car.status = status;
      car.speed = 0;
      car.sync();
      g.scene.add(car.mesh);
      g.police.cruisers.push(car);
      return car;
    };
    place('PELICAN-11', 39, 'PURSUIT', true);
    place('MANTA-32', 80, 'SEARCHING', true);
    place('BARRACUDA-18', 140, 'SEARCHING', true);
    const wreck = place('GECKO-25', 37, 'WRECKED', true);
    wreck.mesh.rotation.z = 0.5;
    wreck.mesh.position.y = 0.4;
    // Hero cruiser: a set-piece close to the camera, three-quarter to Kai.
    const hero = makeCar({ name: 'PCPD Cruiser', color: 0xf2f2f2, kind: 'sedan', police: true });
    hero.mesh.position.set(4, 0, -2);
    hero.mesh.rotation.y = 0.6;
    hero.updateDusk(0.55);
    g.scene.add(hero.mesh);
    g._shotHero = hero;
    // Traffic cluster behind.
    const cluster = [
      { kind: 'taxi', color: 0x2fa8a0, x: -14, z: 22 },
      { kind: 'van', color: 0x8a6a3a, x: 2, z: 30 },
      { kind: 'sedan', color: 0x2244aa, x: 18, z: 26 },
    ];
    for (const d of cluster) {
      const c = makeCar(d);
      c.mesh.position.set(d.x, 0, d.z);
      c.mesh.rotation.y = Math.PI / 2;
      c.sync();
      g.scene.add(c.mesh);
    }
    g.hours = 18.4;
    look(10, 2.8, -4, 3, 1.2, 2);
    g.hud.update();
  } else if (name === '3-mission') {
    // Dusk coupe, headlights and traffic, on the zebra crossing at (64, 0).
    g.missions.index = 2;
    g.missions.stage = 1;
    g.hours = 18.8;
    g.radioStation = 2;
    const coupe = makeCar({ name: 'Vireo GT', color: 0xe86a1a, kind: 'coupe' });
    coupe.mesh.position.set(64, 0, 0);
    coupe.mesh.rotation.y = Math.PI / 2;
    coupe.angle = Math.PI / 2;
    coupe.speed = 24.4; // 88 km/h
    coupe.condition = 100;
    coupe.sync();
    coupe.updateDusk(0.55);
    g.scene.add(coupe.mesh);
    g.player.enterCar(coupe);
    g.player.car = coupe;
    g.player.group.position.set(64, 0, 0); // HUD/district/minimap follow the car
    // The middle stall on Sunset Strip: orange awning, right of the coupe.
    g.scene.add(makeStall(68, 10, Math.PI / 2));
    // Traffic of five types around the coupe.
    const set = [
      { kind: 'taxi', color: 0x2fa8a0, x: 56, z: -8, a: Math.PI / 2 },
      { kind: 'van', color: 0x8a6a3a, x: 72, z: 8, a: Math.PI / 2 },
      { kind: 'pickup', color: 0x2fa8a0, x: 48, z: 10, a: Math.PI / 2 },
      { kind: 'motorcycle', color: 0xc02020, x: 76, z: -6, a: Math.PI / 2 },
      { kind: 'sedan', color: 0x2244aa, x: 58, z: 6, a: Math.PI / 2 },
      { kind: 'sedan', color: 0xc02020, x: 84, z: 4, a: Math.PI / 2 },
    ];
    for (const d of set) {
      const c = makeCar(d);
      c.mesh.position.set(d.x, 0, d.z);
      c.mesh.rotation.y = d.a;
      c.angle = d.a;
      c.sync();
      c.updateDusk(0.55);
      g.scene.add(c.mesh);
      g.traffic.cars.push(c);
    }
    // A pedestrian mid-flee on the sidewalk, arms out.
    const ped = g.traffic.peds[1];
    ped.group.position.set(70, 0, -12);
    ped.flee = 3;
    ped.armL.rotation.z = 1.4;
    ped.armR.rotation.z = -1.4;
    // Camera high rear three-quarter.
    look(64, 5.5, -14, 64, 1, 8);
    g.hud.update();
  } else if (name === '4-chase') {
    // Helicopter and nightfall at 19:20, four stars — chase west along the
    // road past the SOLARA neon, heli in the upper third.
    g.missions.index = 3;
    g.missions.stage = 2;
    g.missions.timer = 90; // the 90 s delivery, still on the clock
    g.hours = 19.33;
    g.wanted.stars = 4;
    g.wanted.inSight = true;
    g.wanted.evading = 22;
    const coupe = makeCar({ name: 'Vireo GT', color: 0xe86a1a, kind: 'coupe' });
    coupe.mesh.position.set(-160, 0, -30);
    coupe.mesh.rotation.y = -Math.PI / 2; // driving west
    coupe.angle = -Math.PI / 2;
    coupe.speed = 18;
    coupe.condition = 82;
    coupe.sync();
    coupe.updateDusk(0.9);
    g.scene.add(coupe.mesh);
    g.player.enterCar(coupe);
    g.player.car = coupe;
    g.player.group.position.set(-160, 0, -30); // HUD/district/minimap follow the car
    // Helicopter overhead, upper third, ahead of the car.
    const heli = g.police._buildHeli();
    heli.group.position.set(-169, 17, -34);
    heli.group.rotation.y = Math.PI * 0.85;
    g.scene.add(heli.group);
    g.police.heli = heli;
    // Spotlight pool on the road under the heli, coupe inside.
    const pool = spotPool(-164, -32, 9);
    g.scene.add(pool);
    g._shotPool = pool;
    // Combined MO'S / SOLARA pole sign, bright, facing the camera.
    g.scene.add(makeNeonSign(-178, 11, -22, Math.PI / 2));
    // A cruiser in pursuit behind, north lane, in frame ahead of the camera.
    const cruiser = makeCar({ name: 'PCPD Cruiser', color: 0xf2f2f2, kind: 'sedan', police: true });
    cruiser.mesh.position.set(-155, 0, -26);
    cruiser.mesh.rotation.y = -Math.PI / 2;
    cruiser.angle = -Math.PI / 2;
    cruiser.unit = 'PELICAN-11';
    cruiser.status = 'PURSUIT';
    cruiser.sync();
    cruiser.updateDusk(0.9);
    g.scene.add(cruiser.mesh);
    g.police.cruisers.push(cruiser);
    // Camera low on the road behind the chase, looking west up at the heli.
    look(-142, 5, -30, -165, 6, -32);
    g.hud.update();
  }

  // Apply dusk lighting for the staged hour, render once, then signal ready.
  g.duskT = clamp((g.hours - 18) / 1.5, 0, 1);
  g.world.update(g.duskT, g.hours);
  for (const c of g.traffic.cars) c.updateDusk(g.duskT);
  for (const c of g.traffic.parked) c.updateDusk(g.duskT);
  // Sync the district label to the staged player position (the loop is frozen).
  g.districts.update(g.player.x, g.player.z);
  g.hud.update();
  g.renderer.render(g.scene, g.camera);
  window.__solaraShotReady = true;
}
