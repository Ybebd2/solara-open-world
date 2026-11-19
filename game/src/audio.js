// SOLARA — the radio: three procedural stations built from WebAudio
// oscillators, no audio files. PUERTO is a warm Latin pulse, CELESTE a
// slow synth wash, SOLARA a night-drive bassline. Everything is guarded:
// headless runs have no audio and must never throw.
const STATIONS = [
  { bpm: 96, root: 220, wave: 'triangle', bass: [0, 0, 7, 5] },
  { bpm: 72, root: 196, wave: 'sine', bass: [0, 3, 5, 7] },
  { bpm: 104, root: 174, wave: 'sawtooth', bass: [0, 0, 10, 7] },
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.station = 0;
    this._timer = null;
    this._step = 0;
    this.muted = false;
  }
  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this._master = this.ctx.createGain();
      this._master.gain.value = 0.14;
      this._master.connect(this.ctx.destination);
      return true;
    } catch { return false; }
  }
  start(station) {
    if (!this.ensure()) return;
    this.station = station;
    this.stop();
    const stepDur = 60 / STATIONS[station].bpm / 2;
    this._step = 0;
    this._timer = setInterval(() => this._tick(stepDur), stepDur * 1000);
  }
  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }
  setStation(station) {
    this.station = station;
    if (this._timer) this.start(station);
  }
  _tick(stepDur) {
    if (this.muted || !this.ctx) return;
    const st = STATIONS[this.station];
    const scale = [0, 3, 5, 7, 10];
    const idx = (this._step * 7 + Math.floor(this._step / 4)) % scale.length;
    const freq = st.root * Math.pow(2, scale[idx] / 12) * (this._step % 8 === 0 ? 2 : 1);
    this._note(freq, stepDur * 0.9, st.wave, 0.5);
    if (this._step % 2 === 0) {
      const b = st.bass[(this._step / 2) % st.bass.length];
      this._note(st.root / 2 * Math.pow(2, b / 12), stepDur * 1.8, 'sine', 0.8);
    }
    this._step++;
  }
  _note(freq, dur, wave, vol) {
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = wave; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * 0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this._master);
      o.start(t); o.stop(t + dur + 0.05);
    } catch { /* audio is best-effort */ }
  }
}
