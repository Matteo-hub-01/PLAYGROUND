export const INITIAL_BOARD=[
  "rnbqkbnr","pppppppp","........","........","........","........","PPPPPPPP","RNBQKBNR"
].join("");
export const PIECE_NAMES={p:"pion",n:"cavalier",b:"fou",r:"tour",q:"dame",k:"roi"};
export const PIECE_VALUES={p:100,n:320,b:330,r:500,q:900,k:20000};
export const opposite=color=>color==="w"?"b":"w";
export const pieceColor=piece=>!piece?null:piece===piece.toUpperCase()?"w":"b";
export const indexToSquare=index=>"abcdefgh"[index%8]+(8-Math.floor(index/8));
export const squareToIndex=square=>(8-Number(square[1]))*8+"abcdefgh".indexOf(square[0]);
const row=index=>Math.floor(index/8),col=index=>index%8,onBoard=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
const cloneState=state=>({...state,board:[...state.board]});

export function createInitialState(){
  return{board:[...INITIAL_BOARD].map(p=>p==="."?null:p),turn:"w",castling:"KQkq",enPassant:null,halfmove:0,fullmove:1};
}
export function stateFrom(board,turn="w",options={}){
  if(board&&typeof board==="object"&&!Array.isArray(board)&&"board" in board){
    const config=board;board=config.board;turn=config.turn??turn;options=config;
  }
  if(Array.isArray(board)&&board.length===8&&board.every(line=>typeof line==="string"))board=board.join("");
  const pieces=typeof board==="string"?[...board].map(p=>p==="."?null:p):[...board];
  const castling=typeof options.castling==="string"?options.castling:Object.entries(options.castling||{}).filter(([,allowed])=>allowed).map(([right])=>right).join("");
  return{board:pieces,turn,castling,enPassant:options.enPassant??null,halfmove:options.halfmove||0,fullmove:options.fullmove||1};
}
function slidingMoves(state,from,directions){
  const moves=[],color=pieceColor(state.board[from]),r=row(from),c=col(from);
  for(const[dr,dc]of directions)for(let step=1;step<8;step++){
    const nr=r+dr*step,nc=c+dc*step;if(!onBoard(nr,nc))break;const to=nr*8+nc,target=state.board[to];
    if(!target)moves.push({from,to});else{if(pieceColor(target)!==color)moves.push({from,to,capture:target});break}
  }return moves;
}
function pawnMoves(state,from,color){
  const moves=[],r=row(from),c=col(from),dir=color==="w"?-1:1,start=color==="w"?6:1,promotionRow=color==="w"?0:7;
  const oneR=r+dir;if(onBoard(oneR,c)&&!state.board[oneR*8+c]){
    addPawnMove(moves,from,oneR*8+c,oneR===promotionRow);
    const twoR=r+dir*2;if(r===start&&!state.board[twoR*8+c])moves.push({from,to:twoR*8+c,doublePawn:true});
  }
  for(const dc of[-1,1]){const nr=r+dir,nc=c+dc;if(!onBoard(nr,nc))continue;const to=nr*8+nc,target=state.board[to];
    if(target&&pieceColor(target)!==color)addPawnMove(moves,from,to,nr===promotionRow,target);
    else if(to===state.enPassant)moves.push({from,to,enPassant:true,capture:color==="w"?"p":"P"});
  }return moves;
}
function addPawnMove(moves,from,to,promotion,capture=null){
  if(promotion)for(const piece of["q","r","b","n"])moves.push({from,to,promotion:piece,capture});
  else moves.push({from,to,capture});
}
function kingMoves(state,from,color){
  const moves=[],r=row(from),c=col(from);
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const nr=r+dr,nc=c+dc;if(!onBoard(nr,nc))continue;
    const to=nr*8+nc,target=state.board[to];if(!target||pieceColor(target)!==color)moves.push({from,to,capture:target||null})}
  const enemy=opposite(color),home=color==="w"?60:4;
  if(from===home&&!isSquareAttacked(state,from,enemy)){
    const kingRight=color==="w"?"K":"k",queenRight=color==="w"?"Q":"q";
    if(state.castling.includes(kingRight)&&!state.board[home+1]&&!state.board[home+2]&&!isSquareAttacked(state,home+1,enemy)&&!isSquareAttacked(state,home+2,enemy))moves.push({from,to:home+2,castle:"king"});
    if(state.castling.includes(queenRight)&&!state.board[home-1]&&!state.board[home-2]&&!state.board[home-3]&&!isSquareAttacked(state,home-1,enemy)&&!isSquareAttacked(state,home-2,enemy))moves.push({from,to:home-2,castle:"queen"});
  }return moves;
}
export function generatePseudoMoves(state,color=state.turn){
  const moves=[];
  for(let from=0;from<64;from++){const piece=state.board[from];if(!piece||pieceColor(piece)!==color)continue;
    switch(piece.toLowerCase()){
      case"p":moves.push(...pawnMoves(state,from,color));break;
      case"n":{const r=row(from),c=col(from);for(const[dr,dc]of[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){const nr=r+dr,nc=c+dc;if(!onBoard(nr,nc))continue;const to=nr*8+nc,target=state.board[to];if(!target||pieceColor(target)!==color)moves.push({from,to,capture:target||null})}break}
      case"b":moves.push(...slidingMoves(state,from,[[-1,-1],[-1,1],[1,-1],[1,1]]));break;
      case"r":moves.push(...slidingMoves(state,from,[[-1,0],[1,0],[0,-1],[0,1]]));break;
      case"q":moves.push(...slidingMoves(state,from,[[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]));break;
      case"k":moves.push(...kingMoves(state,from,color));break;
    }
  }return moves;
}
export function isSquareAttacked(state,square,byColor){
  const r=row(square),c=col(square),pawnDir=byColor==="w"?1:-1;
  for(const dc of[-1,1]){const nr=r+pawnDir,nc=c+dc;if(onBoard(nr,nc)){const p=state.board[nr*8+nc];if(p&&pieceColor(p)===byColor&&p.toLowerCase()==="p")return true}}
  for(const[dr,dc]of[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){const nr=r+dr,nc=c+dc;if(onBoard(nr,nc)){const p=state.board[nr*8+nc];if(p&&pieceColor(p)===byColor&&p.toLowerCase()==="n")return true}}
  for(const[dr,dc,types]of[[-1,-1,"bq"],[-1,1,"bq"],[1,-1,"bq"],[1,1,"bq"],[-1,0,"rq"],[1,0,"rq"],[0,-1,"rq"],[0,1,"rq"]])
    for(let step=1;step<8;step++){const nr=r+dr*step,nc=c+dc*step;if(!onBoard(nr,nc))break;const p=state.board[nr*8+nc];if(p){if(pieceColor(p)===byColor&&types.includes(p.toLowerCase()))return true;break}}
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const nr=r+dr,nc=c+dc;if(onBoard(nr,nc)){const p=state.board[nr*8+nc];if(p&&pieceColor(p)===byColor&&p.toLowerCase()==="k")return true}}
  return false;
}
export function isInCheck(state,color){
  const king=state.board.findIndex(piece=>piece===(color==="w"?"K":"k"));return king<0||isSquareAttacked(state,king,opposite(color));
}
export function makeMove(state,move){
  const next=cloneState(state),piece=next.board[move.from],color=pieceColor(piece),target=next.board[move.to];
  next.board[move.from]=null;next.board[move.to]=move.promotion?(color==="w"?move.promotion.toUpperCase():move.promotion):piece;
  if(move.enPassant)next.board[move.to+(color==="w"?8:-8)]=null;
  if(move.castle==="king"){next.board[move.to-1]=next.board[move.to+1];next.board[move.to+1]=null}
  if(move.castle==="queen"){next.board[move.to+1]=next.board[move.to-2];next.board[move.to-2]=null}
  let rights=next.castling;
  if(piece.toLowerCase()==="k")rights=rights.replace(color==="w"?/[KQ]/g:/[kq]/g,"");
  const rookRights={63:"K",56:"Q",7:"k",0:"q"};if(rookRights[move.from])rights=rights.replace(rookRights[move.from],"");if(rookRights[move.to]&&target)rights=rights.replace(rookRights[move.to],"");
  next.castling=rights;next.enPassant=move.doublePawn?(move.from+move.to)/2:null;
  next.halfmove=piece.toLowerCase()==="p"||target||move.enPassant?0:state.halfmove+1;
  if(color==="b")next.fullmove=state.fullmove+1;next.turn=opposite(color);return next;
}
export function generateLegalMoves(state,color=state.turn){
  return generatePseudoMoves(state,color).filter(move=>!isInCheck(makeMove({...state,turn:color},move),color));
}
export function legalMovesFrom(state,from){return generateLegalMoves(state).filter(move=>move.from===from)}
export function insufficientMaterial(state){
  const pieces=state.board.map((p,i)=>p?{p:p.toLowerCase(),i}:null).filter(Boolean).filter(x=>x.p!=="k");
  if(!pieces.length)return true;if(pieces.length===1&&["b","n"].includes(pieces[0].p))return true;
  if(pieces.every(x=>x.p==="b"))return new Set(pieces.map(x=>(row(x.i)+col(x.i))%2)).size===1;return false;
}
export function getGameStatus(state){
  const legal=generateLegalMoves(state),check=isInCheck(state,state.turn);
  const result=!legal.length?(check?"checkmate":"stalemate"):state.halfmove>=100?"fifty-move":insufficientMaterial(state)?"insufficient":check?"check":"playing";
  return{over:["checkmate","stalemate","fifty-move","insufficient"].includes(result),result,reason:result,winner:result==="checkmate"?opposite(state.turn):null,check,legal};
}
export function moveNotation(before,move,after){
  if(move.castle)return move.castle==="king"?"O-O":"O-O-O";const piece=before.board[move.from],letter=piece.toLowerCase()==="p"?"":piece.toUpperCase();
  const capture=Boolean(move.capture||move.enPassant),pawnFile=piece.toLowerCase()==="p"&&capture?indexToSquare(move.from)[0]:"";
  let text=letter+pawnFile+(capture?"×":"")+indexToSquare(move.to)+(move.promotion?"="+move.promotion.toUpperCase():"");
  const status=getGameStatus(after);if(status.result==="checkmate")text+="#";else if(status.check)text+="+";return text;
}
function evaluate(state){
  let score=0;for(let i=0;i<64;i++){const piece=state.board[i];if(!piece)continue;const color=pieceColor(piece),type=piece.toLowerCase();
    let value=PIECE_VALUES[type],center=3.5-Math.abs(3.5-col(i))+3.5-Math.abs(3.5-row(i));if(type!=="k")value+=center*3;
    score+=(color==="w"?1:-1)*value}return score;
}
function orderedMoves(state){return generateLegalMoves(state).sort((a,b)=>(b.capture?PIECE_VALUES[b.capture.toLowerCase()]:0)-(a.capture?PIECE_VALUES[a.capture.toLowerCase()]:0))}
function minimax(state,depth,alpha,beta){
  const moves=orderedMoves(state);if(!moves.length){if(isInCheck(state,state.turn))return state.turn==="w"?-999999-depth:999999+depth;return 0}
  if(depth===0||state.halfmove>=100||insufficientMaterial(state))return evaluate(state);
  if(state.turn==="w"){let best=-Infinity;for(const move of moves){best=Math.max(best,minimax(makeMove(state,move),depth-1,alpha,beta));alpha=Math.max(alpha,best);if(beta<=alpha)break}return best}
  let best=Infinity;for(const move of moves){best=Math.min(best,minimax(makeMove(state,move),depth-1,alpha,beta));beta=Math.min(beta,best);if(beta<=alpha)break}return best;
}
export function chooseAIMove(state,depth=2,random=Math.random){
  const moves=orderedMoves(state);if(!moves.length)return null;let bestScore=state.turn==="w"?-Infinity:Infinity,best=[];
  for(const move of moves){const score=minimax(makeMove(state,move),Math.max(0,depth-1),-Infinity,Infinity);
    if(state.turn==="w"?(score>bestScore):(score<bestScore)){bestScore=score;best=[move]}else if(score===bestScore)best.push(move)}
  const mistakeChance=depth<=1?.42:depth===2?.16:0;
  if(mistakeChance&&random()<mistakeChance){const candidates=moves.filter(move=>!move.capture);const pool=candidates.length?candidates:moves;return pool[Math.floor(random()*pool.length)]}
  return best[Math.floor(random()*best.length)];
}
