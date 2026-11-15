import * as THREE from 'three';
import { createWorld } from './world.js';
import { loadManifest, loadItemModel, loadSceneryModel, normalize } from './items.js';
import { buildCustomer, setMood } from './customers.js';
import { sfx, startDrums, stopDrums, toggleMute } from './audio.js';
import { initMaker } from './maker.js';

const $ = (id) => document.getElementById(id);
const naira = (n) => '₦' + Math.round(n).toLocaleString('en-NG');
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const ROUND = 75;            // seconds per shift
const MAX_REP = 5;
const SPOTS = [new THREE.Vector3(-2.8, 0, -0.05), new THREE.Vector3(0, 0, -0.05), new THREE.Vector3(2.8, 0, -0.05)];
const ITEM_SIZE = 0.95;

const world = createWorld($('scene'));
const { scene, camera, renderer, slots, ring } = world;

const catalog = [];            // all sellable items {id,name,price,requests,template,isPlaceholder,fresh,source}
const shelf = new Array(slots.length).fill(null); // {item, group, label}
const customers = [];
const flights = [];
let nextReplace = slots.length - 1;

const G = { playing: false, paused: false, time: ROUND, cash: 0, combo: 0, best: 0, served: 0, vexed: 0, rep: MAX_REP, spawnIn: 1, rush: false };

// ---------- labels ----------
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

// ---------- shelf ----------
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

export function addItemToCatalog(item, { toShelf = true } = {}) {
  catalog.push(item);
  if (toShelf) {
    const empty = shelf.findIndex((s) => !s);
    let idx = empty;
    if (idx < 0) { idx = nextReplace; nextReplace = (nextReplace - 1 + slots.length) % slots.length; toast(`${item.name} don land! (${shelf[idx].item.name} moved to store room)`); }
    placeOnShelf(item, idx);
    // sparkle
    floatText(slots[idx].clone().add(new THREE.Vector3(0, 1.2, 0)), '✨ NEW!', 'tip');
  }
}

function shelfItems() { return shelf.filter(Boolean).map((s) => s.item); }

