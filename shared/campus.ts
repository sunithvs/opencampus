import { describeCampus } from './layout';
import type { Obstacle, Vec2 } from '../src/game/state';
export type InteractionData = { id:string;kind:'door'|'seat'|'sign';x:number;z:number;alongX?:boolean;seat?:Vec2 & {rotation:number} };
export const rect=(x:number,z:number,w:number,d:number):Obstacle=>({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
export function doorRect(d:InteractionData,open:boolean):Obstacle {
  const {x,z,alongX}=d,w=1.8;
  return open?{minX:alongX?x-w/2-.07:x-w,maxX:alongX?x-w/2+.07:x,minZ:alongX?z:z-w/2-.07,maxZ:alongX?z+w:z-w/2+.07}:rect(x,z,alongX?w:.24,alongX?.24:w);
}
export function createCampusData() {
  const obstacles:Obstacle[]=[],interactions:InteractionData[]=[],doors:Record<string,boolean>={};
  const obstacle=(x:number,z:number,w:number,d:number)=>obstacles.push(rect(x,z,w,d));
  const noop=()=>{};
  describeCampus({
    box(_n,x,_y,z,w,_h,d,_m,solid){if(solid)obstacle(x,z,w,d);},
    cylinder:noop,label:noop,windowFront:noop,roof:noop,lamp:noop,ground:noop,gardenPath:noop,shrub:noop,
    palm:(x,z)=>obstacle(x,z,.55,.55),tree:(x,z)=>obstacle(x,z,.6,.6),hedge:obstacle,obstacle,
    bench(x,z,rotation=0,id=`bench-${x}-${z}`){
      obstacle(x,z,Math.abs(Math.cos(rotation))*2.1+.4,Math.abs(Math.sin(rotation))*2.1+.65);
      interactions.push({id,kind:'seat',x:x-Math.sin(rotation)*.9,z:z-Math.cos(rotation)*.9,seat:{x,z,rotation:rotation+Math.PI}});
    },
    door(id,x,z,alongX){
      const d:InteractionData={id,kind:'door',x,z,alongX};interactions.push(d);doors[id]=false;
      obstacles.push({...doorRect(d,false),enabled:()=>!doors[id]},{...doorRect(d,true),enabled:()=>doors[id]});
    },
    sign(id,x,z){interactions.push({id,x,z,kind:'sign'});},
  });
  return {obstacles,interactions,doors};
}
