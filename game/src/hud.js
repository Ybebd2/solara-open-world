// SOLARA — the HUD and the menus. The HUD is DOM plus a 2D canvas minimap:
// the minimap draws the road grid, the buildings, the ocean, the player, the
// traffic, the police and the mission marker, all from the live game state.
// Wanted stars, health, cash, the objective, speed and ammo are plain DOM.
// The start, pause and busted screens are here too.

export class HUD {
  constructor() {
    this.hud = document.getElementById('hud');
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.wantedEl = document.getElementById('wanted');
    this.cashEl = document.getElementById('cash');
    this.objectiveEl = document.getElementById('objectiveText');
    this.healthFill = document.getElementById('healthFill');
    this.healthLabel = document.getElementById('healthLabel');
    this.ammoEl = document.getElementById('ammo');
    this.speedEl = document.getElementById('speed');
    this.toastEl = document.getElementById('toast');
    this.hintEl = document.getElementById('hint');
    this.toastTimer = 0;
  }

  show() { this.hud.classList.remove('hidden'); }
  hide() { this.hud.classList.add('hidden'); }

  toast(msg, seconds = 3) {
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = '1';
    this.toastTimer = seconds;
  }

  tick(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.opacity = '0';
    }
  }

  // state: { stars, cash, objective, health, ammo, speed, inCar, timeLeft,
  //   playerPos, playerHeading, world, traffic, policeCars, missionTarget }
  update(s) {
    // Wanted stars: filled gold, the rest dim.
    let stars = '';
    for (let i = 0; i < 5; i++) {
      stars += i < s.stars ? '<span>★</span>' : '<span class="off">★</span>';
    }
    this.wantedEl.innerHTML = stars;
    this.cashEl.textContent = '$' + s.cash.toLocaleString('en-US');
    let obj = s.objective;
    if (s.timeLeft > 0) obj += ` — ${Math.ceil(s.timeLeft)}s left`;
    this.objectiveEl.textContent = obj;
    this.healthFill.style.width = Math.max(0, s.health) + '%';
    this.healthLabel.textContent = 'Health ' + Math.max(0, Math.round(s.health));
    this.ammoEl.textContent = s.inCar ? '' : `Ammo ${s.ammo} / ${s.ammoMax}`;
    this.speedEl.textContent = s.inCar ? `${Math.round(Math.abs(s.speed) * 3.6)} km/h` : '';
    this.drawMinimap(s);
  }

  drawMinimap(s) {
    const ctx = this.mapCtx;
    const W = this.map.width;
    const H = this.map.height;
    const world = s.world;
    const span = (world.half + 60) * 2;
    const toMap = (x, z) => [W / 2 + (x / span) * W, H / 2 + (z / span) * H];
    ctx.clearRect(0, 0, W, H);
    // Sea and sand at the bottom (south).
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(0, 0, W, H);
    const [bx] = toMap(0, world.half + 14);
    ctx.fillStyle = '#2a7ab8';
    ctx.fillRect(0, bx + 40, W, H - bx - 40);
    ctx.fillStyle = '#e8d9a0';
    ctx.fillRect(0, bx + 22, W, 18);
    // Roads.
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 7;
    for (const r of world.roads.horizontal) {
      const [x0, y] = toMap(-world.half - 14, r.z);
      const [x1] = toMap(world.half + 14, r.z);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    }
    for (const r of world.roads.vertical) {
      const [x, y0] = toMap(r.x, -world.half - 14);
      const [, y1] = toMap(r.x, world.half + 14);
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#6b7280';
    for (const b of world.buildings) {
      const [x0, y0] = toMap(b.minX, b.minZ);
      const [x1, y1] = toMap(b.maxX, b.maxZ);
      ctx.fillRect(x0, y0, Math.max(2, x1 - x0), Math.max(2, y1 - y0));
    }
    // Mission marker: a pulsing gold ring.
    if (s.missionTarget) {
      const [mx, my] = toMap(s.missionTarget.x, s.missionTarget.z);
      const pulse = 6 + Math.sin(performance.now() * 0.006) * 2;
      ctx.strokeStyle = '#ffb300';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mx, my, pulse + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffb300';
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
    }
    // Traffic cars: small yellow dots.
    ctx.fillStyle = '#f5c542';
    for (const c of s.traffic) {
      const [x, y] = toMap(c.pos.x, c.pos.z);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Police: red and blue dots.
    for (const c of s.policeCars) {
      const [x, y] = toMap(c.pos.x, c.pos.z);
      ctx.fillStyle = '#ff2222';
      ctx.beginPath(); ctx.arc(x - 2, y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2244ff';
      ctx.beginPath(); ctx.arc(x + 2, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // The player: a white arrow pointing where they face.
    const [px, py] = toMap(s.playerPos.x, s.playerPos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(s.playerHeading), Math.cos(s.playerHeading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// Wire the menu buttons. callbacks: { onPlay, onContinue, onResume,
// onRestart, onRetry }. Returns helpers to show each screen.
export function bindMenus(callbacks) {
  const start = document.getElementById('startScreen');
  const pause = document.getElementById('pauseScreen');
  const over = document.getElementById('overScreen');
  const loading = document.getElementById('loading');
  const continueBtn = document.getElementById('continueBtn');
  document.getElementById('playBtn').addEventListener('click', () => callbacks.onPlay());
  continueBtn.addEventListener('click', () => callbacks.onContinue());
  document.getElementById('resumeBtn').addEventListener('click', () => callbacks.onResume());
  document.getElementById('restartBtn').addEventListener('click', () => callbacks.onRestart());
  document.getElementById('retryBtn').addEventListener('click', () => callbacks.onRetry());
  return {
    showStart(hasSave) {
      start.classList.remove('hidden');
      pause.classList.add('hidden');
      over.classList.add('hidden');
      loading.classList.add('hidden');
      continueBtn.classList.toggle('hidden', !hasSave);
    },
    showPause(stats) {
      document.getElementById('pauseStats').textContent = stats;
      pause.classList.remove('hidden');
    },
    hidePause() { pause.classList.add('hidden'); },
    showOver(text) {
      document.getElementById('overText').textContent = text;
      over.classList.remove('hidden');
    },
    hideOver() { over.classList.add('hidden'); },
    hideStart() { start.classList.add('hidden'); },
    hideLoading() { loading.classList.add('hidden'); },
  };
}
