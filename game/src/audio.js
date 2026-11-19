// SOLARA — audio: WebAudio synth — engine hum, radio arpeggios, siren,
// gunshot, cash. setEngine coerces non-finite speed to 0 before
// setTargetAtTime so a NaN can never flood page errors.
// Built fresh for the @witty-meteor-32 build.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.radioTimer = null;
    this.radioStep = 0;
    this.station = 0;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: sawtooth through a lowpass, gain follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (e) { /* audio unavailable — game stays silent */ }
  }

  setEngine(speed) {
    if (!this.ctx || !this.engineGain) return;
    // Coerce non-finite speeds to 0: a NaN here would throw on setTargetAtTime
    // and flood the page with errors every frame.
    const s = Number.isFinite(speed) ? speed : 0;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0.015 + Math.min(0.09, Math.abs(s) * 0.003), t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(48 + Math.abs(s) * 4.5, t, 0.1);
  }

  setStation(i) {
    this.station = i;
    this.radioStep = 0;
  }

  // One radio tick (called ~8x/sec while driving): a little arpeggio.
  radioTick() {
    if (!this.ctx || this.muted) return;
    const scales = [[0, 3, 7, 10, 12], [0, 4, 7, 11, 12]];
    const scale = scales[this.station % scales.length];
    const base = this.station === 0 ? 220 : 262;
    const note = scale[this.radioStep % scale.length];
    this.radioStep++;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = base * Math.pow(2, note / 12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + 0.24);
  }

  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      const g = this.ctx.createGain();
      g.gain.value = 0.035;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lg = this.ctx.createGain(); lg.gain.value = 260;
      lfo.connect(lg); lg.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(g); g.connect(this.master);
      this.sirenOsc.start(); lfo.start();
      this.sirenLfo = lfo; this.sirenGain = g;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) {}
      this.sirenOsc = null; this.sirenLfo = null;
    }
  }

  gunshot() {
    if (!this.ctx || this.muted) return;
    const len = this.ctx.sampleRate * 0.12;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.5;
    src.connect(g); g.connect(this.master);
    src.start();
  }

  cash() {
    if (!this.ctx || this.muted) return;
    [880, 1318].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain();
      const t0 = this.ctx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + 0.3);
    });
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
