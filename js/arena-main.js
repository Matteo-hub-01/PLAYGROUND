import{ARENA_MODES,ARENAS,CHARACTERS,ArenaGame,arenaLabels}from"./arena-core.js";
import{OnlineRoom}from"./online-room.js";
const $=s=>document.querySelector(s),canvas=$("#arena-canvas"),ctx=canvas.getContext("2d"),game=new ArenaGame();
const ui={play:$("#play-button"),pause:$("#pause-button"),rematch:$("#rematch-button"),fullscreen:$("#fullscreen-button"),
  
  menu:$("#menu-button"),menuPanel:$("#menu-panel"),mode:$("#mode-select"),difficulty:$("#difficulty-select"),
  arena:$("#arena-select"),character1:$("#character-1"),character2:$("#character-2"),items:$("#items-toggle"),lives:$("#lives-select"),
  sound:$("#sound-toggle"),volume:$("#volume-range"),instructions:$("#instructions"),live:$("#live-status"),
  bindingGrid:$("#binding-grid"),resetBindings:$("#reset-bindings"),gamepad:$("#gamepad-status"),
  fighterSelect:$("#fighter-select"),confirmFighters:$("#confirm-fighters"),fighterStatus:$("#fighter-select-status"),
  characterGrids:[$("#character-grid-1"),$("#character-grid-2")],characterChoices:[$("#fighter-choice-1"),$("#fighter-choice-2")],
  aiRandom:[$("#ai-random-1"),$("#ai-random-2")],onlinePanel:$("#online-panel"),roomCode:$("#room-code"),roomStatus:$("#room-status")
};
const defaults={p1Left:"q",p1Right:"d",p1Jump:"z",p1Attack:"s",p1Dash:"a",
  p2Left:"ArrowLeft",p2Right:"ArrowRight",p2Jump:"ArrowUp",p2Attack:"ArrowDown",p2Dash:"ShiftRight"};
let bindings=loadBindings(),listeningBinding=null,audioContext=null,lastTime=performance.now(),lastMessage="",selectedCharacters=[ui.character1.value,ui.character2.value],selectionConfirmed=false;
let particles=[],trails=[],shake=0,flash=0;
let online=false,remoteInput={},lastOnlineSend=0;const remoteSequence={jump:0,attack:0,release:0,dash:0},outgoingSequence={jump:0,attack:0,release:0,dash:0};
const room=new OnlineRoom("push-off",(payload,meta)=>{if(meta.error){ui.roomStatus.textContent=meta.error;return}ui.roomStatus.textContent=meta.connected?`Salon ${room.code} · adversaire connecté`:`Salon ${room.code} · en attente du joueur 2…`;if(room.role==="guest"&&payload?.state){game.state=payload.state;game.arena=payload.arena||game.arena;game.characters=payload.characters||game.characters;selectedCharacters=[...game.characters];selectionConfirmed=Boolean(payload.selectionConfirmed);ui.fighterSelect.hidden=true;render();updateInterface()}if(room.role==="host"&&payload?.controls){const c=payload.controls,s=payload.sequence||{};remoteInput={...c,jumpPressed:s.jump!==remoteSequence.jump,attackPressed:s.attack!==remoteSequence.attack,attackReleased:s.release!==remoteSequence.release,dashPressed:s.dash!==remoteSequence.dash};Object.assign(remoteSequence,s);if(payload.start&&selectionConfirmed&&!game.state.running)start()}});
const keys=new Set(),touch=[{left:false,right:false,attackHeld:false},{left:false,right:false,attackHeld:false}];
const actions=[{jumpPressed:false,attackPressed:false,attackReleased:false,dashPressed:false},{jumpPressed:false,attackPressed:false,attackReleased:false,dashPressed:false}];
const gamepadPrevious=[[],[]];

