import * as THREE from 'three';
import { createWorld } from './world.js';
import { loadManifest, loadItemModel, loadItemGLB, createPlaceholderItem, defaultManifest, loadSceneryModel, normalize } from './items.js';
import { buildCustomer, setMood, buildApprentice } from './customers.js';
import { sfx, startMusic, stopMusic, toggleMute, setMuted, isMuted } from './audio.js';
import { initMaker } from './maker.js';
import { LEVELS, levelById } from './levels.js';
import { loadProgress, saveProgress, buyUpgrade, starsEarned, isUnlocked, UPGRADES } from './progress.js';

const $ = (id) => document.getElementById(id);
const naira = (n) => '₦' + Math.round(n).toLocaleString('en-NG');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const MAX_REP = 5;
const SPOTS = [new THREE.Vector3(-2.8, 0, -0.05), new THREE.Vector3(0, 0, -0.05), new THREE.Vector3(2.8, 0, -0.05)];
const ITEM_SIZE = 0.95;

const world = createWorld($('scene'));
const { scene, camera, renderer, ring } = world;
const slots = world.slots;

const catalogs = { stall: [], ojaoba: [], night: [] };
const shelf = [];
const customers = [];
const flights = [];
let extras = [];
let nextReplace = 0;
let progress = loadProgress();
let currentLevel = LEVELS[0];
let apprenticeMesh = null;
let apprenticeIn = 0;
let haggleState = null;
let shopReturn = 'start';
let sceneryLux = 0;

const G = { playing: false, paused: false, time: 75, cash: 0, combo: 0, best: 0, served: 0, vexed: 0, rep: MAX_REP, spawnIn: 1, rush: false, levelId: 'stall' };

function slotCount() { return progress.upgrades.shelf ? 14 : 12; }

function labelSprite(text, sub, placeholder) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,248,231,0.95)'; g.strokeStyle = '#1b1b1b'; g.lineWidth = 6;
  g.beginPath(); g.roundRect(4, 4, 312, 88, 20); g.fill(); g.stroke();
  g.fillStyle = '#1b1b1b'; g.textAlign = 'center'; g.font = 'bold 34px Trebuchet MS, sans-serif'; g.fillText(text, 160, 42);
  g.font = 'bold 28px Trebuchet MS, sans-serif'; g.fillStyle = placeholder ? '#8a8a8a' : '#06602b';
  g.fillText(sub + (placeholder ? '  · placeholder' : ''), 160, 78);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(1.15, 0.345, 1); s.renderOrder = 10; return s;
}

function clearShelf() {
  shelf.forEach((s) => { if (!s) return; scene.remove(s.group); scene.remove(s.label); });
  shelf.length = 0;
}

function placeOnShelf(item, idx) {
  const old = shelf[idx];
  if (old) { scene.remove(old.group); scene.remove(old.label); }
  const group = item.template.clone(true);
  group.position.copy(slots[idx]);
  group.rotation.y = -0.3 + Math.random() * 0.6;
  group.userData.slot = idx;
  group.traverse((o) => { o.userData.slot = idx; });
  scene.add(group);
  const label = labelSprite(item.name, naira(item.price), item.isPlaceholder);
  label.position.set(slots[idx].x, slots[idx].y - 0.12, slots[idx].z + 0.58);
  scene.add(label);
  shelf[idx] = { item, group, label, baseY: slots[idx].y, phase: Math.random() * 6 };
}

function replaceShelfMesh(idx, item) {
  const old = shelf[idx];
  if (!old) { placeOnShelf(item, idx); return; }
  scene.remove(old.group); scene.remove(old.label);
  const group = item.template.clone(true);
  group.position.copy(slots[idx]);
  group.rotation.y = old.group.rotation.y;
  group.userData.slot = idx;
  group.traverse((o) => { o.userData.slot = idx; });
  scene.add(group);
  const label = labelSprite(item.name, naira(item.price), item.isPlaceholder);
  label.position.set(slots[idx].x, slots[idx].y - 0.12, slots[idx].z + 0.58);
  scene.add(label);
  shelf[idx] = { item, group, label, baseY: slots[idx].y, phase: old.phase, bounce: 0.25 };
}

function restockShelf() {
  world.layoutSlots(slotCount());
  clearShelf();
  const n = slots.length;
  while (shelf.length < n) shelf.push(null);
  const list = (catalogs[currentLevel.id] || []).concat(extras.filter((e) => e.levelId === currentLevel.id));
  list.slice(0, n).forEach((item, i) => placeOnShelf(item, i));
  nextReplace = n - 1;
}

