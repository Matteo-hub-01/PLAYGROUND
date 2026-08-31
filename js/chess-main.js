import {chooseAIMove,createInitialState,getGameStatus,indexToSquare,legalMovesFrom,makeMove,moveNotation,pieceColor,PIECE_NAMES,squareToIndex} from "./chess-core.js";
import {OnlineRoom} from "./online-room.js";

const boardElement=document.querySelector("#chessboard"),modeSelect=document.querySelector("#game-mode"),difficultySelect=document.querySelector("#difficulty"),statusElement=document.querySelector("#game-status"),turnBadge=document.querySelector("#turn-badge"),historyElement=document.querySelector("#move-history"),moveCount=document.querySelector("#move-count"),undoButton=document.querySelector("#undo-move"),promotionDialog=document.querySelector("#promotion-dialog"),promotionOptions=document.querySelector("#promotion-options");
const symbols={K:"\u2654",Q:"\u2655",R:"\u2656",B:"\u2657",N:"\u2658",P:"\u2659",k:"\u265A",q:"\u265B",r:"\u265C",b:"\u265D",n:"\u265E",p:"\u265F"};
const colors={w:"blanc",b:"noir"};
const clockSelect=document.querySelector("#chess-clock"),themeSelect=document.querySelector("#chess-theme"),hintButton=document.querySelector("#hint-move"),puzzleButton=document.querySelector("#puzzle-game"),exportButton=document.querySelector("#export-game"),clockElements={w:document.querySelector("#white-clock"),b:document.querySelector("#black-clock")};
let aiWorker=null;try{if(typeof Worker!=="undefined")aiWorker=new Worker(new URL("./chess-worker.js",import.meta.url),{type:"module"})}catch{aiWorker=null}
let state=createInitialState(),selected=null,lastMove=null,flipped=false,history=[],snapshots=[],promotionPending=null,aiThinking=false,aiGeneration=0,reportedResult=false,clocks={w:300,b:300},clockExpired=null;
const onlinePanel=document.querySelector("#online-panel"),roomCode=document.querySelector("#room-code"),roomStatus=document.querySelector("#room-status");let online=false,applyingRemote=false;
const room=new OnlineRoom("chess",(payload,meta)=>{if(meta.error){roomStatus.textContent=meta.error;return}roomStatus.textContent=meta.connected?`Salon ${room.code} · adversaire connecté`:`Salon ${room.code} · en attente…`;if(payload?.state){applyingRemote=true;state={...payload.state,board:[...payload.state.board]};history=payload.history||[];lastMove=payload.lastMove||null;clocks=payload.clocks||clocks;selected=null;applyingRemote=false;render();if(room.role==="host")broadcastPosition()}});

