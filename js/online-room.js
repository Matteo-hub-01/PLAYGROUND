export class OnlineRoom{
  constructor(game,onUpdate){this.game=game;this.onUpdate=onUpdate;this.code="";this.token="";this.role="";this.version=-1;this.connected=false;this.timer=0;this.busy=false;this.sending=false;this.pending=undefined}
  async request(data){const response=await fetch("api/rooms.php",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const result=await response.json().catch(()=>({error:"Réponse serveur invalide"}));if(!response.ok)throw new Error(result.error||"Connexion impossible");return result}
  async create(){return this.connect(await this.request({action:"create",game:this.game}))}
  async join(code){return this.connect(await this.request({action:"join",game:this.game,code:String(code).trim().toUpperCase()}))}
  connect(info){this.code=info.code;this.token=info.token;this.role=info.role;this.version=-1;this.connected=false;this.pending=undefined;clearInterval(this.timer);this.timer=setInterval(()=>this.poll(),50);this.poll();return info}
  async poll(){if(this.busy||!this.code)return;this.busy=true;try{const result=await this.request({action:"poll",code:this.code,token:this.token});if(result.version!==this.version||result.connected!==this.connected){this.version=result.version;this.connected=result.connected;this.onUpdate?.(result.payload,result)}}catch(error){this.onUpdate?.(null,{error:error.message})}finally{this.busy=false}}
  async send(payload){if(!this.code)return;this.pending=payload;if(this.sending)return;this.sending=true;while(this.pending!==undefined&&this.code){const next=this.pending;this.pending=undefined;try{await this.request({action:"send",code:this.code,token:this.token,payload:next})}catch(error){this.onUpdate?.(null,{error:error.message});break}}this.sending=false}
  close(){clearInterval(this.timer);this.timer=0;this.code=this.token=this.role=""}
}

const clone=value=>{
  if(typeof structuredClone==="function")return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

/**
 * Smooths visual coordinates between authoritative network snapshots. Gameplay
 * decisions still come exclusively from the host; only the guest presentation
 * is interpolated.
 */
export class NetworkStateSmoother{
  constructor({response=.055,snapDistance=240}={}){this.response=response;this.snapDistance=snapDistance;this.current=null;this.target=null}
  reset(){this.current=this.target=null}
  push(state){
    this.target=clone(state);
    if(!this.current)this.current=clone(state);
    return this.current
  }
  update(delta){
    if(!this.target)return this.current;
    const alpha=1-Math.exp(-Math.max(0,delta)/this.response);
    this.current=this.blend(this.current,this.target,alpha);
    return this.current
  }
  blend(current,target,alpha,key=""){
    if(Array.isArray(target))return target.map((value,index)=>this.blend(current?.[index],value,alpha,key));
    if(target&&typeof target==="object"){
      const result={};
      for(const property of Object.keys(target))result[property]=this.blend(current?.[property],target[property],alpha,property);
      return result
    }
    const visual=/^(?:x|y|leftY|rightY|ballX|ballY)$/i.test(key);
    if(visual&&Number.isFinite(current)&&Number.isFinite(target)){
      if(Math.abs(target-current)>this.snapDistance)return target;
      const value=current+(target-current)*alpha;
      return Math.abs(target-value)<.01?target:value
    }
    return target
  }
}
