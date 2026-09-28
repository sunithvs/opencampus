export const PROTOCOL_VERSION=1;
export const MAX_PLAYERS=50;
export const STEP_MS=50;
export const RECONNECT_MS=30_000;
export type Input={type:'input';seq:number;x:number;z:number;run:boolean};
export type ClientMessage=Input|{type:'join';version:number;name:string;resumeToken?:string}|{type:'action';action:'door'|'sit'|'stand'|'wave'|'reset';id?:string}|{type:'stop'}|{type:'leave'};
export type PublicPlayer={id:string;name:string;x:number;z:number;rotation:number;speed:number;seatId:string|null;wave:number;seq:number};
export type WorldState={type:'state';time:number;players:PublicPlayer[];removed:string[];doors:Record<string,boolean>;count:number;reserved:number};
export type Welcome={type:'welcome';version:number;id:string;resumeToken:string;state:WorldState};
export type ServerMessage=WorldState|Welcome|{type:'error';code:string;message:string};
export function parseMessage(raw:unknown):ClientMessage|null {
  if(typeof raw!=='string'||raw.length>2048)return null;
  try {
    const m=JSON.parse(raw);if(!m||typeof m!=='object')return null;
    if(m.type==='join'&&m.version===PROTOCOL_VERSION&&typeof m.name==='string'&&(m.resumeToken===undefined||(typeof m.resumeToken==='string'&&m.resumeToken.length<=80))){
      const name=m.name.replace(/[\u0000-\u001f\u007f]/g,'').trim();
      if(name.length>=1&&name.length<=24)return {type:'join',version:PROTOCOL_VERSION,name,resumeToken:m.resumeToken};
    }
    if(m.type==='input'&&Number.isSafeInteger(m.seq)&&m.seq>0&&m.seq<2**31&&Number.isFinite(m.x)&&Number.isFinite(m.z)&&Math.abs(m.x)<=1&&Math.abs(m.z)<=1&&typeof m.run==='boolean')return m;
    if(m.type==='action'&&['door','sit','stand','wave','reset'].includes(m.action)&&(!m.id||(typeof m.id==='string'&&m.id.length<=80)))return m;
    if(m.type==='stop'||m.type==='leave')return m;
  }catch{/* Invalid packets never enter simulation. */}
  return null;
}