// ---------- HUD / UI ----------
function updateHUD() {
  $('hud-time').textContent = '⏱ ' + Math.ceil(G.time);
  $('hud-cash').textContent = naira(G.cash);
  const c = $('hud-combo'); c.textContent = G.combo >= 2 ? `🔥 Combo x${G.combo}` : `Combo x${G.combo}`; c.classList.toggle('hot', G.combo >= 3);
  $('hud-rep').textContent = '❤'.repeat(G.rep) + '♡'.repeat(MAX_REP - G.rep);
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

// ---------- customers ----------
const ANGRY = ['Abeg I don go! 😤', 'You dey whine me?!', 'Na so una dey do business?', 'I go buy for Iya Bisi side!', 'Time na money o!'];
const HAPPY = ['Correct! 🙌', 'E choke!', 'God bless your hustle!', 'Na you sabi!', 'Better market!', 'Thank you ma!'];
const VIP_LINES = ['Alhaji don land! 👑', 'Big man dey come!'];

function chooseRequest() {
  const items = shelfItems(); if (!items.length) return null;
  const busy = new Set(customers.filter((c) => c.state === 'wait' || c.state === 'walkin').map((c) => c.item.id));
  let pool = items.filter((i) => !busy.has(i.id)); if (!pool.length) pool = items;
  const weighted = pool.flatMap((i) => (i.fresh ? [i, i, i] : [i]));
  return pick(weighted);
}

function spawnCustomer() {
  const free = SPOTS.map((_, i) => i).filter((i) => !customers.some((c) => c.spot === i && c.state !== 'leave'));
  if (!free.length) return;
  const spot = pick(free);
  const item = chooseRequest(); if (!item) return;
  const vip = G.time < ROUND - 10 && Math.random() < 0.12;
  const mesh = buildCustomer(vip);
  const fromLeft = SPOTS[spot].x < 0 || (SPOTS[spot].x === 0 && Math.random() < 0.5);
  const start = new THREE.Vector3(fromLeft ? -16 : 16, 0, -1.6);
  mesh.position.copy(start); scene.add(mesh);
  const p = G.time / ROUND; // 1 -> 0
  const maxPat = (vip ? 9 : 12.5) - 4.5 * (1 - p);
  let line = pick(item.requests && item.requests.length ? item.requests : [`Abeg, bring ${item.name}!`]);
  if (item.fresh && Math.random() < 0.5) line = `I hear say you get ${item.name}! Bring am!`;
  const el = document.createElement('div');
  el.className = 'bubble' + (vip ? ' vip' : '');
  el.innerHTML = `<div class="say"></div><span class="want"></span><div class="bar"><i></i></div>`;
  el.querySelector('.say').textContent = (vip ? '👑 ' : '') + line;
  el.querySelector('.want').textContent = `${item.name}${vip ? ' · pays x2' : ''}`;
  el.style.display = 'none';
  $('bubbles').appendChild(el);
  const c = { mesh, spot, item, vip, state: 'walkin', t: 0, from: start, to: SPOTS[spot].clone(), patience: maxPat, maxPat, el, exit: new THREE.Vector3(fromLeft ? 16 : -16, 0, -1.6) };
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
      const k1 = Math.min(1, c.t / 0.9), k2 = Math.max(0, Math.min(1, (c.t - 0.9) / 0.3));
      if (k2 <= 0) c.mesh.position.lerpVectors(c.from, lane, 1 - Math.pow(1 - k1, 2));
      else c.mesh.position.lerpVectors(lane, c.to, k2);
      c.mesh.position.y = Math.abs(Math.sin(c.t * 14)) * 0.08;
      c.mesh.rotation.y = k2 <= 0 ? (c.from.x < 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
      const k = k2;
      if (k >= 1) { c.state = 'wait'; c.mesh.rotation.y = 0; c.el.style.display = ''; }
    } else if (c.state === 'wait') {
      if (G.playing && !G.paused) c.patience -= dt;
      const r = Math.max(0, c.patience / c.maxPat);
      const bar = c.el.querySelector('.bar i'); bar.style.width = (r * 100).toFixed(1) + '%';
      bar.style.background = r > 0.5 ? '#0b8a3e' : r > 0.25 ? '#ff9f1a' : '#e63946';
      c.mesh.position.y = r < 0.25 ? Math.abs(Math.sin(c.t * 20)) * 0.06 : 0; // impatient hop
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

// ---------- serving ----------
function serve(slotIdx) {
  const s = shelf[slotIdx]; if (!s || !G.playing || G.paused) return;
  const item = s.item;
  const wanting = customers.filter((c) => c.state === 'wait' && c.item.id === item.id).sort((a, b) => a.patience - b.patience);
  const from = s.group.position.clone().add(new THREE.Vector3(0, 0.4, 0));
  // tap bounce
  s.bounce = 0.25;
  if (!wanting.length) {
    G.combo = 0; G.cash = Math.max(0, G.cash - 200); sfx.wrong();
    floatText(from.clone().add(new THREE.Vector3(0, 0.6, 0)), 'Nobody ask for am! -₦200', 'bad');
    const waiting = customers.filter((c) => c.state === 'wait');
    waiting.forEach((c) => { c.el.classList.add('angry'); setTimeout(() => c.el.classList.remove('angry'), 350); });
    updateHUD(); return;
  }
  const c = wanting[0]; c.state = 'served';
  const ratio = c.patience / c.maxPat;
  const ghost = item.template.clone(true); ghost.position.copy(from); scene.add(ghost);
  const to = c.mesh.position.clone().add(new THREE.Vector3(0, 1.2 * c.mesh.scale.y, 0.35));
  flights.push({ obj: ghost, from, to, t: 0, dur: 0.45, onDone: () => pay(c, item, ratio, ghost) });
  sfx.whoosh();
}

function pay(c, item, ratio, ghost) {
  G.combo++; G.best = Math.max(G.best, G.combo); G.served++;
  let amount = item.price * (c.vip ? 2 : 1) * (item.fresh ? 1.5 : 1) * (1 + 0.1 * Math.min(G.combo - 1, 10));
  const tip = ratio > 0.6 ? Math.round(item.price * 0.2 / 50) * 50 : 0;
  amount = Math.round(amount / 50) * 50;
  G.cash += amount + tip;
  const head = c.mesh.position.clone().add(new THREE.Vector3(0, 2.4 * c.mesh.scale.y, 0));
  floatText(head, '+' + naira(amount), ''); sfx.cash(G.combo);
  if (tip) setTimeout(() => { floatText(head.clone().add(new THREE.Vector3(0.8, -0.3, 0)), `Tip +${naira(tip)}`, 'tip'); sfx.tip(); }, 200);
  if (G.combo > 0 && G.combo % 5 === 0) toast(`🔥 ${G.combo} in a row! You dey hot!`);
  // customer carries the item away on their head (Naija style)
  scene.remove(ghost); const carried = item.template.clone(true); carried.scale.multiplyScalar(0.7);
  carried.position.set(0, 1.95, 0); c.mesh.add(carried);
  leave(c, 'happy'); updateHUD();
}

function updateFlights(dt) {
  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i]; f.t += dt; const k = Math.min(1, f.t / f.dur);
    f.obj.position.lerpVectors(f.from, f.to, k); f.obj.position.y += Math.sin(k * Math.PI) * 1.4;
    f.obj.rotation.y += dt * 12;
    if (k >= 1) { flights.splice(i, 1); f.onDone(); }
  }
}

// ---------- input ----------
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
function hitSlot(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const targets = shelf.filter(Boolean).flatMap((s) => [s.group, s.label]);
  const hit = ray.intersectObjects(targets, true)[0];
  if (hit) { let o = hit.object; while (o && o.userData.slot === undefined) o = o.parent; if (o) return o.userData.slot; }
  // generous fallback: nearest slot to the tap point on screen (helps on phones)
  let best = -1, bd = 1e9;
  shelf.forEach((s, i) => { if (!s) return; const p = toScreen(s.group.position.clone().add(new THREE.Vector3(0, 0.4, 0))); const d = Math.hypot(p.x - ev.clientX, p.y - ev.clientY); if (d < bd) { bd = d; best = i; } });
  return bd < Math.min(70, window.innerWidth / 14) ? best : -1;
}
renderer.domElement.addEventListener('pointerdown', (ev) => { sfx.unlock(); const i = hitSlot(ev); if (i >= 0) serve(i); });
renderer.domElement.addEventListener('pointermove', (ev) => {
  if (ev.pointerType !== 'mouse') return; const i = hitSlot(ev);
  if (i >= 0) { ring.visible = true; ring.position.set(slots[i].x, slots[i].y + 0.02, slots[i].z); renderer.domElement.style.cursor = 'pointer'; }
  else { ring.visible = false; renderer.domElement.style.cursor = ''; }
});

// ---------- round flow ----------
function clearCustomers() { customers.forEach((c) => { scene.remove(c.mesh); c.el.remove(); }); customers.length = 0; }

function startRound() {
  sfx.unlock(); clearCustomers();
  Object.assign(G, { playing: true, paused: false, time: ROUND, cash: 0, combo: 0, best: 0, served: 0, vexed: 0, rep: MAX_REP, spawnIn: 0.6, rush: false });
  $('start').classList.add('hidden'); $('over').classList.add('hidden'); $('hud').classList.remove('hidden'); $('hint').classList.remove('hidden');
  updateHUD(); startDrums(); toast('Market don open! Serve dem quick quick!');
}

function endRound(reason) {
  if (!G.playing) return; G.playing = false; stopDrums(); $('hint').classList.add('hidden'); sfx.end();
  customers.filter((c) => c.state === 'wait').forEach((c) => leave(c, 'angry'));
  const ranks = [[20000, 'Small Pikin Trader', 'You go learn. Even Mama Put start small!'], [60000, 'Market Hustler', 'Your hustle dey show. Next shift, chase combo!'], [120000, 'Iya Oloja', 'The whole market dey hail you!'], [Infinity, 'Market Chairman 👑', 'Na you get this market. Dangote dey call you!']];
  const [, title, line] = ranks.find(([t]) => G.cash < t);
  $('over-title').textContent = title;
  $('over-line').textContent = (reason ? reason + ' ' : '') + line;
  $('st-cash').textContent = naira(G.cash); $('st-served').textContent = G.served; $('st-combo').textContent = G.best; $('st-vexed').textContent = G.vexed;
  setTimeout(() => $('over').classList.remove('hidden'), 700);
}

function tickGame(dt) {
  if (!G.playing || G.paused) return;
  const prev = Math.ceil(G.time);
  G.time -= dt;
  if (Math.ceil(G.time) !== prev) { updateHUD(); if (G.time < 6) sfx.tick(); }
  if (!G.rush && G.time <= 20) { G.rush = true; toast('⚡ RUSH HOUR! Everybody dey come!'); }
  G.spawnIn -= dt;
  if (G.spawnIn <= 0) {
    spawnCustomer();
    const p = 1 - G.time / ROUND; G.spawnIn = (G.rush ? 1.3 : 2.8 - 1.2 * p) + Math.random() * 0.8;
  }
  if (G.time <= 0) { G.time = 0; updateHUD(); endRound(); }
}

// ---------- main loop ----------
const clock = new THREE.Clock(); let elapsed = 0;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05); elapsed += dt;
  tickGame(dt); updateCustomers(dt); updateFlights(dt); world.animateCrowd(elapsed);
  shelf.forEach((s) => {
    if (!s) return;
    s.group.rotation.y += dt * 0.35;
    s.bounce = Math.max(0, (s.bounce || 0) - dt);
    s.group.position.y = s.baseY + Math.sin(elapsed * 2 + s.phase) * 0.03 + Math.sin((s.bounce / 0.25) * Math.PI) * 0.25;
  });
  ring.rotation.z += dt;
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

