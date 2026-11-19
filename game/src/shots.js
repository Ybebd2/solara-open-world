// Shots — frozen staged renders of the live game for the dossier. Each
// shot positions Kai, the camera, the PCPD, traffic and the HUD, then
// raises __solaraShotReady. The game loop is frozen while a shot is
// staged (shotMode), so the frame the dossier captures is exactly this.
// New top-3 details: shot 1 lifeguard tower / umbrella+towel / jogger /
// dog / food cart; shot 2 red motorcycle + second cruiser + fleeing peds;
// shot 3 green traffic light / crossing signal / pawn+diner signs / bus;
// shot 4 motel neon / more lit windows / faint stars / police-boat light.
import * as THREE from '../vendor/three.module.min.js';

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}
function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

// A simple pedestrian figure (for joggers, fleeing peds, the dog).
export function makePed(opts = {}) {
  const g = new THREE.Group();
  const shirt = lam(opts.shirt || 0xf2c14e);
  const pants = lam(opts.pants || 0x2a3a5c);
  const skin = lam(0xc68e5e);
  const torso = box(0.5, 0.65, 0.3, shirt);
  torso.position.y = 1.0;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.55;
  g.add(head);
  const legL = box(0.18, 0.65, 0.2, pants);
  legL.position.set(-0.13, 0.33, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.13;
  g.add(legR);
  const armL = box(0.14, 0.5, 0.16, shirt);
  armL.position.set(-0.34, 1.05, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.34;
  g.add(armR);
  if (opts.flee) {
    // Arms thrown out mid-flee.
    armL.rotation.z = 1.2; armL.position.set(-0.5, 1.3, 0);
    armR.rotation.z = -1.2; armR.position.set(0.5, 1.3, 0);
    g.rotation.y = opts.rot || 0;
  }
  if (opts.jogger) {
    // Running pose: one leg forward, one back.
    legL.rotation.x = 0.6; legL.position.z = 0.2;
    legR.rotation.x = -0.6; legR.position.z = -0.2;
    armL.rotation.x = -0.8; armR.rotation.x = 0.8;
  }
  g.position.set(opts.x || 0, 0, opts.z || 0);
  if (opts.rotY) g.rotation.y = opts.rotY;
  return g;
}

export function makeDog(x, z) {
  const g = new THREE.Group();
  const fur = lam(0x8b5a2b);
  const body = box(0.7, 0.35, 0.35, fur);
  body.position.y = 0.45;
  g.add(body);
  const head = box(0.3, 0.3, 0.3, fur);
  head.position.set(0.45, 0.6, 0);
  g.add(head);
  const ear = box(0.12, 0.2, 0.08, lam(0x5a3a1a));
  ear.position.set(0.4, 0.8, 0.12);
  g.add(ear);
  for (const [dx, dz] of [[-0.25, -0.12], [0.25, -0.12], [-0.25, 0.12], [0.25, 0.12]]) {
    const leg = box(0.1, 0.35, 0.1, fur);
    leg.position.set(dx, 0.18, dz);
    g.add(leg);
  }
  const tail = box(0.3, 0.08, 0.08, fur);
  tail.position.set(-0.45, 0.6, 0);
  tail.rotation.z = 0.5;
  g.add(tail);
  g.position.set(x, 0, z);
  return g;
}

function setCam(game, px, py, pz, lx, ly, lz) {
  game.camera.position.set(px, py, pz);
  game.camera.lookAt(lx, ly, lz);
  game.shotCamera = { pos: [px, py, pz], look: [lx, ly, lz] };
}

function clearShotPeds(game) {
  if (!game.shotPeds) game.shotPeds = [];
  for (const p of game.shotPeds) game.scene.remove(p);
  game.shotPeds = [];
}

function addPed(game, ped) {
  game.scene.add(ped);
  game.shotPeds.push(ped);
}

export function applyShot(name, game) {
  const g = game;
  g.shotMode = name;
  clearShotPeds(g);
  g.hud.showOverlay(null);
  // Reset police to a clean slate for staging.
  for (const c of [...g.police.cruisers]) { g.scene.remove(c.mesh); }
  g.police.cruisers = [];
  for (const o of [...g.police.officers]) g.police.removeOfficer(o);
  if (g.police.heli) g.police.removeHeli();

  if (name === '1-start') {
    // Kai on foot, Beach Road, pistol two-hand aim, side profile.
    g.hours = 17.88; // 17:53
    g.money = 400;
    g.missions.index = 1;
    g.missions.stage = 2;
    g.missions.moveBeacon();
    g.player.group.position.set(-60, 0, 30);
    g.player.group.rotation.y = -Math.PI / 2; // facing west (pier)
    g.player.yaw = -Math.PI / 2;
    g.player.onFoot = true;
    g.player.car = null;
    g.player.group.visible = true;
    g.player.setWeapon(2);
    g.player.weaponAmmo = 12;
    g.wanted.stars = 0;
    g.wanted.evading = 0;
    g.wanted.inSight = false;
    // Target ped ~15 m west, red ring-dot crosshair on it.
    const target = makePed({ shirt: 0xe63946, x: -75, z: 30, rotY: Math.PI / 2 });
    addPed(g, target);
    // NEW: jogger + dog on the beach side, food cart near the pier,
    // lifeguard tower + umbrella + towel are already in the world.
    addPed(g, makePed({ shirt: 0xffffff, pants: 0x1a1a1a, jogger: true, x: -52, z: 44, rotY: Math.PI }));
    addPed(g, makeDog(-48, 48));
    addPed(g, makePed({ shirt: 0x2a9d8f, x: -70, z: 22, rotY: 0.6 }));
    // Camera: side profile from the south, Kai lower-third, full body.
    setCam(g, -58, 2.4, 36, -64, 1.3, 29);
    g.hud.setDialogue(
      'Lupe', 'FIXER · PIER SHACK',
      'Borrowed wheels, Kai. The coupe sits on Beach Road — bring it back clean.',
      'On it. Nobody even sees me coming.'
    );
    g.hud.toast('+$1,200 · +12 RESPECT');
    g.districts.update(-60, 30);
  } else if (name === '2-drive') {
    // Wanted 3 stars, PCPD 4 units, hero cruiser close, IN SIGHT.
    g.hours = 18.38; // 18:23
    g.money = 400;
    g.missions.index = 1;
    g.missions.stage = 2;
    g.missions.moveBeacon();
    g.player.group.position.set(-10, 0, 0);
    g.player.group.rotation.y = Math.PI;
    g.player.yaw = Math.PI;
    g.player.onFoot = true;
    g.player.car = null;
    g.player.group.visible = true;
    g.player.setWeapon(2);
    g.wanted.stars = 3;
    g.wanted.evading = 15;
    g.wanted.inSight = true;
    // PCPD units at the spec distances, statuses exact.
    const units = [
      { name: 'PELICAN-11', d: 39, status: 'PURSUIT', ang: 0.5 },
      { name: 'MANTA-32', d: 80, status: 'SEARCHING', ang: 2.2 },
      { name: 'BARRACUDA-18', d: 140, status: 'SEARCHING', ang: -1.1 },
      { name: 'GECKO-25', d: 37, status: 'WRECKED', ang: -2.4 },
    ];
    for (const u of units) {
      const c = g.police.spawnCruiser(-10, 0, 0);
      c.name = u.name;
      c.status = u.status;
      c.x = -10 + Math.sin(u.ang) * u.d;
      c.z = 0 + Math.cos(u.ang) * u.d;
      c.dir = Math.atan2(-10 - c.x, 0 - c.z);
      c.sync();
      if (u.status === 'WRECKED') {
        c.mesh.rotation.z = 0.22; // tipped, wrecked
        c.speed = 0;
      }
    }
    // Hero cruiser: the PURSUIT unit pulled close, three-quarter to camera.
    const hero = g.police.cruisers[0];
    hero.x = -2; hero.z = 14; hero.dir = Math.PI + 0.5; hero.sync();
    // NEW: red motorcycle + rider in traffic, second cruiser far behind,
    // two more peds fleeing on the sidewalk.
    const moto = g.traffic.cars.find((c) => c.type === 'motorcycle');
    if (moto) { moto.x = 18; moto.z = -3; moto.dir = 0; moto.sync(); }
    const far = g.police.spawnCruiser(-10, 0, 0);
    far.name = 'MANTA-32'; far.status = 'SEARCHING';
    far.x = -60; far.z = -60; far.dir = 0.7; far.sync();
    addPed(g, makePed({ shirt: 0xf2c14e, flee: true, x: -14, z: -13, rotY: 2.8 }));
    addPed(g, makePed({ shirt: 0x7fb3d5, flee: true, x: -4, z: -14, rotY: 3.4 }));
    setCam(g, -16, 3.2, 18, -6, 1.2, 9);
    g.hud.setDialogue('Lupe', 'FIXER · PIER SHACK', 'Three stars and they still can\'t catch you. Keep moving.', '');
    g.districts.update(-10, 0);
  } else if (name === '3-mission') {
    // Dusk coupe, headlights + traffic cluster, zebra crossing.
    g.hours = 18.8; // 18:48
    g.money = 400;
    g.missions.index = 2;
    g.missions.stage = 2;
    g.missions.moveBeacon();
    // Player in the orange coupe, 88 km/h, G3, radio SOLARA 98.3.
    const coupe = g.traffic.parked.find((c) => c.type === 'coupe') || g.traffic.parked[0];
    coupe.x = 0; coupe.z = 0; coupe.dir = Math.PI / 2; coupe.sync();
    g.player.car = coupe;
    g.player.onFoot = false;
    g.player.group.visible = false;
    g.player.group.position.set(0, 0, 0);
    coupe.speed = 24.4; // 88 km/h
    g.radioIdx = 2; // SOLARA 98.3
    g.wanted.stars = 0;
    g.wanted.evading = 0;
    // Traffic cluster around the coupe (taxi, van, pickup, motorcycle,
    // sedans, and the NEW city bus).
    const place = [
      { type: 'taxi', x: -14, z: -6, dir: Math.PI / 2 },
      { type: 'van', x: -22, z: 5, dir: Math.PI / 2 },
      { type: 'pickup', x: 12, z: -7, dir: -Math.PI / 2 },
      { type: 'motorcycle', x: 8, z: 6, dir: Math.PI / 2 },
      { type: 'sedan', x: 20, z: -4, dir: -Math.PI / 2 },
      { type: 'sedan', x: -6, z: 8, dir: Math.PI / 2 },
      { type: 'bus', x: 28, z: 7, dir: -Math.PI / 2 },
    ];
    place.forEach((p, i) => {
      const car = g.traffic.cars[i % g.traffic.cars.length];
      if (!car) return;
      // Swap the mesh type by rebuilding is overkill — reposition the
      // existing cars; the types are already varied in the fleet.
      car.x = p.x; car.z = p.z; car.dir = p.dir; car.speed = 0; car.sync();
    });
    // Ped mid-flee on the zebra crossing, arms out.
    addPed(g, makePed({ shirt: 0xe63946, flee: true, x: -2, z: -2, rotY: 1.2 }));
    addPed(g, makePed({ shirt: 0x2e7d5b, x: 6, z: 10, rotY: -0.8 }));
    // Camera: high behind the coupe, traffic + storefronts in frame.
    // The pawn/diner signs and the green traffic light are in the world
    // at Downtown (x 20–60, z -31) — frame them behind the coupe.
    setCam(g, -4, 5, 11, 2, 1.0, -4);
    g.hud.setDialogue('Lupe', 'FIXER · PIER SHACK', 'Collect from the three stalls on Sunset Strip. No receipts.', '');
    g.districts.update(0, 0);
  } else if (name === '4-chase') {
    // Nightfall: helicopter upper-third, 4 stars, neon, dusk 19:19.
    g.hours = 19.32; // 19:19
    g.money = 400;
    g.missions.index = 3;
    g.missions.stage = 3;
    g.missions.moveBeacon();
    const coupe = g.traffic.parked.find((c) => c.type === 'coupe') || g.traffic.parked[0];
    coupe.x = 0; coupe.z = 0; coupe.dir = Math.PI; coupe.sync();
    g.player.car = coupe;
    g.player.onFoot = false;
    g.player.group.visible = false;
    g.player.group.position.set(0, 0, 0);
    coupe.speed = 18; // 65 km/h
    g.radioIdx = 0; // PUERTO 88.3
    g.wanted.stars = 4;
    g.wanted.evading = 22;
    g.wanted.inSight = true;
    // Helicopter overhead, upper-third.
    const heli = g.police.spawnHeli(0, -6);
    heli.group.position.set(20, 28, -25);
    // A cruiser in frame in pursuit behind the coupe.
    const c = g.police.spawnCruiser(0, 0, Math.PI);
    c.name = 'PELICAN-11'; c.status = 'PURSUIT';
    c.x = -4; c.z = 12; c.dir = Math.PI; c.sync();
    // Camera low behind the coupe, looking up the street at the neon
    // (MO'S + SOLARA + the NEW motel sign) and the heli.
    setCam(g, -4, 4, 16, 2, 6, -12);
    g.hud.setDialogue('Marco', 'DRIVER · NORTH GATE', 'Ninety seconds. The tide waits for no one.', '');
    g.districts.update(0, 0);
  }

  // Freeze the loop in shot mode and signal readiness.
  g.hud.update(g);
  g.shotReady = true;
  if (typeof window !== 'undefined') window.__solaraShotReady = true;
}
