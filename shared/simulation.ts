import { createCampusData, doorRect } from './campus';
import { isBlocked, movePlayer, SPAWN, type Vec2 } from '../src/game/state';
import { MAX_PLAYERS, RECONNECT_MS, STEP_MS, type Input, type PublicPlayer, type WorldState } from './protocol';
export type Session={player:PublicPlayer;token:string;online:boolean;expiresAt:number;standing:Vec2;lastSeq:number;lastReceived:number;lastAction:number;queue:Input[]};
export type SavedSession=Omit<Session,'queue'>;
export class CampusSimulation {
  campus=createCampusData();
  sessions=new Map<string,Session>();
  private published=new Map<string,string>();
  private lastPopulation='';
  private lastDoors='';
  restore(s:SavedSession){this.sessions.set(s.player.id,{...s,lastSeq:s.player.seq,queue:[],player:{...s.player,speed:0}});}
  export(s:Session):SavedSession { const {queue,...saved}=s;return structuredClone(saved); }
  admit(name:string,token:string|undefined,now:number){
    this.expire(now);
    let s=token?[...this.sessions.values()].find(p=>p.token===token):undefined;
    if(!s){
      if(this.sessions.size>=MAX_PLAYERS)return null;
      const id=crypto.randomUUID();
      s={player:{id,name,x:SPAWN.x,z:SPAWN.z,rotation:Math.PI,speed:0,seatId:null,wave:0,seq:0},token:crypto.randomUUID(),online:true,expiresAt:0,standing:{...SPAWN},lastSeq:0,lastReceived:now,lastAction:-Infinity,queue:[]};
      this.sessions.set(id,s);
    }
    s.online=true;s.expiresAt=0;s.player.name=name;s.queue=[];s.lastSeq=s.player.seq;s.player.speed=0;s.lastReceived=now;
    return s;
  }
  disconnect(id:string,now:number,reserve=true){
    const s=this.sessions.get(id);if(!s)return;
    this.stop(s);this.stand(s);s.online=false;s.expiresAt=now+RECONNECT_MS;
    if(!reserve)this.sessions.delete(id);
  }
  expire(now:number){for(const [id,s] of this.sessions)if(!s.online&&s.expiresAt<=now)this.sessions.delete(id);}
  stop(s:Session){s.queue=[];s.player.seq=s.lastSeq;s.player.speed=0;}
  input(s:Session,input:Input,now:number){
    if(input.seq<=s.lastSeq||input.seq>s.lastSeq+64||s.queue.length>=8)return false;
    s.lastSeq=input.seq;s.lastReceived=now;s.queue.push(input);return true;
  }
  step(now:number){
    for(const s of this.sessions.values()){
      if(!s.online)continue;
      if(now-s.lastReceived>350){this.stop(s);continue;}
      const input=s.queue.shift();
      if(!input){if(now-s.lastReceived>120)s.player.speed=0;continue;}
      if(Math.hypot(input.x,input.z)>.01)this.stand(s);
      const p=predict(s.player,input,this.campus.obstacles);
      s.player={...s.player,...p,seq:input.seq};
    }
  }
  private stand(s:Session){
    if(!s.player.seatId)return;
    const seat=this.campus.interactions.find(i=>i.id===s.player.seatId)!;
    const choices=[s.standing,{x:seat.x,z:seat.z},...[1.5,2.5,4].flatMap(r=>[0,1,2,3,4,5,6,7].map(a=>({x:seat.x+Math.cos(a*Math.PI/4)*r,z:seat.z+Math.sin(a*Math.PI/4)*r}))),SPAWN];
    const p=choices.find(p=>!isBlocked(p.x,p.z,this.campus.obstacles))!;
    Object.assign(s.player,p,{seatId:null,speed:0});
  }
  action(s:Session,action:string,id:string|undefined,now:number):string|null {
    if(now-s.lastAction<200)return 'Please wait a moment.';
    s.lastAction=now;
    if(action==='stand'){this.stand(s);return null;}
    if(action==='reset'){this.stop(s);this.stand(s);Object.assign(s.player,SPAWN,{rotation:Math.PI});return null;}
    if(action==='wave'){
      if(s.player.seatId||s.player.speed>.1||s.queue.some(i=>Math.hypot(i.x,i.z)>.01))return 'Stand still to wave.';
      s.player.wave++;return null;
    }
    const item=this.campus.interactions.find(i=>i.id===id);
    if(!item||Math.hypot(s.player.x-item.x,s.player.z-item.z)>2.6)return 'Move closer to interact.';
    if(action==='door'&&item.kind==='door'){
      const open=!this.campus.doors[item.id];const target=doorRect(item,open);
      if([...this.sessions.values()].some(p=>isBlocked(p.player.x,p.player.z,[target],.42)))return 'Someone is in the doorway. Wait for them to move.';
      this.campus.doors[item.id]=open;return null;
    }
    if(action==='sit'&&item.kind==='seat'&&item.seat){
      if([...this.sessions.values()].some(p=>p.player.seatId===id))return 'This seat is occupied.';
      this.stand(s);this.stop(s);s.standing={x:s.player.x,z:s.player.z};Object.assign(s.player,item.seat,{seatId:id,speed:0});return null;
    }
    return 'That interaction is unavailable.';
  }
  snapshot(now:number,full=false):WorldState|null {
    const online=[...this.sessions.values()].filter(s=>s.online),players=online.map(s=>({...s.player}));
    const count=players.length,reserved=this.sessions.size-count;
    if(full)return {type:'state',time:now,players,removed:[],doors:{...this.campus.doors},count,reserved};
    const changed=players.filter(p=>this.published.get(p.id)!==JSON.stringify(p));
    const removed=[...this.published.keys()].filter(id=>!online.some(s=>s.player.id===id));
    const population=`${count}/${reserved}`,doorKey=JSON.stringify(this.campus.doors);
    if(!changed.length&&!removed.length&&this.lastPopulation===population&&this.lastDoors===doorKey)return null;
    this.published=new Map(players.map(p=>[p.id,JSON.stringify(p)]));this.lastPopulation=population;this.lastDoors=doorKey;
    return {type:'state',time:now,players:changed,removed,doors:{...this.campus.doors},count,reserved};
  }
}
export function predict(p:Vec2&{rotation:number},input:Input,obstacles:ReturnType<typeof createCampusData>['obstacles']){
  const len=Math.max(1,Math.hypot(input.x,input.z)),speed=input.run?5.8:3.1;
  const result=movePlayer(p,input.x/len*speed*STEP_MS/1000,input.z/len*speed*STEP_MS/1000,obstacles);
  const dx=result.x-p.x,dz=result.z-p.z,moved=Math.hypot(dx,dz);
  return {...result,rotation:moved>.001?Math.atan2(dx,dz):p.rotation,speed:moved/(STEP_MS/1000)};
}
