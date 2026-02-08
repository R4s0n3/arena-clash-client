// client/src/VFX.ts
// Particle and visual effects system
import * as THREE from "three";

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  fadeOut: boolean;
  shrink: boolean;
}

// Pool of reusable geometries
const SPARK_GEO = new THREE.SphereGeometry(0.04, 4, 4);
const BLOOD_GEO = new THREE.SphereGeometry(0.03, 4, 4);

export class VFX {
  private scene: THREE.Scene;
  private particles: Particle[] = [];

  // Reusable materials pool
  private sparkMat: THREE.MeshBasicMaterial;
  private bloodMat: THREE.MeshBasicMaterial;
  private blockSparkMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
    this.bloodMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
    this.blockSparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // Update position
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
      p.velocity.y -= p.gravity * dt;

      // Fade
      if (p.fadeOut) {
        const t = p.life / p.maxLife;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = t;
      }

      // Shrink
      if (p.shrink) {
        const t = p.life / p.maxLife;
        p.mesh.scale.setScalar(t);
      }
    }
  }

  spawnHitSparks(position: THREE.Vector3, direction: THREE.Vector3): void {
    const count = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const mat = this.sparkMat.clone();
      mat.transparent = true;
      mat.opacity = 1;
      const mesh = new THREE.Mesh(SPARK_GEO.clone(), mat);
      mesh.position.copy(position);
      mesh.position.y += 1.0 + Math.random() * 0.5;

      const spread = 0.4;
      const vel = new THREE.Vector3(
        direction.x * 3 + (Math.random() - 0.5) * spread * 8,
        2 + Math.random() * 4,
        direction.z * 3 + (Math.random() - 0.5) * spread * 8
      );

      const particle: Particle = {
        mesh,
        velocity: vel,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.5,
        gravity: 12,
        fadeOut: true,
        shrink: true,
      };
      particle.maxLife = particle.life;

      this.scene.add(mesh);
      this.particles.push(particle);
    }
  }

  spawnBlockSparks(position: THREE.Vector3): void {
    const count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const mat = this.blockSparkMat.clone();
      mat.transparent = true;
      mat.opacity = 1;
      const mesh = new THREE.Mesh(SPARK_GEO.clone(), mat);
      mesh.position.copy(position);
      mesh.position.y += 1.2;

      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        1 + Math.random() * 3,
        Math.sin(angle) * speed
      );

      const particle: Particle = {
        mesh,
        velocity: vel,
        life: 0.15 + Math.random() * 0.2,
        maxLife: 0.3,
        gravity: 8,
        fadeOut: true,
        shrink: true,
      };
      particle.maxLife = particle.life;

      this.scene.add(mesh);
      this.particles.push(particle);
    }
  }

  spawnBloodSplatter(position: THREE.Vector3, direction: THREE.Vector3): void {
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const mat = this.bloodMat.clone();
      mat.transparent = true;
      mat.opacity = 1;
      const mesh = new THREE.Mesh(BLOOD_GEO.clone(), mat);
      mesh.position.copy(position);
      mesh.position.y += 0.8 + Math.random() * 0.6;

      const vel = new THREE.Vector3(
        direction.x * 2 + (Math.random() - 0.5) * 3,
        1 + Math.random() * 2,
        direction.z * 2 + (Math.random() - 0.5) * 3
      );

      const particle: Particle = {
        mesh,
        velocity: vel,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.6,
        gravity: 10,
        fadeOut: true,
        shrink: false,
      };
      particle.maxLife = particle.life;

      this.scene.add(mesh);
      this.particles.push(particle);
    }
  }

  spawnDeathBurst(position: THREE.Vector3): void {
    const count = 15;
    for (let i = 0; i < count; i++) {
      const isEmber = Math.random() > 0.5;
      const mat = (isEmber ? this.sparkMat : this.bloodMat).clone();
      mat.transparent = true;
      mat.opacity = 1;
      const geo = isEmber ? SPARK_GEO.clone() : BLOOD_GEO.clone();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      mesh.position.y += 1;
      mesh.scale.setScalar(0.5 + Math.random() * 1);

      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        2 + Math.random() * 5,
        Math.sin(angle) * speed
      );

      const particle: Particle = {
        mesh,
        velocity: vel,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 0.8,
        gravity: 6,
        fadeOut: true,
        shrink: true,
      };
      particle.maxLife = particle.life;

      this.scene.add(mesh);
      this.particles.push(particle);
    }
  }

  dispose(): void {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];
    this.sparkMat.dispose();
    this.bloodMat.dispose();
    this.blockSparkMat.dispose();
  }
}