export function addItemToCatalog(item, { toShelf = true } = {}) {
  item.levelId = item.levelId || currentLevel.id;
  extras.push(item);
  catalogs[item.levelId] = catalogs[item.levelId] || [];
  catalogs[item.levelId].push(item);
  if (toShelf && item.levelId === currentLevel.id) {
    const empty = shelf.findIndex((s) => !s);
    let idx = empty;
    if (idx < 0) { idx = nextReplace; nextReplace = (nextReplace - 1 + slots.length) % slots.length; toast(`${item.name} don land! (${shelf[idx].item.name} moved to store room)`); }
    placeOnShelf(item, idx);
    floatText(slots[idx].clone().add(new THREE.Vector3(0, 1.2, 0)), '✨ NEW!', 'tip');
  }
}

function shelfItems() { return shelf.filter(Boolean).map((s) => s.item); }
function activeCatalog() { return catalogs[currentLevel.id] || []; }

function updateHUD() {
  $('hud-time').textContent = '⏱ ' + Math.ceil(Math.max(0, G.time));
  $('hud-cash').textContent = naira(G.cash);
  $('hud-level').textContent = currentLevel.name;
  const c = $('hud-combo'); c.textContent = G.combo >= 2 ? `🔥 Combo x${G.combo}` : `Combo x${G.combo}`; c.classList.toggle('hot', G.combo >= 3);
  $('hud-rep').textContent = '❤'.repeat(G.rep) + '♡'.repeat(MAX_REP - G.rep);
}
function updateBankLabels() {
  const line = `Banked: ${naira(progress.bank)}  ·  Stars: ${LEVELS.map((l) => '★'.repeat(progress.stars[l.id] || 0) + '☆'.repeat(3 - (progress.stars[l.id] || 0))).join('  ')}`;
  if ($('bank-status')) $('bank-status').textContent = line;
  if ($('levels-bank')) $('levels-bank').textContent = `Banked ${naira(progress.bank)}`;
  if ($('shop-bank')) $('shop-bank').textContent = naira(progress.bank);
}
let toastT = null;
function toast(msg, ms = 2200) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms); }

const tmpV = new THREE.Vector3();
function toScreen(v) { tmpV.copy(v).project(camera); return { x: (tmpV.x * 0.5 + 0.5) * window.innerWidth, y: (-tmpV.y * 0.5 + 0.5) * window.innerHeight }; }
function floatText(worldPos, text, cls = '') {
  const p = toScreen(worldPos); const el = document.createElement('div');
  el.className = 'floater ' + cls; el.textContent = text; el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  $('floaters').appendChild(el); setTimeout(() => el.remove(), 1150);
}

const ANGRY = ['Abeg I don go! 😤', 'You dey whine me?!', 'Na so una dey do business?', 'I go buy for Iya Bisi side!', 'Time na money o!'];
const HAPPY = ['Correct! 🙌', 'E choke!', 'God bless your hustle!', 'Na you sabi!', 'Better market!', 'Thank you ma!'];
const VIP_LINES = ['Alhaji don land! 👑', 'Big man dey come!', 'Chief don enter the market!'];
const HAGGLE_LINES = ['Abeg, come down small!', 'This price too high o!', 'Last last, how much?', 'Make we reason the price.', 'I go pay, but no be this one.'];

function chooseRequest() {
  const items = shelfItems(); if (!items.length) return null;
  const busy = new Set(customers.filter((c) => c.state === 'wait' || c.state === 'walkin').map((c) => c.item.id));
  let pool = items.filter((i) => !busy.has(i.id)); if (!pool.length) pool = items;
  const weighted = pool.flatMap((i) => (i.fresh ? [i, i, i] : [i]));
  return pick(weighted);
}

function pickType(vip) {
  const types = currentLevel.customerTypes || ['regular'];
  if (vip) {
    if (types.includes('chief')) return 'chief';
    if (types.includes('alhaji')) return 'alhaji';
    if (types.includes('geleQueen')) return 'geleQueen';
    return types[0];
  }
  const pool = types.filter((t) => t !== 'alhaji' && t !== 'chief');
  return pick(pool.length ? pool : types);
}

