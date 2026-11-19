// SOLARA — shots: the four dossier shots. The game freezes its loop in
// shot mode (main.renderShot stops the clock) so every shot is a still.
// Staging is pure geometry + HUD state: shot 1/2 are Kai-first, shot 4
// is sky-first; no shot is car-only. Built fresh for the
// @witty-meteor-32 build.
import { dist2d } from './config.js';

export class Shots {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    // Shot 1: Kai on foot at the BEACH ROAD curb, arms in two-hand aim
    // toward an officer 18 m north. Camera WEST of Kai, LOW (1.15 m),
    // looking east-north — a profile view, so the bright silver pistol
    // and BOTH extended arms read clearly at full frame.
    // (Dead-behind camera hid the gun as a 2 px sliver behind the torso.)
    this.s1 = {
      camPos: [-162.3, 1.15, 5.2],
      lookAt: [-160.2, 1.35, 28],
      player: { x: -160, z: 10, heading: 0 }, // facing +z (north), toward the officer
      officer: { x: -160, z: 28 },
      clock: 17.5, // 17:30 golden hour
      ammo: 71, // one shot fired from the 72 mag
      missionIndex: 1, // CH.2 · BORROWED WHEELS
      dialogue: 'Borrow my coupe, Kai. Bring her back without a scratch — or don’t come back.',
      dialogueRole: 'FIXER · PIER SHACK',
      reply: 'On it, Lupe. No scratch — I promise nothing.',
      toast: 'JOB DONE — +$1,200 · +12 respect · +240 RP',
    };
    // Shot 2: 3★ wanted, white cruiser 3/4 toward Kai, staged PCPD rows.
    this.s2 = {
      camPos: [-159.5, 1.6, 40],
      lookAt: [-160, 1.5, 48],
      player: { x: -163, z: 44, heading: Math.PI / 2 }, // facing +x (east), toward the cruiser
      cruiser: { x: -156.5, z: 48, heading: -2.12 },
      officer: { x: -159, z: 46 },
      clock: 18.1,
      stars: 3,
      evading: 15,
      hidden: false,
      stagedUnits: [
        { name: 'PELICAN-11', dist: 39, status: 'PURSUIT' },
        { name: 'MANTA-32', dist: 80, status: 'SEARCHING' },
        { name: 'BARRACUDA-18', dist: 140, status: 'SEARCHING' },
        { name: 'GECKO-25', dist: 37, status: 'WRECKED' },
      ],
    };
    // Shot 3: dusk coupe, ~45° above-behind, 88 km/h, G3, dense traffic.
    // Camera southwest of the coupe looking northeast up the beach
    // road: front 3/4 (headlights toward the lens), cluster ahead.
    this.s3 = {
      camPos: [-166, 3.2, 53],
      lookAt: [-161, 1, 61],
      car: { x: -161.75, z: 60, heading: Math.PI - 0.3, speed: 24.4 },
      clock: 18.5,
    };
    // Shot 4: heli + nightfall, 4★. Heli low (8 m) and close so it sits
    // in the upper third BELOW the top-center PCPD panel (which would
    // occlude its rotor), and the coupe sits in the spotlight pool
    // directly beneath it. Camera further back so both fit the frame.
    this.s4 = {
      camPos: [-155, 7, 38],
      lookAt: [-161.5, 4, 58],
      car: { x: -163.5, z: 53, heading: Math.PI, speed: 0 },
      clock: 19.33, // 19:20
      stars: 4,
      heli: { x: -163, y: 8, z: 52 },
      stagedUnits: [
        { name: 'PELICAN-11', dist: 42, status: 'PURSUIT' },
        { name: 'MANTA-32', dist: 88, status: 'SEARCHING' },
        { name: 'BARRACUDA-18', dist: 150, status: 'SEARCHING' },
        { name: 'AIR-1', dist: 6, status: 'AIR' },
      ],
    };
    this.clusterAnchorZ = 55; // car cluster anchored on BEACH ROAD
  }

  // Move a vehicle to an exact pose: snap position + heading, clear
  // physics, rebuild mesh. Used by the parked-car cluster in shots 3/4.
  // (Car.x/z are getters on mesh.position — set the mesh, never v.x.)
  placeVehicle(v, x, z, heading) {
    v.heading = heading;
    v.speed = 0; v.velX = 0; v.velZ = 0; v.throttle = 0;
    v.parked = false;
    if (v.mesh) v.mesh.position.set(x, 0.3, z);
    if (v.mesh) v.mesh.rotation.y = heading + Math.PI;
    if (v.updateLights) v.updateLights();
  }

  // Clear all wanted heat and police, then restore stars if given.
  resetPolice() {
    const p = this.game.police;
    const g = this.game;
    g.wanted.clear();
    p.removeAll();
    p.airDeployed = false;
  }

  // Hide every traffic car and scooter inside a world-space corridor —
  // shot 1 must have NO car in frame, and the random parked/moving
  // traffic can otherwise wander onto the beach road in the shot's
  // view. Shot mode only; live play never calls this.
  hideCorridor(x0, x1, z0, z1) {
    const g = this.game;
    for (const c of g.traffic.cars) {
      if (c.x >= x0 && c.x <= x1 && c.z >= z0 && c.z <= z1) c.mesh.visible = false;
    }
    for (const s of g.traffic.scooters) {
      const mx = s.mesh.position.x, mz = s.mesh.position.z;
      if (mx >= x0 && mx <= x1 && mz >= z0 && mz <= z1) s.mesh.visible = false;
    }
  }

  // A busy BEACH ROAD cluster parked just north of the shot anchor:
  // taxi (with yellow roof sign), boxy van, single-cab pickup (flat
  // black bed, red square taillights), red motorcycle + rider, plus
  // two sedans — six distinct types in one frame, bumper gaps 2–4 m.
  // `zOff` shifts the whole cluster north so every car sits in front
  // of the shot camera (shot 3's camera is at z=57 — the unshifted
  // cluster would be behind it). Returns { fleePed } — one pedestrian
  // mid-flee, arms out.
  clusterCars(zOff = 0) {
    const g = this.game;
    const list = [];
    const slots = [
      { type: 'taxi', x: -165.25, z: 52.0 + zOff },
      { type: 'van', x: -161.75, z: 64.0 + zOff }, // clear of the coupe (z 58–62)
      { type: 'pickup', x: -158.25, z: 56.0 + zOff },
      { type: 'motorcycle', x: -154.75, z: 57.5 + zOff },
      { type: 'sedan', x: -165.25, z: 61.0 + zOff },
      { type: 'sedan', x: -158.25, z: 62.5 + zOff },
    ];
    for (const s of slots) {
      const v = g.traffic.spawnParkedAt(s.type, s.x, s.z, Math.PI);
      if (v) list.push(v);
    }
    const fleePed = g.world.addFleePed(-158, 62 + zOff);
    return { list, fleePed };
  }

  // A parked cruiser placed so the shot camera sees it 3/4 toward Kai:
  // heading -2.12 turns its nose toward the player at (-163, 44) — the
  // white sedan, BLACK hood/roof, thin gold side line, RED light bar,
  // square white headlights ON.
  placeCruiserForShot() {
    const g = this.game;
    return g.police.spawnCruiserAt(-156.5, 48, -2.12);
  }

  // Shot 1: Kai on foot, pistol raised in two-hand aim. The camera sits
  // west of Kai (x=-162.3) and low (y=1.15) looking east-north — a
  // profile shot, so the 1.3 m bright silver pistol and both extended
  // arms read clearly at full frame. One shot fired: VESPER 9 · 71.
  stage1() {
    const g = this.game, s = this.s1;
    this.resetPolice();
    g.wanted.clear();
    g.player.setPos(s.player.x, s.player.z);
    g.player.heading = s.player.heading;
    g.player.setWeapon(2);
    g.player.weaponAmmo = s.ammo;
    g.player.setAim(true);
    const officer = g.police.spawnOfficerAt(s.officer.x, s.officer.z);
    g.missions.index = s.missionIndex;
    g.missions.startMission(s.missionIndex);
    g.hours = s.clock;
    g.money = 1250;
    g.respect = 67;
    // No car in frame: hide any random traffic that wandered onto the
    // beach road inside the shot's view corridor (the camera looks
    // north up the road, so the corridor runs to z=70 — a car at z=45
    // still shows as a teal speck on the asphalt).
    this.hideCorridor(-172, -150, 0, 70);
    g.hud.say(s.dialogue, 'Lupe', s.dialogueRole);
    g.hud.reply(s.reply);
    g.hud.toast(s.toast);
    g.player.updateGroup();
    g.setCamera(s.camPos, s.lookAt);
  }

  // Shot 2: wanted 3★ — the cruiser 3/4 toward Kai, PCPD rows staged,
  // IN SIGHT red pill, EVADING 15%, minimap search circle + red edge.
  stage2() {
    const g = this.game, s = this.s2;
    this.resetPolice();
    g.player.setPos(s.player.x, s.player.z);
    g.player.heading = s.player.heading;
    g.player.setWeapon(2);
    g.player.setAim(true);
    g.wanted.stars = s.stars;
    g.wanted.evading = s.evading;
    g.wanted.hidden = s.hidden;
    g.wanted.searching = true;
    const c = this.placeCruiserForShot();
    const officer = g.police.spawnOfficerAt(s.officer.x, s.officer.z);
    g.police.stagedUnits = s.stagedUnits.slice();
    g.missions.index = 1;
    g.missions.startMission(1);
    g.hours = s.clock;
    g.money = 1250;
    g.respect = 67;
    // The mission-start toast would cover the 4th PCPD row — hide it.
    g.hud.hideToast();
    g.hud.say('They’re all over the beach road, Kai. Lose them — or lose the coupe.', 'Lupe');
    g.player.updateGroup();
    g.setCamera(s.camPos, s.lookAt);
  }

  // Shot 3: dusk coupe at 88 km/h, G3, 100% CONDITION, headlights ON
  // (white squares + beam pools), taillight strip ON, traffic cluster.
  // Camera southwest of the coupe, looking northeast up the beach
  // road: the coupe reads big in a front 3/4 (headlights toward the
  // lens), the cluster sits ahead of it in frame, the zebra is under
  // the car. The coupe is angled slightly (heading π−0.3) so its
  // long side reads across the frame.
  stage3() {
    const g = this.game, s = this.s3;
    this.resetPolice();
    g.wanted.clear();
    const car = g.playerCar; // Kai's own coupe (player.car is null on foot)
    this.placeVehicle(car, s.car.x, s.car.z, s.car.heading);
    car.speed = s.car.speed;
    car.gear = 3; // drive() never runs in shot mode — set the gear directly
    car.throttle = 1;
    g.player.enterCar(car);
    g.hours = s.clock;
    g.station = 2; // SOLARA 98.3 · Night Drive
    g.songIdx = 0;
    this.clusterCars(6); // just north of the coupe, in frame ahead of it
    g.missions.index = 3;
    g.missions.startMission(3);
    g.hud.say('Ninety seconds, Kai. The gate does not wait.', 'Marco');
    g.hud.hideToast();
    g.player.updateGroup();
    g.setCamera(s.camPos, s.lookAt);
  }

  // Shot 4: heli + nightfall, 4★. Heli at (-162, 9.5, 56) with its
  // spotlight cone on the coupe; street lamps lit; neon on.
  stage4() {
    const g = this.game, s = this.s4;
    this.resetPolice();
    g.wanted.stars = s.stars;
    g.wanted.evading = 0;
    g.wanted.hidden = false;
    g.wanted.searching = false;
    const car = g.playerCar; // Kai's own coupe (player.car is null on foot)
    this.placeVehicle(car, s.car.x, s.car.z, s.car.heading);
    g.player.enterCar(car);
    const heli = g.police.spawnHeliAt(s.heli.x, s.heli.y, s.heli.z);
    g.police.setHeliSpot(8);
    g.police.stagedUnits = s.stagedUnits.slice();
    this.clusterCars();
    g.missions.index = 7;
    g.missions.startMission(7);
    g.hours = s.clock;
    g.money = 18450;
    g.respect = 400;
    // The mission-start toast would cover the PCPD panel — hide it.
    g.hud.hideToast();
    g.hud.say('The sky is full of rotors, Kai. Finish it — tonight.', 'Aurora');
    g.player.updateGroup();
    g.setCamera(s.camPos, s.lookAt);
  }

  // Distance helpers for the test harness.
  static dist(a, b) { return dist2d(a.x, a.z, b.x, b.z); }
}
