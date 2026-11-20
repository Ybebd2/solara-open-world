// HUD — the dense GTA overlay. Mission panel top-left, money/clock/gold
// stars top-right, PCPD response panel top-centre with named units and
// live distances, weapon slots bottom-right, circular minimap + district
// bottom-left, portrait dialogue bottom-centre, radio + car readout, a
// red ring-dot crosshair, and toasts. All DOM, updated every frame.
import { WEAPONS, RADIO, RANKS } from './config.js';

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

export class HUD {
  constructor(root) {
    this.root = root;
    this.dialogue = { name: 'Lupe', role: 'FIXER · PIER SHACK', text: '', reply: '' };
    this.toastText = '';
    this.toastUntil = 0;
    this.build();
  }

  build() {
    const r = this.root;
    const css = document.createElement('style');
    css.textContent = `
      #hud{position:fixed;inset:0;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:#fff;z-index:5}
      .panel{background:rgba(10,10,18,.72);border-radius:10px;padding:10px 12px;backdrop-filter:blur(2px)}
      #mission{position:absolute;top:14px;left:14px;width:23%;min-width:280px}
      #mission .ch{color:#f2c14e;font-weight:700;font-size:13px;letter-spacing:1px}
      #mission .title{font-size:19px;font-weight:800;margin:2px 0}
      #mission .stage{color:#cfd6dd;font-size:12px}
      #mission .bar{display:flex;gap:4px;margin:6px 0}
      #mission .bar i{flex:1;height:6px;background:#3a4356;border-radius:3px}
      #mission .bar i.on{background:#f2a71b}
      #mission .next{font-size:12.5px;color:#e8ecf1;line-height:1.35}
      #mission .timer{font-size:20px;font-weight:800;color:#ffd700;margin-top:4px}
      #topright{position:absolute;top:14px;right:14px;text-align:right}
      #money{color:#7dff9e;font-size:26px;font-weight:800;text-shadow:0 2px 6px #000}
      #clock{font-size:15px;color:#e8ecf1}
      #stars{font-size:38px;letter-spacing:3px;line-height:1.1}
      #stars .on{color:#ffd700;text-shadow:0 0 8px #ffbf00}
      #stars .off{color:#4a5568}
      #clean{font-size:11px;color:#9fb3c8}
      #pcpd{position:absolute;top:14px;left:50%;transform:translateX(-50%);min-width:330px;text-align:left}
      #pcpd .head{font-weight:800;font-size:13px;letter-spacing:.5px}
      #pcpd .unit{display:flex;justify-content:space-between;font-size:12.5px;padding:1px 0}
      #pcpd .unit .st{color:#9fb3c8}
      #pcpd .unit .pursuit{color:#ff9a3d;font-weight:700}
      #pcpd .unit .wrecked{color:#8a97a5;text-decoration:line-through}
      #pcpd .air{color:#ffd700;font-weight:700;font-size:12.5px}
      #badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:800;margin-top:4px}
      #badge.sight{background:#e63946}
      #badge.hidden{background:#2a6ea5}
      #evade{font-size:12px;color:#9fb3c8}
      #weapons{position:absolute;right:14px;bottom:14px;display:flex;gap:6px}
      #weapons .slot{background:rgba(10,10,18,.72);border-radius:8px;padding:7px 10px;text-align:center;min-width:64px}
      #weapons .slot.sel{outline:2px solid #f2a71b;background:rgba(60,40,5,.8)}
      #weapons .slot .num{font-size:10px;color:#9fb3c8}
      #weapons .slot .nm{font-size:13px;font-weight:800}
      #weapons .slot .am{font-size:12px;color:#ffd700}
      #weapons .slot.locked{opacity:.55}
      #carhud{position:absolute;right:14px;bottom:96px;text-align:right}
      #carhud .nm{font-size:16px;font-weight:800}
      #carhud .cond{font-size:12px;color:#cfd6dd}
      #carhud .condbar{width:150px;height:7px;background:#3a4356;border-radius:4px;margin:3px 0 3px auto}
      #carhud .condbar i{display:block;height:100%;background:#37d67a;border-radius:4px}
      #carhud .spd{font-size:15px;font-weight:700}
      #carhud .radio{font-size:12px;color:#ffd98a}
      #minimap{position:absolute;left:14px;bottom:14px}
      #minimap canvas{border-radius:50%;border:3px solid rgba(255,255,255,.75);background:#0e1a2a}
      #minimap .dist{font-size:12.5px;font-weight:700;margin-top:4px;text-shadow:0 1px 4px #000}
      #minimap .resp{font-size:11.5px;color:#cfd6dd;text-shadow:0 1px 4px #000}
      #dialogue{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:560px;max-width:46vw}
      #dialogue .row{display:flex;gap:10px;align-items:flex-start}
      #portrait{width:92px;height:92px;min-width:92px;border-radius:10px;border:3px solid #ff4fa3;background:linear-gradient(160deg,#ffb3d1,#7a2a5a);display:flex;align-items:center;justify-content:center;font-size:44px}
      #dialogue .who{color:#ff8fc0;font-weight:800;font-size:13px}
      #dialogue .txt{font-size:14px;line-height:1.4;margin:2px 0}
      #dialogue .rep{font-size:13px;color:#bfe3ff;font-style:italic}
      #toast{position:absolute;top:110px;right:14px;background:rgba(10,10,18,.85);border-radius:8px;padding:8px 12px;font-weight:800;font-size:15px}
      #cross{position:absolute;left:50%;top:50%;width:16px;height:16px;transform:translate(-50%,-50%)}
      #cross::before{content:'';position:absolute;left:50%;top:50%;width:14px;height:14px;border:2px solid #ff3b30;border-radius:50%;transform:translate(-50%,-50%)}
      #cross::after{content:'';position:absolute;left:50%;top:50%;width:4px;height:4px;background:#ff3b30;border-radius:50%;transform:translate(-50%,-50%)}
      #overlay{position:fixed;inset:0;background:rgba(8,8,16,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10;text-align:center}
      #overlay h1{font-size:64px;letter-spacing:6px;margin:0;color:#ffd98a}
      #overlay p{font-size:16px;color:#cfd6dd;max-width:520px;line-height:1.5}
      #overlay .hint{margin-top:18px;font-size:13px;color:#9fb3c8}
    `;
    document.head.appendChild(css);
    const hud = el('div', '', r);
    hud.id = 'hud';

    // Mission panel.
    const m = el('div', 'panel', hud); m.id = 'mission';
    this.mCh = el('div', 'ch', m);
    this.mTitle = el('div', 'title', m);
    this.mStage = el('div', 'stage', m);
    this.mBar = el('div', 'bar', m);
    for (let i = 0; i < 4; i++) el('i', '', this.mBar);
    this.mNext = el('div', 'next', m);
    this.mTimer = el('div', 'timer', m);

    // Money / clock / stars.
    const tr = el('div', '', hud); tr.id = 'topright';
    this.moneyEl = el('div', '', tr); this.moneyEl.id = 'money';
    this.clockEl = el('div', '', tr); this.clockEl.id = 'clock';
    this.starsEl = el('div', '', tr); this.starsEl.id = 'stars';
    this.cleanEl = el('div', '', tr); this.cleanEl.id = 'clean';

    // PCPD panel.
    const p = el('div', 'panel', hud); p.id = 'pcpd';
    this.pHead = el('div', 'head', p);
    this.pUnits = el('div', '', p);
    this.pAir = el('div', 'air', p);
    this.pBadge = el('div', '', p); this.pBadge.id = 'badge';
    this.pEvade = el('div', '', p); this.pEvade.id = 'evade';

    // Weapon slots.
    const w = el('div', '', hud); w.id = 'weapons';
    this.slotEls = [];
    for (const wp of WEAPONS) {
      const s = el('div', 'slot' + (wp.locked ? ' locked' : ''), w);
      el('div', 'num', s).textContent = wp.slot;
      el('div', 'nm', s).textContent = wp.name;
      const am = el('div', 'am', s);
      am.textContent = wp.locked ? 'LOCKED' : (wp.ammo === Infinity ? '∞' : wp.ammo);
      this.slotEls.push({ root: s, am });
    }

    // Car HUD.
    const c = el('div', '', hud); c.id = 'carhud';
    this.carName = el('div', 'nm', c);
    this.carCond = el('div', 'cond', c);
    const cb = el('div', 'condbar', c);
    this.carCondBar = el('i', '', cb);
    this.carSpd = el('div', 'spd', c);
    this.carRadio = el('div', 'radio', c);

    // Minimap.
    const mm = el('div', '', hud); mm.id = 'minimap';
    this.mapCanvas = el('canvas', '', mm);
    this.mapCanvas.width = 150; this.mapCanvas.height = 150;
    this.mapDist = el('div', 'dist', mm);
    this.mapResp = el('div', 'resp', mm);

    // Dialogue.
    const d = el('div', 'panel', hud); d.id = 'dialogue';
    const row = el('div', 'row', d);
    const por = el('div', '', row); por.id = 'portrait';
    por.textContent = '👩';
    const dt = el('div', '', row);
    this.dWho = el('div', 'who', dt);
    this.dTxt = el('div', 'txt', dt);
    this.dRep = el('div', 'rep', dt);

    // Toast + crosshair.
    this.toastEl = el('div', '', hud); this.toastEl.id = 'toast';
    this.toastEl.style.display = 'none';
    const cr = el('div', '', hud); cr.id = 'cross';

    // Full-screen overlay (intro / title / pause).
    this.overlay = el('div', '', r); this.overlay.id = 'overlay';
    this.ovTitle = el('h1', '', this.overlay);
    this.ovText = el('p', '', this.overlay);
    this.ovHint = el('div', 'hint', this.overlay);
    this.showOverlay('intro');
  }

