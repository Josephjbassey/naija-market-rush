import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { buildPlaceholder } from './placeholders.js';
import defaultManifest from '../public/assets/manifest.json';

const BASE = import.meta.env.BASE_URL || '/';
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath(`${BASE}draco/`);
loader.setDRACOLoader(draco);

export { defaultManifest };

export async function loadManifest() {
  try {
    const res = await fetch(`${BASE}assets/manifest.json`, { cache: 'no-cache' });
    if (res.ok) return await res.json();
  } catch (_) { /* fallback to bundled */ }
  return defaultManifest;
}

export function createPlaceholderItem(item, size = 0.9) {
  return {
    object: normalize(buildPlaceholder(item.placeholder || item.id), size),
    isPlaceholder: true,
  };
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
      o.castShadow = true;
      o.receiveShadow = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { if (m && m.map) m.map.anisotropy = 2; });
    }
  });
  return scene;
}

export function parseGLB(arrayBuffer) {
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', (gltf) => resolve(prep(gltf.scene)), reject);
  });
}

export function loadGLBUrl(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Timeout loading GLB: ${url}`));
      }
    }, timeoutMs);

    loader.load(
      url,
      (gltf) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try {
            resolve(prep(gltf.scene));
          } catch (e) {
            reject(e);
          }
        }
      },
      undefined,
      (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      }
    );
  });
}

/** Returns normalized Three.Group or null */
export async function loadItemGLB(item, size = 0.9, timeoutMs = 12000) {
  if (!item.glb) return null;
  const scene = await loadGLBUrl(`${BASE}assets/${item.glb}`, timeoutMs);
  return normalize(scene, size);
}

/** Returns { object, isPlaceholder }. Tries the Lux3D GLB first, falls back to a placeholder. */
export async function loadItemModel(item, size = 0.9) {
  if (item.glb) {
    try {
      const obj = await loadItemGLB(item, size, 8000);
      if (obj) return { object: obj, isPlaceholder: false };
    } catch (_) { /* not generated yet: use placeholder */ }
  }
  return createPlaceholderItem(item, size);
}

export async function loadSceneryModel(entry) {
  if (!entry || !entry.glb) return null;
  try {
    const scene = await loadGLBUrl(`${BASE}assets/${entry.glb}`, 4000);
    return normalize(scene, entry.height || 3);
  } catch (_) { return null; }
}
