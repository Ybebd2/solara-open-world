// Sound — one-shot effects on the shared AudioContext: gunshot, siren
// blip, pickup chime, and the wasted sting. All synthesized, no files.
export class Sound {
  constructor(audio) {
    this.audio = audio;
  }

  blip(freq, dur, type = 'square', vol = 0.08) {
    const a = this.audio;
    if (!a.ctx) return;
    try {
      const o = a.ctx.createOscillator();
      const g = a.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, a.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.ctx.currentTime + dur);
      o.connect(g);
      g.connect(a.ctx.destination);
      o.start();
      o.stop(a.ctx.currentTime + dur);
    } catch (e) {}
  }

  shoot() {
    this.blip(180, 0.12, 'square', 0.12);
    this.blip(90, 0.18, 'sawtooth', 0.08);
  }

  siren() {
    this.blip(720, 0.3, 'sine', 0.05);
    setTimeout(() => this.blip(540, 0.3, 'sine', 0.05), 320);
  }

  pickup() {
    this.blip(660, 0.1, 'sine', 0.07);
    setTimeout(() => this.blip(880, 0.14, 'sine', 0.07), 110);
  }

  wasted() {
    this.blip(220, 0.5, 'sawtooth', 0.1);
    setTimeout(() => this.blip(165, 0.7, 'sawtooth', 0.1), 200);
  }
}
