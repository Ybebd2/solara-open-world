// SOLARA — player: Kai Mercer on foot, car entry/exit, carjacking,
// shooting. The shooting ray starts at the player's chest and runs in
// the camera's facing direction flattened to horizontal; ray.camera is
// always set (Sprite raycasting needs it). While driving, shots
// originate from the car, never from the stale on-foot position.
// Built fresh for the @witty-meteor-32 build.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, clamp, dist2d } from './config.js';

export class Player {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.onFoot = true;
    this.car = null;
    this.heading = Math.PI / 2; // facing east, toward the city
    this.speed = 0;
    this.health = 100;
    this.armour = 50; // vest: absorbs damage before health does
    this.group = new THREE.Group();
    // Body: vivid orange jacket (Kai's colour — no pedestrian wears it,
    // so the protagonist reads at a glance), head, red cap, arms, legs.
    const jacket = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.7 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xc22e2e, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), jacket);
    torso.position.y = 1.05; torso.castShadow = true; this.group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.y = 1.72; head.castShadow = true; this.group.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12), capMat);
    cap.position.y = 1.92; this.group.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.3), capMat);
    brim.position.set(0, 1.88, -0.28); this.group.add(brim);
    // Arms are stored (with their rest pose) so the aim pose can swing
    // them forward into a two-hand pistol grip — and back again. Bare
    // forearms (skin, not jacket): in the aim pose the extended arms
    // read as skin against the orange jacket, so the two-hand grip is
    // legible from behind instead of vanishing into the torso. The
    // arms are thick (0.2 m) and splayed wide so the forearms angle
    // down-forward to the grip and stay visible BELOW the silver
    // slide instead of being swallowed by it.
    this.armL = null; this.armR = null;
    this.armRest = {};
    for (const ax of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), skin);
      arm.position.set(ax * 0.39, 1.05, 0);
      this.group.add(arm);
      if (ax < 0) this.armL = arm; else this.armR = arm;
      this.armRest[ax < 0 ? 'L' : 'R'] = { x: arm.position.x, y: arm.position.y, z: arm.position.z, rx: 0, rz: 0 };
    }
    // Pistol, hidden until the aim pose: bright silver slide + grip,
    // held out in front of the chest so the gun silhouette reads from
    // behind — the camera sits over Kai's right shoulder when he aims.
    // The gun is oversized on purpose (1.3 m slide, chunky
    // cross-section, near-white silver) and pushed out to Kai's right,
    // angled across the camera's view so its length reads instead of
    // foreshortening to a dot. The slide is silver, not glowing white:
    // a dark barrel rib on top and a big dark grip hanging below give
    // the classic pistol L-silhouette; the forearms reach down-forward
    // to the grip so they stay visible below the slide instead of
    // being swallowed by it.
    // (A dead-behind camera hid the 0.8 m gun behind the torso as a
    // 2 px sliver — the shot-1 camera now sits over the shoulder so
    // the pistol + splayed arms read in profile.)
    const gunMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f5, roughness: 0.25, metalness: 0.7, emissive: 0x77777f, emissiveIntensity: 0.55 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.6, metalness: 0.2 });
    this.pistol = new THREE.Group();
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 1.3), gunMat);
    slide.position.set(0, 0.06, 0); this.pistol.add(slide);
    // Dark barrel rib along the top of the slide + front sight: the
    // detail that makes the white bar read as a gun, not a plank.
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.1), gripMat);
    rib.position.set(0, 0.2, -0.05); this.pistol.add(rib);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.08), gripMat);
    sight.position.set(0, 0.22, -0.55); this.pistol.add(sight);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.22), gripMat);
    grip.position.set(0, -0.22, 0.28); grip.rotation.x = 0.25; this.pistol.add(grip);
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.28), gripMat);
    muzzle.position.set(0, 0.06, -0.66); this.pistol.add(muzzle);
    this.pistol.position.set(0.62, 1.32, -0.85);
    this.pistol.rotation.y = -0.3; // barrel angled across the camera view
    this.pistol.visible = false;
    this.group.add(this.pistol);
    this.aiming = false;
    for (const lx of [-0.16, 0.16]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.28), pants);
      leg.position.set(lx, 0.38, 0); this.group.add(leg);
    }
    this.group.position.set(-200, 0, WORLD.pier.z);
    scene.add(this.group);
    this.raycaster = new THREE.Raycaster();
    // Weapon state: 1 FISTS (∞), 2 VESPER pistol (12 mag), 3–5 locked.
    this.weapon = 1;
    this.weaponAmmo = 12; // VESPER mag — shooting spends it (12→11)
    this.weaponLocked = [false, false, true, true, true];
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  // Teleport on foot: position + facing, group rotation synced.
  setPos(x, z) {
    this.group.position.set(x, 0, z);
    this.updateGroup();
  }

  // Sync the visible group to the current heading (rotation only).
  updateGroup() {
    this.group.rotation.y = this.heading + Math.PI;
  }

  // Select a weapon slot. Locked slots (3–5) refuse — the HUD keeps
  // them greyed out until earned. Selecting the pistol shows the gun.
  setWeapon(n) {
    if (n < 1 || n > 5) return;
    if (this.weaponLocked[n - 1]) return;
    this.weapon = n;
    if (n === 2) this.setAim(true);
    else this.setAim(false);
  }

  // Aim pose: both arms swing forward into a two-hand grip and the
  // pistol comes out at chest height, offset to Kai's right so the gun
  // reads from the over-the-shoulder camera instead of hiding behind
  // his torso. Shot 1 stages this; live play never aims (yet).
  setAim(on) {
    this.aiming = !!on;
    if (!this.armL || !this.armR) return;
    if (on) {
      // Right (firing) arm extended forward and DOWN to the grip, left
      // arm forward too, supporting from below. Rotation pivots are the
      // arm centres, so the positions move the arms out in front of
      // the chest. rotation.x is POSITIVE: in three.js a +x rotation
      // swings the hanging (-y) arm forward into local -z; a negative
      // value would point the arms backward at the camera instead of
      // at the target. The hands must land ON the grip: the grip hangs
      // below the slide at local (0.62, ~1.1, -0.57), so the hands sit
      // low and forward. rotation.z is POSITIVE on both arms and
      // larger than before: the hand is the -y end, so a positive
      // z-tilt swings the hand toward the pistol on Kai's right, and
      // the wider splay keeps the elbows out of the torso silhouette
      // so the forearms read as two separate bars.
      this.armR.position.set(0.48, 1.3, -0.3);
      this.armR.rotation.set(1.5, 0, 0.5);
      // Left arm comes up from below: lower centre, wider splay, so its
      // forearm reads as a second diagonal bar under the slide instead
      // of hiding behind the right arm. Its hand cups the grip from
      // below-left.
      this.armL.position.set(0.05, 1.15, -0.25);
      this.armL.rotation.set(1.35, 0, 1.1);
      this.pistol.visible = true;
    } else {
      for (const [arm, key] of [[this.armL, 'L'], [this.armR, 'R']]) {
        const r = this.armRest[key];
        arm.position.set(r.x, r.y, r.z);
        arm.rotation.set(r.rx, 0, r.rz);
      }
      this.pistol.visible = false;
    }
  }

  // Chest position — the origin of every shot. While driving it is the
  // car's position (never the stale on-foot spot left behind when
  // entering a car).
  chestPos() {
    if (!this.onFoot && this.car) {
      return new THREE.Vector3(this.car.x, 1.3, this.car.z);
    }
    return new THREE.Vector3(this.group.position.x, 1.35, this.group.position.z);
  }

  enterCar(car) {
    this.car = car;
    this.onFoot = false;
    this.group.visible = false;
    this.group.position.set(car.x, 0, car.z);
  }

  exitCar() {
    if (!this.car) return;
    const c = this.car;
    const sx = c.x - Math.sin(c.heading) * 2.6;
    const sz = c.z - Math.cos(c.heading) * 2.6;
    this.group.position.set(clamp(sx, -260, 195), 0, clamp(sz, -195, 195));
    this.group.visible = true;
    this.onFoot = true;
    this.car = null;
  }

  update(dt, input) {
    if (!this.onFoot) return;
    let mx = 0, mz = 0;
    if (input.forward) mz -= 1;
    if (input.back) mz += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      // Move relative to camera yaw.
      const yaw = this.camYaw || 0;
      const wx = mx * Math.cos(yaw) - mz * Math.sin(yaw);
      const wz = mx * Math.sin(yaw) + mz * Math.cos(yaw);
      const walk = input.sprint ? 9 : 5.2;
      this.group.position.x = clamp(this.group.position.x + wx * walk * dt, -268, 196);
      this.group.position.z = clamp(this.group.position.z + wz * walk * dt, -196, 196);
      this.speed = walk;
      this.heading = Math.atan2(wx, wz);
      // Front is local -z (cap brim at -0.28): rotation.y = heading + PI
      // points the face along the walk direction.
      this.group.rotation.y = this.heading + Math.PI;
      // Walk bob.
      const t = performance.now() / 90;
      this.group.position.y = Math.abs(Math.sin(t)) * 0.05;
    } else {
      this.speed = 0;
      this.group.position.y = 0;
    }
  }

  // Build the shooting ray: origin = chest, direction = camera facing
  // flattened to horizontal (a centre-screen ray would dive below ground).
  aimRay() {
    const origin = this.chestPos();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) dir.set(0, 0, -1);
    dir.normalize();
    this.raycaster.set(origin, dir);
    this.raycaster.camera = this.camera; // Sprite raycasting needs this
    this.raycaster.far = 90;
    return this.raycaster;
  }

  distTo(x, z) { return dist2d(this.x, this.z, x, z); }
}
