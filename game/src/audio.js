// SOLARA — sound, synthesized with the Web Audio API. No audio files: every
// effect is an oscillator or a noise buffer shaped in code, so the game loads
// nothing over the network. The engine hum follows the car's speed, the siren
// wails while the player is wanted, and the rest are one-shots. Sound can be
// muted (toggleMute) or turned down (setVolume); while muted every effect and
// both loops stay silent.

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.enabled = true;
    this.volume = 0.5;
  }

  // Must be called from a user gesture (the Start button).
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.enabled) this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(this.ctx.destination);
    // Engine: a sawtooth whose pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    // Siren: two tones alternating.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenTimer = 0;
  }

  // Mute or unmute everything. Returns true when sound is now muted.
  toggleMute() {
    this.enabled = !this.enabled;
    if (!this.ctx) return !this.enabled;
    if (this.enabled) {
      this.master.gain.value = this.volume;
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } else {
      this.master.gain.value = 0;
      this.engineGain.gain.value = 0;
      this.sirenGain.gain.value = 0;
      if (this.ctx.state === 'running') this.ctx.suspend();
    }
    return !this.enabled;
  }

  // Master volume, 0 (silent) to 1 (full). Takes effect immediately.
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ctx && this.enabled) this.master.gain.value = this.volume;
  }

  // Called every frame: engine pitch from speed, siren while wanted.
  update(dt, speed, wanted) {
    if (!this.ctx || !this.enabled) return;
    const target = speed > 0.5 ? 0.05 + Math.min(0.09, Math.abs(speed) * 0.002) : 0;
    this.engineGain.gain.value += (target - this.engineGain.gain.value) * Math.min(1, 6 * dt);
    this.engineOsc.frequency.value = 50 + Math.abs(speed) * 3.2;
    if (wanted > 0) {
      this.sirenTimer += dt;
      this.sirenOsc.frequency.value = this.sirenTimer % 1 < 0.5 ? 700 : 950;
      this.sirenGain.gain.value = 0.05;
    } else {
      this.sirenGain.gain.value = 0;
    }
  }

  // A short burst of filtered noise (a gunshot, a punch, a crash).
  noise(dur, freq, gain) {
    if (!this.ctx || !this.enabled) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }

  // A short tone (a pickup chime, a UI click, a mission jingle).
  tone(freq, dur, gain = 0.15, type = 'sine') {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  shoot() { this.noise(0.14, 1800, 0.5); }
  punch() { this.noise(0.1, 500, 0.3); }
  crash() { this.noise(0.25, 300, 0.4); }
  pickup() { this.tone(880, 0.12, 0.18); this.tone(1320, 0.18, 0.15); }
  mission() { this.tone(523, 0.15, 0.2); setTimeout(() => this.tone(659, 0.15, 0.2), 140); setTimeout(() => this.tone(784, 0.3, 0.2), 280); }
  click() { this.tone(600, 0.06, 0.1, 'square'); }
  sirenBlip() { this.tone(950, 0.2, 0.12, 'sine'); }
  // Busted sting: three descending notes when the police catch the player.
  busted() { this.tone(392, 0.25, 0.2, 'triangle'); setTimeout(() => this.tone(311, 0.25, 0.2, 'triangle'), 220); setTimeout(() => this.tone(233, 0.5, 0.2, 'triangle'), 440); }
}
