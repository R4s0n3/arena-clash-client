// client/src/Game.ts
import * as THREE from "three";
import { Network } from "./Network";
import { InputManager } from "./InputManager";
import { PlayerEntity } from "./PlayerEntity";
import { Arena } from "./Arena";
import { UI } from "./UI";
import { SoundManager } from "./SoundManager";
import { VFX } from "./VFX";
import { CameraController } from "./CameraController";
import type {
  PlayerState,
  WelcomeMessage,
  StateMessage,
  PlayerJoinedMessage,
  PlayerLeftMessage,
  HitMessage,
  KillMessage,
  RespawnMessage,
  ChatMessage,
} from "./types";

const PLAYER_SPEED = 8;
const GRAVITY = 16;
const JUMP_VELOCITY = 8.5;

// Client-side prediction input record
interface InputRecord {
  seq: number;
  forward: number;
  right: number;
  rotation: number;
  dt: number;
}

// Floating damage number
interface DamageNumber {
  element: HTMLDivElement;
  worldPos: THREE.Vector3;
  life: number;
  velocity: number;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cameraCtrl!: CameraController;
  private network: Network;
  private input: InputManager;
  private ui: UI;
  private sound: SoundManager;
  private vfx!: VFX;
  private arena!: Arena;

  private myId = "";
  private players: Map<string, PlayerEntity> = new Map();
  private serverStates: Map<string, PlayerState> = new Map();
  private clock = new THREE.Clock();
  private arenaRadius = 30;

  // Client-side prediction
  private predictedX = 0;
  private predictedZ = 0;
  private predictedY = 0;
  private predictedRotation = 0;
  private pendingInputs: InputRecord[] = [];
  private inputSeq = 0;
  private lastServerAction: string = "idle";

  // Player names cache
  private playerNames: Map<string, string> = new Map();

  // Client-side jump prediction
  private predictedYVel = 0;

  // Hit-stop: when > 0, freeze entity animations
  private hitStopTimer = 0;

  // Damage numbers
  private damageNumbers: DamageNumber[] = [];
  private damageContainer: HTMLDivElement;

