// client/src/InputManager.ts
export class InputManager {
  private keys: Set<string> = new Set();
  private rotationY = 0;
  private moveForward = 0;
  private moveRight = 0;
  private pendingAttack = false;
  private pendingBlockStart = false;
  private pendingBlockEnd = false;
  private pendingJump = false;
  private isBlocking = false;
  private isPointerLocked = false;

  private static readonly ACCEL = 16;
  private static readonly DECEL = 20;
  private static readonly DEADZONE = 0.01;

  constructor() {
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) {
          this.pendingJump = true;
        }
      }
      this.keys.add(e.code);
    });

    document.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isPointerLocked) return;
      this.rotationY -= e.movementX * 0.003;
    });

    document.addEventListener("mousedown", (e) => {
      if (!this.isPointerLocked) {
        document.body.requestPointerLock();
        return;
      }

      if (e.button === 0) {
        // Left click — attack
        this.pendingAttack = true;
      } else if (e.button === 2) {
        // Right click — block
        this.isBlocking = true;
        this.pendingBlockStart = true;
      }
    });

    document.addEventListener("mouseup", (e) => {
      if (e.button === 2 && this.isBlocking) {
        this.isBlocking = false;
        this.pendingBlockEnd = true;
      }
    });

    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    document.addEventListener("pointerlockchange", () => {
      this.isPointerLocked =
        document.pointerLockElement === document.body;
    });
  }

  update(dt: number): void {
    let targetForward = 0;
    let targetRight = 0;

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp"))
      targetForward += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown"))
      targetForward -= 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft"))
      targetRight -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight"))
      targetRight += 1;

    const fAccel =
      targetForward !== 0
        ? InputManager.ACCEL
        : InputManager.DECEL;
    const rAccel =
      targetRight !== 0
        ? InputManager.ACCEL
        : InputManager.DECEL;

    this.moveForward +=
      (targetForward - this.moveForward) *
      Math.min(1, fAccel * dt);
    this.moveRight +=
      (targetRight - this.moveRight) *
      Math.min(1, rAccel * dt);

    if (Math.abs(this.moveForward) < InputManager.DEADZONE)
      this.moveForward = 0;
    if (Math.abs(this.moveRight) < InputManager.DEADZONE)
      this.moveRight = 0;
  }

  getMovement(): { forward: number; right: number } {
    return { forward: this.moveForward, right: this.moveRight };
  }

  getRotationY(): number {
    return this.rotationY;
  }

  consumeAttack(): boolean {
    if (this.pendingAttack) {
      this.pendingAttack = false;
      return true;
    }
    return false;
  }

  consumeBlockStart(): boolean {
    if (this.pendingBlockStart) {
      this.pendingBlockStart = false;
      return true;
    }
    return false;
  }

  consumeBlockEnd(): boolean {
    if (this.pendingBlockEnd) {
      this.pendingBlockEnd = false;
      return true;
    }
    return false;
  }

  consumeJump(): boolean {
    if (this.pendingJump) {
      this.pendingJump = false;
      return true;
    }
    return false;
  }
}
