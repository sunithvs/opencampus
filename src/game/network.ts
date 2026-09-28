import { PROTOCOL_VERSION, type Input, type PublicPlayer, type ServerMessage, type WorldState } from '../../shared/protocol';
export type ConnectionStatus='connecting'|'online'|'reconnecting'|'full'|'failed'|'offline';
export class CampusConnection {
  id='';ready=false;seq=0;
  players=new Map<string,PublicPlayer>();
  pending:Input[]=[];
  private socket?:WebSocket;
  private token='';private name='';private retries=0;private closed=true;
  private retryTimer?:number;private heartbeat?:number;private welcomeTimer?:number;private lastPong=0;
  constructor(private callbacks:{status:(s:ConnectionStatus)=>void;state:(state:WorldState,welcome:boolean)=>void;error:(message:string)=>void}){
    try{this.token=sessionStorage.getItem('campus-resume')??'';}catch{/* Resume remains in memory. */}
  }
  connect(name:string){this.socket?.close(4000,'Reconnecting');this.name=name;this.closed=false;this.retries=0;clearTimeout(this.retryTimer);this.open();}
  private open(){
    this.ready=false;this.callbacks.status(this.retries?'reconnecting':'connecting');
    const url=new URL('/api/campus',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';
    const ws=new WebSocket(url);this.socket=ws;
    this.welcomeTimer=window.setTimeout(()=>{if(this.socket===ws&&!this.ready)ws.close(4000,'Connection timeout');},8000);
    ws.onopen=()=>{if(this.socket!==ws||this.closed){ws.close();return;}ws.send(JSON.stringify({type:'join',version:PROTOCOL_VERSION,name:this.name,resumeToken:this.token||undefined}));};
    ws.onmessage=e=>{
      if(ws!==this.socket)return;
      if(e.data==='pong'){this.lastPong=performance.now();return;}
      let m:ServerMessage;try{m=JSON.parse(e.data);}catch{return;}
      if(m.type==='error'){this.callbacks.error(m.message);if(m.code==='full'){this.closed=true;this.callbacks.status('full');}return;}
      if(m.type==='welcome'){
        if(m.version!==PROTOCOL_VERSION){this.disconnect();this.callbacks.error('The campus was updated. Refresh to continue.');return;}
        clearTimeout(this.welcomeTimer);this.id=m.id;this.token=m.resumeToken;try{sessionStorage.setItem('campus-resume',this.token);}catch{/* optional */}
        this.players.clear();this.pending=[];this.seq=m.state.players.find(p=>p.id===m.id)?.seq??0;this.ready=true;this.retries=0;
        this.apply(m.state,true);this.callbacks.status('online');this.lastPong=performance.now();
        clearInterval(this.heartbeat);this.heartbeat=window.setInterval(()=>{
          if(performance.now()-this.lastPong>35000){ws.close(4000,'Heartbeat lost');return;}
          if(ws.readyState===WebSocket.OPEN)ws.send('ping');
        },10000);
      }else if(m.type==='state')this.apply(m,false);
    };
    ws.onclose=e=>{
      if(this.socket!==ws)return;this.ready=false;clearTimeout(this.welcomeTimer);clearInterval(this.heartbeat);
      if(this.closed)return;
      if([4001,4002,4008,4009].includes(e.code)){this.closed=true;this.callbacks.status(e.code===4001?'full':'failed');this.callbacks.error(e.reason||'Connection ended. Please rejoin.');return;}
      if(this.retries>=5){this.callbacks.status('failed');return;}
      this.callbacks.status('reconnecting');this.retryTimer=window.setTimeout(()=>{this.retries++;this.open();},Math.min(8000,1000*2**this.retries));
    };
  }
  private apply(state:WorldState,welcome:boolean){
    for(const p of state.players)this.players.set(p.id,p);
    for(const id of state.removed)this.players.delete(id);
    const own=this.players.get(this.id);if(own)this.pending=this.pending.filter(i=>i.seq>own.seq);
    this.callbacks.state(state,welcome);
  }
  input(x:number,z:number,run:boolean){
    if(!this.ready||this.pending.length>=8)return null;
    const input:Input={type:'input',seq:++this.seq,x,z,run};this.pending.push(input);this.send(input);return input;
  }
  async updateFace(image:Blob|null){
    if(!this.ready)throw Error('Wait until you are connected, then try again.');
    const id=this.id;
    const response=await fetch('/api/campus/face',{
      method:image?'PUT':'DELETE',headers:{Authorization:`Bearer ${this.token}`,...(image?{'Content-Type':'image/jpeg'}:{})},body:image,
      signal:AbortSignal.timeout(15000),
    });
    if(!response.ok)throw Error(await response.text());
    if(this.id!==id||!this.ready)throw Error('Your connection changed. Please try again.');
  }
  action(action:'door'|'sit'|'stand'|'wave'|'reset',id?:string){this.send({type:'action',action,id});}
  stop(){if(this.ready)this.send({type:'stop'});}
  private send(value:object){if(this.ready&&this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(value));}
  disconnect(reserve=false){
    this.closed=true;clearTimeout(this.retryTimer);clearTimeout(this.welcomeTimer);clearInterval(this.heartbeat);
    if(!reserve)this.send({type:'leave'});
    this.socket?.close(reserve?4000:1000,reserve?'Reconnecting':'Offline mode');this.socket=undefined;this.ready=false;this.players.clear();this.pending=[];
    if(!reserve){this.token='';try{sessionStorage.removeItem('campus-resume');}catch{/*optional*/}}
    this.callbacks.status('offline');
  }
}
