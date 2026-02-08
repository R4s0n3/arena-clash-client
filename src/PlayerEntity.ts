// client/src/PlayerEntity.ts
import * as THREE from "three";
import type { PlayerState } from "./types";

const LERP_SPEED = 12;
const BODY_HEIGHT = 1.2;
const HEAD_RADIUS = 0.3;

export class PlayerEntity {
  private group: THREE.Group;
  private body: THREE.Mesh;
  private head: THREE.Mesh;
  private sword: THREE.Group;
  private shield: THREE.Group;
  private rightArm: THREE.Group;
  private leftArm: THREE.Group;
  private nameSprite: THREE.Sprite;
  private isLocal: boolean;
  private targetPos: THREE.Vector3;
  private targetRot: number;
  private currentAction: string = "idle";
  private attackAnimProgress = 0;
  private bodyMaterial: THREE.MeshStandardMaterial;
  private hitFlashTime = 0;
  private originalColor: THREE.Color;

  constructor(
    state: PlayerState,
    isLocal: boolean,
    scene: THREE.Scene
  ) {
    this.isLocal = isLocal;
    this.group = new THREE.Group();
    this.targetPos = new THREE.Vector3(
      state.x,
      state.y,
      state.z
    );
    this.targetRot = state.rotation;

    const color = new THREE.Color(state.color);
    this.originalColor = color.clone();

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.35, BODY_HEIGHT, 8, 12);
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.2,
    });
    this.body = new THREE.Mesh(bodyGeo, this.bodyMaterial);
    this.body.position.y = BODY_HEIGHT / 2 + 0.35;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Head
    const headGeo = new THREE.SphereGeometry(HEAD_RADIUS, 12, 8);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffdbac,
      roughness: 0.8,
    });
    this.head = new THREE.Mesh(headGeo, headMat);
    this.head.position.y =
      BODY_HEIGHT + 0.35 + HEAD_RADIUS + 0.05;
    this.head.castShadow = true;
    this.group.add(this.head);

    // Eye visor (to show facing direction)
    const visorGeo = new THREE.BoxGeometry(0.5, 0.08, 0.1);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, BODY_HEIGHT + 0.35 + HEAD_RADIUS + 0.05, -HEAD_RADIUS + 0.02);
    this.group.add(visor);

    // Right arm (sword arm)
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(
      -0.55,
      BODY_HEIGHT / 2 + 0.6,
      0
    );

    const rArmGeo = new THREE.CapsuleGeometry(0.12, 0.5, 6, 8);
    const armMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
    });
    const rArmMesh = new THREE.Mesh(rArmGeo, armMat);
    rArmMesh.position.y = -0.25;
    this.rightArm.add(rArmMesh);

    // Sword
    this.sword = new THREE.Group();

    const bladeGeo = new THREE.BoxGeometry(0.06, 1.2, 0.02);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.9,
      roughness: 0.1,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = -0.6;
    blade.castShadow = true;
    this.sword.add(blade);

    // Sword handle
    const handleGeo = new THREE.CylinderGeometry(
      0.04,
      0.04,
      0.2,
      8
    );
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 0.05;
    this.sword.add(handle);

    // Crossguard
    const guardGeo = new THREE.BoxGeometry(0.25, 0.04, 0.06);
    const guardMat = new THREE.MeshStandardMaterial({
      color: 0xb8860b,
      metalness: 0.7,
    });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.y = -0.05;
    this.sword.add(guard);

    this.sword.position.y = -0.55;
    this.rightArm.add(this.sword);
    this.group.add(this.rightArm);

    // Left arm (shield arm)
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(
      0.55,
      BODY_HEIGHT / 2 + 0.6,
      0
    );

    const lArmMesh = new THREE.Mesh(rArmGeo.clone(), armMat);
    lArmMesh.position.y = -0.25;
    this.leftArm.add(lArmMesh);

    // Shield
    this.shield = new THREE.Group();

    const shieldGeo = new THREE.CircleGeometry(0.4, 16);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.4,
      metalness: 0.3,
      side: THREE.DoubleSide,
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.castShadow = true;

    // Shield rim
    const rimGeo = new THREE.RingGeometry(0.35, 0.42, 16);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xb8860b,
      metalness: 0.8,
      side: THREE.DoubleSide,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.z = 0.01;
    shieldMesh.add(rim);

    // Shield boss (center)
    const bossGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const bossMat = new THREE.MeshStandardMaterial({
      color: 0xb8860b,
      metalness: 0.9,
    });
    const boss = new THREE.Mesh(bossGeo, bossMat);
    boss.position.z = 0.05;
    shieldMesh.add(boss);

    this.shield.add(shieldMesh);
    this.shield.position.set(0, -0.3, -0.2);
    this.shield.rotation.y = Math.PI / 2;
    this.leftArm.add(this.shield);
    this.group.add(this.leftArm);

    // Name tag
    this.nameSprite = this.createNameSprite(
      state.name,
      isLocal
    );
    this.nameSprite.position.y =
      BODY_HEIGHT + HEAD_RADIUS * 2 + 0.8;
    this.group.add(this.nameSprite);

    // Set initial position
    this.group.position.set(state.x, state.y, state.z);
    this.group.rotation.y = state.rotation;

    // Local player is slightly transparent so camera doesn't clip weird
    if (isLocal) {
      // Not transparent, just noted
    }

    scene.add(this.group);
  }

  private createNameSprite(
    name: string,
    isLocal: boolean
  ): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;

    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = isLocal ? "#f1c40f" : "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.strokeText(name, 128, 40);
    ctx.fillText(name, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 0.5, 1);
    return sprite;
  }

  updateFromServer(state: PlayerState, dt: number): void {
    this.targetPos.set(state.x, state.y, state.z);
    this.targetRot = state.rotation;
    this.currentAction = state.action;

    // Interpolate position
    this.group.position.lerp(
      this.targetPos,
      Math.min(1, LERP_SPEED * dt)
    );

    // Interpolate rotation
    let rotDiff = this.targetRot - this.group.rotation.y;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    this.group.rotation.y +=
      rotDiff * Math.min(1, LERP_SPEED * dt);

    // Animate actions
    this.animateActions(state, dt);

    // Visibility on death
    this.group.visible = !state.isDead;

    // Hit flash
    if (this.hitFlashTime > 0) {
      this.hitFlashTime -= dt;
      const flash = Math.sin(this.hitFlashTime * 30) > 0;
      this.bodyMaterial.color.set(
        flash ? 0xffffff : this.originalColor
      );
      if (this.hitFlashTime <= 0) {
        this.bodyMaterial.color.copy(this.originalColor);
      }
    }
  }

  private animateActions(state: PlayerState, dt: number): void {
    if (state.action === "attacking") {
      const elapsed = Date.now() - state.attackTime;
      this.attackAnimProgress = Math.min(elapsed / 600, 1);

      // Sword swing: wind up then swing forward
      const p = this.attackAnimProgress;
      let swingAngle: number;
      if (p < 0.3) {
        // Wind up
        swingAngle = -(p / 0.3) * 1.5;
      } else if (p < 0.6) {
        // Swing
        const sp = (p - 0.3) / 0.3;
        swingAngle = -1.5 + sp * 4.0;
      } else {
        // Recovery
        const rp = (p - 0.6) / 0.4;
        swingAngle = 2.5 * (1 - rp);
      }

      this.rightArm.rotation.x = swingAngle;
      this.rightArm.rotation.z = Math.sin(p * Math.PI) * 0.3;
    } else {
      // Return to idle
      this.rightArm.rotation.x *= 0.85;
      this.rightArm.rotation.z *= 0.85;
      this.attackAnimProgress = 0;
    }

    if (state.action === "blocking") {
      // Raise shield in front
      this.leftArm.rotation.x +=
        (-1.2 - this.leftArm.rotation.x) * 8 * dt;
      this.leftArm.position.z +=
        (-0.3 - this.leftArm.position.z) * 8 * dt;
    } else {
      this.leftArm.rotation.x +=
        (0 - this.leftArm.rotation.x) * 8 * dt;
      this.leftArm.position.z +=
        (0 - this.leftArm.position.z) * 8 * dt;
    }

    // Idle bob
    if (state.action === "idle") {
      const t = Date.now() * 0.003;
      this.body.position.y =
        BODY_HEIGHT / 2 + 0.35 + Math.sin(t) * 0.02;
    }
  }

  flashHit(): void {
    this.hitFlashTime = 0.3;
  }

  getPosition(): THREE.Vector3 {
    return this.group.position;
  }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.group);
    // Dispose geometries and materials
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
