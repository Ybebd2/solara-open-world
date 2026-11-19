// SOLARA — sound effects, all synthesized with WebAudio: the pistol
// crack, the pickup blip, the payout arpeggio, the car door thunk, a
// distant shot and a UI click. Every call is guarded so a missing audio
// context can never break the game.
export class SoundFX {
  constructor() {
    this.ctx = null;
  }
  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      return true;
    } catch { return false; }
  }
  _tone(freq, dur, type = 'sine', vol = 0.25, slideTo = null) {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* best-effort */ }
  }
  _noise(dur, vol = 0.3) {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(g); g.connect(this.ctx.destination);
      src.start(t);
    } catch { /* best-effort */ }
  }
  shoot() { this._noise(0.12, 0.4); this._tone(180, 0.1, 'square', 0.2, 60); }
  shotDistant() { this._noise(0.2, 0.08); }
  pickup() { this._tone(660, 0.09, 'sine', 0.25); setTimeout(() => this._tone(880, 0.12, 'sine', 0.25), 90); }
  payout() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.16, 'triangle', 0.25), i * 90)); }
  carDoor() { this._noise(0.08, 0.25); this._tone(120, 0.12, 'sine', 0.3, 70); }
  click() { this._tone(440, 0.05, 'square', 0.12); }
  denied() { this._tone(220, 0.15, 'square', 0.15, 160); }
}
