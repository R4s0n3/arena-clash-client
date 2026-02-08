// client/src/VFX.ts
// Particle effects with object pooling + sword trail
import * as THREE from "three";

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  fadeOut: boolean;
  shrink: boolean;
  active: boolean;
}

const POOL_SIZE = 120;
const SPARK_GEO = new THREE.SphereGeometry(0.04, 4, 4);
const BLOOD_GEO = new THREE.SphereGeometry(0.035, 4, 4);

const TRAIL_LENGTH = 8;

export class VFX {
  private scene: THREE.Scene;
  private pool: Particle[] = [];

  // Sword trail
  private trailPositions: THREE.Vector3[] = [];
  private trailLine: THREE.Line;
  private trailActive = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Pre-allocate particle pool
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(SPARK_GEO, mat);
      mesh.visible = false;
      scene.add(mesh);

      this.pool.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0,
        gravity: 0,
        fadeOut: true,
        shrink: true,
        active: false,
      });
    }

    // Trail
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      this.trailPositions.push(new THREE.Vector3());
    }

    const trailGeo = new THREE.BufferGeometry();
    const trailVerts = new Float32Array(TRAIL_LENGTH * 3);
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailVerts, 3));
    const trailMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
    });
    this.trailLine = new THREE.Line(trailGeo, trailMat);
    this.trailLine.frustumCulled = false;
    scene.add(this.trailLine);
  }

  private acquire(color: number, geo: THREE.BufferGeometry): Particle | null {
    for (const p of this.pool) {
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        p.mesh.geometry = geo;
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
        p.mesh.scale.setScalar(1);
        return p;
      }
    }
    return null;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;

      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;
      p.velocity.y -= p.gravity * dt;

      const t = p.life / p.maxLife;
      if (p.fadeOut) (p.mesh.material as THREE.MeshBasicMaterial).opacity = t;
      if (p.shrink) p.mesh.scale.setScalar(t);
    }

    // Fade trail
    const mat = this.trailLine.material as THREE.LineBasicMaterial;
    if (this.trailActive) {
      mat.opacity = Math.min(mat.opacity + dt * 8, 0.6);
    } else {
      mat.opacity = Math.max(mat.opacity - dt * 4, 0);
    }
  }

  updateSwordTrail(tipPos: THREE.Vector3, isAttacking: boolean): void {
    this.trailActive = isAttacking;

    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      this.trailPositions[i].copy(this.trailPositions[i - 1]);
    }
    this.trailPositions[0].copy(tipPos);

    const pos = this.trailLine.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      pos.setXYZ(i, this.trailPositions[i].x, this.trailPositions[i].y, this.trailPositions[i].z);
    }
    pos.needsUpdate = true;
  }

  spawnHitSparks(position: THREE.Vector3, direction: THREE.Vector3): void {
    const count = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const p = this.acquire(0xffaa33, SPARK_GEO);
      if (!p) break;
      p.mesh.position.copy(position);
      p.mesh.position.y += 1.0 + Math.random() * 0.5;
      p.velocity.set(
        direction.x * 3 + (Math.random() - 0.5) * 3,
        2 + Math.random() * 4,
        direction.z * 3 + (Math.random() - 0.5) * 3
      );
      p.life = 0.3 + Math.random() * 0.25;
      p.maxLife = p.life;
      p.gravity = 12;
      p.fadeOut = true;
      p.shrink = true;
    }
  }

  spawnBlockSparks(position: THREE.Vector3): void {
    const count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const p = this.acquire(0xffffff, SPARK_GEO);
      if (!p) break;
      p.mesh.position.copy(position);
      p.mesh.position.y += 1.2;
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      p.velocity.set(Math.cos(angle) * speed, 1 + Math.random() * 3, Math.sin(angle) * speed);
      p.life = 0.15 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.gravity = 8;
      p.fadeOut = true;
      p.shrink = true;
    }
  }

  spawnBloodSplatter(position: THREE.Vector3, direction: THREE.Vector3): void {
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const p = this.acquire(0xcc2222, BLOOD_GEO);
      if (!p) break;
      p.mesh.position.copy(position);
      p.mesh.position.y += 0.8 + Math.random() * 0.6;
      p.velocity.set(
        direction.x * 2 + (Math.random() - 0.5) * 3,
        1 + Math.random() * 2,
        direction.z * 2 + (Math.random() - 0.5) * 3
      );
      p.life = 0.4 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.gravity = 10;
      p.fadeOut = true;
      p.shrink = false;
    }
  }

  spawnDeathBurst(position: THREE.Vector3): void {
    for (let i = 0; i < 15; i++) {
      const isEmber = Math.random() > 0.5;
      const p = this.acquire(isEmber ? 0xffaa33 : 0xcc2222, isEmber ? SPARK_GEO : BLOOD_GEO);
      if (!p) break;
      p.mesh.position.copy(position);
      p.mesh.position.y += 1;
      p.mesh.scale.setScalar(0.5 + Math.random());
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      p.velocity.set(Math.cos(angle) * speed, 2 + Math.random() * 5, Math.sin(angle) * speed);
      p.life = 0.5 + Math.random() * 0.5;
      p.maxLife = p.life;
      p.gravity = 6;
      p.fadeOut = true;
      p.shrink = true;
    }
  }

  dispose(): void {
    for (const p of this.pool) {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    this.pool = [];
    this.scene.remove(this.trailLine);
    this.trailLine.geometry.dispose();
    (this.trailLine.material as THREE.Material).dispose();
  }
}
