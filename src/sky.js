import * as THREE from 'three';
import { createRandom } from './random.js';

// A far-away sphere of point stars. It follows the camera so it never gets closer.
export function createStarfield({ count = 2500, radius = 400, seed = 3 } = {}) {
  const rng = createRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = rng() * 2 - 1;
    const theta = rng() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    positions.set([s * Math.cos(theta) * radius, u * radius, s * Math.sin(theta) * radius], i * 3);
    c.setHSL(0.55 + (rng() - 0.5) * 0.25, 0.6, 0.6 + rng() * 0.4);
    c.multiplyScalar(0.4 + rng() * 0.6);
    c.toArray(colors, i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false }),
  );
  stars.renderOrder = -1;
  return stars;
}