function spawnCustomer() {
  const free = SPOTS.map((_, i) => i).filter((i) => !customers.some((c) => c.spot === i && c.state !== 'leave'));
  if (!free.length) return;
  const spot = pick(free);
  const item = chooseRequest(); if (!item) return;
  const vip = G.time < currentLevel.duration - 10 && Math.random() < currentLevel.vipChance;
  const type = pickType(vip);
  const mesh = buildCustomer({ vip, type });
  const fromLeft = SPOTS[spot].x < 0 || (SPOTS[spot].x === 0 && Math.random() < 0.5);
  const start = new THREE.Vector3(fromLeft ? -8.2 : 8.2, 0, -1.6);
  mesh.position.copy(start); scene.add(mesh);
  const p = G.time / currentLevel.duration;
  let maxPat = (vip ? currentLevel.patience.vip : currentLevel.patience.base) - currentLevel.patience.decay * (1 - p);
  if (progress.upgrades.canopy) maxPat *= 1.18;
  const haggle = !vip && Math.random() < currentLevel.haggleChance;
  let line = pick(item.requests && item.requests.length ? item.requests : [`Abeg, bring ${item.name}!`]);
  if (item.fresh && Math.random() < 0.5) line = `I hear say you get ${item.name}! Bring am!`;
  if (haggle) line = pick(HAGGLE_LINES) + '  ' + (item.name);
  const el = document.createElement('div');
  el.className = 'bubble' + (vip ? ' vip' : '') + (haggle ? ' haggle' : '');
  el.innerHTML = `<div class="say"></div><span class="want"></span><div class="bar"><i></i></div>`;
  el.querySelector('.say').textContent = (vip ? '👑 ' : haggle ? '💬 ' : '') + line;
  el.querySelector('.want').textContent = `${item.name}${vip ? ' · pays x2' : haggle ? ' · wan haggle' : ''}`;
  el.style.display = 'none';
  $('bubbles').appendChild(el);
  const c = { mesh, spot, item, vip, type, haggle, haggled: false, state: 'walkin', t: 0, from: start, to: SPOTS[spot].clone(), patience: maxPat, maxPat, el, exit: new THREE.Vector3(fromLeft ? 9.5 : -9.5, 0, -1.6) };
  customers.push(c);
  if (vip) { sfx.vip(); toast(pick(VIP_LINES)); } else sfx.arrive();
}

function leave(c, mood) {
  c.state = 'leave'; c.t = 0; c.from = c.mesh.position.clone(); setMood(c.mesh, mood);
  c.el.classList.remove('vip'); c.el.classList.add(mood === 'happy' ? 'happy' : 'angry');
  c.el.querySelector('.say').textContent = mood === 'happy' ? pick(HAPPY) : pick(ANGRY);
  c.el.querySelector('.want').style.display = 'none'; c.el.querySelector('.bar').style.display = 'none';
  setTimeout(() => c.el.remove(), 1400);
}

function updateCustomers(dt) {
  for (let i = customers.length - 1; i >= 0; i--) {
    const c = customers[i]; c.t += dt;
    const head = c.mesh.position.clone().add(new THREE.Vector3(0, 2.15 * c.mesh.scale.y, 0));
    if (c.state === 'walkin') {
      const lane = new THREE.Vector3(c.to.x, 0, -1.6);
      const k1 = Math.min(1, c.t / 0.5), k2 = Math.max(0, Math.min(1, (c.t - 0.5) / 0.25));
      if (k2 <= 0) c.mesh.position.lerpVectors(c.from, lane, 1 - Math.pow(1 - k1, 2));
      else c.mesh.position.lerpVectors(lane, c.to, k2);
      c.mesh.position.y = Math.abs(Math.sin(c.t * 14)) * 0.08;
      c.mesh.rotation.y = k2 > 0 ? 0 : (c.from.x < 0 ? Math.PI / 2 : -Math.PI / 2);
      if (k1 >= 1 && k2 >= 1) { c.state = 'wait'; c.t = 0; c.mesh.position.copy(c.to); c.mesh.position.y = 0; c.el.style.display = ''; }
    } else if (c.state === 'wait') {
      if (G.playing && !G.paused) c.patience -= dt;
      const r = Math.max(0, c.patience / c.maxPat);
      const bar = c.el.querySelector('.bar i'); bar.style.width = (r * 100).toFixed(1) + '%';
      bar.style.background = r > 0.5 ? '#0b8a3e' : r > 0.25 ? '#ff9f1a' : '#e63946';
      c.mesh.position.y = r < 0.25 ? Math.abs(Math.sin(c.t * 20)) * 0.06 : 0;
      c.mesh.rotation.y = Math.sin(c.t * 2) * 0.12;
      if (c.patience <= 0) {
        leave(c, 'angry'); sfx.angry();
        G.combo = 0; G.vexed++; G.rep--; floatText(head, '-❤', 'bad'); updateHUD();
        if (G.rep <= 0) endRound('Market people don report you! 😬');
      }
    } else if (c.state === 'served') {
      c.mesh.position.y = 0;
    } else if (c.state === 'leave') {
      const k = Math.min(1, c.t / 1.4);
      c.mesh.position.lerpVectors(c.from, c.exit, k * k);
      c.mesh.position.y = Math.abs(Math.sin(c.t * 14)) * 0.1;
      c.mesh.rotation.y = c.exit.x > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (k >= 1) { scene.remove(c.mesh); c.el.remove(); customers.splice(i, 1); continue; }
    }
    if (c.el.isConnected) { const p = toScreen(head); const half = Math.min(110, (c.el.offsetWidth || 160) / 2) + 6; c.el.style.left = Math.max(half, Math.min(window.innerWidth - half, p.x)) + 'px'; c.el.style.top = Math.max(c.el.offsetHeight + 60, p.y) + 'px'; }
  }
}