function cloneState(source){return{...source,board:[...source.board]}}
function isHumanTurn(){return online?Boolean(room.role)&&(state.turn===(room.role==="host"?"w":"b")):modeSelect.value==="player-vs-player"||(modeSelect.value==="player-vs-ai"&&state.turn==="w")}
function playerNames(){
  if(online)return{w:"Hôte · blancs",b:"Invité · noirs"};
  if(modeSelect.value==="player-vs-player")return{w:"Joueur 1 \u00b7 blancs",b:"Joueur 2 \u00b7 noirs"};
  if(modeSelect.value==="ai-vs-ai")return{w:"IA blanche",b:"IA noire"};
  return{w:"Joueur \u00b7 blancs",b:"IA \u00b7 noirs"};
}
function squareLabel(index,piece){
  if(!piece)return`${indexToSquare(index)}, case vide`;
  return`${indexToSquare(index)}, ${PIECE_NAMES[piece.toLowerCase()]} ${colors[pieceColor(piece)]}`;
}
function renderBoard(){
  const status=getGameStatus(state),legal=selected===null?[]:legalMovesFrom(state,selected),checkKing=status.check?state.board.findIndex(piece=>piece===(state.turn==="w"?"K":"k")):-1;
  boardElement.replaceChildren();
  for(let displayIndex=0;displayIndex<64;displayIndex++){
    const index=flipped?63-displayIndex:displayIndex,piece=state.board[index],displayRow=Math.floor(displayIndex/8),displayCol=displayIndex%8,square=document.createElement("button");
    square.type="button";square.className=`square ${(Math.floor(index/8)+index%8)%2?"dark":"light"}`;square.dataset.index=index;square.setAttribute("role","gridcell");square.setAttribute("aria-label",squareLabel(index,piece));
    if(selected===index)square.classList.add("selected");
    if(lastMove&&(lastMove.from===index||lastMove.to===index))square.classList.add("last-move");
    if(checkKing===index)square.classList.add("check");
    const targetMove=legal.find(move=>move.to===index);if(targetMove)square.classList.add("legal",targetMove.capture||targetMove.enPassant?"capture":"move");
    if(piece){const span=document.createElement("span");span.className=`piece ${pieceColor(piece)==="w"?"white-piece":"black-piece"}`;span.textContent=symbols[piece];square.append(span)}
    if(displayRow===7){const file=document.createElement("span");file.className="coord file";file.textContent=indexToSquare(index)[0];square.append(file)}
    if(displayCol===0){const rank=document.createElement("span");rank.className="coord rank";rank.textContent=indexToSquare(index)[1];square.append(rank)}
    boardElement.append(square);
  }
}
function capturedBy(color){return history.filter(entry=>entry.color===color&&entry.capture).map(entry=>symbols[entry.capture]).join(" ")||"Aucune prise"}
function renderHistory(){
  historyElement.replaceChildren();moveCount.textContent=history.length;
  if(!history.length){const empty=document.createElement("li");empty.className="empty-history";empty.textContent="La partie vient de commencer.";historyElement.append(empty);return}
  history.forEach(entry=>{const item=document.createElement("li");item.textContent=entry.notation;historyElement.append(item)});historyElement.scrollTop=historyElement.scrollHeight;
}
function clockText(value){if(!Number(value))return "∞";const seconds=Math.max(0,Math.ceil(value));return String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0")}function renderClocks(){clockElements.w.textContent=clockText(clocks.w);clockElements.b.textContent=clockText(clocks.b);clockElements.w.classList.toggle("active-clock",state.turn==="w");clockElements.b.classList.toggle("active-clock",state.turn==="b")}function renderStatus(){
  const status=getGameStatus(state),names=playerNames(),turnName=names[state.turn];renderClocks();
  document.querySelector("#white-name").textContent=names.w;document.querySelector("#black-name").textContent=names.b;
  document.querySelector("#white-captured").textContent=capturedBy("w");document.querySelector("#black-captured").textContent=capturedBy("b");
  turnBadge.classList.toggle("black-turn",state.turn==="b");turnBadge.innerHTML=`<span></span> Aux ${state.turn==="w"?"blancs":"noirs"}`;
  const messages={checkmate:`\u00c9chec et mat ! ${names[status.winner]} gagne.`,stalemate:"Pat : la partie est nulle.","fifty-move":"Partie nulle selon la r\u00e8gle des 50 coups.",insufficient:"Partie nulle : mat\u00e9riel insuffisant."};
  if(clockExpired)statusElement.textContent="Temps écoulé : "+names[clockExpired==="w"?"b":"w"]+" gagne.";else if(status.over)statusElement.textContent=messages[status.result];
  else if(aiThinking)statusElement.textContent=`${turnName} r\u00e9fl\u00e9chit\u2026`;
  else if(status.check)statusElement.textContent=`\u00c9chec au roi ${colors[state.turn]} ! ${turnName} doit le prot\u00e9ger.`;
  else statusElement.textContent=isHumanTurn()?`${turnName}, \u00e0 vous de jouer.`:`Au tour de ${turnName}.`;
  undoButton.disabled=!snapshots.length||modeSelect.value==="ai-vs-ai"||aiThinking;
  if(status.over&&!reportedResult){reportedResult=true;const humanWon=modeSelect.value==="player-vs-player"?Boolean(status.winner):modeSelect.value==="player-vs-ai"&&status.winner==="w";window.setTimeout(()=>window.Playground?.finish({humanWon,draw:!status.winner||modeSelect.value==="ai-vs-ai",message:statusElement.textContent,achievement:humanWon&&history.length<=20?"quick-mate":null,best:humanWon?history.length:null,lowerIsBetter:true}),0)}
}
function render(){renderBoard();renderHistory();renderStatus()}

