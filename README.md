# SOLARA — an open-world crime game

**gta6-01 "Make GTA 6" · built fresh from the behavioural spec under @witty-meteor-32**

Kai Mercer is back in Solara, a golden-hour coastal city where the sun
never quite sets. Fixer Lupe has eight jobs for him — repo the cars,
shake down the stalls, outrun the PCPD, and stay clear of the helicopter
once the third star lights up.

## How it plays

```sh
node serve.ts 8903
# open http://localhost:8903/game/index.html
```

- **WASD** walk and drive · **Shift** sprint · **F** step into a car or
  carjack one (+1 star) · **Click** fire the VESPER pistol (12-round mag)
- **1–5** switch weapons · **R** change radio (PUERTO 88.3 / CELESTE 98.1 /
  SOLARA 98.3) · **M** open the map (zoom, pan, waypoint) · **P** pause
- **Z** MARA / GHOST (−1 star) · **X** SULLY / PIT CREW (full repair in
  the car) · **C** KIKI / LOOKOUT (patrols revealed for 20 s)
- **F8** quick-save · **F9** load

## What is in the city

- **Wanted:** five stars. Carjacking adds one. Cruisers and officers give
  chase, the helicopter comes out at three stars, and the EVADING meter
  fills while nobody can see you — reach 100% and a star drops.
- **Jobs:** an eight-job chain (Lupe, Sully, Marco, Brandt, Aurora). The
  fourth job is a 90-second timed delivery across town. A gold beacon
  and a ground ring always mark the target.
- **Districts:** seven areas (PIER, BEACH ROAD, MARINA, DOWNTOWN, NORTH
  GATE, OLD TOWN, SUNSET STRIP), all starting NEUTRAL · 55 and warming
  +8 with every completed job.
- **Ranks:** ROOKIE, RUNNER, HUSTLER, ENFORCER, FIXER, by rank points
  (respect × 20 per job, +150 per escape). Armour soaks damage before
  health does; getting WASTED drops Kai back at the pier, $100 lighter.
- **HUD:** mission panel with a four-segment stage bar, money / clock /
  gold stars, a PCPD panel naming every unit with live distance and
  status, weapon slots with mag and reserve, a circular minimap with a
  search circle, district and respect, radio and car readout
  (name / condition / speed / gear), and portrait dialogue.
- **Small details:** a lifeguard tower and beach umbrella on the sand, a
  food cart by the pier, a jogger and his dog, a red motorcycle in
  traffic, a green traffic light and crossing signal downtown, pawn-shop
  and diner signs, a city bus, a motel neon, faint stars at dusk, and a
  police boat glinting out in the marina.

## The four dossier shots

Frozen renders of the live game, `?shot=<name>`:

- `1-start` — Kai on foot on Beach Road, pistol raised in a two-hand
  aim, Lupe on the radio.
- `2-drive` — three stars, four PCPD units, a cruiser three-quarter
  toward the camera.
- `3-mission` — the orange coupe at dusk, headlights on, traffic
  clustered around a zebra crossing.
- `4-chase` — four stars, the helicopter overhead, neon and nightfall.

## Stack

three.js, vendored under `game/vendor/` — no build step, no network.
Dossier: `MAKEFUN_OUTPUT_DIR=out node main.ts`.
