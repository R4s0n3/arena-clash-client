// client/src/main.ts
import { Game } from "./Game";

const playBtn = document.getElementById(
  "play-btn"
) as HTMLButtonElement;
const overlay = document.getElementById(
  "overlay"
) as HTMLDivElement;

let game: Game | null = null;

playBtn.addEventListener("click", () => {
  overlay.style.display = "none";

  document.body.requestPointerLock();

  if (!game) {
    game = new Game();
    game.start();
  }
});
