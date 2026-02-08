// client/src/PlayerEntity.ts
import * as THREE from "three";
import type { PlayerState } from "./types";

// --- Constants ---
const LERP_SPEED = 15;
const BODY_HEIGHT = 1.0;
const LAND_BOUNCE_TIME = 0.14;

// Easing helpers
function easeOutQuad(t: number): number { return 1 - (1 - t) * (1 - t); }
function easeInOutCubic(t: number): number { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOutBack(t: number): number { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

// Smooth approach that feels snappy
function approach(current: number, target: number, speed: number, dt: number): number {
  return current + (target - current) * Math.min(1, speed * dt);
}

export class PlayerEntity {
  // --- Scene hierarchy ---
  private group: THREE.Group;           // root: positioned in world
  private hipPivot: THREE.Group;        // hip rotation point
  private torso: THREE.Group;           // upper body
  private headGroup: THREE.Group;

  // Arms (shoulder pivot > upper arm > elbow pivot > forearm > hand)
  private rShoulder: THREE.Group;
  private rUpperArm: THREE.Group;
  private rElbow: THREE.Group;
  private rForearm: THREE.Group;
  private rHand: THREE.Group;
  private swordGroup: THREE.Group;

  private lShoulder: THREE.Group;
  private lUpperArm: THREE.Group;
  private lElbow: THREE.Group;
  private lForearm: THREE.Group;
  private lHand: THREE.Group;
  private shieldGroup: THREE.Group;

  // Legs (hip pivot > upper leg > knee pivot > lower leg > foot)
  private lHip: THREE.Group;
  private lUpperLeg: THREE.Group;
  private lKnee: THREE.Group;
  private lLowerLeg: THREE.Group;

  private rHip: THREE.Group;
  private rUpperLeg: THREE.Group;
  private rKnee: THREE.Group;
  private rLowerLeg: THREE.Group;

  private nameSprite: THREE.Sprite;

  // --- State ---
  private isLocal: boolean;
  private targetPos = new THREE.Vector3();
  private targetRot = 0;
  private bodyMaterial: THREE.MeshStandardMaterial;
  private originalColor: THREE.Color;
  private allMaterials: THREE.MeshStandardMaterial[] = [];

  // Animation state
  private idleTime = 0;
  private walkCycle = 0;
  private moveSpeed = 0;
  private localMoveSpeed = 0; // for local player, derived from input
  private prevX = 0;
  private prevZ = 0;

  // Attack animation (local elapsed timer, avoids clock skew)
  private attackElapsed = 0;
  private attackActive = false;
  private attackStep = 0;

  // Hit reaction
  private hitFlashTime = 0;
  private hitRecoilTime = 0;
  private blockImpactTime = 0;
  private emissiveFlashTime = 0;
  private scalePulseTime = 0;

  // Dodge
  private dodgeTime = 0;
  private dodgeActive = false;

  // Landing
  private landTimer = 0;
  private prevY = 0;

  // Knockback visual offset (client-side, decays quickly)
  private kbOffsetX = 0;
  private kbOffsetZ = 0;

  // Sword tip position for trail effects
  private swordTip = new THREE.Vector3();

  constructor(state: PlayerState, isLocal: boolean, scene: THREE.Scene) {
    this.isLocal = isLocal;
    this.prevX = state.x;
    this.prevZ = state.z;
    this.prevY = state.y;

    const color = new THREE.Color(state.color);
    this.originalColor = color.clone();

    // Shared materials
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x50585f, roughness: 0.3, metalness: 0.75 });
    const armorDark = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.35, metalness: 0.7 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.85, metalness: 0.05 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.75 });
    const clothMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });
    this.bodyMaterial = clothMat;
    const metalGold = new THREE.MeshStandardMaterial({ color: 0xc9a84c, roughness: 0.3, metalness: 0.85 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdce4ee, roughness: 0.1, metalness: 1.0 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.5, metalness: 0.4 });

    this.allMaterials = [armorMat, armorDark, leatherMat, skinMat, clothMat, metalGold, bladeMat, darkMat];

    // === BUILD HIERARCHY ===
    this.group = new THREE.Group();
    this.hipPivot = new THREE.Group();
    this.hipPivot.position.y = 0.95; // hip height
    this.group.add(this.hipPivot);

    this.torso = new THREE.Group();
    this.hipPivot.add(this.torso);

    // --- TORSO ---
    // Core body
    const torsoGeo = new THREE.CapsuleGeometry(0.28, 0.6, 6, 10);
    const torsoMesh = new THREE.Mesh(torsoGeo, clothMat);
    torsoMesh.position.y = 0.35;
    torsoMesh.castShadow = true;
    this.torso.add(torsoMesh);

    // Chest armor plate
    const chestGeo = new THREE.BoxGeometry(0.58, 0.55, 0.34);
    const chest = new THREE.Mesh(chestGeo, armorMat);
    chest.position.set(0, 0.4, -0.02);
    chest.castShadow = true;
    this.torso.add(chest);

    // Waist / belt
    const waistGeo = new THREE.CylinderGeometry(0.3, 0.28, 0.12, 12);
    const waist = new THREE.Mesh(waistGeo, leatherMat);
    waist.position.y = 0.05;
    this.torso.add(waist);

    // Belt buckle
    const buckleGeo = new THREE.BoxGeometry(0.1, 0.08, 0.06);
    const buckle = new THREE.Mesh(buckleGeo, metalGold);
    buckle.position.set(0, 0.05, -0.28);
    this.torso.add(buckle);

    // Tabard (cloth hanging over chest in player color)
    const tabardGeo = new THREE.BoxGeometry(0.38, 0.7, 0.04);
    const tabard = new THREE.Mesh(tabardGeo, clothMat);
    tabard.position.set(0, 0.25, -0.17);
    this.torso.add(tabard);

    // --- HEAD ---
    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 0.75;
    this.torso.add(this.headGroup);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.1, 8);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = -0.05;
    this.headGroup.add(neck);

    // Head
    const headGeo = new THREE.SphereGeometry(0.22, 10, 8);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 0.15;
    head.castShadow = true;
    this.headGroup.add(head);

    // Helmet - open face style
    const helmGeo = new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const helm = new THREE.Mesh(helmGeo, armorMat);
    helm.position.y = 0.17;
    helm.castShadow = true;
    this.headGroup.add(helm);

    // Helmet brim / nose guard
    const brimGeo = new THREE.BoxGeometry(0.04, 0.12, 0.12);
    const brim = new THREE.Mesh(brimGeo, armorDark);
    brim.position.set(0, 0.1, -0.22);
    this.headGroup.add(brim);

    // Eye slit
    const slitGeo = new THREE.BoxGeometry(0.3, 0.04, 0.04);
    const slit = new THREE.Mesh(slitGeo, darkMat);
    slit.position.set(0, 0.14, -0.22);
    this.headGroup.add(slit);

    // === RIGHT ARM (SWORD) ===
    this.rShoulder = new THREE.Group();
    this.rShoulder.position.set(-0.38, 0.6, 0);
    this.torso.add(this.rShoulder);

    // Pauldron (shoulder guard)
    const pauldronGeo = new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const rPauldron = new THREE.Mesh(pauldronGeo, armorMat);
    rPauldron.rotation.z = 0.3;
    rPauldron.castShadow = true;
    this.rShoulder.add(rPauldron);

    this.rUpperArm = new THREE.Group();
    this.rShoulder.add(this.rUpperArm);

    const rUpperGeo = new THREE.CapsuleGeometry(0.09, 0.28, 5, 6);
    const rUpperMesh = new THREE.Mesh(rUpperGeo, clothMat);
    rUpperMesh.position.y = -0.18;
    rUpperMesh.castShadow = true;
    this.rUpperArm.add(rUpperMesh);

    this.rElbow = new THREE.Group();
    this.rElbow.position.y = -0.32;
    this.rUpperArm.add(this.rElbow);

    // Elbow joint visual
    const elbowJointGeo = new THREE.SphereGeometry(0.07, 6, 6);
    const rElbowJoint = new THREE.Mesh(elbowJointGeo, armorDark);
    this.rElbow.add(rElbowJoint);

    this.rForearm = new THREE.Group();
    this.rElbow.add(this.rForearm);

    const rForeGeo = new THREE.CapsuleGeometry(0.08, 0.24, 5, 6);
    const rForeMesh = new THREE.Mesh(rForeGeo, leatherMat);
    rForeMesh.position.y = -0.16;
    rForeMesh.castShadow = true;
    this.rForearm.add(rForeMesh);

    // Gauntlet
    const gauntletGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.1, 8);
    const rGauntlet = new THREE.Mesh(gauntletGeo, armorDark);
    rGauntlet.position.y = -0.22;
    this.rForearm.add(rGauntlet);

    this.rHand = new THREE.Group();
    this.rHand.position.y = -0.28;
    this.rForearm.add(this.rHand);

    // --- SWORD ---
    this.swordGroup = new THREE.Group();
    this.rHand.add(this.swordGroup);

    // Grip
    const gripGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.22, 8);
    const grip = new THREE.Mesh(gripGeo, leatherMat);
    grip.position.y = 0.0;
    this.swordGroup.add(grip);

    // Pommel
    const pommelGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const pommel = new THREE.Mesh(pommelGeo, metalGold);
    pommel.position.y = 0.12;
    this.swordGroup.add(pommel);

    // Crossguard
    const crossGeo = new THREE.BoxGeometry(0.22, 0.035, 0.05);
    const cross = new THREE.Mesh(crossGeo, metalGold);
    cross.position.y = -0.1;
    this.swordGroup.add(cross);

    // Blade (tapered using vertices manipulation for cheap look)
    const bladeGeo = new THREE.BoxGeometry(0.05, 0.9, 0.02);
    // Taper the blade tip
    const bladePos = bladeGeo.attributes.position;
    for (let i = 0; i < bladePos.count; i++) {
      const y = bladePos.getY(i);
      if (y < -0.35) {
        const taper = 1 - ((-y - 0.35) / 0.1);
        const clampedTaper = Math.max(0.05, taper);
        bladePos.setX(i, bladePos.getX(i) * clampedTaper);
      }
    }
    bladeGeo.computeVertexNormals();
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = -0.55;
    blade.castShadow = true;
    this.swordGroup.add(blade);

    // Blood groove (fuller) - thin dark line on blade
    const fullerGeo = new THREE.BoxGeometry(0.015, 0.6, 0.025);
    const fuller = new THREE.Mesh(fullerGeo, armorDark);
    fuller.position.y = -0.42;
    this.swordGroup.add(fuller);

    // Default sword rest position
    this.swordGroup.position.set(0, -0.05, -0.04);
    this.swordGroup.rotation.x = -0.15;

    // === LEFT ARM (SHIELD) ===
    this.lShoulder = new THREE.Group();
    this.lShoulder.position.set(0.38, 0.6, 0);
    this.torso.add(this.lShoulder);

    const lPauldron = new THREE.Mesh(pauldronGeo.clone(), armorMat);
    lPauldron.rotation.z = -0.3;
    lPauldron.castShadow = true;
    this.lShoulder.add(lPauldron);

    this.lUpperArm = new THREE.Group();
    this.lShoulder.add(this.lUpperArm);

    const lUpperMesh = new THREE.Mesh(rUpperGeo.clone(), clothMat);
    lUpperMesh.position.y = -0.18;
    lUpperMesh.castShadow = true;
    this.lUpperArm.add(lUpperMesh);

    this.lElbow = new THREE.Group();
    this.lElbow.position.y = -0.32;
    this.lUpperArm.add(this.lElbow);

    const lElbowJoint = new THREE.Mesh(elbowJointGeo.clone(), armorDark);
    this.lElbow.add(lElbowJoint);

    this.lForearm = new THREE.Group();
    this.lElbow.add(this.lForearm);

    const lForeMesh = new THREE.Mesh(rForeGeo.clone(), leatherMat);
    lForeMesh.position.y = -0.16;
    lForeMesh.castShadow = true;
    this.lForearm.add(lForeMesh);

    const lGauntlet = new THREE.Mesh(gauntletGeo.clone(), armorDark);
    lGauntlet.position.y = -0.22;
    this.lForearm.add(lGauntlet);

    this.lHand = new THREE.Group();
    this.lHand.position.y = -0.28;
    this.lForearm.add(this.lHand);

    // --- SHIELD (round shield with boss) ---
    this.shieldGroup = new THREE.Group();
    this.lHand.add(this.shieldGroup);

    const shieldFaceGeo = new THREE.CylinderGeometry(0.35, 0.38, 0.05, 16);
    const shieldFaceMat = new THREE.MeshStandardMaterial({ color: 0x5a3822, roughness: 0.55, metalness: 0.15 });
    const shieldFace = new THREE.Mesh(shieldFaceGeo, shieldFaceMat);
    shieldFace.castShadow = true;
    this.shieldGroup.add(shieldFace);

    // Shield rim
    const sRimGeo = new THREE.TorusGeometry(0.36, 0.03, 6, 16);
    const sRim = new THREE.Mesh(sRimGeo, metalGold);
    sRim.rotation.x = Math.PI / 2;
    sRim.position.y = 0.025;
    this.shieldGroup.add(sRim);

    // Shield boss (center metal dome)
    const bossGeo = new THREE.SphereGeometry(0.07, 8, 6);
    const boss = new THREE.Mesh(bossGeo, armorMat);
    boss.position.set(0, 0.04, 0);
    this.shieldGroup.add(boss);

    // Color accent ring on shield
    const accentGeo = new THREE.TorusGeometry(0.2, 0.02, 6, 16);
    const accent = new THREE.Mesh(accentGeo, clothMat);
    accent.rotation.x = Math.PI / 2;
    accent.position.y = 0.03;
    this.shieldGroup.add(accent);

    this.shieldGroup.rotation.x = Math.PI / 2;
    this.shieldGroup.position.set(0, -0.1, -0.1);

    // === LEGS ===
    // Left leg
    this.lHip = new THREE.Group();
    this.lHip.position.set(0.14, -0.02, 0);
    this.hipPivot.add(this.lHip);

    this.lUpperLeg = new THREE.Group();
    this.lHip.add(this.lUpperLeg);

    const upperLegGeo = new THREE.CapsuleGeometry(0.1, 0.3, 5, 6);
    const lULMesh = new THREE.Mesh(upperLegGeo, leatherMat);
    lULMesh.position.y = -0.2;
    lULMesh.castShadow = true;
    this.lUpperLeg.add(lULMesh);

    this.lKnee = new THREE.Group();
    this.lKnee.position.y = -0.38;
    this.lUpperLeg.add(this.lKnee);

    // Knee guard
    const kneeGeo = new THREE.SphereGeometry(0.065, 6, 6);
    const lKneeGuard = new THREE.Mesh(kneeGeo, armorDark);
    this.lKnee.add(lKneeGuard);

    this.lLowerLeg = new THREE.Group();
    this.lKnee.add(this.lLowerLeg);

    const lowerLegGeo = new THREE.CapsuleGeometry(0.085, 0.28, 5, 6);
    const lLLMesh = new THREE.Mesh(lowerLegGeo, leatherMat);
    lLLMesh.position.y = -0.2;
    lLLMesh.castShadow = true;
    this.lLowerLeg.add(lLLMesh);

    // Boot
    const bootGeo = new THREE.BoxGeometry(0.12, 0.1, 0.18);
    const lBoot = new THREE.Mesh(bootGeo, armorDark);
    lBoot.position.set(0, -0.38, -0.02);
    lBoot.castShadow = true;
    this.lLowerLeg.add(lBoot);

    // Right leg (mirror)
    this.rHip = new THREE.Group();
    this.rHip.position.set(-0.14, -0.02, 0);
    this.hipPivot.add(this.rHip);

    this.rUpperLeg = new THREE.Group();
    this.rHip.add(this.rUpperLeg);

    const rULMesh = new THREE.Mesh(upperLegGeo.clone(), leatherMat);
    rULMesh.position.y = -0.2;
    rULMesh.castShadow = true;
    this.rUpperLeg.add(rULMesh);

    this.rKnee = new THREE.Group();
    this.rKnee.position.y = -0.38;
    this.rUpperLeg.add(this.rKnee);

    const rKneeGuard = new THREE.Mesh(kneeGeo.clone(), armorDark);
    this.rKnee.add(rKneeGuard);

    this.rLowerLeg = new THREE.Group();
    this.rKnee.add(this.rLowerLeg);

    const rLLMesh = new THREE.Mesh(lowerLegGeo.clone(), leatherMat);
    rLLMesh.position.y = -0.2;
    rLLMesh.castShadow = true;
    this.rLowerLeg.add(rLLMesh);

    const rBoot = new THREE.Mesh(bootGeo.clone(), armorDark);
    rBoot.position.set(0, -0.38, -0.02);
    rBoot.castShadow = true;
    this.rLowerLeg.add(rBoot);

    // --- NAME TAG ---
    this.nameSprite = this.createNameSprite(state.name, isLocal);
    this.nameSprite.position.y = 2.4;
    this.group.add(this.nameSprite);

    // --- INIT ---
    this.targetPos.set(state.x, state.y, state.z);
    this.targetRot = state.rotation;
    this.group.position.set(state.x, state.y, state.z);
    this.group.rotation.y = state.rotation;

    scene.add(this.group);
  }

  // ===================== NAME TAG =====================
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
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 0.5, 1);
    return sprite;
  }

  updateNameTag(name: string): void {
    const old = this.nameSprite;
    this.group.remove(old);
    old.material.map?.dispose();
    old.material.dispose();
    this.nameSprite = this.createNameSprite(name, this.isLocal);
    this.nameSprite.position.y = 2.4;
    this.group.add(this.nameSprite);
  }

  // ===================== UPDATE =====================
  updateFromServer(state: PlayerState, dt: number): void {
    this.targetPos.set(state.x, state.y, state.z);
    this.targetRot = state.rotation;

    // Move speed for animation
    const dx = state.x - this.prevX;
    const dz = state.z - this.prevZ;
    const moveDist = Math.sqrt(dx * dx + dz * dz);
    const targetSpeed = moveDist / Math.max(dt, 0.001);
    this.moveSpeed = approach(this.moveSpeed, targetSpeed, 10, dt);
    this.prevX = state.x;
    this.prevZ = state.z;

    // Position interpolation
    if (!this.isLocal) {
      this.group.position.lerp(this.targetPos, Math.min(1, LERP_SPEED * dt));
    } else {
      // Local player: use predicted position + knockback offset
      this.group.position.set(
        this.targetPos.x + this.kbOffsetX,
        this.targetPos.y,
        this.targetPos.z + this.kbOffsetZ
      );
    }

    // Decay knockback offset
    this.kbOffsetX = approach(this.kbOffsetX, 0, 8, dt);
    this.kbOffsetZ = approach(this.kbOffsetZ, 0, 8, dt);

    // Landing
    if (this.prevY > 0.05 && this.group.position.y <= 0.02) {
      this.landTimer = LAND_BOUNCE_TIME;
    }
    this.prevY = this.group.position.y;

    // Rotation
    let rotDiff = this.targetRot - this.group.rotation.y;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    this.group.rotation.y += rotDiff * Math.min(1, LERP_SPEED * dt);

    // Track attack state with local elapsed timer
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

    // Dodge state
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

    // Scale pulse on hit
    if (this.scalePulseTime > 0) {
      this.scalePulseTime -= dt;
      const s = 1 + Math.sin((this.scalePulseTime / 0.15) * Math.PI) * 0.06;
      this.torso.scale.setScalar(s);
    } else {
      this.torso.scale.setScalar(1);
    }

    // Hit flash (emissive)
    if (this.hitFlashTime > 0) {
      this.hitFlashTime -= dt;
      const intensity = Math.sin(this.hitFlashTime * 35) > 0 ? 0.8 : 0;
      this.bodyMaterial.emissive.setRGB(intensity, intensity * 0.3, intensity * 0.1);
      if (this.hitFlashTime <= 0) {
        this.bodyMaterial.emissive.setRGB(0, 0, 0);
        this.bodyMaterial.color.copy(this.originalColor);
      }
    }

    // Update sword tip world position for trail
    this.swordGroup.updateWorldMatrix(true, false);
    this.swordTip.set(0, -1.0, 0);
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
    if (this.landTimer > 0) this.landTimer -= dt;
    if (this.landTimer > 0) {
      const p = 1 - this.landTimer / LAND_BOUNCE_TIME;
      const sq = Math.sin(p * Math.PI);
      this.hipPivot.scale.y = 1 - sq * 0.1;
      this.hipPivot.scale.x = 1 + sq * 0.05;
      this.hipPivot.scale.z = 1 + sq * 0.05;
    } else {
      this.hipPivot.scale.x = approach(this.hipPivot.scale.x, 1, 12, dt);
      this.hipPivot.scale.y = approach(this.hipPivot.scale.y, 1, 12, dt);
      this.hipPivot.scale.z = approach(this.hipPivot.scale.z, 1, 12, dt);
    }

    // Hit recoil
    let recoilLean = 0;
    if (this.hitRecoilTime > 0) {
      this.hitRecoilTime -= dt;
      recoilLean = Math.sin((this.hitRecoilTime / 0.25) * Math.PI) * 0.15;
    }

    // ===== IDLE / COMBAT READY STANCE =====
    if (state.action === "idle" && !isMoving && !inAir) {
      const breathe = Math.sin(this.idleTime * 2.5);
      const weightShift = Math.sin(this.idleTime * 1.2) * 0.015;

      // Torso: subtle breathing + slight lean
      this.torso.rotation.x = approach(this.torso.rotation.x, -0.04 + breathe * 0.012 + recoilLean, 6, dt);
      this.torso.rotation.y = approach(this.torso.rotation.y, weightShift, 4, dt);
      this.torso.position.y = breathe * 0.01;

      // Head: slight look-around
      this.headGroup.rotation.x = approach(this.headGroup.rotation.x, -0.05, 4, dt);
      this.headGroup.rotation.y = approach(this.headGroup.rotation.y, Math.sin(this.idleTime * 0.7) * 0.06, 3, dt);

      // Sword arm: guard position (sword held at side, slightly forward)
      this.rShoulder.rotation.x = approach(this.rShoulder.rotation.x, -0.45, 6, dt);
      this.rShoulder.rotation.y = approach(this.rShoulder.rotation.y, -0.15, 6, dt);
      this.rShoulder.rotation.z = approach(this.rShoulder.rotation.z, 0.15, 6, dt);
      this.rElbow.rotation.x = approach(this.rElbow.rotation.x, -0.7, 6, dt);
      this.rHand.rotation.x = approach(this.rHand.rotation.x, 0.1, 6, dt);

      // Shield arm: guard position (shield across body)
      this.lShoulder.rotation.x = approach(this.lShoulder.rotation.x, -0.5, 6, dt);
      this.lShoulder.rotation.y = approach(this.lShoulder.rotation.y, 0.3, 6, dt);
      this.lShoulder.rotation.z = approach(this.lShoulder.rotation.z, -0.2, 6, dt);
      this.lElbow.rotation.x = approach(this.lElbow.rotation.x, -0.9, 6, dt);

      // Legs: combat stance (slightly apart)
      this.lHip.rotation.x = approach(this.lHip.rotation.x, -0.08, 5, dt);
      this.lKnee.rotation.x = approach(this.lKnee.rotation.x, 0.12, 5, dt);
      this.rHip.rotation.x = approach(this.rHip.rotation.x, 0.08, 5, dt);
      this.rKnee.rotation.x = approach(this.rKnee.rotation.x, 0.08, 5, dt);

      // Weight shift on hips
      this.hipPivot.rotation.z = approach(this.hipPivot.rotation.z, weightShift * 2, 3, dt);
    }

    // ===== WALKING / RUNNING =====
    if (isMoving && !inAir && state.action !== "attacking" && state.action !== "dodging") {
      this.walkCycle += dt * (7 + walkFactor * 5);
      const sin = Math.sin(this.walkCycle);
      const cos = Math.cos(this.walkCycle);

      // Hip sway
      this.hipPivot.rotation.z = approach(this.hipPivot.rotation.z, sin * 0.04 * walkFactor, 8, dt);
      this.hipPivot.rotation.y = approach(this.hipPivot.rotation.y, sin * 0.06 * walkFactor, 6, dt);

      // Torso counter-rotation + forward lean
      const forwardLean = -0.08 * walkFactor;
      this.torso.rotation.x = approach(this.torso.rotation.x, forwardLean + recoilLean, 8, dt);
      this.torso.rotation.y = approach(this.torso.rotation.y, -sin * 0.07 * walkFactor, 8, dt);
      this.torso.position.y = Math.abs(sin) * 0.025 * walkFactor;

      // Head stabilization (counters hip sway)
      this.headGroup.rotation.y = approach(this.headGroup.rotation.y, sin * 0.04 * walkFactor, 6, dt);

      // Left leg: forward swing on sin, back on -sin
      const lLegSwing = sin * 0.55 * walkFactor;
      this.lHip.rotation.x = approach(this.lHip.rotation.x, lLegSwing, 12, dt);
      this.lKnee.rotation.x = approach(this.lKnee.rotation.x, Math.max(0, -cos * 0.6 * walkFactor + 0.15), 12, dt);

      // Right leg: opposite phase
      const rLegSwing = -sin * 0.55 * walkFactor;
      this.rHip.rotation.x = approach(this.rHip.rotation.x, rLegSwing, 12, dt);
      this.rKnee.rotation.x = approach(this.rKnee.rotation.x, Math.max(0, cos * 0.6 * walkFactor + 0.15), 12, dt);

      // Arms counter-swing (opposite to legs)
      this.rShoulder.rotation.x = approach(this.rShoulder.rotation.x, -0.35 + rLegSwing * 0.4, 10, dt);
      this.rShoulder.rotation.y = approach(this.rShoulder.rotation.y, -0.1, 8, dt);
      this.rElbow.rotation.x = approach(this.rElbow.rotation.x, -0.5 - Math.abs(sin) * 0.2 * walkFactor, 10, dt);

      this.lShoulder.rotation.x = approach(this.lShoulder.rotation.x, -0.4 + lLegSwing * 0.3, 10, dt);
      this.lShoulder.rotation.y = approach(this.lShoulder.rotation.y, 0.2, 8, dt);
      this.lElbow.rotation.x = approach(this.lElbow.rotation.x, -0.7 - Math.abs(cos) * 0.15 * walkFactor, 10, dt);
    }

    // ===== ATTACK ANIMATION =====
    if (state.action === "attacking") {
      const step = Math.max(1, Math.min(3, this.attackStep));
      const durations = [0.48, 0.5, 0.62];
      const duration = durations[step - 1];
      const p = Math.min(this.attackElapsed / duration, 1);

      // Phase breakdowns
      const windP = Math.min(p / 0.2, 1);       // 0-20% windup
      const strikeP = Math.min(Math.max((p - 0.2) / 0.25, 0), 1); // 20-45% strike
      const followP = Math.min(Math.max((p - 0.45) / 0.25, 0), 1); // 45-70% follow-through
      const recoverP = Math.min(Math.max((p - 0.7) / 0.3, 0), 1);  // 70-100% recovery

      const windEased = easeInOutCubic(windP);
      const strikeEased = easeOutBack(strikeP);
      const followEased = easeOutQuad(followP);
      const recoverEased = easeInOutCubic(recoverP);

      if (step === 1) {
        // --- Right horizontal slash ---
        // Windup: pull sword arm back-right, twist torso left
        // Strike: snap across to left, torso follows
        // Follow: carry momentum, arm decelerates
        const armX = -0.4 * windEased + (-0.3) * strikeEased + 0.2 * followEased + 0.1 * recoverEased;
        const armY = -1.3 * windEased + 2.0 * strikeEased - 0.5 * followEased - 0.2 * recoverEased;
        const armZ = 0.3 * windEased - 0.4 * strikeEased + 0.1 * recoverEased;
        const elbowX = -0.4 * windEased - 0.2 * strikeEased - 0.3 * recoverEased;
        const torsoY = -0.25 * windEased + 0.45 * strikeEased - 0.1 * followEased;
        const torsoX = 0.06 * windEased - 0.08 * strikeEased + recoilLean;
        const swordZ = -0.3 * windEased + 1.4 * strikeEased - 0.3 * followEased;

        this.rShoulder.rotation.x = approach(this.rShoulder.rotation.x, armX, 20, dt);
        this.rShoulder.rotation.y = approach(this.rShoulder.rotation.y, armY, 20, dt);
        this.rShoulder.rotation.z = approach(this.rShoulder.rotation.z, armZ, 20, dt);
        this.rElbow.rotation.x = approach(this.rElbow.rotation.x, elbowX, 20, dt);
        this.swordGroup.rotation.z = approach(this.swordGroup.rotation.z, swordZ, 18, dt);
        this.torso.rotation.y = approach(this.torso.rotation.y, torsoY, 15, dt);
        this.torso.rotation.x = approach(this.torso.rotation.x, torsoX, 12, dt);

        // Forward step
        this.lHip.rotation.x = approach(this.lHip.rotation.x, -0.2 * strikeEased, 10, dt);
        this.rHip.rotation.x = approach(this.rHip.rotation.x, 0.15 * strikeEased, 10, dt);

      } else if (step === 2) {
        // --- Left backhand slash ---
        const armX = -0.3 * windEased + (-0.4) * strikeEased + 0.15 * recoverEased;
        const armY = 1.2 * windEased - 2.2 * strikeEased + 0.5 * followEased + 0.2 * recoverEased;
        const armZ = -0.25 * windEased + 0.35 * strikeEased - 0.1 * recoverEased;
        const elbowX = -0.3 * windEased - 0.25 * strikeEased - 0.4 * recoverEased;
        const torsoY = 0.3 * windEased - 0.5 * strikeEased + 0.15 * followEased;
        const torsoX = 0.05 * windEased - 0.06 * strikeEased + recoilLean;
        const swordZ = 0.4 * windEased - 1.5 * strikeEased + 0.3 * followEased;

        this.rShoulder.rotation.x = approach(this.rShoulder.rotation.x, armX, 20, dt);
        this.rShoulder.rotation.y = approach(this.rShoulder.rotation.y, armY, 20, dt);
        this.rShoulder.rotation.z = approach(this.rShoulder.rotation.z, armZ, 20, dt);
        this.rElbow.rotation.x = approach(this.rElbow.rotation.x, elbowX, 20, dt);
        this.swordGroup.rotation.z = approach(this.swordGroup.rotation.z, swordZ, 18, dt);
        this.torso.rotation.y = approach(this.torso.rotation.y, torsoY, 15, dt);
        this.torso.rotation.x = approach(this.torso.rotation.x, torsoX, 12, dt);

        // Weight transfer
        this.rHip.rotation.x = approach(this.rHip.rotation.x, -0.2 * strikeEased, 10, dt);
        this.lHip.rotation.x = approach(this.lHip.rotation.x, 0.12 * strikeEased, 10, dt);

      } else {
        // --- Overhead power slam ---
        const armX = -2.2 * windEased + 1.8 * strikeEased + 0.5 * followEased + 0.1 * recoverEased;
        const armY = 0.15 * windEased - 0.1 * strikeEased;
        const armZ = 0.2 * windEased - 0.15 * strikeEased;
        const elbowX = -0.8 * windEased + 0.2 * strikeEased - 0.4 * recoverEased;
        const torsoX = -0.2 * windEased + 0.15 * strikeEased + 0.05 * followEased + recoilLean;
        const swordX = -0.4 * windEased + 0.2 * strikeEased;

        this.rShoulder.rotation.x = approach(this.rShoulder.rotation.x, armX, 22, dt);
        this.rShoulder.rotation.y = approach(this.rShoulder.rotation.y, armY, 18, dt);
        this.rShoulder.rotation.z = approach(this.rShoulder.rotation.z, armZ, 18, dt);
        this.rElbow.rotation.x = approach(this.rElbow.rotation.x, elbowX, 22, dt);
        this.swordGroup.rotation.x = approach(this.swordGroup.rotation.x, swordX - 0.15, 18, dt);
        this.torso.rotation.x = approach(this.torso.rotation.x, torsoX, 15, dt);
        this.torso.rotation.y = approach(this.torso.rotation.y, 0, 10, dt);

        // Crouch into slam
        this.hipPivot.position.y = 0.95 - 0.1 * windEased + 0.08 * strikeEased;
        this.lKnee.rotation.x = approach(this.lKnee.rotation.x, 0.3 * windEased - 0.15 * strikeEased, 12, dt);
        this.rKnee.rotation.x = approach(this.rKnee.rotation.x, 0.3 * windEased - 0.15 * strikeEased, 12, dt);
      }

      // Shield tucks during attack
      this.lShoulder.rotation.x = approach(this.lShoulder.rotation.x, -0.6, 8, dt);
      this.lShoulder.rotation.y = approach(this.lShoulder.rotation.y, 0.4, 8, dt);
      this.lElbow.rotation.x = approach(this.lElbow.rotation.x, -1.0, 8, dt);
    }

    // ===== BLOCK STANCE =====
    if (state.action === "blocking") {
      // Shield wall: shield arm forward and up, crouch slightly, sword back
      this.lShoulder.rotation.x = approach(this.lShoulder.rotation.x, -1.3, 12, dt);
      this.lShoulder.rotation.y = approach(this.lShoulder.rotation.y, 0.1, 10, dt);
      this.lShoulder.rotation.z = approach(this.lShoulder.rotation.z, -0.1, 10, dt);
      this.lElbow.rotation.x = approach(this.lElbow.rotation.x, -0.8, 12, dt);
      this.lForearm.rotation.z = approach(this.lForearm.rotation.z, 0.2, 10, dt);

      // Sword arm pulls back
      this.rShoulder.rotation.x = approach(this.rShoulder.rotation.x, -0.3, 10, dt);
      this.rShoulder.rotation.y = approach(this.rShoulder.rotation.y, -0.5, 10, dt);
      this.rElbow.rotation.x = approach(this.rElbow.rotation.x, -1.0, 10, dt);

      // Slight crouch
      this.torso.rotation.x = approach(this.torso.rotation.x, -0.08 + recoilLean, 8, dt);
      this.torso.rotation.y = approach(this.torso.rotation.y, 0.1, 6, dt);
      this.hipPivot.position.y = approach(this.hipPivot.position.y, 0.88, 8, dt);
      this.lKnee.rotation.x = approach(this.lKnee.rotation.x, 0.2, 8, dt);
      this.rKnee.rotation.x = approach(this.rKnee.rotation.x, 0.18, 8, dt);

      // Left foot forward
      this.lHip.rotation.x = approach(this.lHip.rotation.x, -0.15, 8, dt);
      this.rHip.rotation.x = approach(this.rHip.rotation.x, 0.1, 8, dt);

      // Block impact shake
      if (this.blockImpactTime > 0) {
        this.blockImpactTime -= dt;
        const shake = Math.sin(this.blockImpactTime * 55) * 0.04 * (this.blockImpactTime / 0.2);
        this.lShoulder.position.z = shake;
      } else {
        this.lShoulder.position.z = approach(this.lShoulder.position.z, 0, 10, dt);
      }
    } else {
      this.lForearm.rotation.z = approach(this.lForearm.rotation.z, 0, 8, dt);
    }

    // ===== DODGE =====
    if (state.action === "dodging") {
      const p = Math.min(this.dodgeTime / 0.28, 1);
      const rollAngle = easeOutQuad(p) * Math.PI * 1.5;

      this.torso.rotation.x = approach(this.torso.rotation.x, -0.8 * (1 - p), 18, dt);
      this.hipPivot.position.y = 0.95 - 0.3 * Math.sin(p * Math.PI);

      // Tuck limbs
      this.lHip.rotation.x = approach(this.lHip.rotation.x, -0.7 * (1 - p), 15, dt);
      this.rHip.rotation.x = approach(this.rHip.rotation.x, -0.7 * (1 - p), 15, dt);
      this.lKnee.rotation.x = approach(this.lKnee.rotation.x, 1.0 * (1 - p), 15, dt);
      this.rKnee.rotation.x = approach(this.rKnee.rotation.x, 1.0 * (1 - p), 15, dt);

      this.rShoulder.rotation.x = approach(this.rShoulder.rotation.x, -1.2 * (1 - p), 15, dt);
      this.lShoulder.rotation.x = approach(this.lShoulder.rotation.x, -1.2 * (1 - p), 15, dt);

      // Opacity for ghost effect
      this.bodyMaterial.transparent = true;
      this.bodyMaterial.opacity = 0.5 + p * 0.5;
    } else {
      if (this.bodyMaterial.transparent && this.hitFlashTime <= 0) {
        this.bodyMaterial.opacity = approach(this.bodyMaterial.opacity, 1, 10, dt);
        if (this.bodyMaterial.opacity > 0.99) {
          this.bodyMaterial.opacity = 1;
          this.bodyMaterial.transparent = false;
        }
      }
    }

    // ===== AIRBORNE =====
    if (inAir && state.action !== "attacking" && state.action !== "dodging") {
      this.torso.rotation.x = approach(this.torso.rotation.x, -0.2 + recoilLean, 6, dt);
      this.lHip.rotation.x = approach(this.lHip.rotation.x, -0.2, 6, dt);
      this.rHip.rotation.x = approach(this.rHip.rotation.x, 0.1, 6, dt);
      this.lKnee.rotation.x = approach(this.lKnee.rotation.x, 0.3, 6, dt);
      this.rKnee.rotation.x = approach(this.rKnee.rotation.x, 0.2, 6, dt);
    }

    // Reset hip height when not in special states
    if (state.action !== "blocking" && state.action !== "dodging" && state.action !== "attacking") {
      this.hipPivot.position.y = approach(this.hipPivot.position.y, 0.95, 10, dt);
    }

    // Reset sword rotation when not in overhead attack
    if (state.action !== "attacking" || this.attackStep !== 3) {
      this.swordGroup.rotation.x = approach(this.swordGroup.rotation.x, -0.15, 8, dt);
      this.swordGroup.rotation.z = approach(this.swordGroup.rotation.z, 0, 8, dt);
    }
  }

  // ===================== EFFECTS =====================
  flashHit(): void {
    this.hitFlashTime = 0.25;
    this.hitRecoilTime = 0.25;
    this.scalePulseTime = 0.15;
  }

  flashBlockImpact(): void {
    this.blockImpactTime = 0.2;
    this.scalePulseTime = 0.08;
  }

  applyKnockback(kbX: number, kbZ: number, force: number): void {
    this.kbOffsetX += kbX * force * 0.5;
    this.kbOffsetZ += kbZ * force * 0.5;
  }

  getPosition(): THREE.Vector3 {
    return this.group.position;
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  getSwordTip(): THREE.Vector3 {
    return this.swordTip;
  }

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
