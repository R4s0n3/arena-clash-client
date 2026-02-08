// client/src/Arena.ts
import * as THREE from "three";

export class Arena {
  private dustParticles: THREE.Points;
  private dustPositions: Float32Array;
  private dustVelocities: Float32Array;
  private radius: number;
  private torchLights: THREE.PointLight[] = [];
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

    // Animate dust particles
    if (this.dustPositions && this.dustParticles) {
      const positions = this.dustPositions;
      const velocities = this.dustVelocities;
      const count = positions.length / 3;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        positions[i3] += velocities[i3] * dt;
        positions[i3 + 1] += velocities[i3 + 1] * dt;
        positions[i3 + 2] += velocities[i3 + 2] * dt;

        // Gentle swirl
        positions[i3] += Math.sin(this.time * 0.5 + i * 0.1) * 0.002;
        positions[i3 + 2] += Math.cos(this.time * 0.3 + i * 0.15) * 0.002;

        // Reset if too high or out of bounds
        if (positions[i3 + 1] > 6 || positions[i3 + 1] < 0.3) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * this.radius;
          positions[i3] = Math.cos(angle) * dist;
          positions[i3 + 1] = 0.5 + Math.random() * 2;
          positions[i3 + 2] = Math.sin(angle) * dist;
        }
      }

      (this.dustParticles.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Flicker torch lights
    for (const torch of this.torchLights) {
      torch.intensity = 2.0 + Math.sin(this.time * 8 + torch.position.x) * 0.4 + Math.random() * 0.2;
    }
  }

  private buildGround(scene: THREE.Scene, radius: number): void {
    const groundGeo = new THREE.CircleGeometry(radius, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2b3036,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Decorative ring
    const ringGeo = new THREE.RingGeometry(radius * 0.6, radius * 0.62, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x6b4b2b,
      roughness: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    // Inner ring
    const innerRingGeo = new THREE.RingGeometry(radius * 0.3, radius * 0.31, 64);
    const innerRing = new THREE.Mesh(innerRingGeo, ringMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.01;
    scene.add(innerRing);

    // Center circle
    const centerGeo = new THREE.CircleGeometry(2, 32);
    const centerMat = new THREE.MeshStandardMaterial({
      color: 0x3b4149,
      roughness: 0.85,
    });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.01;
    scene.add(center);

    // Grid lines
    const linesMat = new THREE.LineBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.3,
    });
    for (let i = -radius; i <= radius; i += 5) {
      const extent = Math.sqrt(Math.max(0, radius * radius - i * i));
      if (extent < 1) continue;
      const points1 = [
        new THREE.Vector3(i, 0.005, -extent),
        new THREE.Vector3(i, 0.005, extent),
      ];
      const points2 = [
        new THREE.Vector3(-extent, 0.005, i),
        new THREE.Vector3(extent, 0.005, i),
      ];
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points1),
          linesMat
        )
      );
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points2),
          linesMat
        )
      );
    }
  }

  private buildWalls(scene: THREE.Scene, radius: number): void {
    const wallHeight = 3;
    const wallGeo = new THREE.CylinderGeometry(
      radius, radius, wallHeight, 64, 1, true
    );
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x454b53,
      roughness: 0.75,
      metalness: 0.25,
      side: THREE.BackSide,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = wallHeight / 2;
    wall.receiveShadow = true;
    scene.add(wall);

    // Top rim
    const rimGeo = new THREE.TorusGeometry(radius, 0.15, 8, 64);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x8c6a3e,
      metalness: 0.5,
      roughness: 0.45,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = wallHeight;
    scene.add(rim);

    // Pillars
    const pillarCount = 12;
    for (let i = 0; i < pillarCount; i++) {
      const angle = (i / pillarCount) * Math.PI * 2;
      const px = Math.cos(angle) * (radius - 0.3);
      const pz = Math.sin(angle) * (radius - 0.3);

      const pillarGeo = new THREE.CylinderGeometry(0.3, 0.35, wallHeight + 0.5, 8);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x5a6068,
        roughness: 0.65,
        metalness: 0.35,
      });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, (wallHeight + 0.5) / 2, pz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      scene.add(pillar);

      if (i % 2 === 0) {
        const torchLight = new THREE.PointLight(0xff7a3d, 2.2, 15);
        torchLight.position.set(px * 0.92, wallHeight + 0.3, pz * 0.92);
        scene.add(torchLight);
        this.torchLights.push(torchLight);

        const flameGeo = new THREE.SphereGeometry(0.12, 8, 6);
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa35a });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.copy(torchLight.position);
        scene.add(flame);
      } else {
        const bannerGeo = new THREE.PlaneGeometry(1.4, 2.2);
        const bannerMat = new THREE.MeshStandardMaterial({
          color: 0x4a2b1a,
          roughness: 0.9,
          metalness: 0.05,
          side: THREE.DoubleSide,
        });
        const banner = new THREE.Mesh(bannerGeo, bannerMat);
        banner.position.set(px * 0.92, 1.6, pz * 0.92);
        banner.lookAt(0, 1.6, 0);
        scene.add(banner);
      }
    }
  }

  private buildLighting(scene: THREE.Scene): void {
    const ambient = new THREE.AmbientLight(0x40444f, 0.55);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffe0c4, 1.0);
    dirLight.position.set(18, 24, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 60;
    dirLight.shadow.camera.left = -35;
    dirLight.shadow.camera.right = 35;
    dirLight.shadow.camera.top = 35;
    dirLight.shadow.camera.bottom = -35;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    const hemi = new THREE.HemisphereLight(0x5a7aa2, 0x3a2a1d, 0.35);
    scene.add(hemi);

    const centerLight = new THREE.PointLight(0xfff0d8, 1.6, 40);
    centerLight.position.set(0, 12, 0);
    scene.add(centerLight);
  }

  private buildDecorations(scene: THREE.Scene, radius: number): void {
    // Seeded rocks (consistent positions using deterministic math)
    const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 1,
      metalness: 0,
    });

    for (let i = 0; i < 8; i++) {
      // Deterministic positions based on index
      const angle = ((i * 137.5) % 360) * (Math.PI / 180);
      const dist = 5 + ((i * 7.3) % (radius - 10));
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(
        Math.cos(angle) * dist,
        0.2 + (i % 3) * 0.1,
        Math.sin(angle) * dist
      );
      rock.scale.setScalar(0.4 + (i % 4) * 0.2);
      rock.rotation.set(i * 0.7, i * 1.2, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      scene.add(rock);
    }

    // Weapon rack decorations
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(angle) * (radius - 2);
      const z = Math.sin(angle) * (radius - 2);

      const rackGeo = new THREE.BoxGeometry(1.5, 2, 0.2);
      const rackMat = new THREE.MeshStandardMaterial({
        color: 0x654321,
        roughness: 0.9,
      });
      const rack = new THREE.Mesh(rackGeo, rackMat);
      rack.position.set(x, 1, z);
      rack.lookAt(0, 1, 0);
      rack.castShadow = true;
      scene.add(rack);
    }

    // Skybox
    const skyGeo = new THREE.SphereGeometry(80, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a1e,
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Animated dust particles
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(particleCount * 3);
    this.dustVelocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const angle = ((i * 137.5 + 42) % 360) * (Math.PI / 180) + i * 0.3;
      const dist = (i * 3.7 % radius);
      this.dustPositions[i * 3] = Math.cos(angle) * dist;
      this.dustPositions[i * 3 + 1] = 0.5 + (i * 1.7 % 5);
      this.dustPositions[i * 3 + 2] = Math.sin(angle) * dist;

      // Slow upward drift with slight horizontal movement
      this.dustVelocities[i * 3] = (((i * 31) % 100) / 100 - 0.5) * 0.1;
      this.dustVelocities[i * 3 + 1] = 0.05 + ((i * 17) % 100) / 100 * 0.1;
      this.dustVelocities[i * 3 + 2] = (((i * 47) % 100) / 100 - 0.5) * 0.1;
    }

    particleGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.dustPositions, 3)
    );

    const particleMat = new THREE.PointsMaterial({
      color: 0xffaa44,
      size: 0.06,
      transparent: true,
      opacity: 0.5,
    });
    this.dustParticles = new THREE.Points(particleGeo, particleMat);
    scene.add(this.dustParticles);
  }
}