function flyAndPay(c, item, s, priceMul, opts = {}) {
  c.state = 'served';
  const ratio = c.patience / c.maxPat;
  const from = s.group.position.clone().add(new THREE.Vector3(0, 0.4, 0));
  const ghost = item.template.clone(true); ghost.position.copy(from); scene.add(ghost);
  const to = c.mesh.position.clone().add(new THREE.Vector3(0, 1.2 * c.mesh.scale.y, 0.35));
  const dur = progress.upgrades.hands ? 0.28 : 0.45;
  flights.push({ obj: ghost, from, to, t: 0, dur, onDone: () => pay(c, item, ratio, ghost, priceMul, opts) });
  sfx.whoosh();
}

function pay(c, item, ratio, ghost, priceMul = 1, opts = {}) {
  G.combo++; G.best = Math.max(G.best, G.combo); G.served++;
  let amount = item.price * (c.vip ? 2 : 1) * (item.fresh ? 1.5 : 1) * (1 + 0.1 * Math.min(G.combo - 1, 10)) * priceMul;
  const tip = !opts.noTip && ratio > 0.6 ? Math.round(item.price * 0.2 / 50) * 50 : 0;
  const bonus = opts.bonus ? Math.round(item.price * opts.bonus / 50) * 50 : 0;
  amount = Math.round(amount / 50) * 50;
  G.cash += amount + tip + bonus;
  const head = c.mesh.position.clone().add(new THREE.Vector3(0, 2.4 * c.mesh.scale.y, 0));
  floatText(head, '+' + naira(amount), ''); sfx.cash(G.combo);
  if (tip) setTimeout(() => { floatText(head.clone().add(new THREE.Vector3(0.8, -0.3, 0)), `Tip +${naira(tip)}`, 'tip'); sfx.tip(); }, 200);
  if (bonus) setTimeout(() => { floatText(head.clone().add(new THREE.Vector3(-0.8, -0.2, 0)), `Fine deal +${naira(bonus)}`, 'tip'); sfx.tip(); }, 280);
  if (G.combo > 0 && G.combo % 5 === 0) toast(`🔥 ${G.combo} in a row! You dey hot!`);
  scene.remove(ghost); const carried = item.template.clone(true); carried.scale.multiplyScalar(0.7);
  carried.position.set(0, 1.95, 0); c.mesh.add(carried);
  leave(c, 'happy'); updateHUD();
}

function serve(slotIdx, { fromApprentice = false } = {}) {
  const s = shelf[slotIdx]; if (!s || !G.playing || G.paused) return;
  const item = s.item;
  const wanting = customers.filter((c) => c.state === 'wait' && c.item.id === item.id).sort((a, b) => a.patience - b.patience);
  const from = s.group.position.clone().add(new THREE.Vector3(0, 0.4, 0));
  s.bounce = 0.25;
  if (!wanting.length) {
    G.combo = 0; G.cash = Math.max(0, G.cash - 200); sfx.wrong();
    floatText(from.clone().add(new THREE.Vector3(0, 0.6, 0)), 'Nobody ask for am! -₦200', 'bad');
    const waiting = customers.filter((c) => c.state === 'wait');
    waiting.forEach((c) => { c.el.classList.add('angry'); setTimeout(() => c.el.classList.remove('angry'), 350); });
    updateHUD(); return;
  }
  const c = wanting[0];
  if (c.haggle && !c.haggled && !fromApprentice) { beginHaggle(c, item, s); return; }
  flyAndPay(c, item, s, 1);
}

function offerAt(t) {
  const pts = [[0, 0.55], [0.35, 0.85], [0.62, 1.00], [0.78, 1.18], [1, 1.40]];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
      const k = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * k;
    }
  }
  return 1.4;
}
function needleT() {
  const period = 1.05;
  const x = (performance.now() / 1000) % (period * 2);
  return x < period ? x / period : 2 - x / period;
}

