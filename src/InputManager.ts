// client/src/InputManager.ts
export class InputManager {
  private keys: Set<string> = new Set();
  private rotationY = 0;
  private pendingAttack = false;
  private pendingBlockStart = false;
  private pendingBlockEnd = false;
  private isBlocking = false;
  private isPointerLocked = false;

  constructor() {
    document.addEventListener("keydown", (e) => {
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

  getMovement(): { forward: number; right: number } {
    let forward = 0;
    let right = 0;

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp"))
      forward += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown"))
      forward -= 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft"))
      right -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight"))
      right += 1;

    return { forward, right };
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
}
