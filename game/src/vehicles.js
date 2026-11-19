// SOLARA — vehicles: shaped car meshes + arcade driving. Headlight
// halos ride a live dusk factor via setDusk(d). Re-authored for the
// @witty-meteor-32 recording-M build.
import * as THREE from '../vendor/three.module.min.js';
import { CAR_TYPES, clamp } from './config.js';

// Radial glow textures, drawn once on a canvas and shared.
function radialTexture(inner, mid, outer) {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const cx = cv.getContext('2d');
  const g = cx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, mid);
  g.addColorStop(1, outer);
  cx.fillStyle = g;
  cx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
const HALO_TEX = radialTexture('rgba(255,240,190,1)', 'rgba(255,210,110,0.55)', 'rgba(255,200,90,0)');
const TAIL_HALO_TEX = radialTexture('rgba(255,80,60,0.9)', 'rgba(220,40,30,0.45)', 'rgba(200,30,20,0)');
const BEAM_TEX = radialTexture('rgba(255,240,190,0.85)', 'rgba(255,220,140,0.35)', 'rgba(255,210,110,0)');

// Shaped car bodies: a low wedge sports coupe (4.2 x 1.9, roof ~1.1,
// black glasshouse, rounded wheel arches, 0.62 m wheels, lip spoiler),
// a three-box sedan (roof <= 1.4), a cab + open bed pickup, a tall van
// (roof ~1.9, the only boxy vehicle), and a white sedan police cruiser
// with a light bar. Every car reads as a car — hood, cabin, trunk,
// mirrors, grille, lamps — never a single box. Paint metalness stays
// 0.12 so colours read true instead of near-black.
export function makeCarMesh(typeKey, colorHex) {
  const type = CAR_TYPES[typeKey] || CAR_TYPES.sedan;
  const color = colorHex !== undefined ? colorHex : type.color;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.12 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.25, metalness: 0.4 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.2, metalness: 0.9 });
  const isPickup = typeKey === 'pickup';
  const isPolice = typeKey === 'police';
  const isSports = typeKey === 'sports';
  const isVan = typeKey === 'van';
  const low = isSports ? 0.82 : 1; // sports cars sit low and sleek

  const box = (w, h, d, mat, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    m.castShadow = true;
    g.add(m);
    return m;
  };

  if (isSports) {
    // Low wedge 2-door sports coupe (4.2 long x 1.9 wide, roof ~1.1):
    // a hood deck sloping down to the nose, a BLACK tinted glasshouse
    // distinct from the body, a short trunk deck and a small lip spoiler
    // only — never a wing. Pronounced rounded wheel arches over all
    // four wheels.
    box(1.9, 0.45, 4.2, bodyMat, 0, 0.45, 0); // lower body
    box(1.8, 0.16, 1.3, bodyMat, 0, 0.6, -1.45, -0.16); // hood deck, sloping to the nose
    box(1.9, 0.12, 0.25, darkMat, 0, 0.28, -2.0); // front splitter
    box(1.55, 0.45, 1.7, darkMat, 0, 0.88, 0.15); // black glasshouse, roof at ~1.1
    box(1.85, 0.14, 0.75, bodyMat, 0, 0.66, 1.72); // trunk deck
    box(1.7, 0.05, 0.22, darkMat, 0, 0.76, 2.05); // lip spoiler only
    box(0.1, 0.14, 3.4, darkMat, -0.98, 0.3, 0); // side skirts
    box(0.1, 0.14, 3.4, darkMat, 0.98, 0.3, 0);
    // Rounded wheel arches: half-torus lips over each wheel, body colour.
    const archGeo = new THREE.TorusGeometry(0.42, 0.09, 6, 12, Math.PI);
    for (const [ax, az] of [[-0.93, -1.45], [0.93, -1.45], [-0.93, 1.45], [0.93, 1.45]]) {
      const arch = new THREE.Mesh(archGeo, bodyMat);
      arch.rotation.y = Math.PI / 2;
      arch.position.set(ax, 0.36, az);
      arch.castShadow = true;
      g.add(arch);
    }
  } else if (isVan) {
    // Tall delivery van: the only boxy vehicle — slab body, roof ~1.9.
    box(2.0, 1.6, 4.4, bodyMat, 0, 1.0, 0);
    box(1.9, 0.1, 4.2, bodyMat, 0, 1.85, 0); // roof cap, top at 1.9
    const shield = box(1.7, 1.0, 0.1, darkMat, 0, 1.45, -2.0, -0.4);
    shield.castShadow = false;
    box(1.9, 0.5, 2.6, darkMat, 0, 1.35, 0.4); // side glass band
    box(0.06, 1.1, 0.06, darkMat, -1.01, 1.35, 0.4); // door seam, left
    box(0.06, 1.1, 0.06, darkMat, 1.01, 1.35, 0.4);
  } else {
    // Lower body + sloped hood + cabin + trunk deck (sedan / pickup /
    // police / taxi). Sedan roof stays at or under 1.4 m.
    box(2.0, 0.55 * low + 0.1, 4.4, bodyMat, 0, 0.55 * low, 0);
    box(1.9, 0.22, 1.5, bodyMat, 0, (0.88 * low), -1.45, -0.14); // hood slopes down to the nose
    if (isPickup) {
      box(1.9, 0.62, 1.5, bodyMat, 0, 1.12, -0.9); // cab
      box(1.9, 0.3, 2.2, darkMat, 0, 0.95, 1.2); // open bed
      box(1.9, 0.5, 0.15, bodyMat, 0, 1.05, 2.2); // tailgate
    } else {
      // Cabin with a raked windscreen and rear glass.
      box(1.75, 0.55 * low, 2.3, bodyMat, 0, 1.1 * low, -0.25);
      const shield = box(1.65, 0.5, 0.08, darkMat, 0, 1.12 * low, -1.32, -0.5);
      shield.castShadow = false;
      const rear = box(1.65, 0.45, 0.08, darkMat, 0, 1.12 * low, 0.82, 0.45);
      rear.castShadow = false;
      box(1.9, 0.26, 0.9, bodyMat, 0, 0.86 * low, 1.75); // trunk deck
    }
  }
  // Half-length: the sports coupe is 4.2 long, everything else 4.4.
  const halfLen = isSports ? 2.1 : 2.2;
  // Bumpers + grille.
  box(2.05, 0.22, 0.3, chromeMat, 0, 0.42, -halfLen - 0.08);
  box(2.05, 0.22, 0.3, chromeMat, 0, 0.42, halfLen + 0.08);
  box(1.2, 0.18, 0.08, darkMat, 0, 0.62, -halfLen - 0.02);
  // Side mirrors — small, but they sell "car" from every angle.
  const mirrorY = isSports ? 0.95 : 1.12 * low;
  const mirrorX = isSports ? 1.0 : 1.06;
  box(0.16, 0.12, 0.3, darkMat, -mirrorX, mirrorY, -0.85);
  box(0.16, 0.12, 0.3, darkMat, mirrorX, mirrorY, -0.85);
  // Wheels: fat cylinders that poke out of the arches, with pale hubs.
  // Sports coupe wheels are 0.62 m across (r 0.31), silver rims.
  const wheelR = isSports ? 0.31 : 0.38;
  const hubR = isSports ? 0.16 : 0.18;
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.3, metalness: 0.8 });
  for (const [wx, wz] of [[-0.98, -1.45], [0.98, -1.45], [-0.98, 1.45], [0.98, 1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, wheelR, wz);
    w.castShadow = true;
    g.add(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR, 0.32, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(wx, wheelR, wz);
    g.add(hub);
  }
  // Headlights + halo sprites (front = -z), taillights (rear). The
  // lamps are SQUARE white blocks — two bright squares ON at dusk, with
  // beam pools on the asphalt ahead.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 0.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0xaa1111, emissiveIntensity: 0.8 });
  const halos = [];
  const beamPools = [];
  for (const hx of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.08), lampMat);
    lamp.position.set(hx, 0.62, -halfLen - 0.02);
    g.add(lamp);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO_TEX, transparent: true, opacity: 0, depthWrite: false }));
    halo.scale.set(1.6, 1.6, 1);
    halo.position.set(hx, 0.62, -halfLen - 0.15);
    g.add(halo);
    halos.push(halo);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
    tail.position.set(hx, 0.62, halfLen + 0.02);
    g.add(tail);
    // Beam pool: a pale ellipse of headlight on the road ahead of each
    // lamp, fading with distance — visible at dusk, gone by day.
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 3.2),
      new THREE.MeshBasicMaterial({ map: BEAM_TEX, transparent: true, opacity: 0, depthWrite: false })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(hx, 0.06, -halfLen - 2.2);
    g.add(pool);
    beamPools.push(pool);
  }
  // Sports coupe only: a full-width RED taillight strip across the rear
  // with a soft red halo bleeding onto the bodywork.
  let tailHalo = null;
  if (isSports) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.06), tailMat);
    strip.position.set(0, 0.62, halfLen + 0.03);
    g.add(strip);
    tailHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TAIL_HALO_TEX, transparent: true, opacity: 0, depthWrite: false }));
    tailHalo.scale.set(2.4, 1.1, 1);
    tailHalo.position.set(0, 0.62, halfLen + 0.18);
    g.add(tailHalo);
  }
  if (isPolice) {
    // White sedan, BLACK hood + BLACK roof, thin GOLD side line, RED
    // roof light bar lit: reads as a cruiser from every angle, never a
    // plain white sedan.
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.35, metalness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0xcc8800, emissiveIntensity: 0.5, metalness: 0.6 });
    const hoodBlack = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.06, 1.5), blackMat);
    hoodBlack.position.set(0, 1.0, -1.45);
    hoodBlack.rotation.x = -0.14;
    g.add(hoodBlack);
    const roofBlack = new THREE.Mesh(new THREE.BoxGeometry(1.77, 0.06, 2.3), blackMat);
    roofBlack.position.set(0, 1.4, -0.25);
    g.add(roofBlack);
    for (const sx of [-1, 1]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 3.6), goldMat);
      line.position.set(sx * 1.01, 0.95, 0);
      g.add(line);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), darkMat);
    bar.position.set(0, 1.5, -0.25);
    g.add(bar);
    // RED light bar, both segments lit red — no blue on this force.
    // The reds sit PROUD of the dark base (y 1.62, on top of the bar
    // that tops at 1.59): flush-mounted reds were swallowed by the
    // base and read as a plain black roof.
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1.8 });
    for (const rx of [-0.28, 0.28]) {
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.46), redMat);
      red.position.set(rx, 1.64, -0.25);
      g.add(red);
    }
  }
  if (typeKey === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshStandardMaterial({ color: 0xffe23f, emissive: 0xddaa00, emissiveIntensity: 0.8 }));
    sign.position.set(0, 1.55, -0.25);
    g.add(sign);
  }
  return { group: g, halos, lampMat, tailHalo, beamPools };
}

