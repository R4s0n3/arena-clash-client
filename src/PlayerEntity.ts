// client/src/PlayerEntity.ts
// Blocky Roblox/Minecraft-style character with clean articulated limbs
import * as THREE from "three";
import type { PlayerState } from "./types";

const LERP_SPEED = 18;

function approach(current: number, target: number, speed: number, dt: number): number {
  return current + (target - current) * Math.min(1, speed * dt);
}

export class PlayerEntity {
  // Hierarchy: group > root (rotation) > body parts
  private group: THREE.Group;   // world position
  private root: THREE.Group;    // body rotation pivot at feet

  // Body parts - all boxes
  private torso: THREE.Mesh;
  private head: THREE.Mesh;
  private rArm: THREE.Group;    // right arm pivot (sword)
  private rArmMesh: THREE.Mesh;
  private lArm: THREE.Group;    // left arm pivot (shield)
  private lArmMesh: THREE.Mesh;
  private rLeg: THREE.Group;    // right leg pivot
  private rLegMesh: THREE.Mesh;
  private lLeg: THREE.Group;    // left leg pivot
  private lLegMesh: THREE.Mesh;

  // Weapons
  private swordGroup: THREE.Group;
  private shieldGroup: THREE.Group;

  private nameSprite: THREE.Sprite;

  // State
  private isLocal: boolean;
  private targetPos = new THREE.Vector3();
  private targetRot = 0;
  private bodyMat: THREE.MeshLambertMaterial;
  private originalColor: THREE.Color;

  // Animation
  private idleTime = 0;
  private walkCycle = 0;
  private moveSpeed = 0;
  private localMoveSpeed = 0;
  private prevX = 0;
  private prevZ = 0;

  private attackElapsed = 0;
  private attackActive = false;
  private attackStep = 0;

  private hitFlashTime = 0;
  private hitRecoilTime = 0;
  private blockImpactTime = 0;
  private scalePulseTime = 0;
  private dodgeTime = 0;
  private dodgeActive = false;
  private landTimer = 0;
  private prevY = 0;

  private kbOffsetX = 0;
  private kbOffsetZ = 0;

  private swordTip = new THREE.Vector3();

