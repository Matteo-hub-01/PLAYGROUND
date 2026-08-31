import test from "node:test";
import assert from "node:assert/strict";
import { ARENAS, CHARACTERS, ARENA_MODES, ArenaGame } from "../js/arena-core.js";

const fixed=(value=.5)=>new ArenaGame({random:()=>value});
function start(game){game.setMode(ARENA_MODES.PLAYER_VS_PLAYER);game.state.running=true;game.state.countdown=0}
function prepareHit(game,charge=.02,airborne=false){
  const[a,b]=game.state.players;a.x=300;b.x=airborne?310:348;a.y=airborne?350:407;b.y=407;a.facing=1;a.grounded=!airborne;
  a.charging=true;a.chargeTime=charge;game.executeAttack(a);game.resolveAttacks();return[a,b];
}

test("le saut, le double saut directionnel et la récupération sont disponibles",()=>{
  const game=fixed();start(game);const p=game.state.players[0];
  game.update(.01,[{jumpPressed:true},{}]);game.update(.01,[{right:true,jumpPressed:true},{}]);
  assert.equal(p.jumpsRemaining,0);assert.ok(p.vx>350);
  game.update(.01,[{left:true,jumpPressed:true},{}]);
  assert.equal(p.recoveryAvailable,false);assert.ok(p.vy<0);assert.ok(p.vx<0);
});

test("le coyote time autorise un saut juste après le bord",()=>{
  const game=fixed();start(game);const p=game.state.players[0];
  p.grounded=false;p.standingPlatform=null;p.coyoteTimer=.05;p.jumpsRemaining=2;
  game.update(.01,[{jumpPressed:true},{}]);assert.ok(p.vy<0);assert.equal(p.jumpsRemaining,1);
});

test("la mémorisation du saut le déclenche après l’atterrissage",()=>{
  const game=fixed();start(game);const p=game.state.players[0],platform=game.state.platforms[0];
  p.x=300;p.y=platform.y-p.height-2;p.vy=100;p.grounded=false;p.jumpsRemaining=0;p.recoveryAvailable=false;
  game.update(.03,[{jumpPressed:true},{}]);assert.ok(p.vy<0);assert.equal(p.grounded,false);
});

test("une attaque rapide ajoute des dégâts et projette",()=>{
  const game=fixed();start(game);const[a,b]=prepareHit(game);
  assert.equal(a.attackType,"normal");assert.ok(b.damage>=8);assert.ok(b.vx>390);
  assert.equal(a.stats.hits,1);assert.ok(game.state.hitstop>0);
});

test("une attaque chargée frappe plus fort qu’une attaque rapide",()=>{
  const quick=fixed(),charged=fixed();start(quick);start(charged);
  const[,quickTarget]=prepareHit(quick,.02);const[,chargedTarget]=prepareHit(charged,.7);
  assert.ok(chargedTarget.damage>quickTarget.damage);assert.ok(chargedTarget.vx>quickTarget.vx);
});

test("une attaque aérienne devient une attaque plongeante",()=>{
  const game=fixed();start(game);const[a,b]=prepareHit(game,.05,true);
  assert.equal(a.attackType,"slam");assert.ok(b.damage>=14);assert.ok(b.vy>0);
});

test("le dash offre une esquive temporaire avec recharge",()=>{
  const game=fixed();start(game);const p=game.state.players[0];
  game.update(.01,[{right:true,dashPressed:true},{}]);
  assert.ok(p.dashTimer>0);assert.ok(p.dashCooldown>0);assert.ok(p.vx>450);assert.equal(p.stats.dodges,1);
});

test("un personnage protégé ou en dash ne peut pas être touché",()=>{
  const protectedGame=fixed();start(protectedGame);protectedGame.state.players[1].spawnProtected=true;
  const[a,b]=prepareHit(protectedGame);assert.equal(a.attackHit,false);assert.equal(b.damage,0);
  b.spawnProtected=false;b.dashTimer=.1;a.attackHit=false;a.attackTimer=.1;protectedGame.resolveAttacks();assert.equal(b.damage,0);
});

test("les personnages possèdent des caractéristiques distinctes",()=>{
  const game=fixed();game.setCharacter(0,"swift");game.setCharacter(1,"heavy");
  assert.ok(game.state.players[0].traits.speed>1);assert.ok(game.state.players[1].traits.weight>1);
  assert.ok(game.state.players[1].traits.attack>game.state.players[0].traits.attack);
});

test("les trois arènes créent des configurations différentes",()=>{
  const game=fixed();game.setArena("classic");assert.equal(game.state.platforms.length,1);
  game.setArena("islands");assert.equal(game.state.platforms.length,2);
  game.setArena("motion");assert.equal(game.state.platforms.some(p=>p.kind==="move"),true);
  const moving=game.state.platforms.find(p=>p.kind==="move"),before=moving.x;game.state.time=1;game.updatePlatforms();assert.notEqual(moving.x,before);
  game.state.time=3.5;game.updatePlatforms();assert.equal(game.state.platforms.find(p=>p.kind==="pulse").active,false);
});

