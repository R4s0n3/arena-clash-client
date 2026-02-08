// client/src/Arena.ts (COMPLETE)
import * as THREE from "three";

export class Arena {
  constructor(scene: THREE.Scene, radius: number) {
    this.buildGround(scene, radius);
    this.buildWalls(scene, radius);
    this.buildLighting(scene);
    this.buildDecorations(scene, radius);
  }

  private buildGround(
    scene: THREE.Scene,
    radius: number
  ): void {
    const groundGeo = new THREE.CircleGeometry(radius, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3d3d3d,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const ringGeo = new THREE.RingGeometry(
      radius * 0.6,
      radius * 0.62,
      64
    );
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.7,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    const centerGeo = new THREE.CircleGeometry(2, 32);
    const centerMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.8,
    });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.01;
    scene.add(center);

    const linesMat = new THREE.LineBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.3,
    });
    for (let i = -radius; i <= radius; i += 5) {
      const extent = Math.sqrt(
        Math.max(0, radius * radius - i * i)
      );
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

  private buildWalls(
    scene: THREE.Scene,
    radius: number
  ): void {
    const wallHeight = 3;
    const wallGeo = new THREE.CylinderGeometry(
      radius,
      radius,
      wallHeight,
      64,
      1,
      true
    );
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.7,
      metalness: 0.3,
      side: THREE.BackSide,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = wallHeight / 2;
    wall.receiveShadow = true;
    scene.add(wall);

    // Top rim
    const rimGeo = new THREE.TorusGeometry(radius, 0.15, 8, 64);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      metalness: 0.6,
      roughness: 0.4,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = wallHeight;
    scene.add(rim);

    // Pillars around the edge
    const pillarCount = 12;
    for (let i = 0; i < pillarCount; i++) {
      const angle = (i / pillarCount) * Math.PI * 2;
      const px = Math.cos(angle) * (radius - 0.3);
      const pz = Math.sin(angle) * (radius - 0.3);

      const pillarGeo = new THREE.CylinderGeometry(
        0.3,
        0.35,
        wallHeight + 0.5,
        8
      );
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.6,
        metalness: 0.4,
      });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, (wallHeight + 0.5) / 2, pz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      scene.add(pillar);

      // Torch flame (point light) on every other pillar
      if (i % 2 === 0) {
        const torchLight = new THREE.PointLight(
          0xff6600,
          2,
          15
        );
        torchLight.position.set(
          px * 0.92,
          wallHeight + 0.3,
          pz * 0.92
        );
        scene.add(torchLight);

        // Flame visual
        const flameGeo = new THREE.SphereGeometry(0.12, 8, 6);
        const flameMat = new THREE.MeshBasicMaterial({
          color: 0xff8800,
        });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.copy(torchLight.position);
        scene.add(flame);
      }
    }
  }

  private buildLighting(scene: THREE.Scene): void {
    // Ambient
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambient);

    // Main directional (sun/moon)
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    dirLight.position.set(15, 25, 10);
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

    // Hemisphere light for sky/ground color blending
    const hemi = new THREE.HemisphereLight(
      0x6688cc,
      0x443322,
      0.4
    );
    scene.add(hemi);

    // Central overhead light
    const centerLight = new THREE.PointLight(
      0xffffee,
      1.5,
      40
    );
    centerLight.position.set(0, 12, 0);
    scene.add(centerLight);
  }

  private buildDecorations(
    scene: THREE.Scene,
    radius: number
  ): void {
    // Some rocks scattered inside the arena
    const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 1,
      metalness: 0,
    });

    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * (radius - 10);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(
        Math.cos(angle) * dist,
        0.2 + Math.random() * 0.2,
        Math.sin(angle) * dist
      );
      rock.scale.setScalar(0.4 + Math.random() * 0.8);
      rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        0
      );
      rock.castShadow = true;
      rock.receiveShadow = true;
      scene.add(rock);
    }

    // Weapon rack decorations near walls
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

    // Skybox substitute — large dark sphere
    const skyGeo = new THREE.SphereGeometry(80, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a1e,
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Particle dust (floating particles)
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      positions[i * 3] = Math.cos(angle) * dist;
      positions[i * 3 + 1] = 0.5 + Math.random() * 5;
      positions[i * 3 + 2] = Math.sin(angle) * dist;
    }
    particleGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    const particleMat = new THREE.PointsMaterial({
      color: 0xffaa44,
      size: 0.06,
      transparent: true,
      opacity: 0.5,
    });
    const particles = new THREE.Points(
      particleGeo,
      particleMat
    );
    scene.add(particles);
  }
}
