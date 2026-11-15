// Tiny WebAudio synth: no audio files needed.
let ctx = null, muted = false, master = null, drumTimer = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.3, when = 0, slideTo = null) {
  const c = ensure(); if (!c || muted) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  unlock: () => ensure(),
  cash: (combo = 0) => { const b = 880 + Math.min(combo, 8) * 40; tone(b, 0.12, 'triangle', 0.25); tone(b * 1.5, 0.25, 'triangle', 0.22, 0.08); },
  tip: () => { tone(1320, 0.08, 'square', 0.08); tone(1760, 0.12, 'square', 0.08, 0.06); },
  wrong: () => { tone(180, 0.25, 'sawtooth', 0.18); tone(140, 0.3, 'sawtooth', 0.15, 0.1); },
  arrive: () => tone(520, 0.08, 'sine', 0.12, 0, 700),
  angry: () => tone(260, 0.4, 'square', 0.1, 0, 110),
  whoosh: () => tone(400, 0.18, 'sine', 0.08, 0, 1200),
  vip: () => { [0, 0.1, 0.2].forEach((w, i) => tone(660 * (1 + i * 0.25), 0.15, 'triangle', 0.15, w)); },
  end: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, i * 0.12)); },
  tick: () => tone(1000, 0.04, 'square', 0.05),
};

// Talking-drum style groove (pitch-bent sine hits)
export function startDrums() {
  stopDrums(); const c = ensure(); if (!c) return;
  const pattern = [[0, 180, 120], [0.25, 0, 0], [0.375, 220, 150], [0.5, 160, 110], [0.75, 240, 140], [0.875, 200, 130]];
  let bar = 0;
  const playBar = () => {
    if (muted) return;
    pattern.forEach(([w, f, f2]) => { if (f) tone(f, 0.18, 'sine', 0.22, w * 1.6, f2); });
    if (bar++ % 2) tone(90, 0.15, 'sine', 0.25, 0.8 * 1.6 / 1.6, 60);
  };
  playBar(); drumTimer = setInterval(playBar, 1600);
}
export function stopDrums() { if (drumTimer) clearInterval(drumTimer); drumTimer = null; }
export function toggleMute() { muted = !muted; return muted; }
