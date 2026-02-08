// client/src/Game.ts
import * as THREE from "three";
import { Network } from "./Network";
import { InputManager } from "./InputManager";
import { PlayerEntity } from "./PlayerEntity";
import { Arena } from "./Arena";
import { UI } from "./UI";
import { SoundManager } from "./SoundManager";
import { VFX } from "./VFX";
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

const CAMERA_DISTANCE = 11.5;
const CAMERA_HEIGHT = 5.8;
const CAMERA_LERP = 0.08;
const PLAYER_SPEED = 8;

// Client-side prediction input record
interface InputRecord {
  seq: number;
  forward: number;
  right: number;
  rotation: number;
  dt: number;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
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

  // Client-side prediction state
  private predictedX = 0;
  private predictedZ = 0;
  private predictedY = 0;
  private predictedRotation = 0;
  private pendingInputs: InputRecord[] = [];
  private inputSeq = 0;
  private lastServerAction: string = "idle";

  // Player names cache for kill feed
  private playerNames: Map<string, string> = new Map();

  // Raycaster for camera collision
  private cameraRaycaster = new THREE.Raycaster();

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

    // Input
    this.input = new InputManager();

    // UI
    this.ui = new UI();

    // Sound
    this.sound = new SoundManager();

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
    // Initialize audio on user interaction
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

        // Update name tag if name changed
        const oldName = this.playerNames.get(ps.id);
        if (oldName && oldName !== ps.name) {
          const entity = this.players.get(ps.id);
          if (entity) {
            entity.updateNameTag(ps.name);
          }
        }
        this.playerNames.set(ps.id, ps.name);

