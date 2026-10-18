import * as THREE from 'three';

const _axis = new THREE.Vector3();
const _move = new THREE.Vector3();
const _right = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _tmp = new THREE.Vector3();

/** Remove the component of v along the unit normal n, then normalise. */
export function projectOnTangent(v, n) {
  return v.addScaledVector(n, -v.dot(n)).normalize();
}

export class Player {
  constructor(planet) {
    this.planet = planet;
    this.radius = 0.4;
    this.height = 1.6; // total capsule height
    this.walkSpeed = 5;
    this.runSpeed = 9;
    this.jumpSpeed = 7.5;
    this.gravity = 20;

    this.position = new THREE.Vector3(0, planet.surfaceRadius(new THREE.Vector3(0, 1, 0)), 0);
    this.up = new THREE.Vector3(0, 1, 0); // surface normal under the player (toward the sky)
    this.facing = new THREE.Vector3(0, 0, -1); // tangent direction the body points
    this.verticalSpeed = 0; // along `up`, positive = away from the planet
    this.grounded = true;
    this.moving = false;

    this.mesh = this._buildMesh();
    this._syncMesh();
  }

  _buildMesh() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(this.radius, this.height - this.radius * 2, 4, 12),
      new THREE.MeshStandardMaterial({ color: '#f2a541', flatShading: true }),
    );
    body.position.y = this.height / 2;
    group.add(body);

    // A visor so you can tell which way the player faces.
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.2),
      new THREE.MeshStandardMaterial({ color: '#2b3a67', flatShading: true }),
    );
    visor.position.set(0, this.height * 0.72, this.radius * 0.9);
    group.add(visor);
    return group;
  }

  /**
   * @param {number} dt seconds
   * @param {Input} input
   * @param {THREE.Vector3} cameraForward tangent-plane forward of the camera
   */
  update(dt, input, cameraForward) {
    // Camera-relative movement on the tangent plane at the player's position.
    _right.crossVectors(cameraForward, this.up).normalize();
    _move.set(0, 0, 0);
    if (input.isDown('KeyW')) _move.add(cameraForward);
    if (input.isDown('KeyS')) _move.sub(cameraForward);
    if (input.isDown('KeyD')) _move.add(_right);
    if (input.isDown('KeyA')) _move.sub(_right);

    this.moving = _move.lengthSq() > 1e-6;
    if (this.moving) {
      _move.normalize();
      const speed = input.isDown('ShiftLeft', 'ShiftRight') ? this.runSpeed : this.walkSpeed;
      const dist = this.position.length();
      // Walk along the great circle: rotate the position about (up x move).
      _axis.crossVectors(this.up, _move).normalize();
      _q.setFromAxisAngle(_axis, (speed * dt) / dist);
      this.position.applyQuaternion(_q);
      this.facing.applyQuaternion(_q);

      // Turn the body smoothly toward the direction of travel.
      _move.applyQuaternion(_q);
      this.facing.lerp(_move, 1 - Math.exp(-12 * dt));
    }

    if (this.grounded && input.isDown('Space')) {
      this.verticalSpeed = this.jumpSpeed;
      this.grounded = false;
    }

    // Spherical gravity: "down" is always toward the planet's centre.
    this.verticalSpeed -= this.gravity * dt;
    this.up.copy(this.position).normalize();
    this.position.addScaledVector(this.up, this.verticalSpeed * dt);

    this._resolveObstacles();

    const ground = this.planet.surfaceRadius(this.up);
    if (this.position.length() <= ground) {
      this.position.setLength(ground);
      this.verticalSpeed = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // Keep `facing` tangent to the new surface (parallel transport).
    projectOnTangent(this.facing, this.up);
    if (!Number.isFinite(this.facing.x)) {
      this.facing.copy(cameraForward);
    }
    this._syncMesh();
  }

  _resolveObstacles() {
    const len = this.position.length();
    for (const o of this.planet.obstacles) {
      _tmp.subVectors(this.position, o.position);
      _tmp.addScaledVector(this.up, -_tmp.dot(this.up)); // horizontal offset only
      const minDist = o.radius + this.radius;
      const d = _tmp.length();
      if (d < minDist && d > 1e-5) {
        // Ignore obstacles we're clearly above (e.g. jumping over a rock).
        const heightAbove = this.position.dot(this.up) - o.position.dot(this.up);
        if (heightAbove > o.radius * 2.2) continue;
        this.position.addScaledVector(_tmp, (minDist - d) / d);
      }
    }
    this.position.setLength(len);
    this.up.copy(this.position).normalize();
  }

  _syncMesh() {
    this.mesh.position.copy(this.position);
    _right.crossVectors(this.up, this.facing).normalize();
    _m.makeBasis(_right, this.up, this.facing);
    this.mesh.quaternion.setFromRotationMatrix(_m);
  }
}