  constructor(state: PlayerState, isLocal: boolean, scene: THREE.Scene) {
    this.isLocal = isLocal;
    this.prevX = state.x;
    this.prevZ = state.z;
    this.prevY = state.y;

    const color = new THREE.Color(state.color);
    this.originalColor = color.clone();

    // Materials - use Lambert for performance (no specular calculation)
    this.bodyMat = new THREE.MeshLambertMaterial({ color });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xf0c8a0 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x888899 });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xccaa55 });
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0xccddee });
    const shieldWoodMat = new THREE.MeshLambertMaterial({ color: 0x553311 });

    // === HIERARCHY ===
    this.group = new THREE.Group();
    this.root = new THREE.Group();
    this.group.add(this.root);

    // === TORSO (center body block) ===
    // 0.8 wide, 1.0 tall, 0.4 deep. Bottom at y=0.9, top at y=1.9
    const torsoGeo = new THREE.BoxGeometry(0.8, 1.0, 0.4);
    this.torso = new THREE.Mesh(torsoGeo, this.bodyMat);
    this.torso.position.y = 1.4; // center of torso
    this.torso.castShadow = true;
    this.root.add(this.torso);

    // === HEAD ===
    // 0.6 cube, sits on top of torso
    const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 2.2;
    this.head.castShadow = true;
    this.root.add(this.head);

    // Eyes (two small dark blocks on front face of head)
    const eyeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
    const lEye = new THREE.Mesh(eyeGeo, darkMat);
    lEye.position.set(0.12, 2.22, -0.3);
    this.root.add(lEye);
    const rEye = new THREE.Mesh(eyeGeo, darkMat);
    rEye.position.set(-0.12, 2.22, -0.3);
    this.root.add(rEye);

    // Helmet (slightly larger box on top half of head)
    const helmGeo = new THREE.BoxGeometry(0.65, 0.35, 0.65);
    const helm = new THREE.Mesh(helmGeo, metalMat);
    helm.position.y = 2.35;
    helm.castShadow = true;
    this.root.add(helm);

    // === RIGHT ARM (sword arm, player's right = -X) ===
    // Pivot at shoulder height
    this.rArm = new THREE.Group();
    this.rArm.position.set(-0.55, 1.75, 0); // shoulder joint
    this.root.add(this.rArm);

    const armGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
    this.rArmMesh = new THREE.Mesh(armGeo, this.bodyMat);
    this.rArmMesh.position.y = -0.4; // hangs down from pivot
    this.rArmMesh.castShadow = true;
    this.rArm.add(this.rArmMesh);

    // Sword attached to bottom of right arm
    this.swordGroup = new THREE.Group();
    this.swordGroup.position.y = -0.85; // at hand position
    this.rArm.add(this.swordGroup);

    // Grip
    const gripGeo = new THREE.BoxGeometry(0.06, 0.2, 0.06);
    const grip = new THREE.Mesh(gripGeo, woodMat);
    this.swordGroup.add(grip);

    // Crossguard
    const crossGeo = new THREE.BoxGeometry(0.22, 0.04, 0.06);
    const cross = new THREE.Mesh(crossGeo, goldMat);
    cross.position.y = -0.1;
    this.swordGroup.add(cross);

    // Blade
    const bladeGeo = new THREE.BoxGeometry(0.06, 0.8, 0.02);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = -0.5;
    blade.castShadow = true;
    this.swordGroup.add(blade);

    // Pommel
    const pomGeo = new THREE.BoxGeometry(0.08, 0.06, 0.08);
    const pom = new THREE.Mesh(pomGeo, goldMat);
    pom.position.y = 0.12;
    this.swordGroup.add(pom);

    // === LEFT ARM (shield arm, player's left = +X) ===
    this.lArm = new THREE.Group();
    this.lArm.position.set(0.55, 1.75, 0); // shoulder joint
    this.root.add(this.lArm);

    this.lArmMesh = new THREE.Mesh(armGeo.clone(), this.bodyMat);
    this.lArmMesh.position.y = -0.4;
    this.lArmMesh.castShadow = true;
    this.lArm.add(this.lArmMesh);

    // Shield attached to left arm - face points outward (-Z = forward)
    this.shieldGroup = new THREE.Group();
    // Slightly higher, more forward, and gently canted outward for a held feel
    this.shieldGroup.position.set(0.12, -0.38, -0.28);
    this.shieldGroup.rotation.set(0.05, 0, 0.12);
    this.lArm.add(this.shieldGroup);

    // Shield body - flat box, wide and tall, thin depth
    // Face normal is -Z (forward-facing when arm is down)
    const shieldGeo = new THREE.BoxGeometry(0.5, 0.6, 0.06);
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldWoodMat);
    shieldMesh.castShadow = true;
    this.shieldGroup.add(shieldMesh);

    // Shield rim (frame around the shield)
    const rimTopGeo = new THREE.BoxGeometry(0.55, 0.04, 0.08);
    const rimTop = new THREE.Mesh(rimTopGeo, goldMat);
    rimTop.position.y = 0.3;
    this.shieldGroup.add(rimTop);
    const rimBot = new THREE.Mesh(rimTopGeo.clone(), goldMat);
    rimBot.position.y = -0.3;
    this.shieldGroup.add(rimBot);
    const rimSideGeo = new THREE.BoxGeometry(0.04, 0.6, 0.08);
    const rimL = new THREE.Mesh(rimSideGeo, goldMat);
    rimL.position.x = 0.25;
    this.shieldGroup.add(rimL);
    const rimR = new THREE.Mesh(rimSideGeo.clone(), goldMat);
    rimR.position.x = -0.25;
    this.shieldGroup.add(rimR);

    // Shield boss (center dot)
    const bossGeo = new THREE.BoxGeometry(0.12, 0.12, 0.08);
    const boss = new THREE.Mesh(bossGeo, metalMat);
    boss.position.z = -0.04;
    this.shieldGroup.add(boss);

    // Color emblem on shield
    const emblemGeo = new THREE.BoxGeometry(0.2, 0.25, 0.02);
    const emblem = new THREE.Mesh(emblemGeo, this.bodyMat);
    emblem.position.z = -0.04;
    emblem.position.y = 0.05;
    this.shieldGroup.add(emblem);

    // === LEGS ===
    // Right leg (player's right = -X)
    this.rLeg = new THREE.Group();
    this.rLeg.position.set(-0.2, 0.9, 0); // hip joint
    this.root.add(this.rLeg);

    const legGeo = new THREE.BoxGeometry(0.3, 0.85, 0.3);
    this.rLegMesh = new THREE.Mesh(legGeo, darkMat);
    this.rLegMesh.position.y = -0.425;
    this.rLegMesh.castShadow = true;
    this.rLeg.add(this.rLegMesh);

    // Left leg
    this.lLeg = new THREE.Group();
    this.lLeg.position.set(0.2, 0.9, 0);
    this.root.add(this.lLeg);

    this.lLegMesh = new THREE.Mesh(legGeo.clone(), darkMat);
    this.lLegMesh.position.y = -0.425;
    this.lLegMesh.castShadow = true;
    this.lLeg.add(this.lLegMesh);

    // === NAME TAG ===
    this.nameSprite = this.createNameSprite(state.name, isLocal);
    this.nameSprite.position.y = 2.8;
    this.group.add(this.nameSprite);

    // === INIT ===
    this.targetPos.set(state.x, state.y, state.z);
    this.targetRot = state.rotation;
    this.group.position.set(state.x, state.y, state.z);
    this.group.rotation.y = state.rotation;

    scene.add(this.group);
  }

  private createNameSprite(name: string, isLocal: boolean): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "700 26px 'Space Grotesk', Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = isLocal ? "#f1c40f" : "#ffffff";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    ctx.lineWidth = 4;
    ctx.strokeText(name, 128, 40);
    ctx.fillText(name, 128, 40);
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2, 0.5, 1);
    return sprite;
  }

  updateNameTag(name: string): void {
    const old = this.nameSprite;
    this.group.remove(old);
    old.material.map?.dispose();
    old.material.dispose();
    this.nameSprite = this.createNameSprite(name, this.isLocal);
    this.nameSprite.position.y = 2.8;
    this.group.add(this.nameSprite);
  }

  // ===================== UPDATE =====================
  updateFromServer(state: PlayerState, dt: number): void {
    this.targetPos.set(state.x, state.y, state.z);
    this.targetRot = state.rotation;

    // Move speed for remote players
    if (!this.isLocal) {
      const dx = state.x - this.prevX;
      const dz = state.z - this.prevZ;
      this.moveSpeed = approach(this.moveSpeed, Math.sqrt(dx * dx + dz * dz) / Math.max(dt, 0.001), 12, dt);
    }
    this.prevX = state.x;
    this.prevZ = state.z;

    // Position
    if (this.isLocal) {
      this.group.position.set(
        this.targetPos.x + this.kbOffsetX,
        this.targetPos.y,
        this.targetPos.z + this.kbOffsetZ
      );
      // Local player: instant rotation
      this.group.rotation.y = this.targetRot;
    } else {
      this.group.position.lerp(this.targetPos, Math.min(1, LERP_SPEED * dt));
      // Smooth rotation for remote players
      let rd = this.targetRot - this.group.rotation.y;
      while (rd > Math.PI) rd -= Math.PI * 2;
      while (rd < -Math.PI) rd += Math.PI * 2;
      this.group.rotation.y += rd * Math.min(1, LERP_SPEED * dt);
    }

    // Knockback decay
    this.kbOffsetX = approach(this.kbOffsetX, 0, 10, dt);
    this.kbOffsetZ = approach(this.kbOffsetZ, 0, 10, dt);

    // Landing
    if (this.prevY > 0.05 && this.group.position.y <= 0.02) this.landTimer = 0.12;
    this.prevY = this.group.position.y;

    // Attack tracking
    if (state.action === "attacking") {
      if (!this.attackActive || state.attackIndex !== this.attackStep) {
        this.attackActive = true;
        this.attackStep = state.attackIndex;
        this.attackElapsed = 0;
      }
      this.attackElapsed += dt;
    } else {
      this.attackActive = false;
      this.attackElapsed = 0;
      this.attackStep = 0;
    }

    // Dodge tracking
    if (state.action === "dodging" && !this.dodgeActive) {
      this.dodgeActive = true;
      this.dodgeTime = 0;
    } else if (state.action !== "dodging") {
      this.dodgeActive = false;
    }
    if (this.dodgeActive) this.dodgeTime += dt;

    // Animate
    this.animate(state, dt);

    // Visibility
    this.group.visible = !state.isDead;

    // Scale pulse
    if (this.scalePulseTime > 0) {
      this.scalePulseTime -= dt;
      const s = 1 + Math.sin((this.scalePulseTime / 0.12) * Math.PI) * 0.08;
      this.root.scale.setScalar(s);
    } else {
      this.root.scale.setScalar(1);
    }

    // Hit flash
    if (this.hitFlashTime > 0) {
      this.hitFlashTime -= dt;
      const flash = Math.sin(this.hitFlashTime * 40) > 0;
      this.bodyMat.emissive.setRGB(flash ? 1 : 0, flash ? 0.3 : 0, flash ? 0.1 : 0);
      if (this.hitFlashTime <= 0) {
        this.bodyMat.emissive.setRGB(0, 0, 0);
      }
    }

    // Sword tip for trail
    this.swordGroup.updateWorldMatrix(true, false);
    this.swordTip.set(0, -0.9, 0);
    this.swordGroup.localToWorld(this.swordTip);
  }

  setPredictedPosition(x: number, y: number, z: number): void {
    this.targetPos.set(x, y, z);
  }

  setLocalMoveSpeed(speed: number): void {
    this.localMoveSpeed = speed;
  }

  // ===================== ANIMATION =====================
  private animate(state: PlayerState, dt: number): void {
    this.idleTime += dt;
    const inAir = this.group.position.y > 0.04;
    const speed = this.isLocal ? this.localMoveSpeed : this.moveSpeed;
    const isMoving = speed > 0.5;
    const walkFactor = Math.min(speed / 8, 1);

    // Landing squash
    if (this.landTimer > 0) {
      this.landTimer -= dt;
      const sq = Math.sin((1 - this.landTimer / 0.12) * Math.PI);
      this.root.scale.y = 1 - sq * 0.1;
    }

    // Recoil
    let recoil = 0;
    if (this.hitRecoilTime > 0) {
      this.hitRecoilTime -= dt;
      recoil = Math.sin((this.hitRecoilTime / 0.2) * Math.PI) * 0.15;
    }

    // ===== IDLE =====
    if (state.action === "idle" && !isMoving && !inAir) {
      const breathe = Math.sin(this.idleTime * 2.5) * 0.01;
      this.torso.position.y = 1.4 + breathe;

      // Arms relaxed but ready
      this.rArm.rotation.x = approach(this.rArm.rotation.x, 0.25 + recoil, 8, dt);
      this.rArm.rotation.z = approach(this.rArm.rotation.z, 0.08, 8, dt);
      this.lArm.rotation.x = approach(this.lArm.rotation.x, -0.25, 8, dt);
      this.lArm.rotation.z = approach(this.lArm.rotation.z, 0.08, 8, dt);
      this.lArm.rotation.y = approach(this.lArm.rotation.y, 0, 8, dt);

      // Legs straight
      this.rLeg.rotation.x = approach(this.rLeg.rotation.x, 0, 8, dt);
      this.lLeg.rotation.x = approach(this.lLeg.rotation.x, 0, 8, dt);

      // Torso/head neutral
      this.torso.rotation.x = approach(this.torso.rotation.x, recoil, 6, dt);
      this.torso.rotation.y = approach(this.torso.rotation.y, 0, 6, dt);
      this.head.rotation.x = approach(this.head.rotation.x, 0, 6, dt);
      this.head.rotation.y = approach(this.head.rotation.y, 0, 4, dt);

      // Sword hangs naturally
      this.swordGroup.rotation.x = approach(this.swordGroup.rotation.x, 0, 6, dt);
      this.swordGroup.rotation.z = approach(this.swordGroup.rotation.z, 0, 6, dt);
    }

    // ===== WALKING =====
    if (isMoving && !inAir && state.action !== "attacking" && state.action !== "dodging") {
      this.walkCycle += dt * (8 + walkFactor * 6);
      const sin = Math.sin(this.walkCycle);

      // Legs swing
      this.rLeg.rotation.x = approach(this.rLeg.rotation.x, sin * 0.6 * walkFactor, 15, dt);
      this.lLeg.rotation.x = approach(this.lLeg.rotation.x, -sin * 0.6 * walkFactor, 15, dt);

      // Arms counter-swing
      this.rArm.rotation.x = approach(this.rArm.rotation.x, 0.25 + sin * 0.35 * walkFactor + recoil, 12, dt);
      this.lArm.rotation.x = approach(this.lArm.rotation.x, -0.2 + sin * 0.3 * walkFactor, 12, dt);
      this.rArm.rotation.z = approach(this.rArm.rotation.z, 0.05, 8, dt);
      this.lArm.rotation.z = approach(this.lArm.rotation.z, 0.05, 8, dt);
      this.lArm.rotation.y = approach(this.lArm.rotation.y, 0, 8, dt);

      // Torso lean forward + slight bounce
      this.torso.rotation.x = approach(this.torso.rotation.x, -0.05 * walkFactor + recoil, 10, dt);
      this.torso.rotation.y = approach(this.torso.rotation.y, sin * 0.04 * walkFactor, 8, dt);
      this.torso.position.y = 1.4 + Math.abs(sin) * 0.02 * walkFactor;

      // Sword/shield neutral during walk
      this.swordGroup.rotation.x = approach(this.swordGroup.rotation.x, 0, 8, dt);
      this.swordGroup.rotation.z = approach(this.swordGroup.rotation.z, 0, 8, dt);
    }

    // ===== ATTACK =====
    if (state.action === "attacking") {
      const step = Math.max(1, Math.min(3, this.attackStep));
      const dur = [0.45, 0.48, 0.6][step - 1];
      const p = Math.min(this.attackElapsed / dur, 1);

      // Simple but punchy: windup -> strike -> follow through
      const wind = Math.min(p / 0.2, 1);
      const strike = Math.min(Math.max((p - 0.2) / 0.2, 0), 1);
      const follow = Math.min(Math.max((p - 0.4) / 0.3, 0), 1);
      const recover = Math.min(Math.max((p - 0.7) / 0.3, 0), 1);

      if (step === 1) {
        // Right horizontal slash
        this.rArm.rotation.x = 0.7 * wind + 1.0 * strike - 0.15 * follow - 0.05 * recover;
        this.rArm.rotation.z = -1.2 * wind + 1.8 * strike - 0.4 * follow;
        this.swordGroup.rotation.z = 0.3 * wind - 1.2 * strike + 0.2 * follow;
        this.torso.rotation.y = approach(this.torso.rotation.y, 0.3 * wind - 0.5 * strike + 0.1 * follow, 18, dt);
      } else if (step === 2) {
        // Backhand slash (opposite direction)
        this.rArm.rotation.x = 0.6 * wind + 0.9 * strike - 0.15 * follow - 0.05 * recover;
        this.rArm.rotation.z = 1.0 * wind - 1.6 * strike + 0.3 * follow;
        this.swordGroup.rotation.z = -0.3 * wind + 1.3 * strike - 0.2 * follow;
        this.torso.rotation.y = approach(this.torso.rotation.y, -0.3 * wind + 0.5 * strike - 0.1 * follow, 18, dt);
      } else {
        // Overhead slam
        this.rArm.rotation.x = -2.4 * wind + 2.2 * strike + 0.4 * follow + 0.1 * recover;
        this.rArm.rotation.z = 0.2 * wind - 0.1 * strike;
        this.swordGroup.rotation.x = -0.3 * wind + 0.2 * strike;
        this.torso.rotation.x = approach(this.torso.rotation.x, -0.15 * wind + 0.1 * strike + recoil, 15, dt);
        this.torso.rotation.y = approach(this.torso.rotation.y, 0, 10, dt);
      }

      // Shield tucks to body during attack
      this.lArm.rotation.x = approach(this.lArm.rotation.x, -0.4, 10, dt);
      this.lArm.rotation.z = approach(this.lArm.rotation.z, 0.25, 10, dt);
      this.lArm.rotation.y = approach(this.lArm.rotation.y, 0, 10, dt);

      // Legs stable
      this.rLeg.rotation.x = approach(this.rLeg.rotation.x, 0.1 * strike, 8, dt);
      this.lLeg.rotation.x = approach(this.lLeg.rotation.x, -0.1 * strike, 8, dt);
    }

    // ===== BLOCK =====
    if (state.action === "blocking") {
      // Shield arm forward and across the body
      this.lArm.rotation.x = approach(this.lArm.rotation.x, 0.95, 16, dt);
      this.lArm.rotation.z = approach(this.lArm.rotation.z, 0.45, 12, dt);
      this.lArm.rotation.y = approach(this.lArm.rotation.y, 0, 12, dt);

      // Sword arm back
      this.rArm.rotation.x = approach(this.rArm.rotation.x, -0.2 + recoil, 10, dt);
      this.rArm.rotation.z = approach(this.rArm.rotation.z, 0.3, 10, dt);

      // Slight crouch + lean into the shield
      this.torso.rotation.x = approach(this.torso.rotation.x, -0.08 + recoil, 10, dt);
      this.torso.rotation.y = approach(this.torso.rotation.y, 0.18, 10, dt);

      // Block impact shake
      if (this.blockImpactTime > 0) {
        this.blockImpactTime -= dt;
        const shake = Math.sin(this.blockImpactTime * 50) * 0.03 * (this.blockImpactTime / 0.2);
        this.lArm.position.z = shake;
      } else {
        this.lArm.position.z = approach(this.lArm.position.z, 0, 12, dt);
      }

      this.rLeg.rotation.x = approach(this.rLeg.rotation.x, 0.05, 8, dt);
      this.lLeg.rotation.x = approach(this.lLeg.rotation.x, -0.1, 8, dt);
    }

    // ===== DODGE =====
    if (state.action === "dodging") {
      const p = Math.min(this.dodgeTime / 0.28, 1);
      // Tuck everything
      this.torso.rotation.x = approach(this.torso.rotation.x, -0.6 * (1 - p), 20, dt);
      this.rArm.rotation.x = approach(this.rArm.rotation.x, -1.0 * (1 - p), 16, dt);
      this.lArm.rotation.x = approach(this.lArm.rotation.x, -1.0 * (1 - p), 16, dt);
      this.lArm.rotation.y = approach(this.lArm.rotation.y, 0, 16, dt);
      this.rLeg.rotation.x = approach(this.rLeg.rotation.x, -0.5 * (1 - p), 16, dt);
      this.lLeg.rotation.x = approach(this.lLeg.rotation.x, -0.5 * (1 - p), 16, dt);

      // Ghost effect
      this.bodyMat.transparent = true;
      this.bodyMat.opacity = 0.5 + p * 0.5;
    } else {
      if (this.bodyMat.transparent && this.hitFlashTime <= 0) {
        this.bodyMat.opacity = approach(this.bodyMat.opacity, 1, 12, dt);
        if (this.bodyMat.opacity > 0.99) {
          this.bodyMat.opacity = 1;
          this.bodyMat.transparent = false;
        }
      }
    }

    // ===== AIRBORNE =====
    if (inAir && state.action !== "attacking" && state.action !== "dodging" && state.action !== "blocking") {
      this.rLeg.rotation.x = approach(this.rLeg.rotation.x, -0.15, 6, dt);
      this.lLeg.rotation.x = approach(this.lLeg.rotation.x, 0.1, 6, dt);
      this.rArm.rotation.x = approach(this.rArm.rotation.x, 0.45 + recoil, 6, dt);
      this.lArm.rotation.x = approach(this.lArm.rotation.x, -0.5, 6, dt);
      this.lArm.rotation.y = approach(this.lArm.rotation.y, 0, 6, dt);
    }

    // Reset sword rotations when not attacking
    if (state.action !== "attacking") {
      this.swordGroup.rotation.x = approach(this.swordGroup.rotation.x, 0, 10, dt);
      this.swordGroup.rotation.z = approach(this.swordGroup.rotation.z, 0, 10, dt);
    }
  }

  // ===================== EFFECTS =====================
  flashHit(): void {
    this.hitFlashTime = 0.2;
    this.hitRecoilTime = 0.2;
    this.scalePulseTime = 0.12;
  }

  flashBlockImpact(): void {
    this.blockImpactTime = 0.2;
    this.scalePulseTime = 0.06;
  }

  applyKnockback(kbX: number, kbZ: number, force: number): void {
    this.kbOffsetX += kbX * force * 0.5;
    this.kbOffsetZ += kbZ * force * 0.5;
  }

  getPosition(): THREE.Vector3 { return this.group.position; }
  getGroup(): THREE.Group { return this.group; }
  getSwordTip(): THREE.Vector3 { return this.swordTip; }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          for (const m of child.material) m.dispose();
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
