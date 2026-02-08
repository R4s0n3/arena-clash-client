// client/src/main.ts
import type { Game } from "./Game";

const playBtn = document.getElementById(
  "play-btn"
) as HTMLButtonElement;
const overlay = document.getElementById(
  "overlay"
) as HTMLDivElement;

let game: Game | null = null;

playBtn.addEventListener("click", async () => {
  if (playBtn.disabled) return;
  playBtn.disabled = true;
  playBtn.classList.add("loading");
  playBtn.textContent = "ENTERING...";

  overlay.style.display = "none";

  document.body.requestPointerLock();

  if (!game) {
    const { Game } = await import("./Game");
    game = new Game();
    game.start();
  }
});