function beginHaggle(c, item, s) {
  G.paused = true;
  c.haggled = true;
  s.bounce = 0.25;
  sfx.haggle();
  haggleState = { c, item, s, open: true };
  $('haggle-title').textContent = pick(HAGGLE_LINES);
  $('haggle-line').textContent = `${c.mesh.userData.type === 'geleQueen' ? 'Madam' : 'This customer'} wan reason the price of ${item.name}. Tap Lock am! when the needle dey green or gold.`;
  $('haggle-item').textContent = `Listed: ${naira(item.price)}`;
  $('haggle').classList.remove('hidden');
}

function closeHaggle() {
  $('haggle').classList.add('hidden');
  haggleState = null;
  if (G.playing) G.paused = false;
}

function lockHaggle() {
  if (!haggleState) return;
  const { c, item, s } = haggleState;
  const t = needleT();
  const mul = offerAt(t);
  const price = Math.round((item.price * mul) / 50) * 50;
  sfx.lock();
  closeHaggle();
  if (t > 0.86) {
    G.combo = 0;
    leave(c, 'angry'); sfx.haggleNo();
    const head = c.mesh.position.clone().add(new THREE.Vector3(0, 2.2 * c.mesh.scale.y, 0));
    floatText(head, 'Too costly! They waka', 'bad');
    toast('E don too cost! They waka go another stall.');
    updateHUD();
    return;
  }
  sfx.haggleYes();
  const opts = { noTip: t < 0.35, bonus: (t >= 0.62 && t <= 0.78) ? 0.15 : 0 };
  if (t < 0.35) toast('You almost gave am free — but at least they buy.');
  else if (opts.bonus) toast('Fine deal! They pay a sweet price.');
  flyAndPay(c, item, s, mul, opts);
}
$('haggle-lock').onclick = lockHaggle;

function updateFlights(dt) {
  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i]; f.t += dt; const k = Math.min(1, f.t / f.dur);
    f.obj.position.lerpVectors(f.from, f.to, k); f.obj.position.y += Math.sin(k * Math.PI) * 1.4;
    f.obj.rotation.y += dt * 12;
    if (k >= 1) { flights.splice(i, 1); f.onDone(); }
  }
}

function autoServe() {
  const waiting = customers.filter((c) => c.state === 'wait' && !(c.haggle && !c.haggled)).sort((a, b) => a.patience - b.patience);
  for (const c of waiting) {
    const i = shelf.findIndex((s) => s && s.item.id === c.item.id);
    if (i >= 0) { serve(i, { fromApprentice: true }); toast(`Apprentice don serve ${c.item.name}!`); return; }
  }
}

function showApprentice(on) {
  if (apprenticeMesh) { scene.remove(apprenticeMesh); apprenticeMesh = null; }
  world.apprenticeAnchor.visible = !!on;
  if (on) {
    apprenticeMesh = buildApprentice();
    apprenticeMesh.rotation.y = -0.6;
    world.apprenticeAnchor.add(apprenticeMesh);
    world.apprenticeAnchor.visible = true;
  }
}

const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
function hitSlot(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const targets = shelf.filter(Boolean).flatMap((s) => [s.group, s.label]);
  const hit = ray.intersectObjects(targets, true)[0];
  if (hit) { let o = hit.object; while (o && o.userData.slot === undefined) o = o.parent; if (o) return o.userData.slot; }
  let best = -1, bd = 1e9;
  shelf.forEach((s, i) => { if (!s) return; const p = toScreen(s.group.position.clone().add(new THREE.Vector3(0, 0.4, 0))); const d = Math.hypot(p.x - ev.clientX, p.y - ev.clientY); if (d < bd) { bd = d; best = i; } });
  return bd < Math.min(70, window.innerWidth / 14) ? best : -1;
}
renderer.domElement.addEventListener('pointerdown', (ev) => { sfx.unlock(); const i = hitSlot(ev); if (i >= 0) serve(i); });
renderer.domElement.addEventListener('pointermove', (ev) => {
  if (ev.pointerType !== 'mouse') return; const i = hitSlot(ev);
  if (i >= 0 && slots[i]) { ring.visible = true; ring.position.set(slots[i].x, slots[i].y + 0.02, slots[i].z); renderer.domElement.style.cursor = 'pointer'; }
  else { ring.visible = false; renderer.domElement.style.cursor = ''; }
});

function clearCustomers() { customers.forEach((c) => { scene.remove(c.mesh); c.el.remove(); }); customers.length = 0; }

function applyWorld() {
  world.setTheme(currentLevel.theme);
  const night = currentLevel.theme === 'night';
  const royal = currentLevel.theme === 'royal';
  world.setSign(currentLevel.sign, night ? '#1a1535' : royal ? '#d4a017' : '#ffd23f', night ? '#ffe7b0' : '#1b1b1b');
  world.setCanopy(!!progress.upgrades.canopy);
  showApprentice(!!progress.upgrades.apprentice);
  $('hud-level').textContent = currentLevel.name;
}

