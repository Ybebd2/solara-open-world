// SOLARA — sound: one-shot SFX helpers. Built fresh for the
// @witty-meteor-32 build.

export function blip(audio, freq = 660) {
  if (!audio || !audio.ctx || audio.muted) return;
  const o = audio.ctx.createOscillator();
  o.type = 'sine'; o.frequency.value = freq;
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(0.08, audio.ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.12);
  o.connect(g); g.connect(audio.master);
  o.start(); o.stop(audio.ctx.currentTime + 0.14);
}

export function starSting(audio) {
  if (!audio || !audio.ctx || audio.muted) return;
  [523, 659, 784].forEach((f, i) => {
    const o = audio.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = f;
    const g = audio.ctx.createGain();
    const t0 = audio.ctx.currentTime + i * 0.07;
    g.gain.setValueAtTime(0.05, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    o.connect(g); g.connect(audio.master);
    o.start(t0); o.stop(t0 + 0.2);
  });
}