  showOverlay(kind) {
    if (!kind) { this.overlay.style.display = 'none'; return; }
    this.overlay.style.display = 'flex';
    if (kind === 'intro') {
      this.ovTitle.textContent = 'SOLARA';
      this.ovText.textContent = 'A golden-hour coastal city. Eight jobs from fixer Lupe stand between Kai Mercer and the top of the city — steal the cars, outrun the PCPD, and don\'t let the helicopter catch you at three stars.';
      this.ovHint.textContent = 'Press ENTER to continue';
    } else if (kind === 'title') {
      this.ovTitle.textContent = 'SOLARA';
      this.ovText.textContent = 'NEW GAME · Kai Mercer is back in Solara. WASD walk / drive · F enter car · Click shoot · R radio · M map · P pause · Z / X / C crew';
      this.ovHint.textContent = 'Press ENTER to play';
    } else if (kind === 'paused') {
      this.ovTitle.textContent = 'PAUSED';
      this.ovText.textContent = 'Map · Missions · Crew · Settings';
      this.ovHint.textContent = 'Press P to resume';
    }
  }

  toast(text) {
    this.toastText = text;
    this.toastUntil = performance.now() + 3500;
    this.toastEl.textContent = text;
    this.toastEl.style.display = 'block';
  }

  setDialogue(name, role, text, reply) {
    this.dialogue = { name, role, text, reply };
  }

