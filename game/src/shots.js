// SOLARA — shot mode: the four frozen dossier renders. When the page
// loads with ?shot=<name>, the game jumps straight to playing, the shot
// stages its scene deterministically (positions, HUD values, police,
// dialogue), the simulation freezes so nothing drifts, and
// __solaraShotReady flips true once a few frames have rendered. The
// camera is placed by hand per shot: shot 1 sits behind Kai and a little
// to his right, so the bright pistol reads clear of his torso against the
// road while the crosshair stays on the officer 18 m ahead.
import * as THREE from '../vendor/three.module.min.js';
import { clamp } from './config.js';

function neonSignTexture(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#120a18'; g.fillRect(0, 0, 256, 96);
  g.font = 'bold 52px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 22;
  g.fillStyle = color;
  g.fillText(text, 128, 50);
  g.shadowBlur = 6; g.fillStyle = '#ffffff';
  g.fillText(text, 128, 50);
  return new THREE.CanvasTexture(c);
}

// A freestanding neon sign on the sidewalk, facing the camera. Used in
// shot 4 so the neon reads clearly at street level.
function streetNeon(G, text, color, x, y, z, rotY) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 4.5),
    new THREE.MeshBasicMaterial({ map: neonSignTexture(text, color), transparent: true }),
  );
  m.position.set(x, y, z); m.rotation.y = rotY;
  G.scene.add(m);
  const pole = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, y, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
  );
  pole.position.set(x, y / 2, z);
  G.scene.add(pole);
  return m;
}

function setCam(G, pos, look) {
  G.camera.position.set(pos.x, pos.y, pos.z);
  G.camera.lookAt(look.x, look.y, look.z);
  G.camera.updateProjectionMatrix();
}

function hideAllCars(G) {
  for (const c of G.traffic.cars) c.mesh.visible = false;
  for (const c of G.traffic.parked) c.mesh.visible = false;
  for (const c of G.police.cruisers) c.mesh.visible = false;
}

function showAllCars(G) {
  for (const c of G.traffic.cars) c.mesh.visible = true;
  for (const c of G.traffic.parked) c.mesh.visible = true;
  for (const c of G.police.cruisers) c.mesh.visible = true;
}

function clearPolice(G) {
  for (const o of [...G.police.officers]) G.police.removeOfficer(o);
  for (const c of [...G.police.cruisers]) { G.scene.remove(c.mesh); }
  G.police.cruisers.length = 0;
  G.police.removeHeli();
}

function placeCruiserAt(G, name, dist, angle, status, displayDist) {
  // angle: radians around the player (0 = north). The cruiser is placed
  // dist metres from the player and turned to face him.
  const p = G.player;
  const x = p.x + Math.sin(angle) * dist;
  const z = p.z + Math.cos(angle) * dist;
  const c = G.police.spawnCruiser(x, z, name);
  c.heading = Math.atan2(p.x - x, p.z - z);
  c.status = status;
  c.displayDist = displayDist;
  c.speed = 0;
  return c;
}

