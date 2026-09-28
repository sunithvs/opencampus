import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';

const clipNames = ['Idle', 'Walk', 'Run', 'Sit', 'Wave'] as const;
type Clip = typeof clipNames[number];

const containers=new WeakMap<Scene,Promise<AssetContainer>>();
export async function createPlayer(scene: Scene, shadows: ShadowGenerator, castShadow=true) {
  let promise=containers.get(scene);
  if(!promise){promise=LoadAssetContainerAsync(`${import.meta.env.BASE_URL}models/campus-student.glb`,scene);containers.set(scene,promise);}
  const container=await promise;
  const model=container.instantiateModelsToScene(name=>name,false,{doNotInstantiate:true});
  const meshes=model.rootNodes.flatMap(node=>node.getChildMeshes(false));
  const root = new TransformNode('Student', scene);
  for(const node of model.rootNodes)node.parent=root;
  for(const mesh of meshes){mesh.isPickable=false;mesh.receiveShadows=true;if(castShadow&&mesh.getTotalVertices()>0)shadows.addShadowCaster(mesh,false);}
  const groups = Object.fromEntries(clipNames.map(name => {
    const group = model.animationGroups.find(g => g.name === name);
    if (!group) throw new Error(`Student model is missing the ${name} animation`);
    group.stop();
    group.weight = name === 'Idle' ? 1 : 0;
    group.start(true);
    return [name, group];
  })) as Record<Clip, AnimationGroup>;
  const face = meshes.find(mesh => mesh.name === 'FaceImage');
  if (!face || !model.skeletons.length) throw new Error('Student model is missing its face or skeleton');

  const originalFaceMaterial=face.material as PBRMaterial;
  const faceMaterial=originalFaceMaterial.clone(`Face-${root.uniqueId}`)!;
  const defaultFace=faceMaterial.albedoTexture;face.material=faceMaterial;
  let faceTexture:Texture|undefined,faceGeneration=0,disposed=false,faceSource:string|null=null;
  async function setFace(url:string|null){
    if(disposed)return;
    const generation=++faceGeneration;
    if(url===faceSource)return;
    if(!url){faceMaterial.albedoTexture=defaultFace;faceTexture?.dispose();faceTexture=undefined;faceSource=null;return;}
    let texture:Texture|undefined;
    try{
      await new Promise<void>((resolve,reject)=>{
        // glTF UVs use unflipped images; each avatar owns its replacement texture.
        texture=new Texture(url!,scene,false,false,Texture.TRILINEAR_SAMPLINGMODE,resolve,(_message,error)=>reject(error??Error('Face image could not load.')));
      });
      if(disposed||generation!==faceGeneration){texture?.dispose();return;}
      faceMaterial.albedoTexture=texture!;faceTexture?.dispose();faceTexture=texture;faceSource=url;
    }catch(error){texture?.dispose();if(disposed||generation!==faceGeneration)return;throw error;}
  }
  let active: Clip = 'Idle', waveRemaining = 0, lastSpeed = 0, sitting = false, frozen = true;
  const waveDuration = (groups.Wave.to - groups.Wave.from) / groups.Wave.targetedAnimations[0].animation.framePerSecond;
  return {
    root,
    face, setFace,
    wave(force=false) {
      if (!force && (frozen || sitting || lastSpeed > .1)) return false;
      groups.Wave.goToFrame(groups.Wave.from);
      waveRemaining = waveDuration;
      return true;
    },
    animate(dt: number, speed: number, seated: boolean, paused: boolean) {
      lastSpeed = speed; sitting = seated; frozen = paused;
      if (paused) {
        for (const name of clipNames) groups[name].speedRatio = 0;
        return;
      }
      if (seated || speed > .1) waveRemaining = 0;
      else waveRemaining = Math.max(0, waveRemaining - dt);
      active = seated ? 'Sit' : speed > 4 ? 'Run' : speed > .1 ? 'Walk' : waveRemaining > 0 ? 'Wave' : 'Idle';
      const blend = 1 - Math.exp(-14 * dt);
      for (const name of clipNames) {
        const group = groups[name];
        group.weight += ((name === active ? 1 : 0) - group.weight) * blend;
        group.speedRatio = name === 'Walk' ? Math.max(.2, speed / 3.1) : name === 'Run' ? Math.max(.2, speed / 5.8) : 1;
      }
      // Sit's hip lowering is baked into the clip; the movement root stays on the ground.
    },
    dispose(){disposed=true;faceGeneration++;faceTexture?.dispose();if(defaultFace!==originalFaceMaterial.albedoTexture)defaultFace?.dispose();faceMaterial.dispose(false,false);for(const mesh of meshes)shadows.removeShadowCaster(mesh);model.dispose();root.dispose();},
    setShadows(enabled:boolean){if(castShadow===enabled)return;castShadow=enabled;for(const mesh of meshes)if(mesh.getTotalVertices()>0){if(enabled)shadows.addShadowCaster(mesh,false);else shadows.removeShadowCaster(mesh);}},
    snapshot: () => ({
      animation: active,
      animationPaused: frozen,
      clips: [...clipNames],
      bones: model.skeletons[0].bones.length,
      face: face.name, customFace:!!faceTexture, faceMaterial:faceMaterial.uniqueId,
      weights: Object.fromEntries(clipNames.map(name => [name, groups[name].weight])),
      animationFrame: groups[active].animatables[0]?.masterFrame ?? 0,
    }),
  };
}