  rankFor(respect) {
    let r = RANKS[0];
    for (const x of RANKS) if (respect >= x.at) r = x;
    return r;
  }

  fmtClock(hours) {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  update(g) {
    // Mission panel.
    const m = g.missions.current;
    this.mCh.textContent = `${m.ch} · ${m.title}`;
    this.mTitle.textContent = this.missionObjective(m);
    this.mStage.textContent = `STAGE ${g.missions.stage}/${m.stages}`;
    const bars = this.mBar.querySelectorAll('i');
    bars.forEach((b, i) => { b.className = i < g.missions.stage ? 'on' : ''; });
    this.mNext.textContent = `NEXT: ${m.giver} — ${m.next}`;
    // Timed job (TIDE RUNNER): the 90 s clock, big and gold.
    if (m.timed) {
      const t = Math.max(0, Math.ceil(g.missions.timer));
      this.mTimer.textContent = `⏱ ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      this.mTimer.style.display = 'block';
    } else {
      this.mTimer.style.display = 'none';
    }

    // Money / clock / stars.
    this.moneyEl.textContent = `$${g.money.toLocaleString()}`;
    this.clockEl.textContent = this.fmtClock(g.hours);
    let stars = '';
    for (let i = 0; i < 5; i++) stars += `<span class="${i < g.wanted.stars ? 'on' : 'off'}">★</span>`;
    this.starsEl.innerHTML = stars;
    this.cleanEl.textContent = g.wanted.stars === 0 ? 'CLEAN' : '';

    // PCPD panel.
    const units = g.police.cruisers.slice(0, 4);
    this.pHead.textContent = `PCPD RESPONSE — ${units.length} UNITS · CODE ${g.wanted.code}`;
    this.pUnits.innerHTML = units.map((c) => {
      const d = Math.round(Math.hypot(c.x - g.player.x, c.z - g.player.z));
      const cls = c.status === 'PURSUIT' ? 'pursuit' : (c.status === 'WRECKED' ? 'wrecked' : 'st');
      return `<div class="unit"><span>${c.name}</span><span>${d} m</span><span class="${cls}">${c.status}</span></div>`;
    }).join('') || '<div class="unit"><span>No units in the area</span></div>';
    const wrecked = units.filter((c) => c.status === 'WRECKED').length;
    if (wrecked > 0) {
      this.pUnits.innerHTML += `<div class="unit"><span>${wrecked} wrecked · search grid active</span></div>`;
    }
    this.pAir.textContent = g.police.heli ? '✦ AIR UNIT DEPLOYED' : '';
    if (g.wanted.stars > 0) {
      this.pBadge.style.display = 'inline-block';
      this.pBadge.textContent = g.wanted.inSight ? 'IN SIGHT' : 'HIDDEN';
      this.pBadge.className = g.wanted.inSight ? 'sight' : 'hidden';
      this.pBadge.id = 'badge';
      this.pEvade.textContent = `EVADING ${Math.round(g.wanted.evading)}%`;
    } else {
      this.pBadge.style.display = 'none';
      this.pEvade.textContent = '';
    }

    // Weapon slots.
    this.slotEls.forEach((s, i) => {
      const wp = WEAPONS[i];
      s.root.classList.toggle('sel', g.player.weaponSlot === wp.slot);
      if (!wp.locked) {
        if (wp.slot === 2) s.am.textContent = `${g.player.weaponAmmo} · ${wp.reserve}`;
        else if (wp.ammo === Infinity) s.am.textContent = '∞';
      }
    });

    // Car HUD.
    if (g.player.car) {
      const car = g.player.car;
      this.carName.textContent = car.name;
      this.carCond.textContent = `CONDITION ${Math.round(car.condition)}%`;
      this.carCondBar.style.width = `${car.condition}%`;
      const kmh = Math.round(Math.abs(car.speed) * 3.6);
      const gear = car.speed === 0 ? 'N' : `G${Math.min(5, 1 + Math.floor(Math.abs(car.speed) / 9))}`;
      this.carSpd.textContent = `${kmh} km/h · ${gear}`;
      this.carRadio.textContent = `♪ ${RADIO[g.radioIdx].name} · ${RADIO[g.radioIdx].track}`;
    } else {
      this.carName.textContent = '';
      this.carCond.textContent = '';
      this.carCondBar.style.width = '0%';
      this.carSpd.textContent = '';
      this.carRadio.textContent = `♪ ${RADIO[g.radioIdx].name} · ${RADIO[g.radioIdx].track}`;
    }

    // Minimap.
    this.drawMinimap(g);

    // Dialogue.
    this.dWho.textContent = `${this.dialogue.name} · ${this.dialogue.role}`;
    this.dTxt.textContent = this.dialogue.text;
    this.dRep.textContent = this.dialogue.reply ? `Kai: "${this.dialogue.reply}"` : '';

    // Toast expiry.
    if (this.toastText && performance.now() > this.toastUntil) {
      this.toastText = '';
      this.toastEl.style.display = 'none';
    }
  }

  missionObjective(m) {
    const objs = {
      HOMECOMING: 'Meet Lupe at the pier',
      'BORROWED WHEELS': 'Get in the coupe',
      'SHARK TAX': 'Collect at the middle stall',
      'TIDE RUNNER': 'Drop it at North Gate',
      'DIRTY BADGE': 'Lean on the badge',
      'DOCKSIDE AMBUSH': 'Spring the trap',
      'NEON NIGHTS': 'Light up Old Town',
      'GOLDEN HOUR': 'Take the city',
    };
    return objs[m.title] || m.title;
  }

  drawMinimap(g) {
    const ctx = this.mapCanvas.getContext('2d');
    const W = 150, C = W / 2;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#0e1a2a';
    ctx.beginPath(); ctx.arc(C, C, C - 2, 0, Math.PI * 2); ctx.fill();
    // Roads.
    ctx.strokeStyle = '#3a4a5c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(8, C); ctx.lineTo(W - 8, C); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(C, 8); ctx.lineTo(C, W - 8); ctx.stroke();
    // Search circle when wanted.
    if (g.wanted.stars > 0) {
      ctx.strokeStyle = '#3aa0ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(C, C, 46, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(C, C, 46, -0.6, 0.9); ctx.stroke();
    }
    // Player arrow.
    const px = C + ((g.player.x / 320) * (C - 12));
    const pz = C + ((g.player.z / 260) * (C - 12));
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(Math.max(10, Math.min(W - 10, px)), Math.max(10, Math.min(W - 10, pz)), 5, 0, Math.PI * 2);
    ctx.fill();
    // Police dots.
    ctx.fillStyle = '#ff3b30';
    for (const c of g.police.cruisers) {
      const cx = C + ((c.x / 320) * (C - 12));
      const cz = C + ((c.z / 260) * (C - 12));
      ctx.beginPath(); ctx.arc(cx, cz, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    this.mapDist.textContent = `${g.districts.name} · NEUTRAL ${g.districts.standing}%`;
    const rank = this.rankFor(g.rp !== undefined ? g.rp : g.respect * 20);
    this.mapResp.textContent = `RESPECT ${g.respect} · ${rank.name}`;
  }
}