const SHOTS = {
  '1-start'(G) {
    G.hours = 17.5; G.money = 1250; G.respect = 67;
    G.missions.index = 1; G.missions.stage = 1; G.missions.resetTimer();
    const p = G.player;
    p.onFoot = true; p.car = null; p.group.visible = true;
    // Kai faces north-east up Beach Road, pistol in a two-hand aim.
    p.x = -248; p.z = 20;
    p.heading = Math.PI - 0.45;
    p.group.rotation.y = p.heading;
    p.setWeapon(2);
    p.reserve[2] = 71;
    p.setAimPose(true);
    // The target officer, 18 m ahead on the aim line.
    clearPolice(G);
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const off = G.police.spawnOfficer(p.x + fx * 18, p.z + fz * 18, 'PCPD-01');
    off.mesh.rotation.y = Math.atan2(-fx, -fz);
    G.wanted.stars = 0; G.wanted.evading = 0; G.wanted.status = 'HIDDEN';
    hideAllCars(G);
    // No traffic in frame: peds walk the far sidewalk.
    for (const ped of G.traffic.peds) { ped.group.position.set(180 + Math.random() * 20, 0, -120 + Math.random() * 40); ped.setFlee(false); }
    // Camera: EAST of Kai, looking west-northwest so Kai is in profile
    // and the pistol reads side-on, full length, clear of his torso.
    // The officer sits upper-right, the crosshair between them.
    setCam(G, { x: -241, y: 2.6, z: 25 }, { x: -246, y: 1.35, z: 14 });
    G.hud.toast('JOB DONE — +$1,200 · +12 respect · +240 RP', 'good');
  },

  '2-drive'(G) {
    G.hours = 17.5; G.money = 1250; G.respect = 67;
    G.missions.index = 1; G.missions.stage = 1; G.missions.resetTimer();
    const p = G.player;
    p.onFoot = true; p.car = null; p.group.visible = true;
    p.x = -244; p.z = 30;
    p.heading = Math.PI - 0.5; // facing north-east, toward the cruiser
    p.group.rotation.y = p.heading;
    p.setWeapon(2);
    p.reserve[2] = 71;
    p.setAimPose(true);
    G.wanted.stars = 3; G.wanted.evading = 15; G.wanted.status = 'IN SIGHT';
    clearPolice(G);
    // The four named units, all north of Kai so they sit in frame. The
    // angle is measured from north (PI = due north); PELICAN-11 is the
    // big one in frame, angled 3/4 toward Kai, its panel distance the
    // spec's 39 m even though it stages closer for size.
    const pelican = placeCruiserAt(G, 'PELICAN-11', 6, Math.PI - 0.5, 'PURSUIT', 39);
    pelican.heading = Math.atan2(p.x - pelican.x, p.z - pelican.z) + 0.5;
    placeCruiserAt(G, 'GECKO-25', 37, Math.PI + 0.35, 'WRECKED', 37);
    const gecko = G.police.cruisers.find((c) => c.name === 'GECKO-25');
    if (gecko) { gecko.mesh.rotation.z = 0.07; gecko.mesh.position.y = 0.1; }
    placeCruiserAt(G, 'MANTA-32', 80, Math.PI, 'SEARCHING', 80);
    placeCruiserAt(G, 'BARRACUDA-18', 140, Math.PI, 'SEARCHING', 140);
    // The carjacked sedan beside Kai, driver's door toward him.
    showAllCars(G);
    const sedan = G.traffic.parked[0];
    sedan.mesh.visible = true;
    sedan.x = -248; sedan.z = 30; sedan.heading = Math.PI;
    for (const c of G.traffic.parked) if (c !== sedan) c.mesh.visible = false;
    // A traffic cluster behind the cruiser for depth.
    const spots = [[-238, -10, 0.4], [-258, -30, -0.3], [-232, -40, 0.2]];
    for (let i = 0; i < 3 && i < G.traffic.cars.length; i++) {
      const c = G.traffic.cars[i];
      c.mesh.visible = true;
      c.x = spots[i][0]; c.z = spots[i][1]; c.heading = Math.PI + spots[i][2];
      c.speed = 0;
    }
    for (let i = 3; i < G.traffic.cars.length; i++) G.traffic.cars[i].mesh.visible = false;
    // Camera: EAST of Kai, looking north so Kai is in profile and the
    // pistol reads side-on, full length, while the cruiser stays big.
    setCam(G, { x: -239.7, y: 2.7, z: 34.6 }, { x: -243, y: 1.2, z: 28 });
    G.hud.toast('Carjacked — +1 star', 'bad');
  },

  '3-mission'(G) {
    G.hours = 18.9; G.money = 18450; G.respect = 400;
    G.missions.index = 3; G.missions.stage = 1; G.missions.resetTimer();
    const p = G.player;
    // Kai drives the orange coupe. It is the parked Fathom, now his, on
    // the zebra crossing.
    const coupe = G.traffic.parked.find((c) => c.name === 'Fathom') || G.traffic.parked[2];
    coupe.mesh.visible = true;
    coupe.x = -250; coupe.z = 0; coupe.heading = Math.PI; coupe.speed = 24.44; coupe.condition = 100;
    p.car = coupe; p.onFoot = false; p.group.visible = false;
    p.heading = Math.PI;
    G.radioStation = 2; // SOLARA 98.3
    G.wanted.stars = 1; G.wanted.evading = 0; G.wanted.status = 'IN SIGHT';
    clearPolice(G);
    for (const c of G.traffic.parked) if (c !== coupe) c.mesh.visible = false;
    // The traffic cluster ahead: taxi, van, pickup, red bike, two sedans.
    const lineup = [
      { kind: 'taxi', color: 0x2a9d8f, x: -254, z: -30 },
      { kind: 'van', color: 0xd8d8d8, x: -242, z: -52 },
      { kind: 'pickup', color: 0x2a9d8f, x: -254, z: -74 },
      { kind: 'motorcycle', color: 0xc02020, x: -246, z: -18 },
      { kind: 'sedan', color: 0x2a5db0, x: -242, z: -96 },
      { kind: 'sedan', color: 0xc03028, x: -254, z: -118 },
    ];
    for (let i = 0; i < lineup.length && i < G.traffic.cars.length; i++) {
      const c = G.traffic.cars[i];
      c.mesh.visible = true;
      c.x = lineup[i].x; c.z = lineup[i].z; c.heading = Math.PI; c.speed = 0;
    }
    for (let i = lineup.length; i < G.traffic.cars.length; i++) G.traffic.cars[i].mesh.visible = false;
    // A pedestrian mid-flee on the east sidewalk, arms out.
    const ped = G.traffic.peds[0];
    ped.group.position.set(-239, 0, -14);
    ped.group.rotation.y = Math.PI / 2;
    ped.setFlee(true);
    for (let i = 1; i < G.traffic.peds.length; i++) G.traffic.peds[i].group.position.set(200, 0, 200);
    // Camera: rear three-quarter from the right, far enough to the side
    // that the front headlight reads as well as the red taillight strip.
    setCam(G, { x: -243, y: 2.8, z: 7 }, { x: -250, y: 1.0, z: -4 });
    G.hud.toast('CH.4 — stage 2/2 · 90 s', 'good');
  },

  '4-chase'(G) {
    G.hours = 19.32; G.money = 18450; G.respect = 400;
    G.missions.index = 7; G.missions.stage = 0; G.missions.resetTimer();
    const p = G.player;
    // The coupe sits just east of the road centre so the centred dialogue
    // does not cover it; the heli hangs above it.
    const coupe = G.traffic.parked.find((c) => c.name === 'Fathom') || G.traffic.parked[2];
    coupe.mesh.visible = true;
    coupe.x = -244; coupe.z = 20; coupe.heading = Math.PI; coupe.speed = 12; coupe.condition = 100;
    p.car = coupe; p.onFoot = false; p.group.visible = false;
    p.heading = Math.PI;
    G.radioStation = 0;
    G.wanted.stars = 4; G.wanted.evading = 0; G.wanted.status = 'IN SIGHT';
    clearPolice(G);
    // The helicopter: above the road, centred in the sky over the coupe,
    // its cone and ellipse on the road around the car.
    const heli = G.police.spawnHeli();
    heli.group.position.set(-250, 20, 0);
    heli.group.scale.setScalar(1.25);
    G.police.layoutHeli();
    // A few cruisers in the cluster for the PCPD panel.
    placeCruiserAt(G, 'PELICAN-11', 42, Math.PI - 0.4, 'PURSUIT', 42);
    placeCruiserAt(G, 'MANTA-32', 88, Math.PI + 0.5, 'SEARCHING', 88);
    placeCruiserAt(G, 'BARRACUDA-18', 150, Math.PI - 0.15, 'SEARCHING', 150);
    for (const c of G.traffic.parked) if (c !== coupe) c.mesh.visible = false;
    // Traffic cluster in the spotlight.
    const spots = [[-254, -8, 0], [-244, -16, 0], [-254, -28, 0], [-243, 4, 0]];
    for (let i = 0; i < 4 && i < G.traffic.cars.length; i++) {
      const c = G.traffic.cars[i];
      c.mesh.visible = true;
      c.x = spots[i][0]; c.z = spots[i][1]; c.heading = Math.PI; c.speed = 0;
    }
    for (let i = 4; i < G.traffic.cars.length; i++) G.traffic.cars[i].mesh.visible = false;
    for (const ped of G.traffic.peds) ped.group.position.set(200, 0, 200);
    // Two street-level neon signs on the east sidewalk, facing the
    // camera, so the neon reads clearly at full frame.
    streetNeon(G, "MO'S", '#ff5fa2', -240, 11, -8, -0.35);
    streetNeon(G, 'SOLARA', '#39e6c3', -262, 11, -20, 0.06);
    // Camera: low behind the coupe, west of the road centre and looking
    // north-east up the street, so the heli sits upper-third over the
    // road and the east buildings' neon faces read at an angle.
    setCam(G, { x: -258, y: 2.5, z: 44 }, { x: -244, y: 14, z: -5 });
  },
};

export function applyShot(G, name) {
  const fn = SHOTS[name];
  if (!fn) return false;
  G.shotMode = name;
  G.traffic.frozen = true;
  G.police.frozen = true;
  fn(G);
  // The beacon follows the staged mission target (otherwise it sits on
  // the old pier target and can swallow the shot's subject). In shot mode
  // the beacon itself is hidden — it is a gameplay aid, and its bright
  // pillar would read as a spotlight and wash out the frame.
  const bt = G.missions.currentStage.target;
  G.world.beacon.beam.position.set(bt.x, 30, bt.z);
  G.world.beacon.ring.position.set(bt.x, 0.08, bt.z);
  G.world.beacon.beam.visible = false;
  G.world.beacon.ring.visible = false;
  // Let the world settle (sky, lamps, HUD) over a few frames, then flag ready.
  G.world.update(G.hours);
  G.traffic.setDusk(G.duskT);
  G.hud.refreshAll();
  let frames = 0;
  const tick = () => {
    frames++;
    G.world.update(G.hours);
    G.traffic.setDusk(G.duskT);
    if (frames >= 6) {
      window.__solaraShotReady = true;
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
}

export const SHOT_NAMES = Object.keys(SHOTS);