// Red motorcycle + rider: two big wheels, a fuel tank, a long low frame,
// and a rider leaning forward in a red jacket. Faces -z like the cars.
export function makeMotorcycleMesh(colorHex) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: colorHex ?? 0xd93a3a, roughness: 0.35, metalness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.8 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.25, metalness: 0.8 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0xd93a3a, roughness: 0.8 });
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.14, 12);
  for (const wz of [-0.95, 0.95]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(0, 0.35, wz);
    w.castShadow = true;
    g.add(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 8), chrome);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(0, 0.35, wz);
    g.add(hub);
  }
  // Long low frame + fuel tank + seat.
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 1.9), dark);
  frame.position.set(0, 0.55, 0);
  frame.castShadow = true;
  g.add(frame);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.7), paint);
  tank.position.set(0, 0.78, -0.35);
  tank.castShadow = true;
  g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.7), dark);
  seat.position.set(0, 0.72, 0.45);
  g.add(seat);
  // Front fork + handlebar + headlight.
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 6), chrome);
  fork.position.set(0, 0.75, -0.95);
  fork.rotation.x = 0.35;
  g.add(fork);
  const bars = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), dark);
  bars.position.set(0, 1.08, -1.08);
  g.add(bars);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.08), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 1.2 }));
  lamp.position.set(0, 0.82, -1.05);
  g.add(lamp);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.06), new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0xaa1111, emissiveIntensity: 1 }));
  tail.position.set(0, 0.7, 1.02);
  g.add(tail);
  // Rider leaning forward: helmet, torso pitched to the bars, arms
  // forward, legs bent to the pegs.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.28), jacket);
  torso.position.set(0, 1.15, 0.35);
  torso.rotation.x = 0.5;
  torso.castShadow = true;
  g.add(torso);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.35 }));
  helmet.position.set(0, 1.55, 0.12);
  g.add(helmet);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.06), dark);
  visor.position.set(0, 1.53, -0.06);
  g.add(visor);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.62), jacket);
    arm.position.set(sx * 0.28, 1.32, -0.55);
    arm.rotation.x = 1.25;
    g.add(arm);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.5), dark);
    thigh.position.set(sx * 0.18, 0.75, 0.28);
    thigh.rotation.x = 0.45;
    g.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 0.12), dark);
    shin.position.set(sx * 0.18, 0.42, 0.05);
    g.add(shin);
  }
  return g;
}

