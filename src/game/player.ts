import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ImportMeshAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';

const clipNames = ['Idle', 'Walk', 'Run', 'Sit', 'Wave'] as const;
type Clip = typeof clipNames[number];

export async function createPlayer(scene: Scene, shadows: ShadowGenerator) {
  const model = await ImportMeshAsync(`${import.meta.env.BASE_URL}models/campus-student.glb`, scene);
  const root = new TransformNode('Student', scene);
  // Keep the importer's glTF handedness conversion below the movement root.
  for (const mesh of model.meshes) {
    if (!mesh.parent) mesh.parent = root;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    if (mesh.getTotalVertices() > 0) shadows.addShadowCaster(mesh, false);
  }
  const groups = Object.fromEntries(clipNames.map(name => {
    const group = model.animationGroups.find(g => g.name === name);
    if (!group) throw new Error(`Student model is missing the ${name} animation`);
    group.stop();
    group.weight = name === 'Idle' ? 1 : 0;
    group.start(true);
    return [name, group];
  })) as Record<Clip, AnimationGroup>;
  const face = model.meshes.find(mesh => mesh.name === 'FaceImage');
  if (!face || !model.skeletons.length) throw new Error('Student model is missing its face or skeleton');

  let active: Clip = 'Idle', waveRemaining = 0, lastSpeed = 0, sitting = false, frozen = true;
  const waveDuration = (groups.Wave.to - groups.Wave.from) / groups.Wave.targetedAnimations[0].animation.framePerSecond;
  return {
    root,
    // Kept separate for a future per-player image customization flow.
    face,
    wave() {
      if (frozen || sitting || lastSpeed > .1) return false;
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
    snapshot: () => ({
      animation: active,
      animationPaused: frozen,
      clips: [...clipNames],
      bones: model.skeletons[0].bones.length,
      face: face.name,
      weights: Object.fromEntries(clipNames.map(name => [name, groups[name].weight])),
      animationFrame: groups[active].animatables[0]?.masterFrame ?? 0,
    }),
  };
}
