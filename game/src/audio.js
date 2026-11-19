// Audio — tiny WebAudio synth engine. No audio files: a low engine hum
// whose pitch follows speed, and a simple looping radio melody per
// station (a few detuned triangle oscillators). Silent until the first
// user gesture, so it never blocks page load.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.radioOsc = [];
    this.radioGain = null;
    this.station = 0;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.03;
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      this.engineOsc.connect(lp);
      lp.connect(this.engineGain);
      this.engineOsc.start();
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.value = 0.02;
      this.radioGain.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
    }
  }

  setEngine(speedNorm) {
    if (!this.ctx || !this.engineOsc) return;
    this.engineOsc.frequency.value = 50 + speedNorm * 160;
  }

  setStation(idx) {
    this.station = idx;
    if (!this.ctx) return;
    for (const o of this.radioOsc) { try { o.stop(); } catch (e) {} }
    this.radioOsc = [];
    const roots = [220, 196, 246.9];
    const root = roots[idx % roots.length];
    for (const [mult, det] of [[1, 0], [1.5, 4], [2, -3]]) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = root * mult;
      o.detune.value = det;
      o.connect(this.radioGain);
      o.start();
      this.radioOsc.push(o);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
}
