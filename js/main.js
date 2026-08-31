import { GAME_MODES, PongGame, playerLabels } from "./game-core.js";

const canvas = document.querySelector("#pong-canvas");
const context = canvas.getContext("2d");
const playButton = document.querySelector("#play-button");
const pauseButton = document.querySelector("#pause-button");
const newGameButton = document.querySelector("#new-game-button");
const modeSelect = document.querySelector("#mode-select");
const difficultySelect = document.querySelector("#difficulty-select");
const winningScoreSelect = document.querySelector("#winning-score-select");
const soundToggle = document.querySelector("#sound-toggle");
const instructions = document.querySelector("#instructions");
const liveStatus = document.querySelector("#live-status");

const game = new PongGame();
const input = {
  leftUp: false,
  leftDown: false,
  rightUp: false,
  rightDown: false,
  leftTarget: null,
  rightTarget: null
};
const pointerSides = new Map();
let audioContext = null;
let lastFrameTime = performance.now();
let previousSummary = "";

function configureCanvas() {
  const cap=window.Playground?.quality==="low"?1:window.Playground?.quality==="medium"?1.5:2;
  const ratio = Math.min(window.devicePixelRatio || 1, cap);
  canvas.width = game.config.width * ratio;
  canvas.height = game.config.height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawRoundedRect(x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function drawCourt() {
  const c = game.config;
  context.fillStyle = "#02040a";
  context.fillRect(0, 0, c.width, c.height);

  context.save();
  context.setLineDash([12, 14]);
  context.strokeStyle = "#34405a";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(c.width / 2, 92);
  context.lineTo(c.width / 2, c.height);
  context.stroke();
  context.restore();

  context.fillStyle = "#f7f9ff";
  drawRoundedRect(0, game.state.leftY, c.paddleWidth, c.paddleHeight, 4);
  drawRoundedRect(c.width - c.paddleWidth, game.state.rightY, c.paddleWidth, c.paddleHeight, 4);

  context.beginPath();
  context.arc(game.state.ballX, game.state.ballY, c.ballRadius, 0, Math.PI * 2);
  context.shadowColor = "#79f2c0";
  context.shadowBlur = window.Playground?.quality==="low" ? 0 : 14;
  context.fillStyle = "#79f2c0";
  context.fill();
  context.shadowBlur = 0;
}

function drawScore() {
  const c = game.config;
  const labels = playerLabels(game.mode);
  context.textAlign = "center";
  context.fillStyle = "#b8c1d8";
  context.font = "700 15px system-ui, sans-serif";
  context.fillText(labels[0], c.width * 0.25, 28);
  context.fillText(labels[1], c.width * 0.75, 28);

  context.fillStyle = "#f7f9ff";
  context.font = "800 42px system-ui, sans-serif";
  context.fillText(String(game.state.leftScore), c.width * 0.25, 72);
  context.fillText(String(game.state.rightScore), c.width * 0.75, 72);

  context.fillStyle = "#8f9bb6";
  context.font = "600 13px system-ui, sans-serif";
  const speed = Math.round(Math.hypot(game.state.ballVX, game.state.ballVY));
  context.fillText("Échanges : " + game.state.rally + " · Vitesse : " + speed + " px/s", c.width / 2, c.height - 18);
}

function drawOverlay() {
  const c = game.config;
  let title = "";
  let subtitle = "";

  if (game.state.winner) {
    const labels = playerLabels(game.mode);
    title = (game.state.winner === "left" ? labels[0] : labels[1]) + " gagne !";
    subtitle = "Jouer relance une nouvelle partie";
  } else if (!game.state.running) {
    title = game.state.leftScore || game.state.rightScore ? "Pause" : "Prêt ?";
    subtitle = "Jouer ou appuyer sur Espace";
  } else if (game.state.countdown > 0) {
    title = String(Math.ceil(game.state.countdown));
    subtitle = "Préparez-vous";
  }

  if (!title) return;
  context.fillStyle = "rgb(2 4 10 / 72%)";
  context.fillRect(0, 92, c.width, c.height - 92);
  context.textAlign = "center";
  context.fillStyle = "#f7f9ff";
  context.font = "800 48px system-ui, sans-serif";
  context.fillText(title, c.width / 2, c.height / 2);
  context.fillStyle = "#b8c1d8";
  context.font = "600 17px system-ui, sans-serif";
  context.fillText(subtitle, c.width / 2, c.height / 2 + 38);
}

function render() {
  drawCourt();
  drawScore();
  drawOverlay();
}

function announce(message) {
  if (!message || message === previousSummary) return;
  previousSummary = message;
  liveStatus.textContent = "";
  window.setTimeout(() => {
    liveStatus.textContent = message;
  }, 20);
}

function updateInterface() {
  const running = game.state.running;
  document.body.classList.toggle("game-active", running);
  playButton.disabled = running;
  pauseButton.disabled = !running;
  playButton.setAttribute("aria-pressed", String(running));
  pauseButton.setAttribute("aria-pressed", String(!running));
  difficultySelect.disabled = game.mode === GAME_MODES.PLAYER_VS_PLAYER;

  if (game.mode === GAME_MODES.PLAYER_VS_PLAYER) {
    instructions.textContent = "Joueur 1 : W / S · Joueur 2 : ↑ / ↓ · Sur écran tactile : une moitié du terrain par joueur.";
  } else if (game.mode === GAME_MODES.AI_VS_AI) {
    instructions.textContent = "Partie automatique : observez les deux IA s’affronter.";
  } else {
    instructions.textContent = "Utilisez ↑ / ↓, la souris ou glissez sur le terrain.";
  }
}

function getAudioContext() {
  if (!soundToggle.checked) return null;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function beep(frequency, duration, volume = 0.035) {
  const audio = getAudioContext();
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function processEvents() {
  const labels = playerLabels(game.mode);
  for (const event of game.consumeEvents()) {
    if (event.type === "paddle") beep(290, 0.055);
    if (event.type === "wall") beep(180, 0.035, 0.02);
    if (event.type === "serve") beep(420, 0.07);
    if (event.type === "score") {
      beep(125, 0.18, 0.05);
      announce("Point pour " + (event.side === "left" ? labels[0] : labels[1]) +
        ". Score : " + event.leftScore + " à " + event.rightScore + ".");
    }
    if (event.type === "win") {
      beep(660, 0.4, 0.06);
      const winnerLabel=event.side === "left" ? labels[0] : labels[1];
      announce(winnerLabel + " remporte la partie.");
      const humanWon=game.mode===GAME_MODES.PLAYER_VS_PLAYER||(game.mode===GAME_MODES.PLAYER_VS_AI&&event.side==="left");
      const loserScore=event.side==="left"?game.state.rightScore:game.state.leftScore;
      window.Playground?.finish({humanWon,draw:game.mode===GAME_MODES.AI_VS_AI,message:winnerLabel+" gagne "+game.state.leftScore+" a "+game.state.rightScore+".",achievement:humanWon&&loserScore===0?"pong-shutout":null,best:humanWon?Math.abs(game.state.leftScore-game.state.rightScore):null});
    }
    if (event.type === "pause") announce("Partie en pause.");
    if (event.type === "play") announce("Partie en cours.");
  }
}

function clearInput() {
  input.leftUp = false;
  input.leftDown = false;
  input.rightUp = false;
  input.rightDown = false;
  input.leftTarget = null;
  input.rightTarget = null;
  pointerSides.clear();
}

function startGame() {
  window.Playground?.start();
  window.Playground?.setPaused(false);
  getAudioContext();
  game.play();
  canvas.focus({ preventScroll: true });
  updateInterface();
}

function pauseGame(message = "Partie en pause.") {
  game.pause();
  window.Playground?.setPaused(true);
  clearInput();
  updateInterface();
  announce(message);
  render();
}

playButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", () => pauseGame());
newGameButton.addEventListener("click", () => {
  window.Playground?.reset();
  game.newGame();
  clearInput();
  updateInterface();
  announce("Nouvelle partie prête.");
});

modeSelect.addEventListener("change", () => {
  window.Playground?.reset();
  game.setMode(modeSelect.value);
  clearInput();
  updateInterface();
  announce("Mode changé. Nouvelle partie prête.");
});

difficultySelect.addEventListener("change", () => {
  game.setDifficulty(difficultySelect.value);
  announce("Difficulté " + difficultySelect.options[difficultySelect.selectedIndex].text + ".");
});

winningScoreSelect.addEventListener("change", () => {
  game.setWinningScore(Number(winningScoreSelect.value));
  clearInput();
  updateInterface();
  announce("La partie se jouera en " + winningScoreSelect.value + " points.");
});

soundToggle.addEventListener("change", () => {
  if (soundToggle.checked) {
    getAudioContext();
    beep(440, 0.08);
  }
  announce(soundToggle.checked ? "Son activé." : "Son désactivé.");
});

document.addEventListener("keydown", (event) => {
  const formControl = event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement;
  if (event.code === "Space" && !formControl) {
    event.preventDefault();
    game.togglePause();
    updateInterface();
    return;
  }
  if (event.code === "Escape") {
    pauseGame();
    return;
  }
  if (event.code === "KeyW") input.leftUp = true;
  if (event.code === "KeyS") input.leftDown = true;
  if (event.code === "ArrowUp") {
    input.rightUp = true;
    event.preventDefault();
  }
  if (event.code === "ArrowDown") {
    input.rightDown = true;
    event.preventDefault();
  }
});

document.addEventListener("keyup", (event) => {
  if (event.code === "KeyW") input.leftUp = false;
  if (event.code === "KeyS") input.leftDown = false;
  if (event.code === "ArrowUp") input.rightUp = false;
  if (event.code === "ArrowDown") input.rightDown = false;
});

function pointerPosition(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * game.config.width / bounds.width,
    y: (event.clientY - bounds.top) * game.config.height / bounds.height
  };
}

function updatePointer(event) {
  if (game.mode === GAME_MODES.AI_VS_AI) return;
  const position = pointerPosition(event);
  const side = pointerSides.get(event.pointerId) ||
    (game.mode === GAME_MODES.PLAYER_VS_PLAYER && position.x > game.config.width / 2 ? "right" : "left");
  pointerSides.set(event.pointerId, side);
  if (side === "left") input.leftTarget = position.y;
  else input.rightTarget = position.y;
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  updatePointer(event);
  if (!game.state.running) startGame();
});
canvas.addEventListener("pointermove", (event) => {
  if (pointerSides.has(event.pointerId)) updatePointer(event);
},{passive:true});
function releasePointer(event) {
  const side = pointerSides.get(event.pointerId);
  pointerSides.delete(event.pointerId);
  if (side === "left") input.leftTarget = null;
  if (side === "right") input.rightTarget = null;
}
canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("selectstart", (event) => event.preventDefault());

window.addEventListener("playground:replay",()=>{window.Playground?.reset();game.newGame();clearInput();updateInterface();render()});
window.addEventListener("blur", clearInput);
window.addEventListener("resize", configureCanvas,{passive:true});
window.addEventListener("playground:quality",()=>{configureCanvas();render()});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.state.running) pauseGame("Partie mise en pause car l’onglet est masqué.");
});

function animationFrame(timestamp) {
  const delta = Math.min((timestamp - lastFrameTime) / 1000,.1);
  lastFrameTime = timestamp;
  window.Playground?.frame(delta);
  if(game.state.running){
    game.update(delta, input);
    processEvents();
    updateInterface();
    render();
  }
  requestAnimationFrame(animationFrame);
}

configureCanvas();
game.consumeEvents();
updateInterface();
render();
requestAnimationFrame(animationFrame);
