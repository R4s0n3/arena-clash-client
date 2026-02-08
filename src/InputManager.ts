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
  private pendingDodge = false;
  private isBlocking = false;
  private isPointerLocked = false;

  private static readonly ACCEL = 22;
  private static readonly TURN_ACCEL = 30;
  private static readonly DECEL = 26;
  private static readonly DEADZONE = 0.01;

  constructor() {
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) {
          this.pendingJump = true;
        }
      }
      if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && !e.repeat) {
        this.pendingDodge = true;
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
        this.pendingAttack = true;
      } else if (e.button === 2) {
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

    // Normalize intended movement to avoid faster diagonals.
    const targetLen = Math.hypot(targetForward, targetRight);
    if (targetLen > 1) {
      targetForward /= targetLen;
      targetRight /= targetLen;
    }

    // Vector-based acceleration feels more natural than per-axis lerp.
    const desiredDot = this.moveForward * targetForward + this.moveRight * targetRight;
    const accel =
      targetLen > 0
        ? (desiredDot < 0 ? InputManager.TURN_ACCEL : InputManager.ACCEL)
        : InputManager.DECEL;

    const dx = targetRight - this.moveRight;
    const dy = targetForward - this.moveForward;
    const dist = Math.hypot(dx, dy);
    const maxStep = accel * dt;

    if (dist > maxStep && dist > 0) {
      this.moveRight += (dx / dist) * maxStep;
      this.moveForward += (dy / dist) * maxStep;
    } else {
      this.moveRight = targetRight;
      this.moveForward = targetForward;
    }

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

  consumeDodge(): boolean {
    if (this.pendingDodge) {
      this.pendingDodge = false;
      return true;
    }
    return false;
  }
}
