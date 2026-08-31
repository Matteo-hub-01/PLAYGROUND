export const ARENA_MODES=Object.freeze({PLAYER_VS_AI:"player-vs-ai",PLAYER_VS_PLAYER:"player-vs-player",AI_VS_AI:"ai-vs-ai"});
export const AI_LEVELS=Object.freeze({
  easy:Object.freeze({reaction:.2,aggression:.45,recovery:.62,evasion:.4,aerial:.2,patience:.3}),
  normal:Object.freeze({reaction:.1,aggression:.7,recovery:.82,evasion:.72,aerial:.46,patience:.17}),
  hard:Object.freeze({reaction:.05,aggression:.93,recovery:.98,evasion:.94,aerial:.72,patience:.07})
});
export const CHARACTERS=Object.freeze({
  balanced:Object.freeze({name:"Équilibré",speed:1,weight:1,jump:1,attack:1,shape:"round",special:"strike",attackName:"Onde franche",description:"Un coup fiable, précis et polyvalent.",accent:"#ffd166",range:1,damage:1,knockback:1,cooldown:1}),
  swift:Object.freeze({name:"Rapide",speed:1.18,weight:.82,jump:1.08,attack:.88,shape:"slim",special:"flurry",attackName:"Rafale vive",description:"Une attaque courte qui revient très vite.",accent:"#70f0c0",range:.88,damage:.76,knockback:.8,cooldown:.7,duration:.78}),
  heavy:Object.freeze({name:"Lourd",speed:.84,weight:1.32,jump:.9,attack:1.22,shape:"wide",special:"hammer",attackName:"Marteau sismique",description:"Lent, mais dévastateur au contact.",accent:"#ff8b66",range:1.04,damage:1.28,knockback:1.28,cooldown:1.28,duration:1.3}),
  aerial:Object.freeze({name:"Voltigeur",speed:1.08,weight:.84,jump:1.28,attack:.9,shape:"winged",special:"cyclone",attackName:"Cyclone plongeant",description:"Son attaque aérienne couvre une large zone.",accent:"#75baff",range:1.12,damage:.9,knockback:.92,cooldown:.9,aerial:1.5}),
  brawler:Object.freeze({name:"Cogneur",speed:.94,weight:1.14,jump:.96,attack:1.14,shape:"gloves",special:"uppercut",attackName:"Uppercut météore",description:"Projette surtout les adversaires vers le haut.",accent:"#ff6f91",range:.92,damage:1.06,knockback:1.08,cooldown:.96,vertical:1.55}),
  ember:Object.freeze({name:"Braise",speed:1.01,weight:.96,jump:1.02,attack:1.02,shape:"flame",special:"firewave",attackName:"Vague de feu",description:"Une flamme longue portée qui brûle sa cible.",accent:"#ff9f43",range:1.55,damage:.96,knockback:.88,cooldown:1.08,burn:5}),
  volt:Object.freeze({name:"Volt",speed:1.14,weight:.88,jump:1.08,attack:.94,shape:"spark",special:"rush",attackName:"Charge éclair",description:"Fonce vers l'avant pendant son attaque.",accent:"#55dcff",range:1.18,damage:.88,knockback:1.02,cooldown:.74,lunge:185}),
  nova:Object.freeze({name:"Nova",speed:.96,weight:1.04,jump:1.05,attack:1,shape:"orbital",special:"gravity",attackName:"Impulsion gravité",description:"Une onde circulaire frappe dans les deux directions.",accent:"#b58cff",range:1.28,damage:.9,knockback:1.08,cooldown:1.16,vertical:1.3,radial:true})
});
export const ARENAS=Object.freeze({
  classic:Object.freeze({name:"Classique"}),
  islands:Object.freeze({name:"Îlots célestes"}),
  motion:Object.freeze({name:"Plateformes mouvantes"}),
  chaos:Object.freeze({name:"Zone instable"})
});
export const ARENA_CONFIG=Object.freeze({
  width:800,height:600,playerWidth:34,playerHeight:48,moveSpeed:255,groundAcceleration:2100,
  airAcceleration:980,friction:1900,gravity:1280,firstJumpSpeed:475,secondJumpSpeed:430,
  directionalJumpSpeed:390,recoveryJumpSpeed:355,dashSpeed:500,dashDuration:.16,dashCooldown:.85,
  attackRange:60,attackCooldown:.42,attackDuration:.14,pushForce:390,serveDelay:3,startingLives:3,
  coyoteTime:.11,jumpBufferTime:.13,itemInterval:7
});
export function arenaLabels(mode){
  if(mode===ARENA_MODES.PLAYER_VS_PLAYER)return["Joueur 1","Joueur 2"];
  if(mode===ARENA_MODES.AI_VS_AI)return["IA 1","IA 2"];
  return["Joueur","IA"];
}
const approach=(value,target,amount)=>value<target?Math.min(value+amount,target):Math.max(value-amount,target);
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export class ArenaGame{
  constructor(options={}){
    this.config={...ARENA_CONFIG,...options};this.random=options.random||Math.random;
    this.mode=ARENA_MODES.PLAYER_VS_AI;this.difficulty="normal";this.arena="classic";
    this.characters=["balanced","balanced"];this.itemsEnabled=false;this.events=[];
    this.ai=[this.createAI(),this.createAI()];this.newRound();
  }
  createAI(){return{elapsed:0,jumpCooldown:0,attackCooldown:0,chargeTimer:0,controls:{}}}
  createStats(){return{attacks:0,hits:0,dodges:0,falls:0,airtime:0,maxDamage:0}}
  createPlayer(id,x,facing,color){
    const c=this.config,type=this.characters[id],traits=CHARACTERS[type];
    return{id,type,traits,x,y:400,width:c.playerWidth*(type==="heavy"?1.13:type==="swift"?.88:1),
      height:c.playerHeight,vx:0,vy:0,facing,color,grounded:false,standingPlatform:null,
      jumpsRemaining:2,recoveryAvailable:true,coyoteTimer:0,jumpBuffer:0,attackTimer:0,
      attackCooldown:0,attackHit:false,attackType:"normal",attackStyle:traits.special,attackPower:1,charging:false,
      chargeTime:0,dashTimer:0,dashCooldown:0,stunTimer:0,burnTimer:0,spawnProtected:false,
      damage:0,shieldHits:0,attackBoostTimer:0,stats:this.createStats()};
  }
  platformsForArena(){
    if(this.arena==="islands")return[
      {id:"left",x:65,y:460,width:220,height:24,kind:"static",active:true},
      {id:"right",x:515,y:460,width:220,height:24,kind:"static",active:true}
    ];
    if(this.arena==="chaos")return[{id:"left-pulse",x:70,y:455,width:210,height:22,kind:"pulse",active:true},{id:"center-move",x:315,y:370,width:170,height:20,kind:"move",baseX:315,phase:1.5,active:true},{id:"right",x:535,y:455,width:195,height:22,kind:"static",active:true}];
    if(this.arena==="motion")return[
      {id:"main",x:180,y:465,width:440,height:25,kind:"static",active:true},
      {id:"move",x:80,y:350,width:175,height:20,kind:"move",baseX:80,phase:0,active:true},
      {id:"pulse",x:550,y:330,width:170,height:20,kind:"pulse",active:true}
    ];
    return[{id:"main",x:105,y:455,width:590,height:26,kind:"static",active:true}];
  }
  newRound(){
    const c=this.config;this.state={running:false,countdown:c.serveDelay,winner:null,
      lives:[c.startingLives,c.startingLives],time:0,hitstop:0,items:[],itemTimer:c.itemInterval,
      platforms:this.platformsForArena(),players:[]};
    this.resetFighters();this.emit("reset");
  }
  resetFighters(){
    const c=this.config;this.state.players=[
      this.createPlayer(0,c.width*.31,1,"#79f2c0"),this.createPlayer(1,c.width*.69-c.playerWidth,-1,"#ff7a90")
    ];
    const startPlatform=this.state.platforms.find(p=>p.active);
    for(const player of this.state.players){player.y=startPlatform.y-player.height;player.grounded=true;player.standingPlatform=startPlatform.id}
    this.ai=[this.createAI(),this.createAI()];
  }
  setMode(value){if(Object.values(ARENA_MODES).includes(value)){this.mode=value;this.newRound()}}
  setDifficulty(value){if(AI_LEVELS[value]){this.difficulty=value;this.ai=[this.createAI(),this.createAI()]}}
  setCharacter(index,value){if(CHARACTERS[value]&&(index===0||index===1)){this.characters[index]=value;this.newRound()}}
  setCharacters(values){if(!Array.isArray(values)||values.length!==2||values.some(value=>!CHARACTERS[value]))return false;this.characters=[...values];this.newRound();return true}
  randomCharacter(excluded=[]){const blocked=new Set(Array.isArray(excluded)?excluded:[excluded]),available=Object.keys(CHARACTERS).filter(key=>!blocked.has(key)),pool=available.length?available:Object.keys(CHARACTERS);return pool[Math.floor(this.random()*pool.length)]}
  setArena(value){if(ARENAS[value]){this.arena=value;this.newRound()}}
  setItemsEnabled(value){this.itemsEnabled=Boolean(value);this.state.items=[];this.state.itemTimer=this.config.itemInterval}
  play(){if(this.state.winner!==null)this.newRound();this.state.running=true;this.emit("play")}
  pause(){if(this.state.running){this.state.running=false;this.emit("pause")}}
  togglePause(){this.state.running?this.pause():this.play()}
  update(deltaSeconds,humanInputs=[{},{}]){
    if(!this.state.running||this.state.winner!==null)return;
    let delta=clamp(deltaSeconds,0,.05);
    if(this.state.hitstop>0){this.state.hitstop=Math.max(0,this.state.hitstop-delta);return}
    this.state.time+=delta;this.updatePlatforms(delta);
    if(this.state.countdown>0){this.state.countdown=Math.max(0,this.state.countdown-delta);if(this.state.countdown===0)this.emit("start");return}
    const steps=Math.max(1,Math.ceil(delta/(1/120))),stepDelta=delta/steps;
    for(let step=0;step<steps;step++){
      const controls=this.getControls(humanInputs,step===0,stepDelta);
      this.updatePlayer(this.state.players[0],controls[0],stepDelta);
      this.updatePlayer(this.state.players[1],controls[1],stepDelta);
      this.resolvePlayerCollision();this.resolveAttacks();this.updateItems(stepDelta);
      if(this.resolveFall())break;
    }
  }
  updatePlatforms(){
    for(const platform of this.state.platforms){
      const previousX=platform.x;
      if(platform.kind==="move")platform.x=platform.baseX+Math.sin(this.state.time*.85+platform.phase)*145;
      if(platform.kind==="pulse")platform.active=(this.state.time%4.5)<3;
      platform.dx=platform.x-previousX;
      if(platform.dx)for(const player of this.state.players)if(player.grounded&&player.standingPlatform===platform.id)player.x+=platform.dx;
      if(!platform.active)for(const player of this.state.players)if(player.standingPlatform===platform.id){player.grounded=false;player.standingPlatform=null}
    }
  }
  getControls(humanInputs,pressed,delta){
    const firstAI=this.mode===ARENA_MODES.AI_VS_AI,secondAI=this.mode!==ARENA_MODES.PLAYER_VS_PLAYER;
    return[firstAI?this.updateAI(0,delta):this.humanControls(humanInputs[0],pressed),
      secondAI?this.updateAI(1,delta):this.humanControls(humanInputs[1],pressed)];
  }
  humanControls(input={},pressed){return{left:Boolean(input.left),right:Boolean(input.right),attackHeld:Boolean(input.attackHeld),
    jumpPressed:pressed&&Boolean(input.jumpPressed),attackPressed:pressed&&Boolean(input.attackPressed),
    attackReleased:pressed&&Boolean(input.attackReleased),dashPressed:pressed&&Boolean(input.dashPressed)}}
  nearestPlatform(player){
    const cx=player.x+player.width/2,active=this.state.platforms.filter(p=>p.active);
    return active.sort((a,b)=>Math.abs(a.x+a.width/2-cx)-Math.abs(b.x+b.width/2-cx))[0];
  }
  updateAI(index,delta){
    const c=this.config,profile=AI_LEVELS[this.difficulty],ai=this.ai[index],p=this.state.players[index],o=this.state.players[1-index];
    ai.elapsed+=delta;ai.jumpCooldown=Math.max(0,ai.jumpCooldown-delta);ai.attackCooldown=Math.max(0,ai.attackCooldown-delta);
    if(ai.chargeTimer>0){ai.chargeTimer-=delta;if(ai.chargeTimer<=0)return{...ai.controls,attackHeld:false,attackReleased:true};return{...ai.controls,attackHeld:true,jumpPressed:false,attackPressed:false,dashPressed:false}}
    if(ai.elapsed<profile.reaction)return{...ai.controls,jumpPressed:false,attackPressed:false,attackReleased:false,dashPressed:false};
    ai.elapsed=0;const pc=p.x+p.width/2,oc=o.x+o.width/2,distance=oc-pc,platform=this.nearestPlatform(p);
    const outside=!p.grounded&&(pc<platform.x+15||pc>platform.x+platform.width-15),recover=outside&&this.random()<profile.recovery;
    const threat=o.attackTimer>0&&o.facing===Math.sign(pc-oc)&&Math.abs(distance)<c.attackRange+50;
    const cautious=this.state.lives[index]===1&&this.state.lives[1-index]>1;
    let direction=recover?Math.sign(platform.x+platform.width/2-pc):Math.sign(distance);
    if(threat||cautious&&Math.abs(distance)<100)direction=Math.sign(pc-oc);
    ai.controls={left:direction<0,right:direction>0,attackHeld:false,jumpPressed:false,attackPressed:false,attackReleased:false,dashPressed:false};
    if(recover&&p.jumpsRemaining===0&&p.recoveryAvailable||outside&&p.jumpsRemaining>0){ai.controls.jumpPressed=true;ai.jumpCooldown=.18}
    else if(threat&&this.random()<profile.evasion){
      if(p.grounded&&p.dashCooldown===0&&this.random()>.45)ai.controls.dashPressed=true;
      else if(p.jumpsRemaining>0&&ai.jumpCooldown===0){ai.controls.jumpPressed=true;ai.jumpCooldown=.2}
    }else if(p.grounded&&Math.abs(distance)<140&&this.random()<profile.aerial){ai.controls.jumpPressed=true;ai.jumpCooldown=.25}
    const preferredRange=c.attackRange*(p.traits.range||1)+25,close=Math.abs(distance)<preferredRange&&Math.abs(p.y-o.y)<p.height;
    if(close&&ai.attackCooldown===0&&this.random()<profile.aggression){
      ai.controls.attackPressed=true;ai.controls.attackHeld=true;ai.attackCooldown=c.attackCooldown;
      if(this.difficulty!=="easy"&&this.random()>.55)ai.chargeTimer=.2+this.random()*.35;
      else ai.controls.attackReleased=true;
    }
    if(this.itemsEnabled&&this.state.items.length&&Math.abs(distance)>120){
      const item=this.state.items[0],itemDirection=Math.sign(item.x-pc);ai.controls.left=itemDirection<0;ai.controls.right=itemDirection>0;
    }
    if(!recover&&!threat&&Math.abs(distance)>170&&this.random()<profile.patience)ai.controls.left=ai.controls.right=false;
    return ai.controls;
  }
  updatePlayer(p,controls,dt){
    const c=this.config,traits=p.traits;for(const key of["attackTimer","attackCooldown","dashTimer","dashCooldown","stunTimer","attackBoostTimer","burnTimer"])p[key]=Math.max(0,p[key]-dt);
    p.coyoteTimer=p.grounded?c.coyoteTime:Math.max(0,p.coyoteTimer-dt);p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);
    if(!p.grounded)p.stats.airtime+=dt;if(controls.jumpPressed)p.jumpBuffer=c.jumpBufferTime;
    const direction=(controls.right?1:0)-(controls.left?1:0);
    if(controls.dashPressed&&p.dashCooldown===0&&p.stunTimer===0){
      const dashDirection=direction||p.facing;p.vx=dashDirection*c.dashSpeed;p.vy=0;p.facing=dashDirection;
      p.dashTimer=c.dashDuration;p.dashCooldown=c.dashCooldown;p.stats.dodges++;this.emit("dash",{player:p.id});
    }
    if(p.stunTimer===0&&p.dashTimer===0){
      if(direction){const accel=(p.grounded?c.groundAcceleration:c.airAcceleration)*traits.speed;p.vx=approach(p.vx,direction*c.moveSpeed*traits.speed,accel*dt);p.facing=direction}
      else if(p.grounded)p.vx=approach(p.vx,0,c.friction*dt);
      if(p.jumpBuffer>0){
        if((p.grounded||p.coyoteTimer>0)&&p.jumpsRemaining===2)this.performJump(p,false,direction);
        else if(p.jumpsRemaining>0)this.performJump(p,true,direction);
        else if(p.recoveryAvailable)this.performRecovery(p,direction);
      }
      this.updateCharging(p,controls,dt);
    }
    const previousBottom=p.y+p.height,gravityScale=p.dashTimer>0?.18:1;p.vy+=c.gravity*gravityScale*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
    p.grounded=false;p.standingPlatform=null;this.resolvePlatforms(p,previousBottom);
  }
  performJump(p,second,direction){
    const c=this.config;p.vy=-(second?c.secondJumpSpeed:c.firstJumpSpeed)*p.traits.jump;
    if(second&&direction){p.vx=direction*c.directionalJumpSpeed*p.traits.speed;p.facing=direction}
    p.jumpsRemaining-=1;p.grounded=false;p.coyoteTimer=0;p.jumpBuffer=0;this.emit(second?"double-jump":"jump",{player:p.id});
  }
  performRecovery(p,direction){
    const c=this.config;p.vy=-c.recoveryJumpSpeed*p.traits.jump;p.vx=(direction||p.facing)*c.directionalJumpSpeed*.75;
    p.recoveryAvailable=false;p.jumpBuffer=0;this.emit("recovery",{player:p.id});
  }
  updateCharging(p,controls,dt){
    if(controls.attackPressed&&p.attackCooldown===0&&!p.spawnProtected){p.charging=true;p.chargeTime=0;this.emit("charge",{player:p.id})}
    if(p.charging&&controls.attackHeld)p.chargeTime=Math.min(.8,p.chargeTime+dt);
    if(p.charging&&(controls.attackReleased||p.chargeTime>=.8))this.executeAttack(p);
  }
  executeAttack(p){
    const c=this.config,traits=p.traits,airborne=!p.grounded,charged=p.chargeTime>=.28;
    p.attackType=airborne?"slam":charged?"charged":"normal";p.attackStyle=traits.special;p.attackPower=charged?1+Math.min(p.chargeTime,.8)*1.15:1;
    const activeTime=airborne?.24:charged?.22:c.attackDuration;p.attackTimer=activeTime*(traits.duration||1);p.attackCooldown=(c.attackCooldown+(charged?.2:0))*(traits.cooldown||1);
    p.attackHit=false;p.charging=false;p.stats.attacks++;if(airborne)p.vy=Math.max(p.vy,430);
    else if(traits.lunge)p.vx+=p.facing*traits.lunge;
    this.emit("attack",{player:p.id,type:p.attackType,style:p.attackStyle,power:p.attackPower});
  }
  resolvePlatforms(p,previousBottom){
    for(const platform of this.state.platforms){
      if(!platform.active)continue;const horizontal=p.x+p.width>platform.x&&p.x<platform.x+platform.width;
      if(horizontal&&previousBottom<=platform.y+2&&p.y+p.height>=platform.y&&p.vy>=0){
        const protectedBefore=p.spawnProtected;p.y=platform.y-p.height;p.vy=0;p.grounded=true;p.standingPlatform=platform.id;
        p.jumpsRemaining=2;p.recoveryAvailable=true;p.spawnProtected=false;
        if(protectedBefore)this.emit("respawn-ready",{player:p.id});return;
      }
    }
  }
  resolvePlayerCollision(){
    const[a,b]=this.state.players;if(a.spawnProtected||b.spawnProtected||a.dashTimer>0||b.dashTimer>0||!overlaps(a,b))return;
    const dir=a.x+a.width/2<=b.x+b.width/2?1:-1,amount=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
    a.x-=dir*amount/2;b.x+=dir*amount/2;const shared=(a.vx+b.vx)/2;a.vx=shared-dir*15;b.vx=shared+dir*15;
  }
  resolveAttacks(){
    for(const attacker of this.state.players){
      if(attacker.spawnProtected||attacker.attackTimer<=0||attacker.attackHit)continue;
      const target=this.state.players[1-attacker.id];if(target.spawnProtected||target.dashTimer>0)continue;
      const traits=attacker.traits,range=this.config.attackRange*(traits.range||1)*(attacker.attackType==="charged"?1.28:1);
      const box=attacker.attackType==="slam"?{x:attacker.x-12,y:attacker.y+attacker.height-4,width:attacker.width+24,height:52}:
        traits.radial?{x:attacker.x-range,y:attacker.y-8,width:attacker.width+range*2,height:attacker.height+16}:
        {x:attacker.facing>0?attacker.x+attacker.width:attacker.x-range,y:attacker.y+4,width:range,height:attacker.height-8};
      if(!overlaps(box,target))continue;
      if(target.shieldHits>0){target.shieldHits--;attacker.attackHit=true;this.emit("shield",{player:target.id});continue}
      const baseDamage=attacker.attackType==="slam"?14:attacker.attackType==="charged"?13*attacker.attackPower:8;
      const damage=baseDamage*(traits.damage||1)*(attacker.attackType==="slam"?(traits.aerial||1):1)*(attacker.attackBoostTimer>0?1.35:1)+(traits.burn||0);
      target.damage=Math.min(300,target.damage+damage);target.burnTimer=traits.burn?1.2:target.burnTimer;target.stats.maxDamage=Math.max(target.stats.maxDamage,target.damage);
      const direction=attacker.attackType==="slam"||traits.radial?Math.sign(target.x-attacker.x)||attacker.facing:attacker.facing;
      const force=this.config.pushForce*attacker.attackPower*attacker.traits.attack*(traits.knockback||1)/target.traits.weight*(1+target.damage/105);
      const vertical=traits.vertical||1;target.vx=direction*force*(attacker.attackType==="slam"?.5:1);target.vy=attacker.attackType==="slam"?force*.58*(traits.aerial||1):-force*.38*vertical;
      target.grounded=false;target.stunTimer=clamp(.12+force/4000,.12,.34);attacker.vx-=direction*35;
      attacker.attackHit=true;attacker.stats.hits++;this.state.hitstop=clamp(.025+force/9000,.03,.1);
      this.emit("hit",{player:attacker.id,target:target.id,force,damage,type:attacker.attackType,style:attacker.attackStyle});
    }
  }
  updateItems(dt){
    if(!this.itemsEnabled)return;this.state.itemTimer-=dt;
    if(this.state.itemTimer<=0&&this.state.items.length<2){this.spawnItem();this.state.itemTimer=this.config.itemInterval+this.random()*3}
    for(const item of this.state.items){
      if(!item.grounded){const before=item.y+18;item.vy+=this.config.gravity*.55*dt;item.y+=item.vy*dt;
        for(const platform of this.state.platforms)if(platform.active&&item.x+18>platform.x&&item.x<platform.x+platform.width&&before<=platform.y&&item.y+18>=platform.y){item.y=platform.y-18;item.vy=0;item.grounded=true;break}}
      for(const p of this.state.players)if(!item.collected&&overlaps({x:item.x,y:item.y,width:18,height:18},p)){this.collectItem(p,item);item.collected=true}
    }
    this.state.items=this.state.items.filter(item=>!item.collected&&item.y<this.config.height+40);
  }
  spawnItem(){
    const types=["boost","shield","jump"],type=types[Math.floor(this.random()*types.length)];
    this.state.items.push({type,x:100+this.random()*582,y:50,vy:0,grounded:false,collected:false});this.emit("item-spawn",{type});
  }
  collectItem(p,item){
    if(item.type==="boost")p.attackBoostTimer=6;if(item.type==="shield")p.shieldHits=1;
    if(item.type==="jump"){p.jumpsRemaining=2;p.recoveryAvailable=true}
    this.emit("item",{player:p.id,type:item.type});
  }
  resolveFall(){
    const fallen=this.state.players.find(p=>p.y>this.config.height+70);if(!fallen)return false;
    this.state.lives[fallen.id]-=1;fallen.stats.falls++;const winner=1-fallen.id;
    this.emit("life-lost",{player:fallen.id,lives:[...this.state.lives]});
    if(this.state.lives[fallen.id]<=0){this.state.winner=winner;this.state.running=false;this.emit("win",{winner,fallen:fallen.id,lives:[...this.state.lives]})}
    else this.respawnPlayer(fallen);return true;
  }
  respawnPlayer(p){
    const platform=this.state.platforms.filter(x=>x.active)[Math.floor(this.random()*this.state.platforms.filter(x=>x.active).length)]||this.state.platforms[0];
    p.x=platform.x+25+this.random()*Math.max(1,platform.width-p.width-50);p.y=platform.y-p.height-170-this.random()*80;
    p.vx=0;p.vy=0;p.grounded=false;p.standingPlatform=null;p.jumpsRemaining=2;p.recoveryAvailable=true;
    p.attackTimer=0;p.attackCooldown=0;p.attackHit=false;p.charging=false;p.stunTimer=0;p.spawnProtected=true;p.damage=0;
    this.emit("respawn",{player:p.id});
  }
  emit(type,detail={}){this.events.push({type,...detail})}
  consumeEvents(){return this.events.splice(0)}
}