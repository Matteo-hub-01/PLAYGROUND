export class OnlineRoom{
  constructor(game,onUpdate){this.game=game;this.onUpdate=onUpdate;this.code="";this.token="";this.role="";this.version=-1;this.connected=false;this.timer=0;this.busy=false;this.sending=false;this.pending=undefined;this.latency=0;this.failures=0;this.closed=true}
  async request(data){const started=performance.now(),options={method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)};if(globalThis.AbortSignal?.timeout)options.signal=AbortSignal.timeout(5000);const response=await fetch("api/rooms.php",options);this.latency=Math.round(performance.now()-started);const result=await response.json().catch(()=>({error:"Réponse serveur invalide"}));if(!response.ok)throw new Error(result.error||"Connexion impossible");return result}
  async create(){return this.connect(await this.request({action:"create",game:this.game}))}
  async join(code){return this.connect(await this.request({action:"join",game:this.game,code:String(code).trim().toUpperCase()}))}
  connect(info){this.code=info.code;this.token=info.token;this.role=info.role;this.version=-1;this.connected=false;this.pending=undefined;this.failures=0;this.closed=false;clearTimeout(this.timer);this.poll();return info}
  schedule(){if(this.closed||!this.code)return;const base=this.pending!==undefined?0:document.hidden?750:this.connected?80:250,delay=Math.min(2500,base*Math.max(1,2**this.failures));clearTimeout(this.timer);this.timer=setTimeout(()=>this.poll(),delay)}
  async poll(){if(this.busy||!this.code)return;this.busy=true;const outbound=this.pending;this.pending=undefined;try{const request={action:"poll",code:this.code,token:this.token};if(outbound!==undefined)request.payload=outbound;const result=await this.request(request);const changed=result.version!==this.version||result.connected!==this.connected||this.failures>0;this.failures=0;if(changed){this.version=result.version;this.connected=result.connected;this.onUpdate?.(result.payload,{...result,latency:this.latency,network:this.latency<90?"excellent":this.latency<180?"stable":"lent"})}}catch(error){if(this.pending===undefined&&outbound!==undefined)this.pending=outbound;this.failures=Math.min(6,this.failures+1);this.onUpdate?.(null,{error:this.failures>1?"Reconnexion en cours…":error.message,reconnecting:true,latency:this.latency})}finally{this.busy=false;this.schedule()}}
  send(payload){if(!this.code)return;this.pending=payload;if(!this.busy){clearTimeout(this.timer);this.timer=setTimeout(()=>this.poll(),0)}}
  close(){this.closed=true;clearTimeout(this.timer);this.timer=0;this.code=this.token=this.role="";this.failures=0}
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
