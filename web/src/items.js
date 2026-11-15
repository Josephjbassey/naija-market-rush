import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { buildPlaceholder } from './placeholders.js';

const BASE = import.meta.env.BASE_URL || '/';
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath(`${BASE}draco/`);
loader.setDRACOLoader(draco);

export async function loadManifest() {
  const res = await fetch(`${BASE}assets/manifest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error('manifest.json missing');
  return res.json();
}

/** Scale + recentre an object so its largest dimension equals `size` and it sits on y=0. */
export function normalize(obj, size = 0.9) {
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  const max = Math.max(dim.x, dim.y, dim.z) || 1;
  const s = size / max;
  const wrap = new THREE.Group();
  obj.scale.multiplyScalar(s);
  const box2 = new THREE.Box3().setFromObject(obj);
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box2.min.y;
  wrap.add(obj);
  wrap.userData = { ...obj.userData };
  return wrap;
}

function prep(scene) {
  scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { if (m && m.map) m.map.anisotropy = 4; });
    }
  });
  return scene;
}

export function parseGLB(arrayBuffer) {
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', (gltf) => resolve(prep(gltf.scene)), reject);
  });
}

export function loadGLBUrl(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => resolve(prep(gltf.scene)), undefined, reject);
  });
}

/** Returns { object, isPlaceholder }. Tries the Lux3D GLB first, falls back to a placeholder. */
export async function loadItemModel(item, size = 0.9) {
  if (item.glb) {
    try {
      const scene = await loadGLBUrl(`${BASE}assets/${item.glb}`);
      return { object: normalize(scene, size), isPlaceholder: false };
    } catch (_) { /* not generated yet: use placeholder */ }
  }
  return { object: normalize(buildPlaceholder(item.placeholder || item.id), size), isPlaceholder: true };
}

export async function loadSceneryModel(entry) {
  try {
    const scene = await loadGLBUrl(`${BASE}assets/${entry.glb}`);
    return normalize(scene, entry.height || 3);
  } catch (_) { return null; }
}
