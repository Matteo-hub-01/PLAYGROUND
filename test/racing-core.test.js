import test from "node:test";
import assert from "node:assert/strict";
import {createRaceState,humanCarIds,RACE_MODES,updateRace} from "../js/racing-core.js";

test("la course démarre avec un compte à rebours de trois secondes",()=>{
  const state=createRaceState();state.running=true;for(let i=0;i<50;i++)updateRace(state,.02,[{accelerate:true}]);
  assert.ok(Math.abs(state.countdown-2)<1e-9);assert.equal(state.cars[0].speed,0);
});
test("la voiture accélère et peut tourner après le départ",()=>{
  const state=createRaceState();state.running=true;state.countdown=0;const before=state.cars[0].x;
  updateRace(state,.1,[{accelerate:true,right:true}]);assert.ok(state.cars[0].speed>0);assert.ok(state.cars[0].x>before);
});
test("sortir de la route ralentit la voiture",()=>{
  const road=createRaceState(),grass=createRaceState();for(const state of[road,grass]){state.running=true;state.countdown=0;state.cars[0].speed=300}grass.cars[0].x=1.2;
  updateRace(road,.05,[{}]);updateRace(grass,.05,[{}]);assert.ok(grass.cars[0].speed<road.cars[0].speed);
});
test("les IA avancent et suivent la piste",()=>{
  const state=createRaceState();state.mode=RACE_MODES.AI_VS_AI;state.running=true;state.countdown=0;
  for(let i=0;i<60;i++)updateRace(state,1/60,[]);assert.ok(state.cars.every(car=>car.distance>-car.id*55));
});
test("le premier à terminer les tours gagne",()=>{
  const state=createRaceState({laps:1});state.running=true;state.countdown=0;state.cars[0].distance=state.config.trackLength-2;state.cars[0].speed=300;
  updateRace(state,.05,[{accelerate:true}]);assert.equal(state.winner,0);assert.equal(state.cars[0].finished,true);
});
test("les trois modes attribuent correctement les voitures humaines",()=>{
  assert.deepEqual(humanCarIds(RACE_MODES.PLAYER_VS_AI),[0]);assert.deepEqual(humanCarIds(RACE_MODES.PLAYER_VS_PLAYER),[0,1]);assert.deepEqual(humanCarIds(RACE_MODES.AI_VS_AI),[]);
});

test("un drift au frein à main produit un angle, un combo et des points",()=>{const state=createRaceState();state.running=true;state.countdown=0;state.cars[0].speed=260;for(let i=0;i<16;i++)updateRace(state,.05,[{right:true,accelerate:true,handbrake:true}]);assert.ok(state.cars[0].drift>.2);assert.ok(state.cars[0].combo>1);assert.ok(state.cars[0].driftScore>0)});