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
  private staminaBar: HTMLElement;
  private killFeed: HTMLElement;

  constructor() {
    this.healthBar = document.getElementById("health-bar")!;
    this.healthText = document.getElementById("health-text")!;
    this.hud = document.getElementById("hud")!;
    this.scoreboard = document.getElementById("scoreboard")!;
    this.scoresDiv = document.getElementById("scores")!;
    this.chatlog = document.getElementById("chatlog")!;
    this.crosshair = document.getElementById("crosshair")!;
    this.deathScreen = document.getElementById("death-screen")!;
    this.playerCount = document.getElementById("player-count")!;
    this.staminaBar = document.getElementById("stamina-bar")!;
    this.killFeed = document.getElementById("kill-feed")!;
  }

  showHud(): void {
    this.hud.style.display = "block";
    this.scoreboard.style.display = "block";
    this.chatlog.style.display = "block";
    this.crosshair.style.display = "block";
    this.playerCount.style.display = "block";
    this.killFeed.style.display = "block";
  }

  updateHealth(health: number, maxHealth: number): void {
    const pct = Math.max(0, (health / maxHealth) * 100);
    this.healthBar.style.width = `${pct}%`;

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

  updateStamina(stamina: number, maxStamina: number): void {
    const pct = Math.max(0, (stamina / maxStamina) * 100);
    this.staminaBar.style.width = `${pct}%`;

    if (pct > 50) {
      this.staminaBar.style.background =
        "linear-gradient(90deg, #2980b9, #3498db)";
    } else if (pct > 25) {
      this.staminaBar.style.background =
        "linear-gradient(90deg, #d35400, #e67e22)";
    } else {
      this.staminaBar.style.background =
        "linear-gradient(90deg, #7f1d1d, #c0392b)";
    }
  }

  flashDamage(): void {
    const flash = document.createElement("div");
    flash.style.cssText = `
      position: fixed; inset: 0; z-index: 40;
      background: rgba(255, 0, 0, 0.2);
      pointer-events: none;
      animation: dmgflash 0.3s ease-out forwards;
    `;

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

  updateScoreboard(players: PlayerState[], myId: string): void {
    const sorted = [...players].sort((a, b) => b.kills - a.kills);

    this.scoresDiv.innerHTML = sorted
      .map((p) => {
        const isSelf = p.id === myId;
        return `
          <div class="score-entry ${isSelf ? "self" : ""}">
            <span class="name">
              <span class="color-dot" style="background:${p.color}"></span>
              ${this.escapeHtml(p.name)}${p.isDead ? " &#x1F480;" : ""}
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

    while (this.chatlog.children.length > 10) {
      this.chatlog.removeChild(this.chatlog.firstChild!);
    }

    setTimeout(() => msg.remove(), 8000);
  }

  addKillFeedEntry(killerName: string, targetName: string): void {
    const entry = document.createElement("div");
    entry.className = "kill-entry";
    entry.innerHTML = `<span class="killer">${this.escapeHtml(killerName)}</span> <span class="kill-icon">&#x2694;</span> <span class="victim">${this.escapeHtml(targetName)}</span>`;
    this.killFeed.appendChild(entry);

    while (this.killFeed.children.length > 5) {
      this.killFeed.removeChild(this.killFeed.firstChild!);
    }

    setTimeout(() => entry.remove(), 5000);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
