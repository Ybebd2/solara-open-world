// SOLARA — one-shot sound effects, built on the game's AudioEngine.
// Re-authored for the @witty-meteor-32 recording-M build.

// Short UI blip at `freq` Hz: a soft sine that decays fast.
export function blip(audio, freq = 660) {
  if (!audio || !audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start();
  osc.stop(ctx.currentTime + 0.14);
}

// Three-note square sting for gaining a wanted star.
export function starSting(audio) {
  if (!audio || !audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  [523, 659, 784].forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f;
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + i * 0.07;
    gain.gain.setValueAtTime(0.05, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  });
}
