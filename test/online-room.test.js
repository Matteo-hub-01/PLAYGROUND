import test from "node:test";
import assert from "node:assert/strict";
import {NetworkStateSmoother} from "../js/online-room.js";

test("les positions réseau sont interpolées entre deux instantanés",()=>{
  const smoother=new NetworkStateSmoother({response:.1});
  smoother.push({ballX:100,ballY:200,leftScore:0,running:true});
  smoother.push({ballX:200,ballY:300,leftScore:1,running:false});
  const state=smoother.update(.05);
  assert.ok(state.ballX>100&&state.ballX<200);
  assert.ok(state.ballY>200&&state.ballY<300);
  assert.equal(state.leftScore,1);
  assert.equal(state.running,false);
});

test("une téléportation importante est appliquée sans traînée",()=>{
  const smoother=new NetworkStateSmoother({snapDistance:100});
  smoother.push({players:[{x:10,y:10}]});
  smoother.push({players:[{x:400,y:500}]});
  assert.deepEqual(smoother.update(.016).players,[{x:400,y:500}]);
});