test("les bonus bouclier, puissance et saut appliquent leurs effets",()=>{
  const game=fixed();start(game);const p=game.state.players[0];
  for(const type of["shield","boost","jump"]){game.collectItem(p,{type})}
  assert.equal(p.shieldHits,1);assert.ok(p.attackBoostTimer>0);assert.equal(p.recoveryAvailable,true);
});

test("une chute retire une vie et réapparaît au-dessus d’une plateforme",()=>{
  const game=fixed();start(game);const p=game.state.players[0];p.damage=120;p.y=700;game.update(.01,[{},{}]);
  assert.deepEqual(game.state.lives,[2,3]);assert.equal(p.spawnProtected,true);assert.equal(p.damage,0);assert.equal(p.grounded,false);
  assert.ok(game.state.platforms.some(platform=>p.x>=platform.x&&p.x<=platform.x+platform.width));
});

test("la protection de réapparition disparaît à l’atterrissage",()=>{
  const game=fixed();start(game);const p=game.state.players[0],platform=game.state.platforms[0];game.respawnPlayer(p);
  p.x=platform.x+50;p.y=platform.y-p.height-2;p.vy=100;game.update(.02,[{},{}]);
  assert.equal(p.grounded,true);assert.equal(p.spawnProtected,false);
  assert.equal(game.consumeEvents().some(event=>event.type==="respawn-ready"),true);
});

test("la troisième chute termine la partie",()=>{
  const game=fixed();start(game);for(let i=0;i<3;i++){game.state.players[0].y=700;game.update(.01,[{},{}])}
  assert.deepEqual(game.state.lives,[0,3]);assert.equal(game.state.winner,1);assert.equal(game.state.running,false);
});

test("l’IA choisit une esquive face à une attaque imminente",()=>{
  const game=new ArenaGame({random:()=>.1});game.setMode(ARENA_MODES.PLAYER_VS_AI);
  const[a,b]=game.state.players;a.x=350;a.facing=1;a.attackTimer=.1;b.x=405;
  const controls=game.updateAI(1,.2);assert.equal(controls.right,true);
  assert.equal(Boolean(controls.jumpPressed||controls.dashPressed),true);
});

test("le compte à rebours et les trois modes sont conservés",()=>{
  const game=fixed();assert.equal(game.state.countdown,3);
  for(const mode of Object.values(ARENA_MODES)){game.setMode(mode);assert.equal(game.mode,mode)}
});
test("les nouveaux combattants et la zone instable sont disponibles",()=>{assert.ok(CHARACTERS.aerial);assert.ok(CHARACTERS.brawler);assert.ok(ARENAS.chaos);const game=new ArenaGame();game.setArena("chaos");assert.equal(game.state.platforms.length,3)});
test("les huit combattants possèdent des attaques uniques",()=>{
  assert.equal(Object.keys(CHARACTERS).length,8);
  assert.equal(new Set(Object.values(CHARACTERS).map(character=>character.special)).size,8);
  for(const id of["ember","volt","nova"]){assert.ok(CHARACTERS[id].attackName);assert.ok(CHARACTERS[id].description);assert.ok(CHARACTERS[id].accent)}
});

test("Braise attaque à longue portée et brûle sa cible",()=>{
  const game=fixed();game.setCharacters(["ember","balanced"]);start(game);const[a,b]=game.state.players;
  a.x=280;a.y=407;a.grounded=true;a.facing=1;b.x=390;b.y=407;a.charging=true;a.chargeTime=.02;game.executeAttack(a);game.resolveAttacks();
  assert.equal(a.attackStyle,"firewave");assert.ok(b.damage>8);assert.ok(b.burnTimer>0);
});

test("Volt bondit pendant sa charge éclair",()=>{
  const game=fixed();game.setCharacters(["volt","balanced"]);start(game);const p=game.state.players[0];p.grounded=true;p.vx=0;p.facing=1;p.charging=true;p.chargeTime=.02;game.executeAttack(p);
  assert.equal(p.attackStyle,"rush");assert.ok(p.vx>=180);assert.ok(p.attackCooldown<.42);
});

test("Nova frappe aussi un adversaire placé derrière lui",()=>{
  const game=fixed();game.setCharacters(["nova","balanced"]);start(game);const[a,b]=game.state.players;
  a.x=350;a.y=407;a.grounded=true;a.facing=1;b.x=300;b.y=407;a.charging=true;a.chargeTime=.02;game.executeAttack(a);game.resolveAttacks();
  assert.equal(a.attackStyle,"gravity");assert.ok(b.damage>0);assert.ok(b.vx<0);
});

test("le tirage IA est aléatoire et peut exclure le combattant adverse",()=>{
  const game=new ArenaGame({random:()=>.999});assert.equal(game.randomCharacter(),"nova");assert.equal(game.randomCharacter(["nova"]),"volt");
});