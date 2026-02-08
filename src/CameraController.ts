// client/src/CameraController.ts
import * as THREE from "three";

const CAMERA_DISTANCE = 10;
const CAMERA_HEIGHT = 5.2;
const CAMERA_LERP = 0.22; // Much snappier than the old 0.08
const LOOK_HEIGHT = 1.4;

interface ShakeRequest {
  intensity: number;
  duration: number;
  elapsed: number;
}

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private shakes: ShakeRequest[] = [];
  private punchOffset = new THREE.Vector3();
  private punchDecay = 0;

  // Pre-allocated vectors to avoid per-frame allocation
  private _targetPos = new THREE.Vector3();
  private _forward = new THREE.Vector3();
  private _shakeOffset = new THREE.Vector3();
  private _lookAt = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  update(playerPos: THREE.Vector3, rotationY: number, dt: number): void {
    // Calculate desired camera position
    this._forward.set(
      -Math.sin(rotationY),
      0,
      -Math.cos(rotationY)
    );

    // Camera goes BEHIND the player: opposite of forward direction
    this._targetPos.set(
      playerPos.x - this._forward.x * CAMERA_DISTANCE,
      playerPos.y + CAMERA_HEIGHT,
      playerPos.z - this._forward.z * CAMERA_DISTANCE
    );

    // Smooth follow with snappy lerp
    this.camera.position.lerp(this._targetPos, CAMERA_LERP);

    // Apply screen shake
    this._shakeOffset.set(0, 0, 0);
    for (let i = this.shakes.length - 1; i >= 0; i--) {
      const s = this.shakes[i];
      s.elapsed += dt;
      if (s.elapsed >= s.duration) {
        this.shakes.splice(i, 1);
        continue;
      }
      const remaining = 1 - s.elapsed / s.duration;
      const mag = s.intensity * remaining * remaining; // quadratic falloff
      this._shakeOffset.x += (Math.random() - 0.5) * mag * 2;
      this._shakeOffset.y += (Math.random() - 0.5) * mag * 2;
      this._shakeOffset.z += (Math.random() - 0.5) * mag;
    }
    this.camera.position.add(this._shakeOffset);

    // Apply punch (zoom punch on hit)
    if (this.punchDecay > 0) {
      this.punchDecay -= dt * 8;
      if (this.punchDecay < 0) this.punchDecay = 0;
      const punchFactor = this.punchDecay;
      this.camera.position.add(
        this.punchOffset.clone().multiplyScalar(punchFactor)
      );
    }

    // Look at player
    this._lookAt.set(playerPos.x, playerPos.y + LOOK_HEIGHT, playerPos.z);
    this.camera.lookAt(this._lookAt);
  }

  shake(intensity: number, duration: number): void {
    this.shakes.push({ intensity, duration, elapsed: 0 });
  }

  punch(dirX: number, dirZ: number, intensity: number): void {
    this.punchOffset.set(dirX * intensity, 0, dirZ * intensity);
    this.punchDecay = 1;
  }
}
