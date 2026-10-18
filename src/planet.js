import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRandom } from './random.js';

const UP = new THREE.Vector3(0, 1, 0);

// Cheap smooth-ish noise on the unit sphere: a sum of a few sine waves.
function surfaceNoise(dir) {
  const { x, y, z } = dir;
  return (
    0.5 * Math.sin(x * 3.1 + y * 1.7) * Math.cos(z * 2.3 - x * 0.9) +
    0.3 * Math.sin(y * 5.3 + z * 4.1) +
    0.2 * Math.cos(x * 7.7 - z * 6.1 + y * 2.9)
  );
}

function buildTerrain(radius, bumpiness) {
  // Merge the icosahedron's duplicated vertices so displacement keeps faces connected,
  // then go back to non-indexed for a faceted, flat-shaded low-poly look.
  let geometry = new THREE.IcosahedronGeometry(radius, 4);
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  geometry = mergeVertices(geometry);

  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const r = radius + surfaceNoise(v) * bumpiness;
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
  }

  geometry = geometry.toNonIndexed();
  geometry.computeVertexNormals();

  // Colour each face by its average height: sand in the dips, grass, then lighter hilltops.
  const sand = new THREE.Color('#d9c48a');
  const grass = new THREE.Color('#5fa84a');
  const darkGrass = new THREE.Color('#3f7f3a');
  const hill = new THREE.Color('#8fbf5a');
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  const p = geometry.attributes.position;
  const c = new THREE.Color();
  const rng = createRandom(7);
  for (let i = 0; i < p.count; i += 3) {
    let h = 0;
    for (let k = 0; k < 3; k++) h += v.fromBufferAttribute(p, i + k).length();
    const t = (h / 3 - radius) / bumpiness; // roughly -1..1
    if (t < -0.45) c.copy(sand);
    else if (t > 0.45) c.copy(hill);
    else c.copy(rng() < 0.5 ? grass : darkGrass);
    c.offsetHSL(0, 0, (rng() - 0.5) * 0.04);
    for (let k = 0; k < 3; k++) c.toArray(colors, (i + k) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function makeTree(rng) {
  const tree = new THREE.Group();
  const trunkHeight = 0.9 + rng() * 0.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, trunkHeight, 6),
    new THREE.MeshStandardMaterial({ color: '#7a5233', flatShading: true }),
  );
  trunk.position.y = trunkHeight / 2;
  tree.add(trunk);

  const leaves = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2f8f4e').offsetHSL((rng() - 0.5) * 0.06, 0, (rng() - 0.5) * 0.1),
    flatShading: true,
  });
  const layers = 2 + Math.floor(rng() * 2);
  let y = trunkHeight * 0.8;
  for (let i = 0; i < layers; i++) {
    const r = 0.9 - i * 0.22;
    const h = 1.1 - i * 0.15;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), leaves);
    cone.position.y = y + h / 2;
    cone.rotation.y = rng() * Math.PI;
    tree.add(cone);
    y += h * 0.55;
  }
  return { object: tree, collisionRadius: 0.35 };
}

function makeRock(rng) {
  const size = 0.35 + rng() * 0.7;
  let geometry = new THREE.DodecahedronGeometry(size, 0);
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  geometry = mergeVertices(geometry);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const s = 0.75 + rng() * 0.5;
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s * 0.7, pos.getZ(i) * s);
  }
  geometry = geometry.toNonIndexed();
  geometry.computeVertexNormals();
  const rock = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8a8d93').offsetHSL(0, 0, (rng() - 0.5) * 0.15),
      flatShading: true,
    }),
  );
  rock.position.y = size * 0.25;
  rock.rotation.y = rng() * Math.PI * 2;
  const group = new THREE.Group();
  group.add(rock);
  return { object: group, collisionRadius: size * 0.9 };
}

function randomDirection(rng, out) {
  // Uniform point on the unit sphere.
  const u = rng() * 2 - 1;
  const theta = rng() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return out.set(s * Math.cos(theta), u, s * Math.sin(theta));
}

export class Planet {
  constructor({ radius = 20, bumpiness = 0.9, trees = 45, rocks = 30, seed = 42 } = {}) {
    this.radius = radius;
    this.group = new THREE.Group();
    this.obstacles = []; // { position: Vector3, radius: number }

    this.mesh = new THREE.Mesh(
      buildTerrain(radius, bumpiness),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
    );
    this.group.add(this.mesh);

    this._raycaster = new THREE.Raycaster();
    this._origin = new THREE.Vector3();
    this._dir = new THREE.Vector3();

    const rng = createRandom(seed);
    const spawnClear = new THREE.Vector3(0, 1, 0); // keep the spawn point free of props
    const place = (factory, count) => {
      const dir = new THREE.Vector3();
      for (let i = 0; i < count; i++) {
        let tries = 0;
        do {
          randomDirection(rng, dir);
          tries++;
        } while (tries < 20 && (dir.angleTo(spawnClear) < 0.25 || this._tooClose(dir)));

        const { object, collisionRadius } = factory(rng);
        const surface = dir.clone().multiplyScalar(this.surfaceRadius(dir) - 0.05);
        object.position.copy(surface);
        object.quaternion.setFromUnitVectors(UP, dir);
        object.rotateY(rng() * Math.PI * 2);
        const scale = 0.8 + rng() * 0.5;
        object.scale.setScalar(scale);
        this.group.add(object);
        this.obstacles.push({ position: surface, radius: collisionRadius * scale });
      }
    };
    place(makeTree, trees);
    place(makeRock, rocks);
  }

  _tooClose(dir) {
    const minDist = 1.8;
    for (const o of this.obstacles) {
      if (o.position.distanceTo(this._origin.copy(dir).multiplyScalar(this.radius)) < minDist) return true;
    }
    return false;
  }

  /** Distance from the planet's centre to the ground along a unit direction. */
  surfaceRadius(dir) {
    this._origin.copy(dir).multiplyScalar(this.radius * 2);
    this._dir.copy(dir).negate();
    this._raycaster.set(this._origin, this._dir);
    const hit = this._raycaster.intersectObject(this.mesh, false)[0];
    return hit ? this.radius * 2 - hit.distance : this.radius;
  }
}
