// client/src/PlayerEntity.ts
import * as THREE from "three";
import type { PlayerState } from "./types";

const LERP_SPEED = 12;
const BODY_HEIGHT = 1.2;
const HEAD_RADIUS = 0.3;
const LAND_BOUNCE_TIME = 0.16;

export class PlayerEntity {
  private group: THREE.Group;
  private torso: THREE.Group;
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
  private idleTime = 0;
  private landTimer = 0;
  private prevY = 0;

  constructor(
    state: PlayerState,
    isLocal: boolean,
    scene: THREE.Scene
  ) {
    this.isLocal = isLocal;
    this.group = new THREE.Group();
    this.torso = new THREE.Group();
    this.group.add(this.torso);
    this.targetPos = new THREE.Vector3(
      state.x,
      state.y,
      state.z
    );
    this.targetRot = state.rotation;

    const color = new THREE.Color(state.color);
    this.originalColor = color.clone();

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x4b5563,
      roughness: 0.35,
      metalness: 0.7,
    });
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x6b4423,
      roughness: 0.8,
      metalness: 0.1,
    });

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
    this.torso.add(this.body);

    // Chest plate
    const chestGeo = new THREE.BoxGeometry(0.72, 0.9, 0.42);
    const chest = new THREE.Mesh(chestGeo, armorMat);
    chest.position.set(0, BODY_HEIGHT / 2 + 0.38, 0.02);
    chest.castShadow = true;
    this.torso.add(chest);

    // Belt
    const beltGeo = new THREE.TorusGeometry(0.38, 0.06, 8, 16);
    const belt = new THREE.Mesh(beltGeo, leatherMat);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.5;
    this.torso.add(belt);

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
    this.torso.add(this.head);

    // Helmet band
    const helmGeo = new THREE.TorusGeometry(0.32, 0.06, 8, 16);
    const helm = new THREE.Mesh(helmGeo, armorMat);
    helm.rotation.x = Math.PI / 2;
    helm.position.y = this.head.position.y + 0.02;
    this.torso.add(helm);

    // Eye visor (to show facing direction)
    const visorGeo = new THREE.BoxGeometry(0.5, 0.08, 0.1);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, BODY_HEIGHT + 0.35 + HEAD_RADIUS + 0.05, -HEAD_RADIUS + 0.02);
    this.torso.add(visor);

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.13, 0.65, 6, 8);
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x2f333a,
      roughness: 0.9,
      metalness: 0.1,
    });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(0.18, 0.35, 0);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(-0.18, 0.35, 0);
    leftLeg.castShadow = true;
    rightLeg.castShadow = true;
    this.group.add(leftLeg);
    this.group.add(rightLeg);

    // Right arm (sword arm)
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(
      -0.55,
      BODY_HEIGHT / 2 + 0.65,
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
    const rPadGeo = new THREE.SphereGeometry(0.18, 10, 8);
    const rPad = new THREE.Mesh(rPadGeo, armorMat);
    rPad.position.y = 0.05;
    this.rightArm.add(rPad);

    // Sword
    this.sword = new THREE.Group();

    const bladeGeo = new THREE.BoxGeometry(0.06, 1.2, 0.03);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xd7dee7,
      metalness: 1.0,
      roughness: 0.15,
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
      color: 0x5a3c20,
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 0.05;
    this.sword.add(handle);

    // Crossguard
    const guardGeo = new THREE.BoxGeometry(0.25, 0.04, 0.06);
    const guardMat = new THREE.MeshStandardMaterial({
      color: 0xd4b26f,
      metalness: 0.8,
    });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.y = -0.05;
    this.sword.add(guard);

    this.sword.position.y = -0.55;
    this.rightArm.add(this.sword);
    this.torso.add(this.rightArm);

    // Left arm (shield arm)
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(
      0.55,
      BODY_HEIGHT / 2 + 0.65,
      0
    );

    const lArmMesh = new THREE.Mesh(rArmGeo.clone(), armMat);
    lArmMesh.position.y = -0.25;
    this.leftArm.add(lArmMesh);
    const lPad = new THREE.Mesh(rPadGeo, armorMat);
    lPad.position.y = 0.05;
    this.leftArm.add(lPad);

    // Shield
    this.shield = new THREE.Group();

    const shieldGeo = new THREE.CylinderGeometry(0.42, 0.45, 0.08, 24);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x6b4b2b,
      roughness: 0.5,
      metalness: 0.2,
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.castShadow = true;

    // Shield rim
    const rimGeo = new THREE.TorusGeometry(0.43, 0.04, 8, 16);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd4b26f,
      metalness: 0.8,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.04;
    this.shield.add(rim);

    // Shield boss (center)
    const bossGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const bossMat = new THREE.MeshStandardMaterial({
      color: 0xd4b26f,
      metalness: 0.9,
    });
    const boss = new THREE.Mesh(bossGeo, bossMat);
    boss.position.y = 0.06;
    shieldMesh.add(boss);

    this.shield.add(shieldMesh);
    this.shield.position.set(0, -0.25, -0.15);
    this.shield.rotation.x = Math.PI / 2;
    this.leftArm.add(this.shield);
    this.torso.add(this.leftArm);

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

    ctx.font = "700 28px 'Space Grotesk', Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = isLocal ? "#f1c40f" : "#ffffff";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
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

    // Landing check for squash
    if (this.prevY > 0.05 && this.group.position.y <= 0.02) {
      this.landTimer = LAND_BOUNCE_TIME;
    }
    this.prevY = this.group.position.y;

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
    this.idleTime += dt;
    const inAir = this.group.position.y > 0.04;

    // Landing squash
    if (this.landTimer > 0) {
      this.landTimer -= dt;
    }
    const landP =
      this.landTimer > 0
        ? 1 - this.landTimer / LAND_BOUNCE_TIME
        : 1;
    const squash = this.landTimer > 0 ? Math.sin(landP * Math.PI) : 0;
    const targetScaleY = 1 - squash * 0.12;
    const targetScaleXZ = 1 + squash * 0.06;
    this.torso.scale.x = THREE.MathUtils.lerp(
      this.torso.scale.x,
      targetScaleXZ,
      Math.min(1, dt * 10)
    );
    this.torso.scale.y = THREE.MathUtils.lerp(
      this.torso.scale.y,
      targetScaleY,
      Math.min(1, dt * 10)
    );
    this.torso.scale.z = THREE.MathUtils.lerp(
      this.torso.scale.z,
      targetScaleXZ,
      Math.min(1, dt * 10)
    );

    // Subtle idle sway
    const idleBob = inAir
      ? 0
      : Math.sin(this.idleTime * 4) * 0.025;
    this.torso.position.y = idleBob;

    if (state.action === "attacking") {
      const elapsed = Date.now() - state.attackTime;
      this.attackAnimProgress = Math.min(elapsed / 600, 1);

      // Sword swing: wind-up, strike, recover
      const p = this.attackAnimProgress;
      const wind = Math.min(p / 0.22, 1);
      const strike = Math.min(Math.max((p - 0.22) / 0.32, 0), 1);
      const recover = Math.min(Math.max((p - 0.54) / 0.46, 0), 1);
      const swingAngle = -1.25 * wind + 3.0 * strike - 0.9 * recover;

      this.rightArm.rotation.x = swingAngle;
      this.rightArm.rotation.z = -0.25 + Math.sin(p * Math.PI) * 0.55;
      this.rightArm.rotation.y = -0.2 + Math.sin(p * Math.PI) * -0.35;
      this.sword.rotation.z = Math.sin(p * Math.PI) * 0.75;
      this.sword.rotation.x = Math.sin(p * Math.PI) * -0.2;

      this.torso.rotation.y = THREE.MathUtils.lerp(
        this.torso.rotation.y,
        -0.25 + strike * 0.55,
        Math.min(1, dt * 10)
      );
      this.torso.rotation.x = THREE.MathUtils.lerp(
        this.torso.rotation.x,
        inAir ? -0.3 : 0.05,
        Math.min(1, dt * 8)
      );
    } else {
      // Return to idle
      this.rightArm.rotation.x += (0 - this.rightArm.rotation.x) * 8 * dt;
      this.rightArm.rotation.z += (0 - this.rightArm.rotation.z) * 8 * dt;
      this.rightArm.rotation.y += (0 - this.rightArm.rotation.y) * 8 * dt;
      this.sword.rotation.z += (0 - this.sword.rotation.z) * 8 * dt;
      this.attackAnimProgress = 0;
    }

    if (state.action === "blocking") {
      // Raise shield in front
      this.leftArm.rotation.x +=
        (-1.35 - this.leftArm.rotation.x) * 10 * dt;
      this.leftArm.rotation.z +=
        (0.3 - this.leftArm.rotation.z) * 10 * dt;
      this.leftArm.position.z +=
        (-0.35 - this.leftArm.position.z) * 8 * dt;
      this.shield.rotation.z +=
        (-0.18 - this.shield.rotation.z) * 10 * dt;
    } else {
      this.leftArm.rotation.x +=
        (0 - this.leftArm.rotation.x) * 8 * dt;
      this.leftArm.rotation.z +=
        (0 - this.leftArm.rotation.z) * 8 * dt;
      this.leftArm.position.z +=
        (0 - this.leftArm.position.z) * 8 * dt;
      this.shield.rotation.z +=
        (0 - this.shield.rotation.z) * 8 * dt;
    }

    // Airborne tilt
    if (state.action !== "attacking") {
      this.torso.rotation.x = THREE.MathUtils.lerp(
        this.torso.rotation.x,
        inAir ? -0.35 : 0,
        Math.min(1, dt * 6)
      );
      this.torso.rotation.y = THREE.MathUtils.lerp(
        this.torso.rotation.y,
        0,
        Math.min(1, dt * 6)
      );
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
