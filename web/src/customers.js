import * as THREE from 'three';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...o });
const SKIN = [0x5a3a22, 0x6b4226, 0x7d4e2d, 0x4a2f1b, 0x8a5a36];
const CLOTH = [0xe63946, 0x1d3fbf, 0x2f9e44, 0x6a0dad, 0xff7a1a, 0x0b8a3e, 0xd4148e, 0x00a6a6];
const ACC = [0xffd23f, 0xffffff, 0xff4fb6, 0xff7a1a, 0x1d3fbf];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function buildCustomer(vip = false) {
  const g = new THREE.Group();
  const cloth = vip ? 0xfafafa : pick(CLOTH), acc = vip ? 0xd4a017 : pick(ACC), skin = pick(SKIN);
  const female = !vip && Math.random() < 0.55;
  const s = vip ? 1.18 : 0.92 + Math.random() * 0.14;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(female ? 0.26 : 0.3, female ? 0.42 : 0.36, 1.1, 10), M(cloth));
  body.position.y = 0.62; g.add(body);
  if (vip) { const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), M(cloth)); belly.position.set(0, 0.7, -0.12); g.add(belly); }
  const trim = new THREE.Mesh(new THREE.TorusGeometry(female ? 0.28 : 0.31, 0.04, 5, 12), M(acc, { metalness: vip ? 0.7 : 0 }));
  trim.rotation.x = Math.PI / 2; trim.position.y = 1.0; g.add(trim);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), M(skin)); head.position.y = 1.42; g.add(head);
  // eyes (customers face +z, toward the player)
  for (const x of [-0.08, 0.08]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff })); e.position.set(x, 1.46, 0.2); g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), new THREE.MeshBasicMaterial({ color: 0x111111 })); p.position.set(x, 1.46, 0.23); g.add(p);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 4, 10, Math.PI), new THREE.MeshBasicMaterial({ color: 0x3a1010 }));
  mouth.position.set(0, 1.36, 0.21); mouth.rotation.z = Math.PI; g.add(mouth);
  if (female) {
    const gele = new THREE.Group();
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.22 - i * 0.03, 0.08, 5, 12), M(acc, { roughness: 0.4 })); t.rotation.x = Math.PI / 2 + (i - 1) * 0.3; t.position.y = 1.6 + i * 0.08; gele.add(t); }
    const fan = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 5), M(acc)); fan.position.set(0.12, 1.85, -0.05); fan.rotation.z = -0.6; gele.add(fan);
    g.add(gele);
  } else {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.2, 10), M(vip ? 0xd4a017 : acc, { metalness: vip ? 0.6 : 0 }));
    cap.position.set(0, 1.66, 0); cap.rotation.z = vip ? 0 : 0.25; g.add(cap);
  }
  const arms = [];
  for (const x of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 3, 6), M(cloth)); a.position.set(x * (female ? 0.32 : 0.37), 0.95, 0); a.rotation.z = x * 0.25; g.add(a); arms.push(a);
  }
  g.scale.setScalar(s);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  g.userData = { arms, mouth, head, vip };
  return g;
}

export function setMood(cust, mood) {
  const { mouth, arms } = cust.userData;
  if (mood === 'happy') { mouth.rotation.z = Math.PI; mouth.scale.set(1.5, 1.5, 1); arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * 2.6; a.position.y = 1.35; }); }
  else if (mood === 'angry') { mouth.rotation.z = 0; mouth.position.y -= 0.03; mouth.scale.set(1.4, 1.4, 1); arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * 1.2; }); }
}