function startRound(levelArg) {
  if (typeof levelArg === 'string') currentLevel = levelById(levelArg);
  else if (levelArg && levelArg.id) currentLevel = levelArg;
  if (!isUnlocked(currentLevel, progress)) { toast(currentLevel.unlockText || 'That market still locked.'); return; }
  sfx.unlock(); clearCustomers();
  applyWorld();
  restockShelf();
  Object.assign(G, { playing: true, paused: false, time: currentLevel.duration, cash: 0, combo: 0, best: 0, served: 0, vexed: 0, rep: MAX_REP, spawnIn: 0.2, rush: false, levelId: currentLevel.id });
  apprenticeIn = 6;
  hideScreens();
  $('hud').classList.remove('hidden'); $('hint').classList.remove('hidden');
  updateHUD();
  if (!progress.muted) startMusic();
  toast(`${currentLevel.name} don open! Serve dem quick quick!`);
  hydrateGLBModels();
}

function starString(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }

function endRound(reason) {
  if (!G.playing) return; G.playing = false; stopMusic(); $('hint').classList.add('hidden'); sfx.end();
  if (haggleState) closeHaggle();
  customers.filter((c) => c.state === 'wait').forEach((c) => leave(c, 'angry'));
  const stats = { cash: G.cash, served: G.served, vexed: G.vexed, combo: G.best };
  const got = starsEarned(currentLevel, stats);
  const prev = progress.stars[currentLevel.id] || 0;
  const fresh = got > prev;
  if (fresh) { progress.stars[currentLevel.id] = got; sfx.star(); }
  progress.bestCash[currentLevel.id] = Math.max(progress.bestCash[currentLevel.id] || 0, G.cash);
  progress.bank += G.cash;
  saveProgress(progress);
  const newly = LEVELS.filter((l) => isUnlocked(l, progress) && l.unlock?.needStars && Object.keys(l.unlock.needStars).includes(currentLevel.id) && (prev < (l.unlock.needStars[currentLevel.id] || 1)) && got >= (l.unlock.needStars[currentLevel.id] || 1));
  const ranks = [[20000, 'Small Pikin Trader', 'You go learn. Even Mama Put start small!'], [60000, 'Market Hustler', 'Your hustle dey show. Next shift, chase combo!'], [120000, 'Iya Oloja', 'The whole market dey hail you!'], [Infinity, 'Market Chairman 👑', 'Na you get this market. Dangote dey call you!']];
  const [, title, line] = ranks.find(([t]) => G.cash < t);
  $('over-title').textContent = title;
  $('over-stars').textContent = starString(got);
  $('over-line').textContent = (reason ? reason + ' ' : '') + line + (fresh ? `  New best: ${got} star${got === 1 ? '' : 's'}!` : '');
  if (newly.length) $('over-line').textContent += '  🔓 ' + newly.map((l) => l.name).join(' & ') + ' unlocked!';
  $('st-cash').textContent = naira(G.cash); $('st-served').textContent = G.served; $('st-combo').textContent = G.best; $('st-vexed').textContent = G.vexed;
  $('over-bank').textContent = `Banked ${naira(G.cash)} this shift. Total bank: ${naira(progress.bank)}.`;
  updateBankLabels();
  setTimeout(() => $('over').classList.remove('hidden'), 700);
}

function tickGame(dt) {
  if (!G.playing || G.paused) return;
  const prev = Math.ceil(G.time);
  G.time -= dt;
  if (Math.ceil(G.time) !== prev) { updateHUD(); if (G.time < 6) sfx.tick(); }
  if (!G.rush && G.time <= currentLevel.rushAt) { G.rush = true; toast('⚡ RUSH HOUR! Everybody dey come!'); }
  G.spawnIn -= dt;
  if (G.spawnIn <= 0) {
    spawnCustomer();
    const p = 1 - G.time / currentLevel.duration;
    G.spawnIn = (G.rush ? currentLevel.spawn.rush : currentLevel.spawn.base - (currentLevel.spawn.base - currentLevel.spawn.rush) * 0.45 * p) + Math.random() * currentLevel.spawn.variance;
  }
  if (progress.upgrades.apprentice) {
    apprenticeIn -= dt;
    if (apprenticeIn <= 0) { apprenticeIn = 7; autoServe(); }
  }
  if (G.time <= 0) { G.time = 0; updateHUD(); endRound(); }
}

function hideScreens() {
  ['start', 'over', 'levels', 'shop', 'maker', 'haggle'].forEach((id) => $(id).classList.add('hidden'));
}

