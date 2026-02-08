// client/src/UI.ts
import type { PlayerState } from "./types";

export class UI {
  private healthBar: HTMLElement;
  private healthText: HTMLElement;
  private hud: HTMLElement;
  private scoreboard: HTMLElement;
  private scoresDiv: HTMLElement;
  private chatlog: HTMLElement;
  private crosshair: HTMLElement;
  private deathScreen: HTMLElement;
  private playerCount: HTMLElement;

  constructor() {
    this.healthBar = document.getElementById("health-bar")!;
    this.healthText = document.getElementById("health-text")!;
    this.hud = document.getElementById("hud")!;
    this.scoreboard = document.getElementById("scoreboard")!;
    this.scoresDiv = document.getElementById("scores")!;
    this.chatlog = document.getElementById("chatlog")!;
    this.crosshair = document.getElementById("crosshair")!;
    this.deathScreen = document.getElementById("death-screen")!;
    this.playerCount =
      document.getElementById("player-count")!;
  }

  showHud(): void {
    this.hud.style.display = "block";
    this.scoreboard.style.display = "block";
    this.chatlog.style.display = "block";
    this.crosshair.style.display = "block";
    this.playerCount.style.display = "block";
  }

  updateHealth(health: number, maxHealth: number): void {
    const pct = Math.max(0, (health / maxHealth) * 100);
    this.healthBar.style.width = `${pct}%`;

    // Color gradient: green -> yellow -> red
    if (pct > 60) {
      this.healthBar.style.background =
        "linear-gradient(90deg, #27ae60, #2ecc71)";
    } else if (pct > 30) {
      this.healthBar.style.background =
        "linear-gradient(90deg, #f39c12, #f1c40f)";
    } else {
      this.healthBar.style.background =
        "linear-gradient(90deg, #c0392b, #e74c3c)";
    }

    this.healthText.textContent = `${Math.ceil(health)} / ${maxHealth}`;
  }

  flashDamage(): void {
    const flash = document.createElement("div");
    flash.style.cssText = `
      position: fixed; inset: 0; z-index: 40;
      background: rgba(255, 0, 0, 0.2);
      pointer-events: none;
      animation: dmgflash 0.3s ease-out forwards;
    `;

    // Inject keyframes if not present
    if (!document.getElementById("dmgflash-style")) {
      const style = document.createElement("style");
      style.id = "dmgflash-style";
      style.textContent = `
        @keyframes dmgflash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 300);
  }

  showDeath(): void {
    this.deathScreen.style.display = "flex";
  }

  hideDeath(): void {
    this.deathScreen.style.display = "none";
  }

  updateScoreboard(
    players: PlayerState[],
    myId: string
  ): void {
    // Sort by kills descending
    const sorted = [...players].sort(
      (a, b) => b.kills - a.kills
    );

    this.scoresDiv.innerHTML = sorted
      .map((p) => {
        const isSelf = p.id === myId;
        return `
          <div class="score-entry ${isSelf ? "self" : ""}">
            <span class="name">
              <span class="color-dot" style="background:${p.color}"></span>
              ${p.name}${p.isDead ? " 💀" : ""}
            </span>
            <span>${p.kills}K / ${p.deaths}D</span>
          </div>
        `;
      })
      .join("");
  }

  updatePlayerCount(count: number): void {
    this.playerCount.textContent = `Players: ${count}/16`;
  }

  addChatMessage(text: string): void {
    const msg = document.createElement("div");
    msg.className = "chat-msg";
    msg.textContent = text;
    this.chatlog.appendChild(msg);

    // Keep only last 10 messages
    while (this.chatlog.children.length > 10) {
      this.chatlog.removeChild(this.chatlog.firstChild!);
    }

    // Remove after animation
    setTimeout(() => msg.remove(), 8000);
  }
}
