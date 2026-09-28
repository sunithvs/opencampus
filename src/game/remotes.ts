import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { createPlayer } from './player';
import type { PublicPlayer } from '../../shared/protocol';
type Avatar=Awaited<ReturnType<typeof createPlayer>>;
type Remote={avatar:Avatar;label:Mesh;texture:DynamicTexture;material:StandardMaterial;wave:number;frames:{at:number;player:PublicPlayer}[];elapsed:number};
export class RemotePlayers {
  private remotes=new Map<string,Remote>();private pending=new Map<string,symbol>();
  private desired=new Map<string,PublicPlayer>();
  constructor(private scene:Scene,private shadows:ShadowGenerator,private onError:(error:unknown)=>void){}
  sync(players:Map<string,PublicPlayer>,self:string){
    this.desired=new Map([...players].filter(([id])=>id!==self));
    for(const [id,r] of this.remotes)if(!this.desired.has(id)){this.dispose(r);this.remotes.delete(id);}
    for(const [id] of this.pending)if(!this.desired.has(id))this.pending.delete(id);
    for(const [id,p] of this.desired){
      const r=this.remotes.get(id);
      if(r){
        const last=r.frames.at(-1);if(last?.player.name!==p.name)drawName(r.texture,p.name);if(!last||JSON.stringify(last.player)!==JSON.stringify(p)){r.frames.push({at:performance.now(),player:{...p}});if(r.frames.length>12)r.frames.shift();}
        if(p.wave!==r.wave){r.wave=p.wave;r.avatar.wave(true);}
      }else if(!this.pending.has(id)){
        const marker=Symbol(id);this.pending.set(id,marker);
        void createPlayer(this.scene,this.shadows,false).then(avatar=>{
          if(this.pending.get(id)!==marker||!this.desired.has(id)){avatar.dispose();return;}
          this.pending.delete(id);const player=this.desired.get(id)!;
          const texture=new DynamicTexture(`name-${id}`,{width:512,height:96},this.scene,true);drawName(texture,player.name);
          const material=new StandardMaterial(`name-${id}`,this.scene);material.diffuseTexture=texture;material.emissiveColor=Color3.White();material.disableLighting=true;material.backFaceCulling=false;
          const label=MeshBuilder.CreatePlane(`name-${id}`,{width:1.7,height:.32},this.scene);label.material=material;label.billboardMode=Mesh.BILLBOARDMODE_ALL;label.parent=avatar.root;label.position.y=2.25;label.isPickable=false;
          avatar.root.position.set(player.x,.05,player.z);avatar.root.rotation.y=player.rotation;
          this.remotes.set(id,{avatar,label,texture,material,wave:player.wave,frames:[{at:performance.now(),player:{...player}}],elapsed:0});
        }).catch(error=>{this.pending.delete(id);this.onError(error);});
      }
    }
  }
  update(dt:number,local:{x:number;z:number},low:boolean){
    for(const [id,r] of this.remotes){
      const p=this.desired.get(id);if(!p)continue;
      const t=performance.now()-120;
      while(r.frames.length>2&&r.frames[1].at<t)r.frames.shift();
      const a=r.frames[0],b=r.frames[1]??a,alpha=a===b?1:Math.max(0,Math.min(1,(t-a.at)/(b.at-a.at)));
      const seatChanged=a.player.seatId!==b.player.seatId;
      const x=seatChanged?b.player.x:a.player.x+(b.player.x-a.player.x)*alpha,z=seatChanged?b.player.z:a.player.z+(b.player.z-a.player.z)*alpha;
      r.avatar.root.position.x=x;r.avatar.root.position.z=z;
      const delta=Math.atan2(Math.sin(b.player.rotation-a.player.rotation),Math.cos(b.player.rotation-a.player.rotation));r.avatar.root.rotation.y=a.player.rotation+delta*alpha;
      const distance=Math.hypot(x-local.x,z-local.z);r.label.setEnabled(distance<25);r.avatar.root.setEnabled(distance<(low?55:90));r.avatar.setShadows(!low&&distance<14);
      r.elapsed+=dt;
      if(distance<20||r.elapsed>.1){r.avatar.animate(r.elapsed,p.speed,!!p.seatId,distance>(low?55:90));r.elapsed=0;}
    }
  }
  private dispose(r:Remote){r.label.dispose();r.material.dispose();r.texture.dispose();r.avatar.dispose();}
  clear(){this.desired.clear();this.pending.clear();for(const r of this.remotes.values())this.dispose(r);this.remotes.clear();}
  get count(){return this.remotes.size;}
}

function drawName(texture:DynamicTexture,name:string){
  const c=texture.getContext() as CanvasRenderingContext2D;
  c.clearRect(0,0,512,96);c.fillStyle='rgba(24,59,45,.85)';c.fillRect(0,0,512,96);c.font='500 42px sans-serif';c.textAlign='center';c.fillStyle='#f7f7ed';c.fillText(name,256,62,490);texture.hasAlpha=true;texture.update();
}
