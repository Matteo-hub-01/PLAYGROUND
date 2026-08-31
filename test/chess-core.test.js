import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseAIMove,
  createInitialState,
  generateLegalMoves,
  getGameStatus,
  makeMove,
  squareToIndex,
  stateFrom,
} from "../js/chess-core.js";

const play=(state,from,to,promotion)=>{
  const move=generateLegalMoves(state).find(candidate=>candidate.from===squareToIndex(from)&&candidate.to===squareToIndex(to)&&(!promotion||candidate.promotion===promotion));
  assert.ok(move,`coup légal attendu : ${from}-${to}`);
  return makeMove(state,move);
};

test("la position initiale propose 20 coups légaux",()=>{
  assert.equal(generateLegalMoves(createInitialState()).length,20);
});

test("le roque déplace aussi la tour",()=>{
  const state=stateFrom({board:["....k...","........","........","........","........","........","........","....K..R"],turn:"w",castling:{K:true,Q:false,k:false,q:false}});
  const after=play(state,"e1","g1");
  assert.equal(after.board[squareToIndex("g1")],"K");
  assert.equal(after.board[squareToIndex("f1")],"R");
});

test("la prise en passant est appliquée",()=>{
  let state=createInitialState();
  state=play(state,"e2","e4"); state=play(state,"a7","a6");
  state=play(state,"e4","e5"); state=play(state,"d7","d5");
  state=play(state,"e5","d6");
  assert.equal(state.board[squareToIndex("d5")],null);
  assert.equal(state.board[squareToIndex("d6")],"P");
});

test("un pion peut être promu",()=>{
  const state=stateFrom({board:["....k...","P.......","........","........","........","........","........","....K..."],turn:"w"});
  const after=play(state,"a7","a8","q");
  assert.equal(after.board[squareToIndex("a8")],"Q");
});

test("le mat du sot est détecté",()=>{
  let state=createInitialState();
  state=play(state,"f2","f3"); state=play(state,"e7","e5");
  state=play(state,"g2","g4"); state=play(state,"d8","h4");
  const status=getGameStatus(state);
  assert.equal(status.over,true); assert.equal(status.reason,"checkmate"); assert.equal(status.winner,"b");
});

test("le pat et le matériel insuffisant sont détectés",()=>{
  const stalemate=stateFrom({board:["k.......","..Q.....","..K.....","........","........","........","........","........"],turn:"b"});
  assert.equal(getGameStatus(stalemate).reason,"stalemate");
  const kings=stateFrom({board:["....k...","........","........","........","........","........","........","....K..."],turn:"w"});
  assert.equal(getGameStatus(kings).reason,"insufficient");
});

test("l’IA choisit toujours un coup légal",()=>{
  const state=createInitialState();
  const legal=generateLegalMoves(state);
  const move=chooseAIMove(state,1);
  assert.ok(legal.some(candidate=>candidate.from===move.from&&candidate.to===move.to));
});
