// Banked naira, stars, upgrades and mute — persisted in localStorage.
const KEY = 'nmr-save-v1';

export const UPGRADES = [
  { id: 'hands', name: 'Faster hands', blurb: 'Goods fly to customers sharper, so you keep the combo going.', cost: 8000 },
  { id: 'shelf', name: 'Bigger shelf', blurb: 'Two extra slots on your table. More goods, less wahala.', cost: 15000 },
  { id: 'apprentice', name: 'Apprentice', blurb: 'A small helper auto-serves the most impatient customer every few seconds.', cost: 25000 },
  { id: 'canopy', name: 'Fine canopy', blurb: 'A finer awning. Your stall looks serious, so customers wait a little longer.', cost: 12000 },
];

function blank() {
  return {
    bank: 0,
    muted: false,
    stars: { stall: 0, ojaoba: 0, night: 0 },
    bestCash: { stall: 0, ojaoba: 0, night: 0 },
    upgrades: { hands: 0, shelf: 0, apprentice: 0, canopy: 0 },
  };
}

export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return blank();
    const b = blank();
    b.bank = Math.max(0, Math.floor(Number(raw.bank) || 0));
    b.muted = !!raw.muted;
    for (const k of Object.keys(b.stars)) {
      b.stars[k] = Math.max(0, Math.min(3, Math.floor(Number(raw.stars?.[k]) || 0)));
      b.bestCash[k] = Math.max(0, Math.floor(Number(raw.bestCash?.[k]) || 0));
    }
    for (const k of Object.keys(b.upgrades)) b.upgrades[k] = raw.upgrades?.[k] ? 1 : 0;
    return b;
  } catch {
    return blank();
  }
}

export function saveProgress(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
}

export function buyUpgrade(p, id) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def || p.upgrades[id]) return { ok: false, reason: p.upgrades[id] ? 'already' : 'unknown' };
  if (p.bank < def.cost) return { ok: false, reason: 'broke' };
  p.bank -= def.cost;
  p.upgrades[id] = 1;
  saveProgress(p);
  return { ok: true };
}

/** How many stars a finished shift earns (best-of is applied by the caller). */
export function starsEarned(level, stats) {
  const t = level.stars;
  let n = 0;
  if (stats.cash >= t[0].cash || stats.served >= t[0].served) n = 1;
  if (n >= 1 && stats.cash >= t[1].cash && stats.vexed <= t[1].vexedMax) n = 2;
  if (n >= 2 && stats.cash >= t[2].cash && stats.vexed <= t[2].vexedMax && stats.combo >= t[2].combo) n = 3;
  return n;
}

export function isUnlocked(level, progress) {
  if (level.unlock?.always) return true;
  const need = level.unlock?.needStars || {};
  return Object.entries(need).every(([id, n]) => (progress.stars[id] || 0) >= n);
}
