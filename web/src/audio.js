// Original procedural WebAudio: SFX plus a light afrobeat-ish loop. No third-party samples.
// Sources and licence: docs/AUDIO_CREDITS.md
let ctx = null, muted = false, master = null, musicTimer = null, musicStep = 0, noiseBuf = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = n;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.3, when = 0, slideTo = null) {
  const c = ensure(); if (!c || muted) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(Math.max(20, freq), t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, when, hipass = 800, filterType = 'highpass') {
  const c = ensure(); if (!c || muted || !noiseBuf) return;
  const t = c.currentTime + when;
  const src = c.createBufferSource(); src.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = filterType; f.frequency.setValueAtTime(hipass, t);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.02);
}

function kick(when = 0) {
  tone(90, 0.16, 'sine', 0.42, when, 42);
  tone(55, 0.12, 'triangle', 0.18, when, 36);
}
function clap(when = 0) {
  noise(0.12, 0.22, when, 1800);
  tone(240, 0.08, 'triangle', 0.06, when);
}
function shaker(when = 0, accent = false) {
  noise(accent ? 0.06 : 0.04, accent ? 0.07 : 0.035, when, accent ? 5000 : 7000);
}
function bass(freq, when = 0) {
  tone(freq, 0.22, 'triangle', 0.16, when, freq * 0.85);
}
function lead(freq, when = 0) {
  tone(freq, 0.18, 'sine', 0.07, when);
  tone(freq * 2.01, 0.12, 'sine', 0.03, when);
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
  haggle: () => { tone(392, 0.1, 'triangle', 0.16); tone(494, 0.12, 'triangle', 0.12, 0.08); },
  haggleYes: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, i * 0.07)); },
  haggleNo: () => { tone(220, 0.2, 'sawtooth', 0.14); tone(150, 0.28, 'sawtooth', 0.12, 0.12, 90); },
  buy: () => { tone(660, 0.1, 'square', 0.1); tone(880, 0.16, 'square', 0.1, 0.08); tone(1320, 0.2, 'triangle', 0.12, 0.16); },
  star: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, 'triangle', 0.14, i * 0.09)); },
  lock: () => tone(740, 0.07, 'square', 0.1),
};

// 100 BPM, two-bar loop: kick + clap + shekere + highlife-ish bass, with a light kalimba lead every other bar.
export function startMusic() {
  stopMusic();
  const c = ensure(); if (!c || muted) return;
  const stepMs = 150; // 16th note at 100 BPM
  musicStep = 0;
  const bassLine = [98, 98, 0, 147, 131, 0, 98, 87, 110, 110, 0, 147, 131, 0, 98, 0];
  const melody = [0, 392, 0, 440, 392, 0, 330, 0, 294, 0, 330, 392, 0, 440, 523, 0];
  const playStep = () => {
    if (muted) return;
    const s = musicStep % 32;
    const i = s % 16;
    const bar = Math.floor(s / 16);
    if (i === 0 || i === 6 || i === 8 || i === 14) kick(0);
    if (i === 4 || i === 12) clap(0);
    shaker(0, i % 2 === 0);
    if (bassLine[i]) bass(bassLine[i] * (bar ? 1 : 1), 0);
    if (bar === 1 && melody[i]) lead(melody[i], 0);
    musicStep++;
  };
  playStep();
  musicTimer = setInterval(playStep, stepMs);
}
export function stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; }
export function startDrums() { startMusic(); }
export function stopDrums() { stopMusic(); }
export function isMuted() { return muted; }
export function setMuted(v) {
  muted = !!v;
  if (muted) stopMusic();
  return muted;
}
export function toggleMute() {
  muted = !muted;
  if (muted) stopMusic();
  return muted;
}
