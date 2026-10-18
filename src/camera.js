import * as THREE from 'three';
import { projectOnTangent } from './player.js';

const _eye = new THREE.Vector3();
const _target = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();

/**
 * Third-person follow camera. It keeps its own heading on the planet's tangent plane
 * (so WASD stays camera-relative without the camera spinning when you walk backwards),
 * and slerps its orientation toward a "look at the player, up = surface normal" target.
 */
export class FollowCamera {
  constructor(camera, player) {
    this.camera = camera;
    this.player = player;
    this.distance = 7;
    this.pitch = 0.45; // radians above the horizon
    this.minPitch = -0.1;
    this.maxPitch = 1.2;
    this.lookSensitivity = 0.005;
    this.positionDamping = 8;
    this.rotationDamping = 10;
    this.autoAlign = 1.5; // how fast the heading drifts behind the player while walking forward

    this.heading = player.facing.clone();
    this.forward = this.heading.clone(); // exposed for camera-relative movement

    this._place();
    camera.position.copy(_eye);
    camera.quaternion.copy(_q);
  }

  update(dt, input) {
    const up = this.player.up;
    projectOnTangent(this.heading, up);
    if (!Number.isFinite(this.heading.x)) this.heading.copy(this.player.facing);

    // Mouse drag / arrow keys orbit the camera.
    const look = input.consumeLook();
    let yaw = -look.x * this.lookSensitivity;
    let pitch = look.y * this.lookSensitivity;
    if (input.isDown('ArrowLeft')) yaw += 2 * dt;
    if (input.isDown('ArrowRight')) yaw -= 2 * dt;
    if (input.isDown('ArrowUp')) pitch += 1.5 * dt;
    if (input.isDown('ArrowDown')) pitch -= 1.5 * dt;
    if (yaw) this.heading.applyAxisAngle(up, yaw);
    this.pitch = THREE.MathUtils.clamp(this.pitch + pitch, this.minPitch, this.maxPitch);

    // While walking forward, ease the camera back behind the player.
    if (this.player.moving && input.isDown('KeyW') && !input.isDown('KeyS') && !yaw) {
      this.heading.lerp(this.player.facing, 1 - Math.exp(-this.autoAlign * dt));
      projectOnTangent(this.heading, up);
    }
    this.forward.copy(this.heading);

    this._place();
    this.camera.position.lerp(_eye, 1 - Math.exp(-this.positionDamping * dt));
    this.camera.quaternion.slerp(_q, 1 - Math.exp(-this.rotationDamping * dt));
  }

  /** Computes the desired eye position (_eye) and orientation (_q). */
  _place() {
    const up = this.player.up;
    _target.copy(this.player.position).addScaledVector(up, this.player.height * 0.8);
    _eye
      .copy(_target)
      .addScaledVector(this.heading, -Math.cos(this.pitch) * this.distance)
      .addScaledVector(up, Math.sin(this.pitch) * this.distance);

    // Orientation looking at the player with "up" aligned to the surface normal.
    _m.lookAt(_eye, _target, up);
    _q.setFromRotationMatrix(_m);
  }
}
