// SOLARA — procedural audio: engine hum, radio beds, sirens. WebAudio only,
// created lazily on the first user gesture; every call is guarded.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.radioOsc = null;
    this.radioGain = null;
    this.station = 0;
    this._unlocked = false;
  }

  unlock() {
    if (this._unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._unlocked = true;
      // Engine hum.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain).connect(this.ctx.destination);
      this.engineOsc.start();
      // Radio bed: a soft chord pad.
      this.radioOsc = this.ctx.createOscillator();
      this.radioOsc.type = 'triangle';
      this.radioOsc.frequency.value = 220;
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.value = 0.0;
      this.radioOsc.connect(this.radioGain).connect(this.ctx.destination);
      this.radioOsc.start();
    } catch (e) { /* audio is optional */ }
  }

  setEngine(speedNorm, inCar) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(45 + speedNorm * 90, t, 0.1);
    this.engineGain.gain.setTargetAtTime(inCar ? 0.035 + speedNorm * 0.03 : 0, t, 0.1);
  }

  setRadio(station, on) {
    this.station = station;
    if (!this.ctx || !this.radioOsc) return;
    const t = this.ctx.currentTime;
    const freqs = [196, 220, 246.9];
    this.radioOsc.frequency.setTargetAtTime(freqs[station % 3], t, 0.2);
    this.radioGain.gain.setTargetAtTime(on ? 0.02 : 0, t, 0.2);
  }
}