        // Server reconciliation for local player
        if (ps.id === this.myId) {
          this.reconcileWithServer(ps);
        }
      }
      this.ui.updateScoreboard(msg.players, this.myId);
      this.ui.updatePlayerCount(msg.players.length);

      // Update local player stamina bar
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
        } else {
          target.flashHit();
          this.sound.playHit();
          if (attacker) {
            const attackerPos = attacker.getPosition();
            const dir = new THREE.Vector3(
              targetPos.x - attackerPos.x,
              0,
              targetPos.z - attackerPos.z
            ).normalize();
            this.vfx?.spawnHitSparks(targetPos, dir);
            this.vfx?.spawnBloodSplatter(targetPos, dir);
          }
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

      // Kill feed
      this.ui.addKillFeedEntry(msg.killerName, msg.targetName);

      if (msg.targetId === this.myId) {
        this.ui.showDeath();
        this.sound.playDeath();
      } else if (msg.killerId === this.myId) {
        this.sound.playKill();
      }
    });

    this.network.on("respawn", (msg: RespawnMessage) => {
      if (msg.id === this.myId) {
        this.ui.hideDeath();
        this.ui.updateHealth(100, 100);
        this.ui.updateStamina(100, 100);
        // Reset prediction state
        this.predictedX = msg.x;
        this.predictedZ = msg.z;
        this.predictedY = 0;
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
    const dt = Math.min(this.clock.getDelta(), 0.1); // cap dt
    this.update(dt);
    this.vfx?.update(dt);
    this.arena?.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number): void {
    this.input.update(dt);

    if (this.myId) {
      const { forward, right } = this.input.getMovement();
      const rotation = this.input.getRotationY();
      this.predictedRotation = rotation;

      // Client-side prediction: apply movement locally
      const canMove = this.lastServerAction !== "attacking" && this.lastServerAction !== "dodging";
      if (canMove && (forward !== 0 || right !== 0)) {
        const sin = Math.sin(rotation);
        const cos = Math.cos(rotation);
        let dx = right * cos - forward * sin;
        let dz = right * sin - forward * cos;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len > 1) {
          dx /= len;
          dz /= len;
        }
        const speedMul = this.lastServerAction === "blocking" ? 0.55 : 1.0;
        this.predictedX += dx * PLAYER_SPEED * speedMul * dt;
        this.predictedZ += dz * PLAYER_SPEED * speedMul * dt;

        // Clamp to arena
        const dist = Math.sqrt(
          this.predictedX * this.predictedX + this.predictedZ * this.predictedZ
        );
        if (dist > this.arenaRadius - 1) {
          const scale = (this.arenaRadius - 1) / dist;
          this.predictedX *= scale;
          this.predictedZ *= scale;
        }
      }

      // Send input to server with sequence number
      this.inputSeq++;
      const inputRecord: InputRecord = {
        seq: this.inputSeq,
        forward,
        right,
        rotation,
        dt,
      };
      this.pendingInputs.push(inputRecord);

      // Keep only last 2 seconds of inputs
      const maxPending = 120;
      if (this.pendingInputs.length > maxPending) {
        this.pendingInputs = this.pendingInputs.slice(-maxPending);
      }

      this.network.sendThrottled({
        type: "move",
        seq: this.inputSeq,
        forward,
        right,
        rotation,
        dt,
      });

      // Handle actions
      if (this.input.consumeAttack()) {
        this.network.send({ type: "attack" });
        // Use current server attack index for combo-varied sound
        const myState = this.serverStates.get(this.myId);
        const comboStep = myState?.action === "attacking" ? Math.min(3, (myState.attackIndex || 0) + 1) : 1;
        this.sound.playSwing(comboStep);
      }
      if (this.input.consumeBlockStart()) {
        this.network.send({ type: "blockStart" });
      }
      if (this.input.consumeBlockEnd()) {
        this.network.send({ type: "blockEnd" });
      }
      if (this.input.consumeJump()) {
        this.network.send({ type: "jump" });
        this.sound.playJump();
      }
      if (this.input.consumeDodge()) {
        this.network.send({ type: "dodge" });
        this.sound.playDodge();
      }

      // Update local player with predicted position
      const myEntity = this.players.get(this.myId);
      if (myEntity) {
        myEntity.setPredictedPosition(
          this.predictedX,
          this.predictedY,
          this.predictedZ
        );
      }
    }

    // Update player entities from server state
    for (const [id, state] of this.serverStates) {
      let entity = this.players.get(id);
      if (!entity) {
        this.addPlayerEntity(state);
        entity = this.players.get(id);
      }
      if (entity) {
        if (id === this.myId) {
          // For local player, use predicted position but server state for actions/animations
          const predictedState = { ...state };
          predictedState.x = this.predictedX;
          predictedState.y = this.predictedY;
          predictedState.z = this.predictedZ;
          predictedState.rotation = this.predictedRotation;
          entity.updateFromServer(predictedState, dt);
        } else {
          entity.updateFromServer(state, dt);
        }
      }
    }

    // Remove entities that no longer have server state
    for (const [id] of this.players) {
      if (!this.serverStates.has(id)) {
        this.removePlayerEntity(id);
      }
    }

    // Update camera
    const myEntity = this.players.get(this.myId);
    if (myEntity) {
      this.updateCamera(myEntity, dt);
    }
  }

  private reconcileWithServer(serverState: PlayerState): void {
    const lastProcessedSeq = serverState.lastSeq;

    // Remove inputs that the server has already processed
    this.pendingInputs = this.pendingInputs.filter(
      (input) => input.seq > lastProcessedSeq
    );

    // Start from server authoritative position
    this.predictedX = serverState.x;
    this.predictedZ = serverState.z;
    this.predictedY = serverState.y;

    // Re-apply unprocessed inputs
    const canMove = serverState.action !== "attacking" && serverState.action !== "dodging";
    if (canMove) {
      for (const input of this.pendingInputs) {
        const sin = Math.sin(input.rotation);
        const cos = Math.cos(input.rotation);
        let dx = input.right * cos - input.forward * sin;
        let dz = input.right * sin - input.forward * cos;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len > 1) {
          dx /= len;
          dz /= len;
        }
        const speedMul = serverState.action === "blocking" ? 0.55 : 1.0;
        this.predictedX += dx * PLAYER_SPEED * speedMul * input.dt;
        this.predictedZ += dz * PLAYER_SPEED * speedMul * input.dt;

        const dist = Math.sqrt(
          this.predictedX * this.predictedX + this.predictedZ * this.predictedZ
        );
        if (dist > this.arenaRadius - 1) {
          const scale = (this.arenaRadius - 1) / dist;
          this.predictedX *= scale;
          this.predictedZ *= scale;
        }
      }
    }
  }

  private updateCamera(player: PlayerEntity, _dt: number): void {
    const pos = player.getPosition();
    const rot = this.input.getRotationY();

    const forward = new THREE.Vector3(
      -Math.sin(rot),
      0,
      -Math.cos(rot)
    );

    let camDist = CAMERA_DISTANCE;

    // Camera collision: cast ray from player toward camera position
    const targetCamPos = new THREE.Vector3(
      pos.x - forward.x * CAMERA_DISTANCE,
      pos.y + CAMERA_HEIGHT,
      pos.z - forward.z * CAMERA_DISTANCE
    );

    const playerHead = new THREE.Vector3(pos.x, pos.y + 1.5, pos.z);
    const camDir = new THREE.Vector3().subVectors(targetCamPos, playerHead).normalize();
    const maxDist = playerHead.distanceTo(targetCamPos);

    this.cameraRaycaster.set(playerHead, camDir);
    this.cameraRaycaster.far = maxDist;

    // Only check against arena meshes (not players or particles)
    const intersectable: THREE.Object3D[] = [];
    this.scene.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.geometry &&
        !(child.parent instanceof THREE.Group && this.isPlayerGroup(child.parent))
      ) {
        intersectable.push(child);
      }
    });

    const intersections = this.cameraRaycaster.intersectObjects(intersectable, false);
    if (intersections.length > 0) {
      const closestDist = intersections[0].distance;
      if (closestDist < maxDist) {
        camDist = Math.max(2, closestDist * 0.9); // keep 10% padding
        // Recalculate with shorter distance
        const ratio = camDist / CAMERA_DISTANCE;
        targetCamPos.set(
          pos.x - forward.x * camDist,
          pos.y + CAMERA_HEIGHT * ratio,
          pos.z - forward.z * camDist
        );
      }
    }

    this.camera.position.lerp(targetCamPos, CAMERA_LERP);
    this.camera.lookAt(pos.x, pos.y + 1.5, pos.z);
  }

  private isPlayerGroup(obj: THREE.Object3D): boolean {
    for (const [, entity] of this.players) {
      if (entity.getGroup() === obj || entity.getGroup().parent === obj) {
        return true;
      }
    }
    return false;
  }

  setPlayerName(name: string): void {
    this.network.send({ type: "setName", name });
  }
}
