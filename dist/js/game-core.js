export const GAME_MODES = Object.freeze({
PLAYER_VS_AI: "player-vs-ai",
PLAYER_VS_PLAYER: "player-vs-player",
AI_VS_AI: "ai-vs-ai"
});
export const DIFFICULTIES = Object.freeze({
easy: Object.freeze({ speed: 320, reaction: 0.18, error: 72 }),
normal: Object.freeze({ speed: 440, reaction: 0.10, error: 36 }),
hard: Object.freeze({ speed: 570, reaction: 0.055, error: 13 })
});
export const DEFAULT_CONFIG = Object.freeze({
width: 800,
height: 600,
paddleWidth: 12,
paddleHeight: 104,
paddleSpeed: 520,
ballRadius: 10,
initialBallSpeed: 420,
minimumVerticalSpeed: 90,
speedIncrease: 1.20,
maxBallSpeed: 2000,
serveDelay: 2.4
});
export function reflectPosition(value, minimum, maximum) {
const span = maximum - minimum;
const period = span * 2;
const normalized = ((value - minimum) % period + period) % period;
return normalized <= span ? minimum + normalized : maximum - (normalized - span);
}
export function playerLabels(mode) {
if (mode === GAME_MODES.PLAYER_VS_PLAYER) return ["Joueur 1", "Joueur 2"];
if (mode === GAME_MODES.AI_VS_AI) return ["IA 1", "IA 2"];
return ["Joueur", "IA"];
}
export class PongGame {
constructor(options = {}) {
this.config = { ...DEFAULT_CONFIG, ...options };
this.random = options.random || Math.random;
this.mode = GAME_MODES.PLAYER_VS_AI;
this.difficulty = "normal";
this.winningScore = 10;
this.events = [];
this.ai = {
left: { target: this.config.height / 2, elapsed: 0 },
right: { target: this.config.height / 2, elapsed: 0 }
};
this.newGame();
}
newGame() {
const c = this.config;
this.state = {
running: false,
countdown: c.serveDelay,
serveDirection: this.random() < 0.5 ? -1 : 1,
winner: null,
rally: 0,
leftScore: 0,
rightScore: 0,
leftY: (c.height - c.paddleHeight) / 2,
rightY: (c.height - c.paddleHeight) / 2,
ballX: c.width / 2,
ballY: c.height / 2,
ballVX: 0,
ballVY: 0
};
this.resetAI();
this.emit("reset");
}
setMode(mode) {
if (!Object.values(GAME_MODES).includes(mode)) return;
this.mode = mode;
this.newGame();
}
setDifficulty(difficulty) {
if (!DIFFICULTIES[difficulty]) return;
this.difficulty = difficulty;
this.resetAI();
}
setWinningScore(score) {
const parsed = Number(score);
if (!Number.isInteger(parsed) || parsed < 1) return;
this.winningScore = parsed;
this.newGame();
}
play() {
if (this.state.winner) this.newGame();
this.state.running = true;
this.emit("play");
}
pause() {
if (!this.state.running) return;
this.state.running = false;
this.emit("pause");
}
togglePause() {
if (this.state.running) this.pause();
else this.play();
}
update(deltaSeconds, input = {}) {
if (!this.state.running || this.state.winner) return;
const delta = Math.min(Math.max(deltaSeconds, 0), 0.05);
this.updatePaddles(delta, input);
if (this.state.countdown > 0) {
this.state.countdown = Math.max(0, this.state.countdown - delta);
if (this.state.countdown === 0) this.launchBall();
return;
}
this.updateBall(delta);
}
updatePaddles(delta, input) {
const leftHuman = this.mode !== GAME_MODES.AI_VS_AI;
const rightHuman = this.mode === GAME_MODES.PLAYER_VS_PLAYER;
if (leftHuman) {
const up = this.mode === GAME_MODES.PLAYER_VS_AI ? input.rightUp : input.leftUp;
const down = this.mode === GAME_MODES.PLAYER_VS_AI ? input.rightDown : input.leftDown;
this.moveHuman("left", delta, up, down, input.leftTarget);
} else {
this.updateAI("left", delta);
}
if (rightHuman) {
this.moveHuman("right", delta, input.rightUp, input.rightDown, input.rightTarget);
} else {
this.updateAI("right", delta);
}
this.clampPaddles();
}
moveHuman(side, delta, up, down, target) {
const key = side === "left" ? "leftY" : "rightY";
const current = this.state[key];
const maxStep = this.config.paddleSpeed * delta;
if (Number.isFinite(target)) {
const desired = target - this.config.paddleHeight / 2;
this.state[key] += Math.max(-maxStep, Math.min(maxStep, desired - current));
return;
}
this.state[key] += ((down ? 1 : 0) - (up ? 1 : 0)) * maxStep;
}
updateAI(side, delta) {
const profile = DIFFICULTIES[this.difficulty];
const ai = this.ai[side];
const movingToward = side === "left" ? this.state.ballVX < 0 : this.state.ballVX > 0;
ai.elapsed += delta;
if (ai.elapsed >= profile.reaction) {
ai.elapsed = 0;
const error = (this.random() * 2 - 1) * profile.error;
ai.target = movingToward ? this.predictBallY(side) + error : this.config.height / 2;
}
const key = side === "left" ? "leftY" : "rightY";
const center = this.state[key] + this.config.paddleHeight / 2;
const difference = ai.target - center;
const step = Math.min(Math.abs(difference), profile.speed * delta);
if (Math.abs(difference) > 5) this.state[key] += Math.sign(difference) * step;
}
predictBallY(side) {
const c = this.config;
const targetX = side === "left" ? c.paddleWidth + c.ballRadius : c.width - c.paddleWidth - c.ballRadius;
if (this.state.ballVX === 0) return c.height / 2;
const time = (targetX - this.state.ballX) / this.state.ballVX;
if (time < 0) return c.height / 2;
const predicted = this.state.ballY + this.state.ballVY * time;
return reflectPosition(predicted, c.ballRadius, c.height - c.ballRadius);
}
updateBall(delta) {
const c = this.config;
const travel = Math.max(Math.abs(this.state.ballVX), Math.abs(this.state.ballVY)) * delta;
const steps = Math.max(1, Math.ceil(travel / c.ballRadius));
const stepDelta = delta / steps;
for (let index = 0; index < steps; index += 1) {
this.state.ballX += this.state.ballVX * stepDelta;
this.state.ballY += this.state.ballVY * stepDelta;
this.resolveWalls();
this.resolvePaddles();
if (this.resolvePoint()) break;
}
}
resolveWalls() {
const c = this.config;
if (this.state.ballY - c.ballRadius <= 0 && this.state.ballVY < 0) {
this.state.ballY = c.ballRadius;
this.state.ballVY = Math.abs(this.state.ballVY);
this.emit("wall");
} else if (this.state.ballY + c.ballRadius >= c.height && this.state.ballVY > 0) {
this.state.ballY = c.height - c.ballRadius;
this.state.ballVY = -Math.abs(this.state.ballVY);
this.emit("wall");
}
}
resolvePaddles() {
const c = this.config;
const s = this.state;
const leftHit = s.ballVX < 0 &&
s.ballX - c.ballRadius <= c.paddleWidth &&
s.ballX + c.ballRadius >= 0 &&
s.ballY + c.ballRadius >= s.leftY &&
s.ballY - c.ballRadius <= s.leftY + c.paddleHeight;
const rightX = c.width - c.paddleWidth;
const rightHit = s.ballVX > 0 &&
s.ballX + c.ballRadius >= rightX &&
s.ballX - c.ballRadius <= c.width &&
s.ballY + c.ballRadius >= s.rightY &&
s.ballY - c.ballRadius <= s.rightY + c.paddleHeight;
if (leftHit) this.bounceFromPaddle("left");
else if (rightHit) this.bounceFromPaddle("right");
}
bounceFromPaddle(side) {
const c = this.config;
const s = this.state;
const paddleY = side === "left" ? s.leftY : s.rightY;
const hit = Math.max(-1, Math.min(1, (s.ballY - (paddleY + c.paddleHeight / 2)) / (c.paddleHeight / 2)));
const horizontal = Math.min(Math.abs(s.ballVX) * c.speedIncrease, c.maxBallSpeed);
const vertical = hit * Math.max(c.minimumVerticalSpeed, horizontal * 0.72);
s.ballX = side === "left" ? c.paddleWidth + c.ballRadius : c.width - c.paddleWidth - c.ballRadius;
s.ballVX = side === "left" ? horizontal : -horizontal;
s.ballVY = Math.max(-c.maxBallSpeed, Math.min(c.maxBallSpeed, vertical));
s.rally += 1;
this.emit("paddle");
}
resolvePoint() {
const c = this.config;
if (this.state.ballX + c.ballRadius < 0) {
this.scorePoint("right");
return true;
}
if (this.state.ballX - c.ballRadius > c.width) {
this.scorePoint("left");
return true;
}
return false;
}
scorePoint(side) {
const scoreKey = side === "left" ? "leftScore" : "rightScore";
this.state[scoreKey] += 1;
this.emit("score", { side, leftScore: this.state.leftScore, rightScore: this.state.rightScore });
if (this.state[scoreKey] >= this.winningScore) {
this.state.winner = side;
this.state.running = false;
this.state.countdown = 0;
this.state.ballVX = 0;
this.state.ballVY = 0;
this.emit("win", { side });
return;
}
this.prepareServe(side === "left" ? 1 : -1);
}
prepareServe(direction) {
const c = this.config;
this.state.ballX = c.width / 2;
this.state.ballY = c.height / 2;
this.state.ballVX = 0;
this.state.ballVY = 0;
this.state.rally = 0;
this.state.serveDirection = direction;
this.state.countdown = c.serveDelay;
}
launchBall() {
const c = this.config;
const verticalSign = this.random() < 0.5 ? -1 : 1;
const verticalRatio = 0.28 + this.random() * 0.22;
this.state.ballVX = c.initialBallSpeed * this.state.serveDirection;
this.state.ballVY = c.initialBallSpeed * verticalRatio * verticalSign;
this.emit("serve");
}
clampPaddles() {
const maximum = this.config.height - this.config.paddleHeight;
this.state.leftY = Math.max(0, Math.min(maximum, this.state.leftY));
this.state.rightY = Math.max(0, Math.min(maximum, this.state.rightY));
}
resetAI() {
this.ai.left = { target: this.config.height / 2, elapsed: 0 };
this.ai.right = { target: this.config.height / 2, elapsed: 0 };
}
emit(type, detail = {}) {
this.events.push({ type, ...detail });
}
consumeEvents() {
return this.events.splice(0);
}
}