// Scooter + rider: two small wheels, a step-through deck, handlebar, and
// a seated rider (helmet, leaning torso, arms to the bars, bent legs).
// Faces -z like the cars. Returned group sits at ground level.
export function makeScooterMesh(colorHex) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: colorHex ?? 0xff5da2, roughness: 0.4, metalness: 0.12 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x2fb5a8, roughness: 0.85 });
  const wheelGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 10);
  for (const wz of [-0.75, 0.75]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(0, 0.26, wz);
    w.castShadow = true;
    g.add(w);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 1.1), paint);
  deck.position.set(0, 0.32, 0.05);
  deck.castShadow = true;
  g.add(deck);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 6), dark);
  column.position.set(0, 0.75, -0.72);
  column.rotation.x = 0.25;
  g.add(column);
  const bars = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.06), dark);
  bars.position.set(0, 1.12, -0.82);
  g.add(bars);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.55), dark);
  seat.position.set(0, 0.72, 0.55);
  g.add(seat);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 0.8 }));
  lamp.position.set(0, 0.62, -0.82);
  g.add(lamp);
  // Rider, seated: helmet, torso leaning to the bars, arms forward, legs bent.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.26), shirt);
  torso.position.set(0, 1.12, 0.42);
  torso.rotation.x = 0.35;
  torso.castShadow = true;
  g.add(torso);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4 }));
  helmet.position.set(0, 1.52, 0.28);
  g.add(helmet);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.06), dark);
  visor.position.set(0, 1.5, 0.1);
  g.add(visor);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.62), shirt);
    arm.position.set(sx * 0.26, 1.28, -0.18);
    arm.rotation.x = 1.15;
    g.add(arm);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.5), dark);
    thigh.position.set(sx * 0.16, 0.72, 0.32);
    thigh.rotation.x = 0.5;
    g.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.11), dark);
    shin.position.set(sx * 0.16, 0.42, 0.08);
    g.add(shin);
  }
  return g;
}