window.addEventListener('resize', world.resize);

// ---------- boot ----------
async function boot() {
  let manifest;
  try { manifest = await loadManifest(); } catch (e) { $('asset-status').textContent = 'Could not load assets/manifest.json'; return; }
  const results = await Promise.all(manifest.items.map((it) => loadItemModel(it, ITEM_SIZE).then((r) => ({ it, ...r }))));
  let lux = 0;
  results.forEach(({ it, object, isPlaceholder }) => {
    if (!isPlaceholder) lux++;
    addItemToCatalog({ id: it.id, name: it.name, price: it.price, requests: it.requests, template: object, isPlaceholder, fresh: false, source: isPlaceholder ? 'placeholder' : 'lux3d' });
  });
  // scenery: Lux3D GLBs replace procedural neighbours when present
  let sceneryLux = 0;
  await Promise.all((manifest.scenery || []).map(async (s) => {
    const obj = await loadSceneryModel(s); if (!obj) return;
    sceneryLux++; obj.position.fromArray(s.position); obj.rotation.y = s.rotationY || 0; scene.add(obj);
  }));
  if (sceneryLux) world.fallbackScenery.children.slice(0, sceneryLux).forEach((c) => (c.visible = false));
  $('asset-status').textContent = `${results.length} items on shelf: ${lux} Lux3D model${lux === 1 ? '' : 's'}, ${results.length - lux} placeholder${results.length - lux === 1 ? '' : 's'}. Scenery: ${sceneryLux} Lux3D props.`;
  window.__nmr = { G, catalog, shelf, customers, serve, startRound, spawnCustomer, endRound };
}

$('btn-start').onclick = startRound;
$('btn-again').onclick = startRound;
$('btn-mute').onclick = () => { const m = toggleMute(); $('btn-mute').textContent = m ? '🔇' : '🔊'; if (m) stopDrums(); else if (G.playing) startDrums(); };

initMaker({
  onOpen: () => { if (G.playing) G.paused = true; },
  onClose: () => { if (G.playing) G.paused = false; },
  onItem: (obj, meta) => {
    const id = 'made_' + Date.now();
    addItemToCatalog({ id, name: meta.name, price: meta.price, requests: [meta.line || `Abeg, bring ${meta.name}!`], template: normalize(obj, ITEM_SIZE), isPlaceholder: false, fresh: true, source: meta.source });
    toast(`✨ ${meta.name} dey your shelf now. Fresh items sell for 1.5x!`, 3000);
  },
  buttons: [$('btn-make-start'), $('btn-make-over'), $('btn-make-hud')],
});

boot();
loop();