function choosePromotion(moves){
  promotionPending=moves;promotionOptions.replaceChildren();const color=state.turn;
  for(const code of["q","r","b","n"]){const button=document.createElement("button");button.type="button";button.textContent=symbols[color==="w"?code.toUpperCase():code];button.setAttribute("aria-label",`Promouvoir en ${PIECE_NAMES[code]}`);button.addEventListener("click",()=>{const move=promotionPending.find(candidate=>candidate.promotion===code);promotionPending=null;promotionDialog.close();commitMove(move)});promotionOptions.append(button)}
  promotionDialog.showModal();
}
function handleSquare(index){
  if(clockExpired||aiThinking||getGameStatus(state).over||!isHumanTurn())return;
  const piece=state.board[index];
  if(selected!==null){const matches=legalMovesFrom(state,selected).filter(move=>move.to===index);if(matches.length){if(matches.some(move=>move.promotion))choosePromotion(matches);else commitMove(matches[0]);return}}
  selected=piece&&pieceColor(piece)===state.turn?index:null;renderBoard();
}
boardElement.addEventListener("click",event=>{const square=event.target.closest(".square");if(square)handleSquare(Number(square.dataset.index))});
boardElement.addEventListener("contextmenu",event=>event.preventDefault());
boardElement.addEventListener("selectstart",event=>event.preventDefault());
promotionDialog.addEventListener("close",()=>{promotionPending=null});

function commitMove(move){
  if(!move)return;window.Playground?.start();const before=cloneState(state),movingColor=state.turn,captured=move.enPassant?(movingColor==="w"?"p":"P"):state.board[move.to];
  snapshots.push({state:before,lastMove,historyLength:history.length});state=makeMove(state,move);lastMove=move;selected=null;
  history.push({color:movingColor,notation:moveNotation(before,move,state),capture:captured});render();if(online)broadcastPosition();else scheduleAI();
}
function broadcastPosition(){if(!room.role||applyingRemote)return;room.send({state,history,lastMove,clocks})}
async function enterRoom(action){try{const info=action==="create"?await room.create():await room.join(roomCode.value);online=true;roomCode.value=info.code;flipped=info.role==="guest";roomStatus.textContent=`Code ${info.code} · ${info.role==="host"?"vous jouez les blancs":"vous jouez les noirs"}`;onlinePanel.hidden=false;newGame()}catch(error){roomStatus.textContent=error.message}}
function scheduleAI(){
  if(online){aiThinking=false;renderStatus();return}
  if(!isHumanTurn())window.Playground?.start();
  const status=getGameStatus(state);if(status.over||isHumanTurn()){aiThinking=false;renderStatus();return}
  aiThinking=true;renderStatus();const generation=++aiGeneration;
  window.setTimeout(()=>{if(generation!==aiGeneration)return;if(aiWorker)aiWorker.postMessage({state,depth:Number(difficultySelect.value),id:generation});else finishAIMove(generation,chooseAIMove(state,Number(difficultySelect.value)))},modeSelect.value==="ai-vs-ai"?480:320);
}
function finishAIMove(generation,move){if(generation!==aiGeneration)return;aiThinking=false;if(move)commitMove(move);else render()}
if(aiWorker){aiWorker.onmessage=event=>{if(event.data.error){finishAIMove(event.data.id,chooseAIMove(state,1));return}finishAIMove(event.data.id,event.data.move)};aiWorker.onerror=()=>{aiWorker?.terminate();aiWorker=null;if(aiThinking)finishAIMove(aiGeneration,chooseAIMove(state,1))}}
function newGame(){
  window.Playground?.reset();const duration=Number(clockSelect.value);clocks={w:duration,b:duration};clockExpired=null;reportedResult=false;aiGeneration++;state=createInitialState();selected=null;lastMove=null;history=[];snapshots=[];promotionPending=null;aiThinking=false;if(promotionDialog.open)promotionDialog.close();render();if(online){if(room.role==="host")broadcastPosition()}else scheduleAI();
}
function undo(){
  if(!snapshots.length||aiThinking||modeSelect.value==="ai-vs-ai")return;aiGeneration++;let count=modeSelect.value==="player-vs-ai"&&state.turn==="w"&&snapshots.length>1?2:1;
  while(count--&&snapshots.length){const snapshot=snapshots.pop();state=cloneState(snapshot.state);lastMove=snapshot.lastMove;history.length=snapshot.historyLength}
  selected=null;aiThinking=false;render();scheduleAI();
}

