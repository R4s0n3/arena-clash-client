// client/src/Arena.ts
// Performance-optimized arena - minimal lights, low-poly, fewer objects
import * as THREE from "three";

export class Arena {
  private dustParticles: THREE.Points;
  private dustPositions: Float32Array;
  private dustVelocities: Float32Array;
  private radius: number;
  private time = 0;

  constructor(scene: THREE.Scene, radius: number) {
    this.radius = radius;
    this.dustParticles = null!;
    this.dustPositions = null!;
    this.dustVelocities = null!;
    this.buildGround(scene, radius);
    this.buildWalls(scene, radius);
    this.buildLighting(scene);
    this.buildDecorations(scene, radius);
  }

  update(dt: number): void {
    this.time += dt;

    // Dust particles
    if (this.dustPositions && this.dustParticles) {
      const pos = this.dustPositions;
      const vel = this.dustVelocities;
      const count = pos.length / 3;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        pos[i3] += vel[i3] * dt;
        pos[i3 + 1] += vel[i3 + 1] * dt;
        pos[i3 + 2] += vel[i3 + 2] * dt;
        if (pos[i3 + 1] > 5 || pos[i3 + 1] < 0.3) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * this.radius;
          pos[i3] = Math.cos(a) * d;
          pos[i3 + 1] = 0.5 + Math.random() * 2;
          pos[i3 + 2] = Math.sin(a) * d;
        }
      }
      (this.dustParticles.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  private buildGround(scene: THREE.Scene, radius: number): void {
    // Single ground plane
    const groundGeo = new THREE.CircleGeometry(radius, 32);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x2b3036 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Center circle
    const centerGeo = new THREE.CircleGeometry(2, 16);
    const centerMat = new THREE.MeshLambertMaterial({ color: 0x3b4149 });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.01;
    scene.add(center);

    // One decorative ring
    const ringGeo = new THREE.RingGeometry(radius * 0.5, radius * 0.52, 32);
    const ringMat = new THREE.MeshLambertMaterial({ color: 0x6b4b2b });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);
  }

  private buildWalls(scene: THREE.Scene, radius: number): void {
    const wallHeight = 3;
    const wallGeo = new THREE.CylinderGeometry(radius, radius, wallHeight, 32, 1, true);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x454b53, side: THREE.BackSide });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = wallHeight / 2;
    wall.receiveShadow = true;
    scene.add(wall);

    // 8 pillars (reduced from 12)
    const pillarCount = 8;
    const pillarGeo = new THREE.BoxGeometry(0.5, wallHeight + 0.5, 0.5);
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x5a6068 });
    for (let i = 0; i < pillarCount; i++) {
      const angle = (i / pillarCount) * Math.PI * 2;
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(
        Math.cos(angle) * (radius - 0.3),
        (wallHeight + 0.5) / 2,
        Math.sin(angle) * (radius - 0.3)
      );
      pillar.castShadow = true;
      scene.add(pillar);
    }
  }

  private buildLighting(scene: THREE.Scene): void {
    // Ambient + single directional + hemisphere = 3 lights total (was 8+)
    const ambient = new THREE.AmbientLight(0x555566, 0.7);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffe8cc, 1.1);
    dir.position.set(15, 20, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 1024;  // reduced from 2048
    dir.shadow.mapSize.height = 1024;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 50;
    dir.shadow.camera.left = -35;
    dir.shadow.camera.right = 35;
    dir.shadow.camera.top = 35;
    dir.shadow.camera.bottom = -35;
    dir.shadow.bias = -0.002;
    scene.add(dir);

    const hemi = new THREE.HemisphereLight(0x6688aa, 0x332211, 0.4);
    scene.add(hemi);
  }

  private buildDecorations(scene: THREE.Scene, radius: number): void {
    // Skybox
    const skyGeo = new THREE.SphereGeometry(80, 16, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x0a0a1e, side: THREE.BackSide });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Dust particles (reduced count)
    const count = 100;
    const geo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(count * 3);
    this.dustVelocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const a = ((i * 137.5 + 42) % 360) * (Math.PI / 180) + i * 0.3;
      const d = (i * 3.7 % radius);
      this.dustPositions[i * 3] = Math.cos(a) * d;
      this.dustPositions[i * 3 + 1] = 0.5 + (i * 1.7 % 4);
      this.dustPositions[i * 3 + 2] = Math.sin(a) * d;
      this.dustVelocities[i * 3] = (((i * 31) % 100) / 100 - 0.5) * 0.08;
      this.dustVelocities[i * 3 + 1] = 0.04 + ((i * 17) % 100) / 100 * 0.08;
      this.dustVelocities[i * 3 + 2] = (((i * 47) % 100) / 100 - 0.5) * 0.08;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(this.dustPositions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffaa44, size: 0.05, transparent: true, opacity: 0.4 });
    this.dustParticles = new THREE.Points(geo, mat);
    scene.add(this.dustParticles);
  }
}
