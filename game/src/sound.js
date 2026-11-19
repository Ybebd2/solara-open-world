// SOLARA — one-shot sound effects, synthesised with WebAudio.
export class SoundFX {
  constructor(audio) {
    this.audio = audio;
  }

  _ctx() {
    if (!this.audio.ctx) this.audio.unlock();
    return this.audio.ctx;
  }

  _blip(freq, dur, type = 'square', vol = 0.06) {
    const ctx = this._ctx();
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g).connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.stop(ctx.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  _noise(dur, vol = 0.12) {
    const ctx = this._ctx();
    if (!ctx) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(g).connect(ctx.destination);
      src.start();
    } catch (e) { /* ignore */ }
  }

  shot() { this._noise(0.14, 0.16); this._blip(160, 0.08, 'square', 0.05); }
  hit() { this._blip(320, 0.07, 'square', 0.06); }
  cash() { this._blip(880, 0.09, 'sine', 0.07); this._blip(1320, 0.12, 'sine', 0.06); }
  carjack() { this._blip(220, 0.12, 'sawtooth', 0.07); }
  siren() { this._blip(660, 0.25, 'sine', 0.04); this._blip(520, 0.25, 'sine', 0.04); }
  wasted() { this._blip(110, 0.7, 'sawtooth', 0.08); }
  click() { this._blip(1200, 0.04, 'sine', 0.04); }
}
