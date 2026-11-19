# SOLARA — an open-world crime game

**gta6-01 "Make GTA 6" · re-authored under @witty-meteor-32 (recording M)**

Kai Mercer is back in Solara, a golden-hour coastal city. Eight jobs from
fixer Lupe stand between him and the top of the city — steal the cars,
outrun the PCPD, and don't let the helicopter catch you at three stars.

## Play

```sh
node serve.ts 8903
# open http://localhost:8903/game/index.html
```

- **WASD** walk / drive · **Shift** sprint · **F** enter car / carjack (+1★)
- **Click / Space** shoot (VESPER pistol, 12-round mag) · **1–5** weapons
- **R** radio (PUERTO 88.3 / CELESTE 98.1 / SOLARA 98.3) · **M** map
  (wheel zoom, drag pan, click waypoint) · **P** pause
- **Z** MARA / GHOST (−1★) · **X** SULLY / PIT CREW (repair) ·
  **C** KIKI / LOOKOUT (reveal patrols) · **F8** save · **F9** load

## Systems

- **Wanted:** 5 stars, carjack +1★, cruisers + officers chase, helicopter
  at 3★, EVADING meter, HIDDEN / IN SIGHT, escape pays $150.
- **Missions:** 8-job chain (Lupe, Sully, Marco, Brandt, Aurora);
  mission 4 is a 90 s timed delivery. Beacon + ground ring mark targets.
- **Districts:** 7 districts, standing NEUTRAL · 55 start, +8 per job.
- **Ranks:** ROOKIE 0 / RUNNER 800 / HUSTLER 1800 / ENFORCER 3200 /
  FIXER 5200. Armour absorbs damage first; WASTED respawns at the pier −$100.
- **HUD:** mission panel with stage bar, money / clock / gold stars,
  PCPD response panel with named units + live distances, weapon bar,
  circular minimap with search circle, district + respect, radio + car
  (name / condition / speed / gear), portrait dialogue.

## Shots

The four dossier screenshots are frozen renders of the live game:
`?shot=1-start` Kai on foot, pistol raised in two-hand aim ·
`?shot=2-drive` wanted 3★ with the cruiser 3/4 toward Kai ·
`?shot=3-mission` dusk coupe, headlights + traffic cluster ·
`?shot=4-chase` helicopter + nightfall, 4★.

## Stack

three.js (vendored under `game/vendor/`), no build step, no network.
Dossier: `MAKEFUN_OUTPUT_DIR=out node main.ts`.