function hint(){if(clockExpired||!isHumanTurn()||getGameStatus(state).over)return;const move=chooseAIMove(state,1);if(!move)return;selected=move.from;renderBoard();statusElement.textContent="Indice : regardez les cases surlignées pour "+indexToSquare(move.from)+"."}
function applySetupMove(from,to){const move=legalMovesFrom(state,squareToIndex(from)).find(candidate=>candidate.to===squareToIndex(to));if(move)state=makeMove(state,move)}
function loadPuzzle(){newGame();modeSelect.value="player-vs-player";state=createInitialState();applySetupMove("f2","f3");applySetupMove("e7","e5");applySetupMove("g2","g4");history=[];snapshots=[];lastMove=null;selected=null;render();statusElement.textContent="Puzzle : les noirs jouent et font mat en un coup."}
function exportGame(){const text=["Playground Échecs",new Date().toLocaleString("fr-FR"),"",...history.map((entry,index)=>(index%2===0?Math.floor(index/2)+1+". ":"")+entry.notation)].join("\n");const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"})),link=document.createElement("a");link.href=url;link.download="partie-echecs.txt";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
hintButton.addEventListener("click",hint);puzzleButton.addEventListener("click",loadPuzzle);exportButton.addEventListener("click",exportGame);themeSelect.addEventListener("change",()=>{document.body.dataset.chessTheme=themeSelect.value;localStorage.setItem("chessTheme",themeSelect.value)});themeSelect.value=localStorage.getItem("chessTheme")||"classic";document.body.dataset.chessTheme=themeSelect.value;clockSelect.addEventListener("change",newGame);
setInterval(()=>{if(!history.length||clockExpired||getGameStatus(state).over)return;const limit=Number(clockSelect.value);if(!limit)return;clocks[state.turn]=Math.max(0,clocks[state.turn]-.25);if(clocks[state.turn]===0){clockExpired=state.turn;aiGeneration++;aiThinking=false}renderClocks();if(clockExpired)renderStatus()},250);
window.addEventListener("playground:replay",newGame);
document.addEventListener("visibilitychange",()=>{if(document.hidden){aiGeneration++;window.Playground?.setPaused(true)}else{window.Playground?.setPaused(false);scheduleAI()}});
document.querySelector("#new-game").addEventListener("click",newGame);undoButton.addEventListener("click",undo);modeSelect.addEventListener("change",()=>{online=modeSelect.value==="online";onlinePanel.hidden=!online;if(!online)room.close();newGame()});difficultySelect.addEventListener("change",()=>{if(!isHumanTurn()&&!online)scheduleAI()});document.querySelector("#flip-board").addEventListener("click",()=>{flipped=!flipped;renderBoard()});
document.querySelector("#create-room").addEventListener("click",()=>enterRoom("create"));document.querySelector("#join-room").addEventListener("click",()=>enterRoom("join"));
render();
