import test from "node:test";
import assert from "node:assert/strict";
import { GAME_MODES, PongGame, reflectPosition } from "../js/game-core.js";

function gameWithFixedRandom(value = 0.75) {
  return new PongGame({ random: () => value });
}

test("reflectPosition reproduit les rebonds sur les deux murs", () => {
  assert.equal(reflectPosition(650, 10, 590), 530);
  assert.equal(reflectPosition(-30, 10, 590), 50);
  assert.equal(reflectPosition(300, 10, 590), 300);
});

test("la trajectoire est indépendante du nombre de frames", () => {
  const oneFrame = gameWithFixedRandom();
  const twoFrames = gameWithFixedRandom();

  for (const game of [oneFrame, twoFrames]) {
    game.state.running = true;
    game.state.countdown = 0;
    game.state.ballX = 400;
    game.state.ballY = 300;
    game.state.ballVX = 300;
    game.state.ballVY = 100;
  }

  oneFrame.update(0.02);
  twoFrames.update(0.01);
  twoFrames.update(0.01);

  assert.ok(Math.abs(oneFrame.state.ballX - twoFrames.state.ballX) < 1e-9);
  assert.ok(Math.abs(oneFrame.state.ballY - twoFrames.state.ballY) < 1e-9);
});

test("une balle rapide rebondit sur la raquette sans la traverser", () => {
  const game = gameWithFixedRandom();
  game.setMode(GAME_MODES.PLAYER_VS_PLAYER);
  game.state.running = true;
  game.state.countdown = 0;
  game.state.ballX = 38;
  game.state.ballY = game.state.leftY + game.config.paddleHeight / 2;
  game.state.ballVX = -850;
  game.state.ballVY = 0;

  game.update(0.05);

  assert.ok(game.state.ballVX > 0);
  assert.equal(game.state.rally, 1);
  assert.ok(game.state.ballX >= game.config.paddleWidth + game.config.ballRadius);
});

test("la balle rebondit sur le mur supérieur", () => {
  const game = gameWithFixedRandom();
  game.state.running = true;
  game.state.countdown = 0;
  game.state.ballY = 12;
  game.state.ballVX = 200;
  game.state.ballVY = -300;

  game.update(0.02);

  assert.ok(game.state.ballVY > 0);
  assert.ok(game.state.ballY >= game.config.ballRadius);
});

test("le score gagnant arrête la partie et désigne le vainqueur", () => {
  const game = gameWithFixedRandom();
  game.setWinningScore(2);
  game.state.running = true;
  game.state.leftScore = 1;

  game.scorePoint("left");

  assert.equal(game.state.leftScore, 2);
  assert.equal(game.state.winner, "left");
  assert.equal(game.state.running, false);
});

test("une nouvelle partie remet scores et raquettes à zéro", () => {
  const game = gameWithFixedRandom();
  game.state.leftScore = 7;
  game.state.rightY = 12;
  game.state.winner = "left";

  game.newGame();

  assert.equal(game.state.leftScore, 0);
  assert.equal(game.state.rightScore, 0);
  assert.equal(game.state.winner, null);
  assert.equal(game.state.rightY, (game.config.height - game.config.paddleHeight) / 2);
});

test("la prédiction de l’IA tient compte des rebonds futurs", () => {
  const game = gameWithFixedRandom();
  game.state.ballX = 400;
  game.state.ballY = 560;
  game.state.ballVX = 200;
  game.state.ballVY = 240;

  const prediction = game.predictBallY("right");

  assert.ok(prediction >= game.config.ballRadius);
  assert.ok(prediction <= game.config.height - game.config.ballRadius);
});

test("les raquettes restent dans le terrain", () => {
  const game = gameWithFixedRandom();
  game.state.leftY = -100;
  game.state.rightY = 900;
  game.clampPaddles();

  assert.equal(game.state.leftY, 0);
  assert.equal(game.state.rightY, game.config.height - game.config.paddleHeight);
});
