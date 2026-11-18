import * as THREE from 'three';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o });

function stripes(a, b, n = 8) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 8;
  const g = c.getContext('2d');
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect((i * 128) / n, 0, 128 / n, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

/** Procedural neighbour stall, used when no Lux3D scenery GLB is present. */
export function neighbourStall(colorA, colorB, goods = 0xff7a1a) {
  const g = new THREE.Group();
  const wood = M(0x8b5a2b);
  box(2.6, 0.9, 1.2, wood, 0, 0.45, 0, g);
  for (const x of [-1.2, 1.2]) for (const z of [-0.5, 0.5]) box(0.08, 2.4, 0.08, wood, x, 1.2, z, g);
  const tarp = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.7, 4, 1), new THREE.MeshStandardMaterial({ map: stripes(colorA, colorB), side: THREE.DoubleSide, roughness: 0.9 }));
  tarp.rotation.y = Math.PI / 4; tarp.position.y = 2.7; tarp.castShadow = true; g.add(tarp);
  for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), M(goods)); s.position.set(-0.9 + i * 0.3, 1.0, (i % 2) * 0.2 - 0.1); s.castShadow = true; g.add(s); }
  g.userData.placeholder = true;
  return g;
}

function person(colors) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 1.0, 8), M(colors[0])); body.position.y = 0.6; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), M(0x6b4226)); head.position.y = 1.3; g.add(head);
  const hat = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.08, 5, 10), M(colors[1])); hat.rotation.x = Math.PI / 2; hat.position.y = 1.44; g.add(hat);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function makeLantern() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.35, 8), M(0x8a1c12, { roughness: 0.5, metalness: 0.3 }));
  body.position.y = 0; g.add(body);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffc878, emissive: 0xff8a2a, emissiveIntensity: 1.4, roughness: 0.3 }));
  glass.position.y = 0.05; g.add(glass);
  const light = new THREE.PointLight(0xff9944, 2.2, 10, 1.6); light.position.y = 0.05; g.add(light);
  return g;
}

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffd9a0);
  scene.fog = new THREE.Fog(0xffd9a0, 22, 48);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  const hemi = new THREE.HemisphereLight(0xfff3d6, 0x9a6b3c, 1.3); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.4);
  sun.position.set(6, 12, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 40 });
  scene.add(sun);

  const groundMat = M(0xc6814a);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const laneMat = M(0xb07a52);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(60, 5), laneMat);
  lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.01, -1.4); lane.receiveShadow = true; scene.add(lane);

  const stall = new THREE.Group(); scene.add(stall);
  const wood = M(0x9c6b3a), dark = M(0x6e4521);
  box(8.4, 1.0, 0.7, dark, 0, 0.5, 0.9, stall);
  box(8.4, 0.08, 0.9, wood, 0, 1.04, 0.9, stall);
  box(8.2, 1.05, 1.1, wood, 0, 0.52, 2.3, stall);
  box(8.2, 0.55, 1.3, wood, 0, 0.27, 3.65, stall);
  const clothHi = M(0x0b8a3e);
  const clothLo = M(0xf2e3c4);
  box(8.2, 0.06, 1.1, clothHi, 0, 1.07, 2.3, stall);
  box(8.2, 0.06, 1.3, clothLo, 0, 0.57, 3.65, stall);
  for (const x of [-4.3, 4.3]) box(0.14, 3.6, 0.14, dark, x, 1.8, 0.6, stall);
  const awnMat = new THREE.MeshStandardMaterial({ map: stripes('#0b8a3e', '#ffffff', 10), side: THREE.DoubleSide, roughness: 0.9 });
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 1.1), awnMat);
  awn.rotation.x = -Math.PI / 2 + 0.35; awn.position.set(0, 3.75, 0.25); awn.castShadow = true; stall.add(awn);
  // gold trim (canopy upgrade), hidden by default
  const awnTrim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 10), M(0xd4a017, { metalness: 0.6, roughness: 0.35 }));
  awnTrim.position.set(0, 3.95, 0.15); awnTrim.visible = false; stall.add(awnTrim);
  const fringe = new THREE.Group(); fringe.visible = false; stall.add(fringe);
  for (let i = 0; i < 15; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), M(i % 2 ? 0xd4a017 : 0xffffff));
    f.position.set(-4 + i * 0.57, 3.45, 0.7); fringe.add(f);
  }

  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 96;
  const sg = sc.getContext('2d');
  const sTex = new THREE.CanvasTexture(sc); sTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.75), new THREE.MeshBasicMaterial({ map: sTex }));
  sign.position.set(0, 3.2, 0.62); sign.rotation.x = -0.5; stall.add(sign);

  function setSign(text, bg = '#ffd23f', fg = '#1b1b1b') {
    sg.fillStyle = bg; sg.fillRect(0, 0, 512, 96);
    sg.fillStyle = fg; sg.font = 'bold 36px Trebuchet MS, sans-serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle';
    sg.fillText(text, 256, 50);
    sTex.needsUpdate = true;
  }
  setSign('MAMA JO ENTERPRISES');

  const slots = [];
  function layoutSlots(count) {
    slots.length = 0;
    const cols = count <= 12 ? 6 : 7;
    const span = count <= 12 ? 6.5 : 7.2;
    const step = span / (cols - 1);
    const start = -span / 2;
    for (let i = 0; i < cols; i++) slots.push(new THREE.Vector3(start + i * step, 1.1, 2.2));
    for (let i = 0; i < cols; i++) slots.push(new THREE.Vector3(start + i * step, 0.6, 3.5));
  }
  layoutSlots(12);

  const fallbackScenery = new THREE.Group(); scene.add(fallbackScenery);
  const palette = [['#e63946', '#ffffff', 0xffd23f], ['#1d3fbf', '#ffd23f', 0x2f9e44], ['#ff7a1a', '#ffffff', 0xe63946], ['#6a0dad', '#ffd23f', 0xf2c230]];
  [[-8, -4.5, 0.4], [8, -4.5, -0.4], [-13, -5, 0.6], [13, -5, -0.6], [-4, -9, 0.1], [4.5, -9.5, -0.1], [-10, -12, 0.3], [10, -13, -0.2]].forEach(([x, z, r], i) => {
    const p = palette[i % palette.length]; const s = neighbourStall(p[0], p[1], p[2]); s.position.set(x, 0, z); s.rotation.y = r; fallbackScenery.add(s);
  });
  const buildings = new THREE.Group(); scene.add(buildings);
  const bcols = [0xf4e1c1, 0xd9a066, 0xa3d9b1, 0xf1b5a5, 0xc8d6f0];
  for (let i = 0; i < 14; i++) {
    const h = 3 + (i * 7) % 5; const b = box(4 + (i % 3), h, 3, M(bcols[i % bcols.length]), -26 + i * 4.2, h / 2, -19 - (i % 2) * 2, buildings);
    box(4.4 + (i % 3), 0.25, 3.4, M(0x7a6b5d), b.position.x, h + 0.1, b.position.z, buildings);
  }

  // A simple "palace" silhouette for Oja Oba, hidden otherwise
  const palace = new THREE.Group(); palace.visible = false; scene.add(palace);
  box(10, 5.5, 4, M(0xf3d5a3), 0, 2.75, -22, palace);
  box(3, 3.5, 3, M(0xe8c48a), -6.5, 4.2, -22, palace);
  box(3, 3.5, 3, M(0xe8c48a), 6.5, 4.2, -22, palace);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), M(0xd4a017, { metalness: 0.4, roughness: 0.45 }));
  dome.position.set(0, 6.4, -22); palace.add(dome);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 8), M(0xd4a017, { metalness: 0.5 })); spire.position.set(0, 8.3, -22); palace.add(spire);

  const bunting = new THREE.Group(); scene.add(bunting);
  const flagColsDay = [0x0b8a3e, 0xffffff, 0x0b8a3e, 0xffd23f, 0xff7a1a];
  const flagColsRoyal = [0xd4a017, 0xc4452d, 0xffffff, 0xd4a017, 0x1d3fbf];
  const flagMats = flagColsDay.map((c) => new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide }));
  const flags = [];
  for (let row = 0; row < 2; row++) for (let i = 0; i < 26; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 3), flagMats[i % 5].clone());
    f.rotation.x = Math.PI; const x = -13 + i * 1.04; f.position.set(x, 4.6 - Math.sin((i / 25) * Math.PI) * 0.6, -3.5 - row * 6); bunting.add(f);
    flags.push(f);
  }

  const crowd = [];
  const crowdGroup = new THREE.Group(); scene.add(crowdGroup);
  const crowdCols = [[0xe63946, 0xffd23f], [0x1d3fbf, 0xffffff], [0x2f9e44, 0xff7a1a], [0x6a0dad, 0xff4fb6], [0xff7a1a, 0x1d3fbf]];
  for (let i = 0; i < 12; i++) {
    const p = person(crowdCols[i % 5]); p.position.set(-14 + i * 2.5 + (i % 2), 0, -6.5 - (i % 3) * 2.2); p.rotation.y = (i % 4) - 1.5; crowdGroup.add(p);
    crowd.push({ obj: p, phase: i * 1.7, speed: 0.4 + (i % 3) * 0.25, baseX: p.position.x });
  }

  const nightGroup = new THREE.Group(); nightGroup.visible = false; scene.add(nightGroup);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf5f0d8, emissive: 0xdde4ff, emissiveIntensity: 0.7, roughness: 1 }));
  moon.position.set(-10, 14, -16); nightGroup.add(moon);
  const moonGlow = new THREE.PointLight(0xc8d4ff, 0.8, 40, 2); moonGlow.position.copy(moon.position); nightGroup.add(moonGlow);
  [[-3.8, 3.4, 0.4], [3.8, 3.4, 0.4], [-7.5, 3.2, -3.8], [7.5, 3.2, -3.8], [0, 3.6, -6]].forEach(([x, y, z]) => {
    const L = makeLantern(); L.position.set(x, y, z); nightGroup.add(L);
  });

  const apprenticeAnchor = new THREE.Group(); apprenticeAnchor.position.set(5.1, 0, 2.4); apprenticeAnchor.visible = false; scene.add(apprenticeAnchor);

  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);

  function setCanopy(fancy) {
    awnTrim.visible = fringe.visible = !!fancy;
    awn.material.map = stripes(fancy ? '#d4a017' : '#0b8a3e', fancy ? '#1b1b1b' : '#ffffff', fancy ? 14 : 10);
    awn.material.needsUpdate = true;
  }

  function setTheme(theme) {
    nightGroup.visible = theme === 'night';
    palace.visible = theme === 'royal';
    if (theme === 'night') {
      scene.background.set(0x1a1535);
      scene.fog.color.set(0x1a1535); scene.fog.near = 16; scene.fog.far = 42;
      hemi.color.set(0x6a7aaa); hemi.groundColor.set(0x1a1020); hemi.intensity = 0.45;
      sun.color.set(0x8899cc); sun.intensity = 0.35; sun.position.set(-8, 14, 4);
      renderer.toneMappingExposure = 0.82;
      groundMat.color.set(0x3a2a28); laneMat.color.set(0x2c201c);
      clothHi.color.set(0x1a3a4a); clothLo.color.set(0x2a2430);
      flags.forEach((f, i) => f.material.color.set([0xff7a1a, 0x1d3fbf, 0x111111, 0xffd23f, 0xe63946][i % 5]));
    } else if (theme === 'royal') {
      scene.background.set(0xffe4b0);
      scene.fog.color.set(0xffe4b0); scene.fog.near = 24; scene.fog.far = 52;
      hemi.color.set(0xfff0cc); hemi.groundColor.set(0xb07a40); hemi.intensity = 1.35;
      sun.color.set(0xffe6b8); sun.intensity = 2.5; sun.position.set(6, 12, 8);
      renderer.toneMappingExposure = 1.08;
      groundMat.color.set(0xd4a574); laneMat.color.set(0xc49660);
      clothHi.color.set(0x1d3fbf); clothLo.color.set(0xffe7b0);
      flags.forEach((f, i) => f.material.color.set(flagColsRoyal[i % 5]));
    } else {
      scene.background.set(0xffd9a0);
      scene.fog.color.set(0xffd9a0); scene.fog.near = 22; scene.fog.far = 48;
      hemi.color.set(0xfff3d6); hemi.groundColor.set(0x9a6b3c); hemi.intensity = 1.3;
      sun.color.set(0xffe2b0); sun.intensity = 2.4; sun.position.set(6, 12, 8);
      renderer.toneMappingExposure = 1.05;
      groundMat.color.set(0xc6814a); laneMat.color.set(0xb07a52);
      clothHi.color.set(0x0b8a3e); clothLo.color.set(0xf2e3c4);
      flags.forEach((f, i) => f.material.color.set(flagColsDay[i % 5]));
    }
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const portrait = h > w;
    camera.fov = portrait ? 64 : 42;
    if (portrait) { camera.position.set(0, 11, 11.5); camera.lookAt(0, 0.8, 1.0); }
    else { camera.position.set(0, 9.5, 9.5); camera.lookAt(0, 0.6, 0.3); }
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  function animateCrowd(t) {
    crowd.forEach((c) => { c.obj.position.x = c.baseX + Math.sin(t * c.speed + c.phase) * 1.2; c.obj.position.y = Math.abs(Math.sin(t * 4 * c.speed + c.phase)) * 0.06; });
    if (nightGroup.visible) {
      nightGroup.children.forEach((ch, i) => {
        const L = ch.children && ch.children.find((o) => o.isLight);
        if (L) L.intensity = 1.8 + Math.sin(t * 3 + i) * 0.4;
      });
    }
  }

  return { renderer, scene, camera, slots, layoutSlots, ring, resize, fallbackScenery, animateCrowd, setTheme, setCanopy, setSign, apprenticeAnchor, stall };
}
