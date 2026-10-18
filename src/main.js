import * as THREE from 'three';
import { Planet } from './planet.js';
import { Player } from './player.js';
import { FollowCamera } from './camera.js';
import { createStarfield } from './sky.js';
import { Input } from './input.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#05060f');

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

scene.add(new THREE.HemisphereLight('#bcd4ff', '#2a2440', 1.1));
const sun = new THREE.DirectionalLight('#fff3dd', 2.2);
sun.position.set(40, 30, 20);
scene.add(sun);

const stars = createStarfield();
scene.add(stars);

const planet = new Planet();
scene.add(planet.group);

const player = new Player(planet);
scene.add(player.mesh);

const input = new Input(renderer.domElement);
const followCamera = new FollowCamera(camera, player);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 30); // clamp so a tab switch doesn't launch you
  player.update(dt, input, followCamera.forward);
  followCamera.update(dt, input);
  stars.position.copy(camera.position);
  renderer.render(scene, camera);
});