export class Car {
  constructor(typeKey, x, z, heading = 0, colorHex) {
    this.typeKey = typeKey;
    this.type = CAR_TYPES[typeKey] || CAR_TYPES.sedan;
    this.name = this.type.name;
    const built = makeCarMesh(typeKey, colorHex);
    this.mesh = built.group;
    this.halos = built.halos;
    this.lampMat = built.lampMat;
    this.tailHalo = built.tailHalo || null;
    this.beamPools = built.beamPools || [];
    this.mesh.position.set(x, 0, z);
    // The mesh's front (headlights, hood) is local -z: rotation.y =
    // heading + PI points the front along the direction of motion
    // (sin heading, cos heading). Without the +PI the car drives
    // backwards — front toward the camera while moving away.
    this.mesh.rotation.y = heading + Math.PI;
    this.heading = heading;
    this.speed = 0;
    this.condition = 100;
    this.gear = 1;
    this.dusk = 0;
  }

  setDusk(d) {
    this.dusk = clamp(d, 0, 1);
    for (const h of this.halos) h.material.opacity = this.dusk * 0.85;
    this.lampMat.emissiveIntensity = 0.6 + this.dusk * 2.2;
    // Taillight strip halo + headlight beam pools fade in with dusk.
    if (this.tailHalo) this.tailHalo.material.opacity = this.dusk * 0.7;
    for (const p of this.beamPools) p.material.opacity = this.dusk * 0.5;
  }

  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }

  // Arcade driving: throttle -1..1, steer -1..1.
  drive(dt, throttle, steer) {
    const t = this.type;
    this.speed += throttle * t.accel * dt;
    this.speed -= this.speed * 0.9 * dt; // drag
    this.speed = clamp(this.speed, -t.topSpeed * 0.45, t.topSpeed);
    const spd = Math.abs(this.speed);
    this.heading += steer * t.grip * (spd / t.topSpeed) * dt * Math.sign(this.speed || 1);
    this.mesh.rotation.y = this.heading + Math.PI;
    this.mesh.position.x += Math.sin(this.heading) * this.speed * dt;
    this.mesh.position.z += Math.cos(this.heading) * this.speed * dt;
    // Gear from speed.
    this.gear = clamp(1 + Math.floor(spd / (t.topSpeed / 5)), 1, 5);
    // Body roll / pitch for feel.
    this.mesh.rotation.z = -steer * 0.03 * (spd / t.topSpeed);
    this.mesh.rotation.x = -throttle * 0.02 * (spd / t.topSpeed);
  }

  damage(amount) {
    this.condition = clamp(this.condition - amount, 0, 100);
  }
}
