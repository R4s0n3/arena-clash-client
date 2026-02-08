// client/src/Game.ts
import * as THREE from "three";
import { Network } from "./Network";
import { InputManager } from "./InputManager";
import { PlayerEntity } from "./PlayerEntity";
import { Arena } from "./Arena";
import { UI } from "./UI";
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
const CAMERA_SIDE = 0.0;
const CAMERA_LERP = 0.08;

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private network: Network;
  private input: InputManager;
  private ui: UI;
  private arena!: Arena;

  private myId = "";
  private players: Map<string, PlayerEntity> = new Map();
  private serverStates: Map<string, PlayerState> = new Map();
  private clock = new THREE.Clock();

  constructor() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );
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

    // Network
    const envUrl = import.meta.env.VITE_WS_URL as
      | string
      | undefined;
    const wsUrl =
      envUrl && envUrl.trim() !== ""
        ? envUrl
        : `${window.location.protocol === "https:" ? "wss" : "ws"}://${
            window.location.host
          }`;
    this.network = new Network(wsUrl);
    this.setupNetworkHandlers();

    // Resize
    window.addEventListener("resize", () => {
      this.camera.aspect =
        window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(
        window.innerWidth,
        window.innerHeight
      );
    });
  }

  start(): void {
    this.animate();
  }

  private setupNetworkHandlers(): void {
    this.network.on("welcome", (msg: WelcomeMessage) => {
      this.myId = msg.id;
      this.arena = new Arena(this.scene, msg.arenaRadius);

      for (const ps of msg.players) {
        this.addPlayerEntity(ps);
      }

      this.ui.showHud();
    });

    this.network.on(
      "playerJoined",
      (msg: PlayerJoinedMessage) => {
        this.addPlayerEntity(msg.player);
      }
    );

    this.network.on("playerLeft", (msg: PlayerLeftMessage) => {
      this.removePlayerEntity(msg.id);
    });

    this.network.on("state", (msg: StateMessage) => {
      for (const ps of msg.players) {
        this.serverStates.set(ps.id, ps);
      }
      this.ui.updateScoreboard(msg.players, this.myId);
      this.ui.updatePlayerCount(msg.players.length);
    });

    this.network.on("hit", (msg: HitMessage) => {
      const target = this.players.get(msg.targetId);
      if (target) {
        target.flashHit();
      }

      if (msg.targetId === this.myId) {
        this.ui.updateHealth(
          msg.targetHealth,
          100
        );
        this.ui.flashDamage();
      }
    });

    this.network.on("kill", (msg: KillMessage) => {
      if (msg.targetId === this.myId) {
        this.ui.showDeath();
      }
    });

    this.network.on("respawn", (msg: RespawnMessage) => {
      if (msg.id === this.myId) {
        this.ui.hideDeath();
        this.ui.updateHealth(100, 100);
      }
    });

    this.network.on("chat", (msg: ChatMessage) => {
      this.ui.addChatMessage(msg.text);
    });
  }

  private addPlayerEntity(ps: PlayerState): void {
    if (this.players.has(ps.id)) return;
    const entity = new PlayerEntity(
      ps,
      ps.id === this.myId,
      this.scene
    );
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
    const dt = this.clock.getDelta();
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number): void {
    this.input.update(dt);
    // Send input to server
    if (this.myId) {
      const { forward, right } = this.input.getMovement();
      const rotation = this.input.getRotationY();

      this.network.send({
        type: "move",
        forward,
        right,
        rotation,
      });

      // Handle attack/block
      if (this.input.consumeAttack()) {
        this.network.send({ type: "attack" });
      }
      if (this.input.consumeBlockStart()) {
        this.network.send({ type: "blockStart" });
      }
      if (this.input.consumeBlockEnd()) {
        this.network.send({ type: "blockEnd" });
      }
      if (this.input.consumeJump()) {
        this.network.send({ type: "jump" });
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
        entity.updateFromServer(state, dt);
      }
    }

    // Remove entities that no longer have server state
    for (const [id] of this.players) {
      if (!this.serverStates.has(id)) {
        this.removePlayerEntity(id);
      }
    }

    // Update camera to follow local player
    const myEntity = this.players.get(this.myId);
    if (myEntity) {
      this.updateCamera(myEntity, dt);
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
    const right = new THREE.Vector3(
      forward.z,
      0,
      -forward.x
    );
    const targetX =
      pos.x - forward.x * CAMERA_DISTANCE + right.x * CAMERA_SIDE;
    const targetZ =
      pos.z - forward.z * CAMERA_DISTANCE + right.z * CAMERA_SIDE;
    const targetY = pos.y + CAMERA_HEIGHT;

    this.camera.position.lerp(
      new THREE.Vector3(targetX, targetY, targetZ),
      CAMERA_LERP
    );

    this.camera.lookAt(pos.x, pos.y + 1.5, pos.z);
  }
}
