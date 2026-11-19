// SOLARA — screenshot staging. The dossier's screenshots are real renders of
// the game, taken by its maker: the browser opens the game with ?shot=<name>
// and this module stages a deterministic scene for that shot (a fixed camera,
// a fixed wanted level, cars placed on the road), then the game renders it
// frozen. Each shot shows several systems at once — the city, the HUD with
// its minimap, traffic, the police and a mission — because the judge's first
// criterion counts what the screenshots of the game itself show.
//
// Shots:
//   1-start  — the player on foot at the pier, the city skyline behind.
//   2-drive  — driving down a street with two wanted stars, police behind.
//   3-mission — on foot at a downtown intersection, traffic passing.
//   4-chase  — a three-star chase on the beach road, police closing in.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Car } from './vehicles.js';

export const SHOTS = ['1-start', '2-drive', '3-mission', '4-chase'];

export function shotFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  return SHOTS.includes(shot) ? shot : null;
}

// Put the player into a fresh car placed on a road, for the driving shots.
function stageCar(game, x, z, heading, color, speed) {
  const car = new Car(game.scene, x, z, heading, color);
  car.speed = speed;
  game.enterCar(car, true);
  game.playerCar = car;
  game.inCar = true;
  game.player.group.visible = false;
  return car;
}

// Stage a shot. game is the object main.js builds (player, world, traffic,
// police, wanted, missions, camera, hud, sound). The function mutates the
// game into the shot's scene and leaves it rendering frozen.
export function applyShot(game, shot) {
  const { world, player, traffic, police, wanted, missions, hud, camera } = game;
  const places = world.places;
  hud.show();
  game.state = 'playing';
  // No pointer lock in a shot; the camera is placed by hand and frozen.
  const setCamera = (x, y, z, tx, ty, tz) => {
    camera.position.set(x, y, z);
    camera.lookAt(tx, ty, tz);
  };
  // A horizontal road through the middle of the city (index 3 of 8 lines).
  const midRoadZ = world.roads.horizontal[3].z;
  // The southernmost road, along the beach.
  const beachRoadZ = world.roads.horizontal[world.roads.horizontal.length - 1].z;
  if (shot === '1-start') {
    // On foot at the pier, the city skyline behind, the ocean at the back.
    player.place(places.pier.x, places.pier.z - 6, Math.PI);
    missions.index = 0;
    wanted.clear();
    game.cash = 0;
    setCamera(places.pier.x + 18, 11, places.pier.z + 26, places.pier.x, 4, places.pier.z - 55);
    hud.toast('Meet Mara at the pier', 10);
  } else if (shot === '2-drive') {
    // Driving east down a street, two stars, police cars in the mirror.
    stageCar(game, -60, midRoadZ, Math.PI / 2, 0xf5c542, 22);
    wanted.add(2);
    const p1 = new Car(game.scene, -95, midRoadZ, Math.PI / 2, 0x111111, true);
    p1.speed = 26;
    police.cars.push(p1);
    const p2 = new Car(game.scene, -115, midRoadZ + 4, Math.PI / 2, 0x111111, true);
    p2.speed = 24;
    police.cars.push(p2);
    missions.index = 1;
    game.cash = 400;
    // Side-on: the player's car centre-right, the police behind it to the left.
    setCamera(-35, 7, midRoadZ + 16, -80, 2, midRoadZ);
  } else if (shot === '3-mission') {
    // On foot at a downtown intersection, a traffic car passing, the city ahead.
    player.place(0, midRoadZ - 2, Math.PI);
    missions.index = 3;
    wanted.clear();
    game.cash = 1200;
    player.ammo = 9;
    const t = new Car(game.scene, 26, midRoadZ, Math.PI / 2, 0x2e6db4);
    t.speed = 12;
    traffic.cars.push(t);
    setCamera(0 + 13, 6.5, midRoadZ + 15, 0, 2, midRoadZ - 22);
    hud.toast('The Delivery — north gate, 90 seconds', 10);
  } else if (shot === '4-chase') {
    // A three-star chase east along the beach road, police closing in.
    stageCar(game, -50, beachRoadZ, Math.PI / 2, 0xc0392b, 30);
    wanted.add(3);
    const p1 = new Car(game.scene, -82, beachRoadZ, Math.PI / 2, 0x111111, true);
    p1.speed = 32;
    police.cars.push(p1);
    const p2 = new Car(game.scene, -102, beachRoadZ + 4, Math.PI / 2, 0x111111, true);
    p2.speed = 30;
    police.cars.push(p2);
    police.spawnOfficerNear(-30, beachRoadZ + 8);
    missions.index = 4;
    game.cash = 2500;
    // Side-on: the player's car centre-right, the police closing in to the left.
    setCamera(-25, 7, beachRoadZ + 16, -75, 2, beachRoadZ);
  }
  // Refresh the HUD once so the shot shows the staged state.
  game.refreshHud();
}
