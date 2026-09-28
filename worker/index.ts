import { DurableObject } from 'cloudflare:workers';
import { CampusSimulation, type SavedSession, type Session } from '../shared/simulation';
import { parseMessage, PROTOCOL_VERSION, type ServerMessage } from '../shared/protocol';
export interface Env { CAMPUS:DurableObjectNamespace<CampusRoom>; ASSETS:Fetcher }
type Connection={id?:string;deadline:number;tokens:number;budgetAt:number;lastSeen:number};
type Attachment=Connection&{session?:SavedSession};
export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);
    if(url.pathname==='/api/campus'||url.pathname==='/api/campus/status'){
      if(request.method!=='GET')return new Response('Method not allowed',{status:405});
      if(url.pathname==='/api/campus'){
        if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
        if(request.headers.get('Origin')!==url.origin)return new Response('Origin not allowed',{status:403});
      }
      // A fixed identity: query parameters can never create extra campuses.
      return env.CAMPUS.getByName('public-campus-v1').fetch(request);
    }
    if(url.pathname.startsWith('/api/'))return new Response('Not found',{status:404});
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
export class CampusRoom extends DurableObject<Env> {
  private sim=new CampusSimulation();
  private connections=new Map<WebSocket,Connection>();
  private timer?:ReturnType<typeof setInterval>;
  private ticks=0;
  private lastWork=0;
  private steppedAt=0;
  constructor(ctx:DurableObjectState,env:Env){
    super(ctx,env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
    ctx.blockConcurrencyWhile(async()=>{
      const doors=await ctx.storage.get<Record<string,boolean>>('doors');if(doors)for(const id of Object.keys(this.sim.campus.doors))this.sim.campus.doors[id]=doors[id]===true;
      const reservations=await ctx.storage.get<SavedSession[]>('reservations')??[];
      for(const s of reservations)if(s.expiresAt>Date.now())this.sim.restore(s);
      for(const ws of ctx.getWebSockets()){
        const a=ws.deserializeAttachment() as Attachment|null;
        if(!a)continue;
        this.connections.set(ws,a);
        if(a.session){this.sim.restore({...a.session,online:true});}
      }
      this.sim.expire(Date.now());
    });
  }
  async fetch(request:Request){
    this.sim.expire(Date.now());
    if(new URL(request.url).pathname.endsWith('/status'))return Response.json({online:[...this.sim.sessions.values()].filter(s=>s.online).length,reserved:[...this.sim.sessions.values()].filter(s=>!s.online).length,capacity:50},{headers:{'Cache-Control':'no-store'}});
    if(this.connections.size>=60)return new Response('Campus busy. Please retry shortly.',{status:503});
    const [client,server]=Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const now=Date.now(),c={deadline:now+5000,tokens:60,budgetAt:now,lastSeen:now};this.connections.set(server,c);server.serializeAttachment(c);
    await this.scheduleAlarm();
    return new Response(null,{status:101,webSocket:client});
  }
  private send(ws:WebSocket,message:ServerMessage){try{ws.send(JSON.stringify(message));}catch{void this.drop(ws,true);}}
  private attach(ws:WebSocket,c:Connection){const s=c.id?this.sim.sessions.get(c.id):undefined;ws.serializeAttachment({...c,session:s?this.sim.export(s):undefined});}
  private broadcast(){
    const state=this.sim.snapshot(Date.now());if(!state)return;
    const json=JSON.stringify(state);
    for(const [ws,c] of this.connections)if(c.id){try{ws.send(json);this.attach(ws,c);}catch{void this.drop(ws,true);}}
  }
  async webSocketMessage(ws:WebSocket,raw:string|ArrayBuffer){
    const c=this.connections.get(ws);if(!c)return;
    const now=Date.now();c.tokens=Math.min(60,c.tokens+(now-c.budgetAt)*.035);c.budgetAt=now;c.lastSeen=now;
    if(c.tokens<1){ws.close(4008,'Too many messages');await this.drop(ws,false);return;}c.tokens--;
    const m=parseMessage(raw);
    if(!m){ws.close(4002,'Invalid message or protocol version');await this.drop(ws,false);return;}
    if(m.type==='join'){
      if(c.id){ws.close(4002,'Already joined');await this.drop(ws,false);return;}
      const s=this.sim.admit(m.name,m.resumeToken,now);
      if(!s){this.send(ws,{type:'error',code:'full',message:'Campus full — 50/50. Please try again shortly.'});ws.close(4001,'Campus full');await this.drop(ws,false);return;}
      for(const [old,oldC] of this.connections)if(old!==ws&&oldC.id===s.player.id){this.connections.delete(old);old.close(4009,'Session resumed elsewhere');}
      c.id=s.player.id;this.attach(ws,c);
      this.send(ws,{type:'welcome',version:PROTOCOL_VERSION,id:s.player.id,resumeToken:s.token,state:this.sim.snapshot(now,true)!});
      this.broadcast();await this.persistReservations();await this.scheduleAlarm();return;
    }
    const s=c.id?this.sim.sessions.get(c.id):undefined;
    if(!s){ws.close(4002,'Join first');await this.drop(ws,false);return;}
    if(m.type==='leave'){ws.close(1000,'Left campus');await this.drop(ws,false);return;}
    if(m.type==='stop'){this.sim.stop(s);this.broadcast();return;}
    if(m.type==='input'){
      if(!this.sim.input(s,m,now)){ws.close(4008,'Input backlog or invalid sequence');await this.drop(ws,false);return;}
      this.lastWork=now;this.startLoop();return;
    }
    if(m.type==='action'){
      const error=this.sim.action(s,m.action,m.id,now);
      if(error)this.send(ws,{type:'error',code:'action',message:error});
      if(m.action==='door'&&!error)await this.ctx.storage.put('doors',this.sim.campus.doors);
      this.broadcast();
    }
  }
  private startLoop(){
    if(this.timer)return;
    this.steppedAt=Date.now();
    this.timer=setInterval(()=>{
      const now=Date.now();
      // Keep simulation time aligned with wall time when the runtime delays a timer.
      // Bound catch-up so a long suspension cannot replay seconds of stale movement.
      this.steppedAt=Math.max(this.steppedAt,now-250);
      let broadcast=false;
      while(now-this.steppedAt>=50){
        this.steppedAt+=50;this.sim.step(now);this.ticks++;
        if(this.ticks%2===0)broadcast=true;
      }
      if(broadcast)this.broadcast();
      if(Date.now()-this.lastWork>500){if(this.timer!==undefined)clearInterval(this.timer!);this.timer=undefined;this.broadcast();}
    },50);
  }
  private async persistReservations(){await this.ctx.storage.put('reservations',[...this.sim.sessions.values()].filter(s=>!s.online).map(s=>this.sim.export(s)));}
  private async drop(ws:WebSocket,reserve:boolean){
    const c=this.connections.get(ws);if(!c)return;this.connections.delete(ws);
    if(c.id)this.sim.disconnect(c.id,Date.now(),reserve);
    this.broadcast();await this.persistReservations();await this.scheduleAlarm();
  }
  async webSocketClose(ws:WebSocket,code:number){await this.drop(ws,code!==1000&&code!==4008&&code!==4002);}
  async webSocketError(ws:WebSocket){await this.drop(ws,true);}
  private async scheduleAlarm(){
    const deadlines=[...this.sim.sessions.values()].filter(s=>!s.online).map(s=>s.expiresAt);
    for(const c of this.connections.values())deadlines.push(c.id?Date.now()+60_000:c.deadline);
    if(deadlines.length)await this.ctx.storage.setAlarm(Math.max(Date.now()+100,Math.min(...deadlines)));
    else await this.ctx.storage.deleteAlarm();
  }
  async alarm(){
    const now=Date.now();this.sim.expire(now);
    for(const [ws,c] of this.connections){
      const auto=this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime()??0;
      if((!c.id&&c.deadline<=now)||(c.id&&now-Math.max(c.lastSeen,auto)>60_000)){
        ws.close(4000,'Connection timed out');await this.drop(ws,true);
      }
    }
    this.broadcast();await this.persistReservations();await this.scheduleAlarm();
  }
}