  constructor() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    document.body.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0f14);
    this.scene.fog = new THREE.Fog(0x0b0f14, 38, 68);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.cameraCtrl = new CameraController(this.camera);

    // Input
    this.input = new InputManager();

    // UI
    this.ui = new UI();

    // Sound
    this.sound = new SoundManager();

    // Damage number container
    this.damageContainer = document.createElement("div");
    this.damageContainer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:15;overflow:hidden;";
    document.body.appendChild(this.damageContainer);

    // Network
    const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
    const wsUrl =
      envUrl && envUrl.trim() !== ""
        ? envUrl
        : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
    this.network = new Network(wsUrl);
    this.setupNetworkHandlers();

    // Resize
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  start(): void {
    this.sound.init();
    this.animate();
  }

  private setupNetworkHandlers(): void {
    this.network.on("welcome", (msg: WelcomeMessage) => {
      this.myId = msg.id;
      this.arenaRadius = msg.arenaRadius;
      this.arena = new Arena(this.scene, msg.arenaRadius);
      this.vfx = new VFX(this.scene);

      for (const ps of msg.players) {
        this.addPlayerEntity(ps);
        this.playerNames.set(ps.id, ps.name);
        if (ps.id === this.myId) {
          this.predictedX = ps.x;
          this.predictedZ = ps.z;
          this.predictedY = ps.y;
          this.predictedRotation = ps.rotation;
        }
      }

      this.ui.showHud();
    });

    this.network.on("playerJoined", (msg: PlayerJoinedMessage) => {
      this.addPlayerEntity(msg.player);
      this.playerNames.set(msg.player.id, msg.player.name);
    });

    this.network.on("playerLeft", (msg: PlayerLeftMessage) => {
      this.removePlayerEntity(msg.id);
      this.playerNames.delete(msg.id);
    });

    this.network.on("state", (msg: StateMessage) => {
      for (const ps of msg.players) {
        this.serverStates.set(ps.id, ps);

        // Update name tag if changed
        const oldName = this.playerNames.get(ps.id);
        if (oldName && oldName !== ps.name) {
          const entity = this.players.get(ps.id);
          if (entity) entity.updateNameTag(ps.name);
        }
        this.playerNames.set(ps.id, ps.name);

        if (ps.id === this.myId) {
          this.reconcileWithServer(ps);
        }
      }
      this.ui.updateScoreboard(msg.players, this.myId);
      this.ui.updatePlayerCount(msg.players.length);

      const myState = msg.players.find((p) => p.id === this.myId);
      if (myState) {
        this.ui.updateStamina(myState.stamina, myState.maxStamina);
        this.lastServerAction = myState.action;
      }
    });

    this.network.on("hit", (msg: HitMessage) => {
      const target = this.players.get(msg.targetId);
      const attacker = this.players.get(msg.attackerId);

      if (target) {
        const targetPos = target.getPosition();

        if (msg.blocked) {
          target.flashBlockImpact();
          this.sound.playBlock();
          this.vfx?.spawnBlockSparks(targetPos);
          // Small camera shake on block
          if (msg.targetId === this.myId) {
            this.cameraCtrl.shake(0.08, 0.12);
          }
        } else {
          target.flashHit();
          this.sound.playHit();

          // Knockback
          target.applyKnockback(msg.kbX, msg.kbZ, msg.kbForce);

          // Hit-stop: brief freeze frame
          this.hitStopTimer = 0.06;

          // Camera shake on hit (stronger if we're the target)
          if (msg.targetId === this.myId) {
            this.cameraCtrl.shake(0.2 + msg.damage * 0.005, 0.2);
          } else if (msg.attackerId === this.myId) {
            this.cameraCtrl.shake(0.08, 0.1);
            this.cameraCtrl.punch(msg.kbX, msg.kbZ, 0.3);
          }

          // VFX sparks
          if (attacker) {
            const attackerPos = attacker.getPosition();
            const dir = new THREE.Vector3(
              targetPos.x - attackerPos.x, 0, targetPos.z - attackerPos.z
            ).normalize();
            this.vfx?.spawnHitSparks(targetPos, dir);
            this.vfx?.spawnBloodSplatter(targetPos, dir);
          }

          // Floating damage number
          this.spawnDamageNumber(targetPos, msg.damage, false);
        }
      }

      if (msg.targetId === this.myId) {
        this.ui.updateHealth(msg.targetHealth, 100);
        this.ui.flashDamage();
      }
    });

    this.network.on("kill", (msg: KillMessage) => {
      const targetEntity = this.players.get(msg.targetId);
      if (targetEntity) {
        this.vfx?.spawnDeathBurst(targetEntity.getPosition());
      }

      this.ui.addKillFeedEntry(msg.killerName, msg.targetName);

      if (msg.targetId === this.myId) {
        this.ui.showDeath();
        this.sound.playDeath();
        this.cameraCtrl.shake(0.4, 0.5);
      } else if (msg.killerId === this.myId) {
        this.sound.playKill();
      }
    });

    this.network.on("respawn", (msg: RespawnMessage) => {
      if (msg.id === this.myId) {
        this.ui.hideDeath();
        this.ui.updateHealth(100, 100);
        this.ui.updateStamina(100, 100);
        this.predictedX = msg.x;
        this.predictedZ = msg.z;
        this.predictedY = 0;
        this.predictedYVel = 0;
        this.pendingInputs = [];
      }
    });

    this.network.on("chat", (msg: ChatMessage) => {
      this.ui.addChatMessage(msg.text);
    });
  }

  private addPlayerEntity(ps: PlayerState): void {
    if (this.players.has(ps.id)) return;
    const entity = new PlayerEntity(ps, ps.id === this.myId, this.scene);
    this.players.set(ps.id, entity);
  }

  private removePlayerEntity(id: string): void {
    const entity = this.players.get(id);
    if (entity) {
      entity.destroy(this.scene);
      this.players.delete(id);
    }
    this.serverStates.delete(id);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const rawDt = Math.min(this.clock.getDelta(), 0.1);

    // Hit-stop: reduce dt to near-zero for freeze-frame effect
    let dt = rawDt;
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= rawDt;
      dt = rawDt * 0.05; // near-freeze, not fully zero so things still move slightly
    }

    this.update(dt, rawDt);
    this.vfx?.update(dt);
    this.arena?.update(dt);

    // Update sword trail for local player
    const trailEntity = this.players.get(this.myId);
    if (trailEntity && this.vfx) {
      const myState = this.serverStates.get(this.myId);
      this.vfx.updateSwordTrail(trailEntity.getSwordTip(), myState?.action === "attacking");
    }
    this.updateDamageNumbers(rawDt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number, rawDt: number): void {
    this.input.update(rawDt); // input always uses real dt

    if (this.myId) {
      const rawInput = this.input.getMovement();
      const rotation = this.input.getRotationY();
      this.predictedRotation = rotation;

      // Negate inputs: camera is behind the player, so visual forward = -server forward
      const forward = -rawInput.forward;
      const right = -rawInput.right;

      // Calculate local move speed for entity animation
      const inputMag = Math.sqrt(forward * forward + right * right);
      const localSpeed = inputMag * PLAYER_SPEED * (this.lastServerAction === "blocking" ? 0.55 : 1.0);
      const canMove = this.lastServerAction !== "attacking" && this.lastServerAction !== "dodging";
      const myEntity = this.players.get(this.myId);
      if (myEntity) {
        myEntity.setLocalMoveSpeed(canMove ? localSpeed : 0);
      }

      // Client-side XZ prediction
      if (canMove && (forward !== 0 || right !== 0)) {
        const sin = Math.sin(rotation);
        const cos = Math.cos(rotation);
        let dx = right * cos - forward * sin;
        let dz = right * sin - forward * cos;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len > 1) { dx /= len; dz /= len; }
        const speedMul = this.lastServerAction === "blocking" ? 0.55 : 1.0;
        this.predictedX += dx * PLAYER_SPEED * speedMul * rawDt;
        this.predictedZ += dz * PLAYER_SPEED * speedMul * rawDt;

        const dist = Math.sqrt(this.predictedX * this.predictedX + this.predictedZ * this.predictedZ);
        if (dist > this.arenaRadius - 1) {
          const scale = (this.arenaRadius - 1) / dist;
          this.predictedX *= scale;
          this.predictedZ *= scale;
        }
      }

      // Client-side Y prediction (jump + gravity)
      if (this.predictedY > 0 || this.predictedYVel > 0) {
        this.predictedYVel -= GRAVITY * rawDt;
        this.predictedY += this.predictedYVel * rawDt;
        if (this.predictedY <= 0) {
          this.predictedY = 0;
          this.predictedYVel = 0;
        }
      }

      // Send input (with negated values so server moves correctly)
      this.inputSeq++;
      this.pendingInputs.push({ seq: this.inputSeq, forward, right, rotation, dt: rawDt });
      if (this.pendingInputs.length > 120) {
        this.pendingInputs = this.pendingInputs.slice(-120);
      }

      this.network.sendThrottled({
        type: "move", seq: this.inputSeq, forward, right, rotation, dt: rawDt,
      });

      // Actions
      if (this.input.consumeAttack()) {
        this.network.send({ type: "attack" });
        const myState = this.serverStates.get(this.myId);
        const comboStep = myState?.action === "attacking" ? Math.min(3, (myState.attackIndex || 0) + 1) : 1;
        this.sound.playSwing(comboStep);
      }
      if (this.input.consumeBlockStart()) this.network.send({ type: "blockStart" });
      if (this.input.consumeBlockEnd()) this.network.send({ type: "blockEnd" });
      if (this.input.consumeJump()) {
        this.network.send({ type: "jump" });
        this.sound.playJump();
        // Client-side jump prediction: instantly apply jump velocity
        if (this.predictedY <= 0.001) {
          this.predictedYVel = JUMP_VELOCITY;
          this.predictedY = 0.001;
        }
      }
      if (this.input.consumeDodge()) { this.network.send({ type: "dodge" }); this.sound.playDodge(); }

      // Set predicted position
      if (myEntity) {
        myEntity.setPredictedPosition(this.predictedX, this.predictedY, this.predictedZ);
      }
    }

    // Update entities
    for (const [id, state] of this.serverStates) {
      let entity = this.players.get(id);
      if (!entity) {
        this.addPlayerEntity(state);
        entity = this.players.get(id);
      }
      if (entity) {
        if (id === this.myId) {
          const s = { ...state };
          s.x = this.predictedX;
          s.y = this.predictedY;
          s.z = this.predictedZ;
          s.rotation = this.predictedRotation;
          entity.updateFromServer(s, dt);
        } else {
          entity.updateFromServer(state, dt);
        }
      }
    }

    // Clean up stale entities
    for (const [id] of this.players) {
      if (!this.serverStates.has(id)) {
        this.removePlayerEntity(id);
      }
    }

    // Camera (always use real dt for smooth follow)
    const myEntity2 = this.players.get(this.myId);
    if (myEntity2) {
      this.cameraCtrl.update(myEntity2.getPosition(), this.input.getRotationY(), rawDt);
    }
  }

  private reconcileWithServer(serverState: PlayerState): void {
    const lastProcessedSeq = serverState.lastSeq;
    this.pendingInputs = this.pendingInputs.filter((i) => i.seq > lastProcessedSeq);

    this.predictedX = serverState.x;
    this.predictedZ = serverState.z;
    // Only snap Y to server if we're not mid-jump locally (avoids jitter)
    if (this.predictedYVel === 0) {
      this.predictedY = serverState.y;
    }

    const canMove = serverState.action !== "attacking" && serverState.action !== "dodging";
    if (canMove) {
      for (const input of this.pendingInputs) {
        const sin = Math.sin(input.rotation);
        const cos = Math.cos(input.rotation);
        // Note: input.forward and input.right are already negated when stored
        let dx = input.right * cos - input.forward * sin;
        let dz = input.right * sin - input.forward * cos;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len > 1) { dx /= len; dz /= len; }
        const speedMul = serverState.action === "blocking" ? 0.55 : 1.0;
        this.predictedX += dx * PLAYER_SPEED * speedMul * input.dt;
        this.predictedZ += dz * PLAYER_SPEED * speedMul * input.dt;

        const dist = Math.sqrt(this.predictedX * this.predictedX + this.predictedZ * this.predictedZ);
        if (dist > this.arenaRadius - 1) {
          const scale = (this.arenaRadius - 1) / dist;
          this.predictedX *= scale;
          this.predictedZ *= scale;
        }
      }
    }
  }

  // ===================== DAMAGE NUMBERS =====================
  private spawnDamageNumber(worldPos: THREE.Vector3, damage: number, isBlocked: boolean): void {
    const el = document.createElement("div");
    el.textContent = `-${damage}`;
    el.style.cssText = `
      position:absolute;font-family:'Cinzel',serif;font-weight:700;
      font-size:${isBlocked ? '14px' : '18px'};
      color:${isBlocked ? '#8899aa' : (damage >= 25 ? '#ff4444' : '#ffaa44')};
      text-shadow:0 2px 6px rgba(0,0,0,0.8);
      pointer-events:none;transition:none;white-space:nowrap;
    `;
    this.damageContainer.appendChild(el);

    this.damageNumbers.push({
      element: el,
      worldPos: worldPos.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5, 2.2, (Math.random() - 0.5) * 0.5
      )),
      life: 1.0,
      velocity: 1.5 + Math.random() * 0.5,
    });
  }

  private updateDamageNumbers(dt: number): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const _v = new THREE.Vector3();

    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      dn.life -= dt;
      dn.worldPos.y += dn.velocity * dt;
      dn.velocity -= dt * 2; // decelerate

      if (dn.life <= 0) {
        dn.element.remove();
        this.damageNumbers.splice(i, 1);
        continue;
      }

      // Project world position to screen
      _v.copy(dn.worldPos);
      _v.project(this.camera);
      const sx = (0.5 + _v.x / 2) * w;
      const sy = (0.5 - _v.y / 2) * h;

      dn.element.style.left = `${sx}px`;
      dn.element.style.top = `${sy}px`;
      dn.element.style.opacity = `${Math.min(1, dn.life * 2)}`;
      dn.element.style.transform = `translate(-50%,-50%) scale(${0.8 + dn.life * 0.4})`;
    }
  }

  setPlayerName(name: string): void {
    this.network.send({ type: "setName", name });
  }
}
