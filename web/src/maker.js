// "Make an item" flow.
//  1) Generate with Aholo Lux3D through our backend (server/app.py) — needs AHOLO_API_KEY on the server.
//  2) Import a .glb exported from the Lux3D web app — works on any static host.
import { parseGLB, loadGLBUrl } from './items.js';

const API = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const $ = (id) => document.getElementById(id);
const WAIT_LINES = ['Lux3D dey mould am…', 'Carving the 3D shape…', 'Painting PBR textures…', 'Almost ready, no vex…', 'Bringing am come market…'];

export function initMaker({ onOpen, onClose, onItem, buttons }) {
  let backendOk = false, importBuf = null, busy = false;
  const err = (m) => { const e = $('maker-err'); e.textContent = m || ''; e.classList.toggle('hidden', !m); };

  function setGenerateAvailable(on) {
    backendOk = on;
    $('lux-go').disabled = !on;
    const fields = $('lux-fields');
    if (fields) fields.classList.toggle('hidden', !on);
  }

  async function checkBackend() {
    const st = $('lux-status');
    try {
      const r = await fetch(`${API}/api/health`, { cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      if (j && j.lux3d) {
        setGenerateAvailable(true);
        st.textContent = j.mock ? '🧪 Backend in MOCK mode (no real Lux3D calls).' : '🟢 Lux3D backend connected. Generation takes a few minutes.';
      } else if (j) {
        setGenerateAvailable(false);
        st.textContent = 'Live generation available in local/server build.';
      } else throw new Error();
    } catch {
      setGenerateAvailable(false);
      st.textContent = 'Live generation available in local/server build.';
    }
  }

  function open() { onOpen(); err(); $('maker').classList.remove('hidden'); checkBackend(); }
  function close() { if (busy) return; $('maker').classList.add('hidden'); onClose(); }
  buttons.forEach((b) => b && (b.onclick = open));
  $('maker-close').onclick = close;

  document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    $('tab-lux').classList.toggle('hidden', t.dataset.tab !== 'lux');
    $('tab-import').classList.toggle('hidden', t.dataset.tab !== 'import');
  }));

  const meta = (p) => ({
    name: ($(`${p}-name`).value || '').trim() || 'Mystery item',
    price: Math.max(100, Math.min(100000, parseInt($(`${p}-price`).value, 10) || 5000)),
    line: ($(`${p}-line`).value || '').trim(),
  });

  // ---- Import flow ----
  const drop = $('drop');
  async function takeFile(f) {
    if (!f) return;
    if (!/\.glb$/i.test(f.name)) { err('Please choose a .glb file (binary glTF).'); return; }
    if (f.size > 60 * 1024 * 1024) { err('That file is over 60 MB. Export with a lower face count (e.g. 30k–50k).'); return; }
    importBuf = await f.arrayBuffer(); err();
    drop.firstChild.textContent = `✔ ${f.name} (${(f.size / 1048576).toFixed(1)} MB) `;
    if (!$('imp-name').value) $('imp-name').value = f.name.replace(/\.glb$/i, '').replace(/[_-]+/g, ' ').slice(0, 28);
    $('imp-go').disabled = false;
  }
  $('imp-file').onchange = (e) => takeFile(e.target.files[0]);
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); takeFile(e.dataTransfer.files[0]); };
  $('imp-go').onclick = async () => {
    if (!importBuf) return;
    try { const obj = await parseGLB(importBuf.slice(0)); onItem(obj, { ...meta('imp'), source: 'lux3d-import' }); close(); }
    catch (e) { err('Could not read that GLB: ' + (e.message || e)); }
  };

  // ---- Lux3D generate flow ----
  $('lux-go').onclick = async () => {
    if (!backendOk || busy) return;
    const photo = $('lux-photo').files[0]; const prompt = $('lux-prompt').value.trim();
    if (!photo && !prompt) { err('Add a photo or type a description.'); return; }
    const fd = new FormData(); if (photo) fd.append('photo', photo); if (prompt) fd.append('prompt', prompt);
    busy = true; err(); $('lux-go').disabled = true; $('lux-progress').classList.remove('hidden');
    let i = 0; const spin = setInterval(() => { $('lux-progress-text').textContent = WAIT_LINES[i++ % WAIT_LINES.length]; }, 4000);
    try {
      const r = await fetch(`${API}/api/make`, { method: 'POST', body: fd });
      const j = await r.json(); if (!r.ok) throw new Error(j.detail || 'create failed');
      const started = Date.now();
      let glbUrl = null;
      while (!glbUrl) {
        await new Promise((res) => setTimeout(res, 8000));
        const s = await (await fetch(`${API}/api/task/${j.taskId}`, { cache: 'no-store' })).json();
        if (s.state === 'failed') throw new Error(s.detail || 'Lux3D task failed');
        if (s.state === 'done') glbUrl = s.glbUrl;
        if (Date.now() - started > 15 * 60 * 1000) throw new Error('Timed out after 15 minutes');
      }
      const obj = await loadGLBUrl(`${API}${glbUrl}`);
      busy = false; onItem(obj, { ...meta('lux'), source: 'lux3d-api' }); close();
    } catch (e) { err('Lux3D: ' + (e.message || e)); }
    finally { busy = false; clearInterval(spin); $('lux-progress').classList.add('hidden'); $('lux-go').disabled = !backendOk; }
  };
}