function keyToken(event){return event.key?.length===1?event.key.toLocaleLowerCase("fr"):event.code}
function loadBindings(){try{const saved=JSON.parse(localStorage.getItem("pushOffBindings")||"{}");for(const key of Object.keys(saved))if(/^Key[A-Z]$/.test(saved[key]))saved[key]=saved[key].slice(3).toLocaleLowerCase("fr");return{...defaults,...saved}}catch{return{...defaults}}}
function prettyKey(code){return code.length===1?code.toLocaleUpperCase("fr"):code.replace("Arrow","Flèche ").replace("ShiftRight","Maj droite").replace("Space","Espace")}function bindingMeta(){
  return[{key:"p1Left",label:"J1 gauche"},{key:"p1Right",label:"J1 droite"},{key:"p1Jump",label:"J1 saut"},{key:"p1Attack",label:"J1 attaque"},{key:"p1Dash",label:"J1 dash"},
    {key:"p2Left",label:"J2 gauche"},{key:"p2Right",label:"J2 droite"},{key:"p2Jump",label:"J2 saut"},{key:"p2Attack",label:"J2 attaque"},{key:"p2Dash",label:"J2 dash"}];
}
function renderBindings(){
  ui.bindingGrid.textContent="";
  for(const meta of bindingMeta()){const button=document.createElement("button");button.type="button";button.dataset.binding=meta.key;
    button.textContent=meta.label+" : "+prettyKey(bindings[meta.key]);button.classList.toggle("is-listening",listeningBinding===meta.key);
    button.addEventListener("click",()=>{listeningBinding=meta.key;renderBindings();announce("Appuyez sur la nouvelle touche pour "+meta.label+".")});ui.bindingGrid.append(button)}
}
function humanControlsCharacter(index){return game.mode===ARENA_MODES.PLAYER_VS_PLAYER||game.mode===ARENA_MODES.PLAYER_VS_AI&&index===0}
function statWidth(value){return Math.max(18,Math.min(100,Math.round(value/1.35*100)))}
function characterCard(id,traits,index){
  const button=document.createElement("button");button.type="button";button.className="character-card";button.dataset.character=id;button.setAttribute("role","radio");button.setAttribute("aria-checked",String(selectedCharacters[index]===id));button.style.setProperty("--fighter-accent",traits.accent);
  button.innerHTML=`<span class="character-portrait" data-character="${id}" aria-hidden="true"><i class="effect"></i><i class="head"></i><i class="body"></i></span><span class="character-copy"><strong>${traits.name}</strong><em>${traits.attackName}</em><small>${traits.description}</small><span class="character-stats" title="Vitesse, force, saut"><i style="width:${statWidth(traits.speed)}%"></i><i style="width:${statWidth(traits.attack)}%"></i><i style="width:${statWidth(traits.jump)}%"></i></span></span>`;
  button.onclick=()=>{selectedCharacters[index]=id;ui["character"+(index+1)].value=id;renderFighterSelection();announce(traits.name+" sélectionné pour "+arenaLabels(game.mode)[index]+".")};return button
}
function renderFighterSelection(){
  const labels=arenaLabels(game.mode);for(const index of[0,1]){const human=humanControlsCharacter(index),grid=ui.characterGrids[index],random=ui.aiRandom[index];grid.hidden=!human;random.hidden=human;grid.replaceChildren();
    document.querySelector(`[data-fighter-selector="${index}"] .fighter-selector-title strong`).textContent=labels[index];ui.characterChoices[index].textContent=human?CHARACTERS[selectedCharacters[index]].name:"Aléatoire";
    if(human)for(const[id,traits]of Object.entries(CHARACTERS))grid.append(characterCard(id,traits,index));
  }
  ui.fighterStatus.textContent=game.mode===ARENA_MODES.PLAYER_VS_PLAYER?"Chaque joueur choisit son combattant.":game.mode===ARENA_MODES.AI_VS_AI?"Les deux combattants seront tirés au sort.":"Choisissez votre combattant ; l’IA recevra un personnage aléatoire.";
}
function openFighterSelection(message="Choisissez les combattants avant le duel.",scroll=false){
  game.pause();window.Playground?.setPaused(false);selectionConfirmed=false;ui.fighterSelect.hidden=false;ui.play.textContent="▶ Choisir les combattants";clearInputs();renderFighterSelection();updateInterface();announce(message);render();if(scroll)ui.fighterSelect.scrollIntoView({behavior:"smooth",block:"start"})
}
function confirmFighterSelection(){
  const choices=[...selectedCharacters];if(!humanControlsCharacter(0))choices[0]=game.randomCharacter();if(!humanControlsCharacter(1))choices[1]=game.randomCharacter([choices[0]]);
  selectedCharacters=[...choices];ui.character1.value=choices[0];ui.character2.value=choices[1];game.setCharacters(choices);randomArenaForAI();selectionConfirmed=true;ui.fighterSelect.hidden=true;ui.play.textContent="▶ Jouer";
  announce(arenaLabels(game.mode).map((label,index)=>label+" : "+CHARACTERS[choices[index]].name).join(" contre "));start()
}
function configureCanvas(){const cap=window.Playground?.quality==="low"?1:window.Playground?.quality==="medium"?1.5:2,ratio=Math.min(devicePixelRatio||1,cap);canvas.width=game.config.width*ratio;canvas.height=game.config.height*ratio;ctx.setTransform(ratio,0,0,ratio,0,0)}
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function background(){
  const themes={classic:["#202a5b","#111a38"],islands:["#37478e","#161d45"],motion:["#522b72","#16112e"],chaos:["#7b283d","#1b0c22"]},colors=themes[game.arena];
  const g=ctx.createLinearGradient(0,0,0,600);g.addColorStop(0,colors[0]);g.addColorStop(.7,colors[1]);g.addColorStop(1,"#080b18");ctx.fillStyle=g;ctx.fillRect(0,0,800,600);
  ctx.fillStyle="#ffd166";ctx.beginPath();ctx.arc(665,105,38,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgb(255 209 102 / 12%)";ctx.beginPath();ctx.arc(665,105,66,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#0b1128";const city=[[0,310,90,240],[80,355,100,190],[170,285,85,260],[250,340,115,200],[355,270,95,270],[445,335,120,210],[555,300,95,240],[640,345,100,195],[730,280,90,260]];
  for(const b of city)ctx.fillRect(...b);
}
function platforms(){
  for(const p of game.state.platforms){if(!p.active)continue;ctx.globalAlpha=p.kind==="pulse"?.55+Math.sin(game.state.time*5)*.25:1;
    ctx.fillStyle="#202a47";rr(p.x+7,p.y+8,p.width-14,p.height+24,7);ctx.fillStyle=p.kind==="move"?"#7b6de3":p.kind==="pulse"?"#d76da8":"#53698f";rr(p.x,p.y,p.width,p.height,7);
    ctx.fillStyle="#a8b8df";rr(p.x,p.y,p.width,5,4)}ctx.globalAlpha=1;
}
function fighter(p,index){
  const x=p.x+p.width/2,head=p.y+9,protectedNow=p.spawnProtected||p.dashTimer>0,accent=p.traits.accent||p.color,shape=p.traits.shape;ctx.save();
  if(protectedNow)ctx.globalAlpha=.52+Math.sin(performance.now()/85)*.18;ctx.shadowColor=accent;ctx.shadowBlur=window.Playground?.quality==="low"?0:p.grounded?8:16;ctx.lineCap="round";
  if(shape==="winged"){ctx.fillStyle=accent;ctx.globalAlpha*=.55;ctx.beginPath();ctx.moveTo(x-3,p.y+24);ctx.lineTo(x-25,p.y+15);ctx.lineTo(x-16,p.y+38);ctx.lineTo(x,p.y+29);ctx.lineTo(x+16,p.y+38);ctx.lineTo(x+25,p.y+15);ctx.lineTo(x+3,p.y+24);ctx.fill();ctx.globalAlpha=protectedNow?.62:1}
  if(shape==="orbital"){ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,p.y+24,25,13,-.35,0,Math.PI*2);ctx.stroke();ctx.fillStyle=accent;ctx.beginPath();ctx.arc(x+22,p.y+16,4,0,Math.PI*2);ctx.fill()}
  if(shape==="flame"){ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(x,head-15);ctx.quadraticCurveTo(x+14,head-4,x+5,head+6);ctx.quadraticCurveTo(x,head+1,x-6,head+6);ctx.quadraticCurveTo(x-12,head-4,x,head-15);ctx.fill()}
  if(shape==="spark"){ctx.strokeStyle=accent;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-16,p.y+16);ctx.lineTo(x-7,p.y+22);ctx.lineTo(x-15,p.y+31);ctx.moveTo(x+15,p.y+12);ctx.lineTo(x+8,p.y+20);ctx.lineTo(x+17,p.y+27);ctx.stroke()}
  ctx.strokeStyle=p.color;ctx.fillStyle=p.color;ctx.lineWidth=shape==="wide"||shape==="gloves"?8:shape==="slim"?5:6;
  ctx.beginPath();if(shape==="wide"){ctx.roundRect(x-11,head-8,22,18,5);ctx.fill()}else{ctx.arc(x,head,shape==="slim"?7:8,0,Math.PI*2);ctx.fill()}
  ctx.beginPath();ctx.moveTo(x,p.y+19);ctx.lineTo(x,p.y+36);ctx.moveTo(x,p.y+26);ctx.lineTo(x-p.facing*8,p.y+31);
  const stride=Math.min(Math.abs(p.vx)/(game.config.moveSpeed*p.traits.speed),1)*6;ctx.moveTo(x,p.y+36);ctx.lineTo(x-7-stride,p.y+47);ctx.moveTo(x,p.y+36);ctx.lineTo(x+7+stride,p.y+47);ctx.stroke();
  if(shape==="gloves"){ctx.fillStyle=accent;ctx.beginPath();ctx.arc(x-p.facing*11,p.y+31,7,0,Math.PI*2);ctx.arc(x+p.facing*14,p.y+24,7,0,Math.PI*2);ctx.fill()}
  if(p.attackTimer>0){const reach=28+game.config.attackRange*(p.traits.range||1)*.34*p.attackPower;ctx.shadowColor=accent;ctx.shadowBlur=12;ctx.strokeStyle=accent;
    if(p.attackStyle==="gravity"){ctx.lineWidth=5;ctx.beginPath();ctx.arc(x,p.y+24,reach,0,Math.PI*2);ctx.stroke()}
    else if(p.attackStyle==="firewave"){const gradient=ctx.createLinearGradient(x,p.y,x+p.facing*reach,p.y);gradient.addColorStop(0,"#ffd166");gradient.addColorStop(1,accent);ctx.strokeStyle=gradient;ctx.lineWidth=12*p.attackPower;ctx.beginPath();ctx.moveTo(x,p.y+24);ctx.quadraticCurveTo(x+p.facing*reach*.55,p.y+10,x+p.facing*reach,p.y+24);ctx.stroke()}
    else if(p.attackStyle==="rush"){ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,p.y+26);ctx.lineTo(x+p.facing*reach*.35,p.y+16);ctx.lineTo(x+p.facing*reach*.62,p.y+31);ctx.lineTo(x+p.facing*reach,p.y+20);ctx.stroke()}
    else if(p.attackStyle==="cyclone"){ctx.lineWidth=7;ctx.beginPath();ctx.arc(x,p.y+28,reach*.62,-Math.PI*.8,Math.PI*.45);ctx.stroke()}
    else if(p.attackStyle==="flurry"){ctx.lineWidth=4;for(const offset of[-8,0,8]){ctx.beginPath();ctx.moveTo(x,p.y+24+offset);ctx.lineTo(x+p.facing*reach,p.y+19+offset);ctx.stroke()}}
    else if(p.attackStyle==="uppercut"){ctx.lineWidth=9*p.attackPower;ctx.beginPath();ctx.moveTo(x,p.y+31);ctx.lineTo(x+p.facing*reach*.72,p.y-4);ctx.stroke()}
    else{ctx.lineWidth=(p.attackStyle==="hammer"?12:7)*p.attackPower;ctx.beginPath();ctx.moveTo(x,p.y+25);ctx.lineTo(x+p.facing*reach,p.y+(p.attackType==="slam"?43:22));ctx.stroke();if(p.attackStyle==="hammer"){ctx.fillStyle=accent;ctx.fillRect(x+p.facing*reach-8,p.y+11,16,23)}}
  }
  if(p.charging){const radius=15+p.chargeTime*18;ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,p.y+24,radius,0,Math.PI*2);ctx.stroke()}
  if(p.burnTimer>0){ctx.fillStyle="#ff9f43";ctx.globalAlpha=.65;for(const offset of[-9,4,12]){ctx.beginPath();ctx.arc(x+offset,p.y+35-Math.abs(offset),4,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1}
  ctx.shadowBlur=0;ctx.fillStyle="#08101c";ctx.beginPath();ctx.arc(x+p.facing*3,head-1,1.5,0,Math.PI*2);ctx.fill();
  if(protectedNow||p.shieldHits){ctx.globalAlpha=.85;ctx.strokeStyle=p.shieldHits?"#65cfff":"#fff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,p.y+24,30,0,Math.PI*2);ctx.stroke()}ctx.restore();
  ctx.textAlign="center";ctx.fillStyle=accent;ctx.font="800 12px system-ui";ctx.fillText(arenaLabels(game.mode)[index]+" · "+p.traits.name,x,p.y-13);
  const ratio=1-p.dashCooldown/game.config.dashCooldown;ctx.fillStyle="#222b46";ctx.fillRect(x-19,p.y-7,38,3);ctx.fillStyle=p.color;ctx.fillRect(x-19,p.y-7,38*clamp01(ratio),3);
}
function clamp01(v){return Math.max(0,Math.min(1,v))}
function items(){
  const colors={boost:"#ff9f43",shield:"#65cfff",jump:"#b58cff"},symbols={boost:"✦",shield:"◇",jump:"↟"};
  for(const item of game.state.items){ctx.fillStyle=colors[item.type];ctx.shadowColor=colors[item.type];ctx.shadowBlur=12;ctx.beginPath();ctx.arc(item.x+9,item.y+9,10,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle="#07101d";ctx.textAlign="center";ctx.font="900 12px system-ui";ctx.fillText(symbols[item.type],item.x+9,item.y+13)}
}
function trailFrame(dt){
  if(window.Playground?.quality==="low"){trails=[];return}
  for(const p of game.state.players)if(Math.hypot(p.vx,p.vy)>430||p.dashTimer>0)trails.push({x:p.x+p.width/2,y:p.y+p.height/2,life:.18,color:p.color});
  trails=trails.filter(t=>t.life>0);for(const t of trails){t.life-=dt;ctx.globalAlpha=t.life/.18*.45;ctx.fillStyle=t.color;ctx.beginPath();ctx.arc(t.x,t.y,8,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
}
function particleFrame(dt){
  particles=particles.filter(p=>p.life>0);for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=420*dt;ctx.globalAlpha=Math.max(0,p.life/p.max);
    ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size)}ctx.globalAlpha=1;
}
function hud(){
  const labels=arenaLabels(game.mode),players=game.state.players,lives=game.state.lives;
  ctx.fillStyle="rgb(8 11 24 / 76%)";rr(130,14,540,68,16);ctx.textAlign="center";ctx.font="800 13px system-ui";
  for(const index of[0,1]){const x=index?535:265,p=players[index];ctx.fillStyle=p.color;ctx.fillText(labels[index]+" · "+p.traits.name+"  "+"♥ ".repeat(lives[index]),x,38);
    const damageColor=p.damage<50?"#f8f9ff":p.damage<100?"#ffd166":"#ff657a";ctx.fillStyle=damageColor;ctx.font="900 27px system-ui";ctx.fillText(Math.round(p.damage)+" %",x,69);ctx.font="800 13px system-ui"}
}
function statsOverlay(){
  if(game.state.winner===null)return;const labels=arenaLabels(game.mode);ctx.fillStyle="rgb(6 9 24 / 88%)";rr(185,150,430,300,22);ctx.textAlign="center";ctx.fillStyle="#f8f9ff";ctx.font="900 40px system-ui";
  ctx.fillText(labels[game.state.winner]+" gagne !",400,205);ctx.font="750 15px system-ui";ctx.fillStyle="#b7c1dc";ctx.fillText("STATISTIQUES",400,239);
  for(const index of[0,1]){const p=game.state.players[index],x=index?500:300;ctx.fillStyle=p.color;ctx.font="850 17px system-ui";ctx.fillText(labels[index],x,273);
    ctx.fillStyle="#f8f9ff";ctx.font="650 14px system-ui";ctx.fillText("Coups : "+p.stats.hits+" / "+p.stats.attacks,x,306);ctx.fillText("Esquives : "+p.stats.dodges,x,332);
    ctx.fillText("Chutes : "+p.stats.falls,x,358);ctx.fillText("Dégâts max : "+Math.round(p.stats.maxDamage)+" %",x,384);ctx.fillText("Temps en l'air : "+p.stats.airtime.toFixed(1)+" s",x,410)}
}
function overlay(){
  if(game.state.winner!==null){statsOverlay();return}let title="",sub="";
  if(!game.state.running){title="Prêts au duel ?";sub="Trois vies par combattant"}else if(game.state.countdown>0){title=String(Math.ceil(game.state.countdown));sub="Préparez-vous"}
  if(!title)return;ctx.fillStyle="rgb(6 9 24 / 68%)";ctx.fillRect(0,0,800,600);ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font="900 49px system-ui";ctx.fillText(title,400,260);ctx.fillStyle="#c5cee5";ctx.font="650 18px system-ui";ctx.fillText(sub,400,297);
}
function render(dt=0){
  ctx.save();if(shake>0){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake=Math.max(0,shake-dt*55)}
  background();platforms();trailFrame(dt);items();fighter(game.state.players[0],0);fighter(game.state.players[1],1);particleFrame(dt);ctx.restore();hud();overlay();
  if(flash>0){ctx.fillStyle="rgb(255 255 255 / "+Math.min(.3,flash)+")";ctx.fillRect(0,0,800,600);flash=Math.max(0,flash-dt*1.8)}
}
function announce(message){if(!message||message===lastMessage)return;lastMessage=message;ui.live.textContent="";setTimeout(()=>ui.live.textContent=message,20)}
function getAudio(){if(!ui.sound.checked)return null;if(!audioContext){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;audioContext=new AC()}if(audioContext.state==="suspended")audioContext.resume();return audioContext}
function beep(freq,duration,volume=.035,type="square"){const ac=getAudio();if(!ac)return;const o=ac.createOscillator(),g=ac.createGain(),now=ac.currentTime,mult=Number(ui.volume.value)/100;
  o.type=type;o.frequency.setValueAtTime(freq,now);g.gain.setValueAtTime(volume*mult,now);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(g).connect(ac.destination);o.start(now);o.stop(now+duration)}
function burstAt(x,y,color,count=12,power=1){const actual=window.Playground?.quality==="low"?Math.ceil(count*.45):count;for(let i=0;i<actual;i++)particles.push({x,y,vx:(Math.random()-.5)*260*power,vy:(Math.random()-.75)*220*power,life:.35+Math.random()*.25,max:.6,size:3+Math.random()*4,color})}
function processEvents(){
  const labels=arenaLabels(game.mode);for(const e of game.consumeEvents()){
    if(e.type==="jump")beep(330,.06,.025,"sine");if(e.type==="double-jump"){beep(500,.09,.03,"sine");burstAt(game.state.players[e.player].x,game.state.players[e.player].y+40,"#fff",8,.6)}
    if(e.type==="recovery"){beep(620,.12,.04,"sine");burstAt(game.state.players[e.player].x,game.state.players[e.player].y+35,"#ffd166",12,.8)}
    if(e.type==="dash")beep(210,.06,.025,"sawtooth");if(e.type==="charge")beep(120,.05,.015,"sine");
    if(e.type==="hit"){const p=game.state.players[e.target];shake=Math.min(20,3+e.force/70);flash=Math.min(.24,e.force/4000);burstAt(p.x+p.width/2,p.y+22,p.color,10+Math.round(e.force/100),Math.min(2,e.force/500));beep(Math.max(55,180-e.force/10),.08+e.force/5000,.05,"square");announce(labels[e.player]+" touche "+labels[e.target]+".")}
    if(e.type==="shield"){beep(760,.12,.04,"sine");announce("Le bouclier absorbe le coup.")}
    if(e.type==="life-lost"){flash=.45;shake=18;burstAt(400,555,game.state.players[e.player].color,28,1.8);beep(90,.35,.07,"sawtooth");announce(labels[e.player]+" perd une vie.")}
    if(e.type==="respawn")announce(labels[e.player]+" réapparaît avec une protection.");if(e.type==="respawn-ready")announce(labels[e.player]+" est de nouveau vulnérable.");
    if(e.type==="item"){beep(880,.12,.035,"sine");announce(labels[e.player]+" récupère un bonus "+e.type+".")}
    if(e.type==="win"){beep(660,.5,.07,"sawtooth");announce(labels[e.winner]+" gagne la partie.");const humanWon=game.mode===ARENA_MODES.PLAYER_VS_PLAYER||(game.mode===ARENA_MODES.PLAYER_VS_AI&&e.winner===0);window.Playground?.finish({humanWon,draw:game.mode===ARENA_MODES.AI_VS_AI,message:labels[e.winner]+" remporte le duel.",achievement:humanWon&&game.state.lives[e.winner]===3?"perfect-push":null,best:humanWon?game.state.lives[e.winner]:null})}
    if(e.type==="pause")announce("Partie en pause.");if(e.type==="play")announce("Combat lancé.");
  }
}
function clearInputs(){keys.clear();for(const t of touch){t.left=t.right=t.attackHeld=false}for(const a of actions)for(const key of Object.keys(a))a[key]=false}
function mapped(player,action){return bindings["p"+(player+1)+action[0].toUpperCase()+action.slice(1)]}
function pollGamepads(){
  const pads=navigator.getGamepads?.()||[],result=[{},{ }];let connected=0;
  for(let i=0;i<2;i++){const pad=pads[i];if(!pad)continue;connected++;const previous=gamepadPrevious[i],pressed=pad.buttons.map(b=>b.pressed);
    result[i]={left:pad.axes[0]<-.3,right:pad.axes[0]>.3,jumpPressed:pressed[0]&&!previous[0],attackPressed:pressed[2]&&!previous[2],
      attackHeld:pressed[2],attackReleased:!pressed[2]&&previous[2],dashPressed:pressed[1]&&!previous[1]};gamepadPrevious[i]=pressed}
  ui.gamepad.textContent=connected?"Manette : "+connected+" détectée(s)":"Manette : aucune détectée";return result;
}
function combinedInputs(){
  const pads=pollGamepads();return[0,1].map(i=>({left:keys.has(mapped(i,"left"))||touch[i].left||pads[i].left,
    right:keys.has(mapped(i,"right"))||touch[i].right||pads[i].right,jumpPressed:actions[i].jumpPressed||pads[i].jumpPressed,
    attackPressed:actions[i].attackPressed||pads[i].attackPressed,attackHeld:keys.has(mapped(i,"attack"))||touch[i].attackHeld||pads[i].attackHeld,
    attackReleased:actions[i].attackReleased||pads[i].attackReleased,dashPressed:actions[i].dashPressed||pads[i].dashPressed}))}
function resetActions(){for(const a of actions){a.jumpPressed=a.attackPressed=a.attackReleased=a.dashPressed=false}}
function updateInterface(){
  document.body.classList.toggle("game-active",game.state.running);
  ui.play.disabled=game.state.running;ui.pause.disabled=!game.state.running||online&&room.role==="guest";ui.difficulty.disabled=game.mode===ARENA_MODES.PLAYER_VS_PLAYER;
  ui.onlinePanel.hidden=!online;const panels=[...document.querySelectorAll(".touch-player")],labels=arenaLabels(game.mode);panels[0].classList.toggle("is-hidden",game.mode===ARENA_MODES.AI_VS_AI||online&&room.role==="guest");panels[1].classList.toggle("is-hidden",game.mode!==ARENA_MODES.PLAYER_VS_PLAYER||online&&room.role!=="guest");
  panels.forEach((panel,index)=>panel.querySelector("strong").textContent=labels[index]+" · "+CHARACTERS[game.characters[index]].name);
  ui.instructions.textContent=game.mode===ARENA_MODES.PLAYER_VS_PLAYER?"J1 : "+prettyKey(bindings.p1Left)+"/"+prettyKey(bindings.p1Right)+", "+prettyKey(bindings.p1Jump)+" saut, "+prettyKey(bindings.p1Attack)+" attaque, "+prettyKey(bindings.p1Dash)+" dash · J2 : flèches + "+prettyKey(bindings.p2Dash)+" dash":
    game.mode===ARENA_MODES.AI_VS_AI?"Mode automatique : arène choisie aléatoirement à chaque partie.":"Joueur : "+prettyKey(bindings.p1Left)+"/"+prettyKey(bindings.p1Right)+", "+prettyKey(bindings.p1Jump)+" saut, "+prettyKey(bindings.p1Attack)+" attaque, "+prettyKey(bindings.p1Dash)+" dash.";if(online)ui.instructions.textContent=room.role==="guest"?"Vous contrôlez le combattant rose (joueur 2).":"Vous contrôlez le combattant vert (joueur 1). Partagez le code du salon.";
}
function randomArenaForAI(){if(game.mode!==ARENA_MODES.AI_VS_AI)return;const names=Object.keys(ARENAS),choice=names[Math.floor(Math.random()*names.length)];ui.arena.value=choice;game.setArena(choice)}
function start(){if(online&&room.role==="guest"){room.send({controls:{},sequence:outgoingSequence,start:true});ui.roomStatus.textContent=`Salon ${room.code} · demande de démarrage envoyée`;return}if(!selectionConfirmed){openFighterSelection();return}window.Playground?.start();window.Playground?.setPaused(false);getAudio();game.play();canvas.focus({preventScroll:true});updateInterface()}
function onlineState(){return{state:game.state,arena:game.arena,characters:game.characters,selectionConfirmed}}
async function enterRoom(action){try{const info=action==="create"?await room.create():await room.join(ui.roomCode.value);online=true;ui.mode.value="online";game.setMode(ARENA_MODES.PLAYER_VS_PLAYER);ui.roomCode.value=info.code;ui.roomStatus.textContent=`Code ${info.code} · ${info.role==="host"?"vous êtes le joueur 1":"vous êtes le joueur 2"}`;if(info.role==="host"){openFighterSelection("Choisissez les deux combattants puis partagez le code.");room.send(onlineState())}else{ui.fighterSelect.hidden=true;selectionConfirmed=false}updateInterface()}catch(error){ui.roomStatus.textContent=error.message}}
function pauseGame(message="Partie en pause."){game.pause();window.Playground?.setPaused(true);clearInputs();updateInterface();announce(message);render()}
ui.play.addEventListener("click",start);ui.pause.addEventListener("click",()=>pauseGame());ui.confirmFighters.addEventListener("click",confirmFighterSelection);
$("#create-room").addEventListener("click",()=>enterRoom("create"));$("#join-room").addEventListener("click",()=>enterRoom("join"));
ui.rematch.addEventListener("click",()=>{window.Playground?.reset();openFighterSelection("Choisissez de nouveaux combattants pour la revanche.",true)});
ui.fullscreen.addEventListener("click",async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{announce("Plein ecran indisponible sur cet appareil.")}});
document.addEventListener("fullscreenchange",()=>{const active=Boolean(document.fullscreenElement);ui.fullscreen.textContent=active?"⛶ Quitter le plein écran":"⛶ Plein écran";ui.fullscreen.setAttribute("aria-pressed",String(active));configureCanvas();render()});
ui.mode.addEventListener("change",()=>{window.Playground?.reset();online=ui.mode.value==="online";if(!online)room.close();game.setMode(online?ARENA_MODES.PLAYER_VS_PLAYER:ui.mode.value);clearInputs();openFighterSelection("Mode changé : choisissez les combattants.")});
ui.difficulty.addEventListener("change",()=>game.setDifficulty(ui.difficulty.value));ui.arena.addEventListener("change",()=>game.setArena(ui.arena.value));
ui.character1.addEventListener("change",()=>{selectedCharacters[0]=ui.character1.value;renderFighterSelection()});ui.character2.addEventListener("change",()=>{selectedCharacters[1]=ui.character2.value;renderFighterSelection()});
ui.lives.addEventListener("change",()=>{game.config.startingLives=Number(ui.lives.value);game.newRound();updateInterface()});ui.items.addEventListener("change",()=>game.setItemsEnabled(ui.items.checked));ui.sound.addEventListener("change",()=>{if(ui.sound.checked)beep(440,.08)});
ui.menu.addEventListener("click",()=>{ui.menuPanel.classList.toggle("is-hidden");if(!ui.menuPanel.classList.contains("is-hidden")){pauseGame();ui.mode.focus()}});
ui.resetBindings.addEventListener("click",()=>{bindings={...defaults};localStorage.setItem("pushOffBindings",JSON.stringify(bindings));renderBindings();updateInterface()});
document.addEventListener("keydown",e=>{
  if(listeningBinding){e.preventDefault();bindings[listeningBinding]=keyToken(e);listeningBinding=null;localStorage.setItem("pushOffBindings",JSON.stringify(bindings));renderBindings();updateInterface();return}
  const form=e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement;if(e.code==="Space"&&!form){e.preventDefault();game.togglePause();updateInterface();return}
  if(e.code==="Escape"){pauseGame();return}const token=keyToken(e);keys.add(token);
  for(let i=0;i<2;i++){if(token===mapped(i,"jump")&&!e.repeat)actions[i].jumpPressed=true;if(token===mapped(i,"attack")&&!e.repeat)actions[i].attackPressed=true;if(token===mapped(i,"dash")&&!e.repeat)actions[i].dashPressed=true}
  if(e.code.startsWith("Arrow"))e.preventDefault();
});
document.addEventListener("keyup",e=>{const token=keyToken(e);keys.delete(token);for(let i=0;i<2;i++)if(token===mapped(i,"attack"))actions[i].attackReleased=true});
for(const button of document.querySelectorAll("[data-action]")){
  const player=Number(button.closest("[data-player]").dataset.player),action=button.dataset.action;
  button.addEventListener("pointerdown",e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);if(action==="left"||action==="right")touch[player][action]=true;
    else if(action==="attack"){actions[player].attackPressed=true;touch[player].attackHeld=true}else if(action==="jump")actions[player].jumpPressed=true;else actions[player].dashPressed=true;if(!game.state.running)start()});
  const release=e=>{e.preventDefault();if(action==="left"||action==="right")touch[player][action]=false;if(action==="attack"){touch[player].attackHeld=false;actions[player].attackReleased=true}};
  button.addEventListener("pointerup",release);button.addEventListener("pointercancel",release);
  button.addEventListener("contextmenu",e=>e.preventDefault());
  button.addEventListener("selectstart",e=>e.preventDefault());
}
window.addEventListener("playground:replay",()=>{window.Playground?.reset();openFighterSelection("Choisissez les combattants pour la revanche.",true)});
window.addEventListener("blur",clearInputs);window.addEventListener("resize",configureCanvas,{passive:true});window.addEventListener("playground:quality",()=>{configureCanvas();render()});window.addEventListener("gamepadconnected",()=>announce("Manette connectée."));
document.addEventListener("visibilitychange",()=>{if(document.hidden&&game.state.running)pauseGame("Partie mise en pause.")});
function frame(timestamp){const dt=Math.min((timestamp-lastTime)/1000,.05);lastTime=timestamp;window.Playground?.frame(dt);const inputs=combinedInputs();if(online&&room.role==="guest"){const control=inputs[1];if(control.jumpPressed)outgoingSequence.jump++;if(control.attackPressed)outgoingSequence.attack++;if(control.attackReleased)outgoingSequence.release++;if(control.dashPressed)outgoingSequence.dash++;if(timestamp-lastOnlineSend>45){lastOnlineSend=timestamp;room.send({controls:{left:control.left,right:control.right,attackHeld:control.attackHeld},sequence:outgoingSequence})}}else if(game.state.running){game.update(dt,online?[inputs[0],remoteInput]:inputs);remoteInput.jumpPressed=remoteInput.attackPressed=remoteInput.attackReleased=remoteInput.dashPressed=false;processEvents();updateInterface();render(dt);if(online&&timestamp-lastOnlineSend>45){lastOnlineSend=timestamp;room.send(onlineState())}}resetActions();requestAnimationFrame(frame)}
renderBindings();configureCanvas();game.consumeEvents();renderFighterSelection();openFighterSelection("Choisissez votre combattant pour commencer.");render();requestAnimationFrame(frame);
