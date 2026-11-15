// PLACEHOLDER MESHES — simple primitives so the game runs before real Aholo Lux3D
// assets exist. Every mesh built here is tagged userData.placeholder = true.
// Drop a Lux3D GLB into /public/assets/ (see manifest.json) to replace one.
import * as THREE from 'three';

const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...opts });

function stripeTexture(colors, size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const w = size / colors.length;
  colors.forEach((col, i) => { g.fillStyle = col; g.fillRect(i * w, 0, w, size); });
  g.fillStyle = 'rgba(255,255,255,.85)';
  for (let y = 4; y < size; y += 16) for (let x = 4; x < size; x += 16) { g.beginPath(); g.arc(x + (y % 32 ? 8 : 0), y, 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const builders = {
  yam() {
    const g = new THREE.Group();
    const geo = new THREE.CapsuleGeometry(0.22, 0.7, 4, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const k = 1 + 0.18 * Math.sin(y * 9) - 0.15 * y; pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M(0x7a5230)); m.rotation.z = Math.PI / 2.3; m.position.y = 0.25; g.add(m);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), M(0xf3e6c4)); tip.position.set(0.48, 0.42, 0); g.add(tip);
    return g;
  },
  agbada() {
    const g = new THREE.Group();
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.0, 8, 1, true), M(0x2b59c3, { side: THREE.DoubleSide })); robe.position.y = 0.5; g.add(robe);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 12), M(0xffd23f, { metalness: 0.4 })); trim.rotation.x = Math.PI / 2; trim.position.y = 0.95; g.add(trim);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.18, 10), M(0x2b59c3)); cap.position.y = 1.08; g.add(cap);
    return g;
  },
  gele() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.28 - i * 0.03, 0.09, 6, 14), M(i % 2 ? 0xd4148e : 0xff4fb6, { metalness: 0.3, roughness: 0.4 })); t.rotation.x = Math.PI / 2 + (i - 1.5) * 0.25; t.position.y = 0.15 + i * 0.1; g.add(t); }
    const fan = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 6), M(0xff4fb6, { metalness: 0.3 })); fan.position.set(0.15, 0.65, 0); fan.rotation.z = -0.7; g.add(fan);
    return g;
  },
  jollof() {
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.45, 14), M(0x555a60, { metalness: 0.6, roughness: 0.4 })); pot.position.y = 0.23; g.add(pot);
    const rice = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), M(0xe8641c)); rice.position.y = 0.38; rice.scale.y = 0.55; g.add(rice);
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 5, 8), M(0x333333)); h.position.set(s * 0.45, 0.38, 0); h.rotation.y = Math.PI / 2; g.add(h); }
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 4), M(0x2f9e44)); leaf.position.set(0.05, 0.55, 0.05); g.add(leaf);
    return g;
  },
  plantain() {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.18, 0.35, 0), new THREE.Vector3(0.05, 0.7, 0));
      const f = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.075, 6), M(i % 2 ? 0xf2c230 : 0xe2b21c));
      f.position.set(-0.24 + i * 0.12, 0.05, (i % 2) * 0.08); f.rotation.y = (i - 2) * 0.2; g.add(f);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 6), M(0x6b4f1d)); stem.position.set(0, 0.05, 0); stem.rotation.z = Math.PI / 2; g.add(stem);
    return g;
  },
  palmoil() {
    const g = new THREE.Group();
    const keg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.32), M(0xd94a1a, { roughness: 0.35 })); keg.position.y = 0.33; g.add(keg);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8), M(0xffd23f)); cap.position.set(-0.13, 0.71, 0); g.add(cap);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 5, 10, Math.PI), M(0xd94a1a)); handle.position.set(0.1, 0.66, 0); g.add(handle);
    return g;
  },
  ankara() {
    const g = new THREE.Group();
    const tex = stripeTexture(['#0b8a3e', '#ff7a1a', '#1d3fbf', '#ffd23f']); tex.repeat.set(3, 1);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.95, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); roll.rotation.z = Math.PI / 2; roll.position.y = 0.2; g.add(roll);
    const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide })); flap.position.set(0, 0.06, 0.28); flap.rotation.x = -Math.PI / 2.3; g.add(flap);
    return g;
  },
  phone() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 0.1), M(0x2a2d33, { roughness: 0.3 })); body.position.y = 0.3; body.rotation.x = -0.35; g.add(body);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.16), new THREE.MeshBasicMaterial({ color: 0x9fe870 })); scr.position.set(0, 0.42, 0.09); scr.rotation.x = -0.35; g.add(scr);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.02), M(0xcccccc)); k.position.set(-0.07 + c * 0.07, 0.25 - r * 0.055, 0.04 + r * 0.02 + 0.03); k.rotation.x = -0.35; g.add(k); }
    return g;
  },
  lantern() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.2, 12), M(0xb22222, { metalness: 0.5 })); base.position.y = 0.1; g.add(base);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffb300, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 })); glass.position.y = 0.38; glass.scale.y = 1.25; g.add(glass);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.15, 12), M(0xb22222, { metalness: 0.5 })); top.position.y = 0.68; g.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 5, 12, Math.PI), M(0x444444)); ring.position.y = 0.76; g.add(ring);
    return g;
  },
  danfo() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.38, 0.42), M(0xf7c600)); body.position.y = 0.3; g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.4), M(0xf7c600)); roof.position.set(-0.05, 0.55, 0); g.add(roof);
    for (const z of [-0.215, 0.215]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.01), M(0x111111)); s.position.set(0, 0.26, z); g.add(s); const w = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.13, 0.01), M(0x8fd3ff, { roughness: 0.2 })); w.position.set(-0.03, 0.42, z); g.add(w); }
    for (const x of [-0.28, 0.28]) for (const z of [-0.2, 0.2]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10), M(0x111111)); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.1, z); g.add(wh); }
    return g;
  },
  egusi() {
    const g = new THREE.Group();
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.3, 0.25, 16, 1, true), M(0x1f7ae0, { side: THREE.DoubleSide, roughness: 0.4 })); basin.position.y = 0.13; g.add(basin);
    const bot = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), M(0x1f7ae0)); bot.rotation.x = -Math.PI / 2; bot.position.y = 0.01; g.add(bot);
    const seeds = new THREE.Mesh(new THREE.SphereGeometry(0.43, 14, 6, 0, Math.PI * 2, 0, Math.PI / 3), M(0xf1e4c3)); seeds.position.y = 0.04; seeds.scale.y = 0.6; g.add(seeds);
    return g;
  },
  suya() {
    const g = new THREE.Group();
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.45), M(0xc9a36b)); tray.position.y = 0.03; g.add(tray);
    for (let i = 0; i < 4; i++) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 4), M(0xe0c48a)); stick.rotation.z = Math.PI / 2; stick.position.set(0, 0.1, -0.15 + i * 0.1); g.add(stick);
      for (let k = 0; k < 4; k++) { const meat = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 0), M(0x7b2d12)); meat.position.set(-0.22 + k * 0.14, 0.1, -0.15 + i * 0.1); g.add(meat); }
    }
    const onion = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 4, 8), M(0xe9d7ff)); onion.position.set(0.3, 0.07, 0.15); onion.rotation.x = Math.PI / 2; g.add(onion);
    return g;
  },
  generic() {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), M(0x9b59b6)); box.position.y = 0.25; g.add(box);
    const q = new THREE.Mesh(new THREE.TorusKnotGeometry(0.12, 0.04, 30, 5), M(0xffd23f)); q.position.y = 0.65; g.add(q);
    return g;
  },
};

export function buildPlaceholder(key) {
  const g = (builders[key] || builders.generic)();
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.placeholder = true;
  return g;
}
