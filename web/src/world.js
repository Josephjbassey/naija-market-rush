import * as THREE from 'three';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o });

function stripes(a, b, n = 8) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 8;
  const g = c.getContext('2d');
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect((i * 128) / n, 0, 128 / n, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
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

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffd9a0);
  scene.fog = new THREE.Fog(0xffd9a0, 22, 48);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xfff3d6, 0x9a6b3c, 1.3));
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.4);
  sun.position.set(6, 12, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 40 });
  scene.add(sun);

  // Ground: red laterite earth + paved lane
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), M(0xc6814a));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(60, 5), M(0xb07a52));
  lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.01, -1.4); lane.receiveShadow = true; scene.add(lane);

  // Player stall
  const stall = new THREE.Group(); scene.add(stall);
  const wood = M(0x9c6b3a), dark = M(0x6e4521);
  box(8.4, 1.0, 0.7, dark, 0, 0.5, 0.9, stall);               // front counter (customers lean here)
  box(8.4, 0.08, 0.9, wood, 0, 1.04, 0.9, stall);
  // tiered display table: low tier nearest the camera, high tier behind it (nearer the counter)
  box(8.2, 1.05, 1.1, wood, 0, 0.52, 2.3, stall);
  box(8.2, 0.55, 1.3, wood, 0, 0.27, 3.65, stall);
  box(8.2, 0.06, 1.1, M(0x0b8a3e), 0, 1.07, 2.3, stall);      // green cloth
  box(8.2, 0.06, 1.3, M(0xf2e3c4), 0, 0.57, 3.65, stall);     // cream cloth
  for (const x of [-4.3, 4.3]) box(0.14, 3.6, 0.14, dark, x, 1.8, 0.6, stall);
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 1.1), new THREE.MeshStandardMaterial({ map: stripes('#0b8a3e', '#ffffff', 10), side: THREE.DoubleSide, roughness: 0.9 }));
  awn.rotation.x = -Math.PI / 2 + 0.35; awn.position.set(0, 3.75, 0.25); awn.castShadow = true; stall.add(awn);
  // sign
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 96;
  const sg = sc.getContext('2d'); sg.fillStyle = '#ffd23f'; sg.fillRect(0, 0, 512, 96); sg.fillStyle = '#1b1b1b';
  sg.font = 'bold 44px Trebuchet MS, sans-serif'; sg.textAlign = 'center'; sg.fillText('MAMA JO ENTERPRISES', 256, 66);
  const sTex = new THREE.CanvasTexture(sc); sTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.75), new THREE.MeshBasicMaterial({ map: sTex }));
  sign.position.set(0, 3.2, 0.62); sign.rotation.x = -0.5; stall.add(sign);

  // Shelf slots (12): 6 on the low front tier, 6 on the back tier
  const slots = [];
  for (let i = 0; i < 6; i++) slots.push(new THREE.Vector3(-3.25 + i * 1.3, 1.1, 2.2));
  for (let i = 0; i < 6; i++) slots.push(new THREE.Vector3(-3.25 + i * 1.3, 0.6, 3.5));

  // Neighbours & backdrop (procedural fallbacks; Lux3D scenery GLBs override via manifest)
  const fallbackScenery = new THREE.Group(); scene.add(fallbackScenery);
  const palette = [['#e63946', '#ffffff', 0xffd23f], ['#1d3fbf', '#ffd23f', 0x2f9e44], ['#ff7a1a', '#ffffff', 0xe63946], ['#6a0dad', '#ffd23f', 0xf2c230]];
  [[-8, -4.5, 0.4], [8, -4.5, -0.4], [-13, -5, 0.6], [13, -5, -0.6], [-4, -9, 0.1], [4.5, -9.5, -0.1], [-10, -12, 0.3], [10, -13, -0.2]].forEach(([x, z, r], i) => {
    const p = palette[i % palette.length]; const s = neighbourStall(p[0], p[1], p[2]); s.position.set(x, 0, z); s.rotation.y = r; fallbackScenery.add(s);
  });
  // buildings
  const bcols = [0xf4e1c1, 0xd9a066, 0xa3d9b1, 0xf1b5a5, 0xc8d6f0];
  for (let i = 0; i < 14; i++) {
    const h = 3 + (i * 7) % 5; const b = box(4 + (i % 3), h, 3, M(bcols[i % bcols.length]), -26 + i * 4.2, h / 2, -19 - (i % 2) * 2, scene);
    box(4.4 + (i % 3), 0.25, 3.4, M(0x7a6b5d), b.position.x, h + 0.1, b.position.z, scene);
  }
  // bunting
  const flagCols = [0x0b8a3e, 0xffffff, 0x0b8a3e, 0xffd23f, 0xff7a1a];
  for (let row = 0; row < 2; row++) for (let i = 0; i < 26; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 3), new THREE.MeshStandardMaterial({ color: flagCols[i % 5], side: THREE.DoubleSide }));
    f.rotation.x = Math.PI; const x = -13 + i * 1.04; f.position.set(x, 4.6 - Math.sin((i / 25) * Math.PI) * 0.6, -3.5 - row * 6); scene.add(f);
  }
  // background crowd (static)
  const crowdCols = [[0xe63946, 0xffd23f], [0x1d3fbf, 0xffffff], [0x2f9e44, 0xff7a1a], [0x6a0dad, 0xff4fb6], [0xff7a1a, 0x1d3fbf]];
  const crowd = [];
  for (let i = 0; i < 12; i++) {
    const p = person(crowdCols[i % 5]); p.position.set(-14 + i * 2.5 + (i % 2), 0, -6.5 - (i % 3) * 2.2); p.rotation.y = (i % 4) - 1.5; scene.add(p);
    crowd.push({ obj: p, phase: i * 1.7, speed: 0.4 + (i % 3) * 0.25, baseX: p.position.x });
  }

  // highlight ring for hover/tap feedback
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);

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

  function animateCrowd(t) {
    crowd.forEach((c) => { c.obj.position.x = c.baseX + Math.sin(t * c.speed + c.phase) * 1.2; c.obj.position.y = Math.abs(Math.sin(t * 4 * c.speed + c.phase)) * 0.06; });
  }

  return { renderer, scene, camera, slots, ring, resize, fallbackScenery, animateCrowd };
}