function openLevels() {
  renderLevelSelect();
  updateBankLabels();
  $('start').classList.add('hidden');
  $('over').classList.add('hidden');
  $('shop').classList.add('hidden');
  $('levels').classList.remove('hidden');
}
function openShop(from) {
  shopReturn = from || 'start';
  renderShop();
  $('start').classList.add('hidden');
  $('over').classList.add('hidden');
  $('levels').classList.add('hidden');
  $('shop').classList.remove('hidden');
}
function closeShop() {
  $('shop').classList.add('hidden');
  if (shopReturn === 'levels') openLevels();
  else if (shopReturn === 'over') $('over').classList.remove('hidden');
  else $('start').classList.remove('hidden');
}

function renderLevelSelect() {
  const grid = $('level-grid'); grid.innerHTML = '';
  LEVELS.forEach((l) => {
    const open = isUnlocked(l, progress);
    const btn = document.createElement('button');
    btn.className = 'level-card' + (l.theme === 'night' ? ' night' : l.theme === 'royal' ? ' royal' : '') + (open ? '' : ' locked');
    btn.disabled = !open;
    btn.dataset.level = l.id;
    const stars = progress.stars[l.id] || 0;
    btn.innerHTML = `<div class="kicker">${l.kicker}</div><h3>${l.name}</h3><p class="sub">${l.subtitle}</p><div class="stars">${starString(stars)}</div><p class="need">${open ? (progress.bestCash[l.id] ? 'Best: ' + naira(progress.bestCash[l.id]) : l.description) : '🔒 ' + (l.unlockText || 'Locked')}</p>`;
    if (open) btn.onclick = () => startRound(l);
    grid.appendChild(btn);
  });
}

function renderShop() {
  updateBankLabels();
  const list = $('shop-list'); list.innerHTML = '';
  $('shop-err').classList.add('hidden');
  UPGRADES.forEach((u) => {
    const owned = !!progress.upgrades[u.id];
    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `<div class="grow"><h3>${u.name}</h3><p>${u.blurb}</p></div>`;
    const b = document.createElement('button');
    b.className = 'btn' + (owned ? '' : ' primary');
    b.textContent = owned ? 'Owned' : naira(u.cost);
    b.disabled = owned;
    b.dataset.upgrade = u.id;
    b.onclick = () => {
      const res = buyUpgrade(progress, u.id);
      if (!res.ok) {
        $('shop-err').textContent = res.reason === 'broke' ? 'Your bank no reach that one yet. Go hustle another shift!' : 'You already get this one.';
        $('shop-err').classList.remove('hidden');
        sfx.wrong(); return;
      }
      sfx.buy();
      applyWorld();
      if (G.playing) restockShelf();
      toast(`✔ ${u.name} don land!`);
      renderShop();
    };
    row.appendChild(b);
    list.appendChild(row);
  });
}

