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
