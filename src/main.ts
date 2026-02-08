// client/src/main.ts
import type { Game } from "./Game";

const playBtn = document.getElementById("play-btn") as HTMLButtonElement;
const overlay = document.getElementById("overlay") as HTMLDivElement;
const nameInput = document.getElementById("name-input") as HTMLInputElement;

let game: Game | null = null;

async function enterArena() {
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

  // Send player name if provided
  const name = nameInput?.value.trim();
  if (name && name.length > 0) {
    // Wait a moment for connection to establish
    setTimeout(() => {
      game!.setPlayerName(name);
    }, 500);
  }
}

playBtn.addEventListener("click", enterArena);

// Allow Enter key on name input
nameInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    enterArena();
  }
});