// ---------- main loop ----------
const clock = new THREE.Clock(); let elapsed = 0;
function loop() {
  const dt = Math.min(0.1, clock.getDelta()); elapsed += dt;
  tickGame(dt);
  updateCustomers(dt);
  updateFlights(dt);
  world.animateCrowd(elapsed);
  shelf.forEach((s) => {
    if (!s) return;
    s.phase += dt;
    const bob = Math.sin(s.phase * 2.2) * 0.03;
    const bounce = s.bounce ? (s.bounce = Math.max(0, s.bounce - dt)) && Math.sin((0.25 - s.bounce) * 20) * 0.12 : 0;
    s.group.position.y = s.baseY + bob + bounce;
  });
  if (haggleState) {
    const t = needleT();
    $('haggle-needle').style.left = (t * 100).toFixed(2) + '%';
    const price = Math.round((haggleState.item.price * offerAt(t)) / 50) * 50;
    $('haggle-price').textContent = naira(price);
    $('haggle-price').style.color = t > 0.86 ? '#e63946' : (t >= 0.62 && t <= 0.78) ? '#b06d00' : '#06602b';
  }
  if (apprenticeMesh) apprenticeMesh.position.y = Math.abs(Math.sin(elapsed * 4)) * 0.05;
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

let hydrating = false;
async function hydrateGLBModels() {
  if (hydrating) return;
  hydrating = true;
  let luxCount = 0;
  const levelOrder = [currentLevel.id, ...LEVELS.map((l) => l.id).filter((id) => id !== currentLevel.id)];
  for (const levelId of levelOrder) {
    const cat = catalogs[levelId];
    if (!cat) continue;
    for (const item of cat) {
      if (!item.isPlaceholder || !item.rawItem?.glb) {
        if (!item.isPlaceholder) luxCount++;
        continue;
      }
      try {
        const obj = await loadItemGLB(item.rawItem, ITEM_SIZE, 8000);
        if (obj) {
          item.template = obj;
          item.isPlaceholder = false;
          item.source = 'lux3d';
          luxCount++;
          const slotIdx = shelf.findIndex((s) => s && s.item.id === item.id);
          if (slotIdx >= 0) {
            replaceShelfMesh(slotIdx, item);
          }
          if ($('asset-status')) {
            $('asset-status').textContent = `✨ ${luxCount}/36 Lux3D models active · Market fully stocked!`;
          }
        }
      } catch (err) {
        console.warn(`GLB load skipped for ${item.name}:`, err.message || err);
      }
    }
  }
  if ($('asset-status')) {
    $('asset-status').textContent = `✨ All ${luxCount} Lux3D models active across 3 markets!`;
  }
  hydrating = false;
}

async function boot() {
  setMuted(!!progress.muted);
  $('btn-mute').textContent = progress.muted ? '🔇' : '🔊';

  let manifest = defaultManifest;
  try {
    const fetched = await loadManifest();
    if (fetched && fetched.levels) manifest = fetched;
  } catch (_) { /* use bundled manifest */ }

  const groups = manifest.levels && manifest.levels.length
    ? manifest.levels
    : [{ id: 'stall', items: manifest.items || [], scenery: manifest.scenery || [] }];

  let total = 0;
  for (const g of groups) {
    catalogs[g.id] = (g.items || []).map((it) => {
      total++;
      const ph = createPlaceholderItem(it, ITEM_SIZE);
      return {
        id: it.id,
        name: it.name,
        price: it.price,
        requests: it.requests,
        template: ph.object,
        isPlaceholder: true,
        fresh: false,
        source: 'placeholder',
        levelId: g.id,
        rawItem: it,
      };
    });
  }

  applyWorld();
  restockShelf();
  renderLevelSelect();
  renderShop();
  updateBankLabels();

  $('asset-status').textContent = `✨ Market ready! ${total} items stocked across ${groups.length} markets.`;

  window.__nmr = {
    G, catalogs, get catalog() { return activeCatalog(); }, shelf, customers,
    serve, startRound, spawnCustomer, endRound, progress, LEVELS, openLevels, openShop,
    beginHaggle, lockHaggle, offerAt, needleT,
    buyUpgrade: (id) => { const r = buyUpgrade(progress, id); if (r.ok) { applyWorld(); renderShop(); updateBankLabels(); } return r; },
    setProgress(p) { progress = p; saveProgress(p); applyWorld(); renderLevelSelect(); renderShop(); updateBankLabels(); },
    unlockAll() { LEVELS.forEach((l) => { if ((progress.stars[l.id] || 0) < 1) progress.stars[l.id] = 1; }); saveProgress(progress); renderLevelSelect(); updateBankLabels(); },
    grantBank(n) { progress.bank += n; saveProgress(progress); renderShop(); updateBankLabels(); },
    saveProgress, isUnlocked, starsEarned, currentLevel: () => currentLevel, restockShelf, applyWorld, hydrateGLBModels,
  };

  hydrateGLBModels();
}

$('btn-markets').onclick = openLevels;
$('btn-over-markets').onclick = openLevels;
$('levels-close').onclick = () => { $('levels').classList.add('hidden'); $('start').classList.remove('hidden'); };
$('btn-shop-start').onclick = () => openShop('start');
$('btn-shop-levels').onclick = () => openShop('levels');
$('btn-shop-over').onclick = () => openShop('over');
$('shop-close').onclick = closeShop;
$('btn-again').onclick = () => startRound(currentLevel);
$('btn-mute').onclick = () => {
  const m = toggleMute();
  progress.muted = m; saveProgress(progress);
  $('btn-mute').textContent = m ? '🔇' : '🔊';
  if (m) stopMusic(); else if (G.playing) startMusic();
};

initMaker({
  onOpen: () => { if (G.playing) G.paused = true; },
  onClose: () => { if (G.playing && !haggleState) G.paused = false; },
  onItem: (obj, meta) => {
    const id = 'made_' + Date.now();
    addItemToCatalog({ id, name: meta.name, price: meta.price, requests: [meta.line || `Abeg, bring ${meta.name}!`], template: normalize(obj, ITEM_SIZE), isPlaceholder: false, fresh: true, source: meta.source, levelId: currentLevel.id });
    toast(`✨ ${meta.name} dey your shelf now. Fresh items sell for 1.5x!`, 3000);
  },
  buttons: [$('btn-make-start'), $('btn-make-over'), $('btn-make-hud')],
});

boot();
loop();
