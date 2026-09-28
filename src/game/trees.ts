import type { Scene } from '@babylonjs/core/scene';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';

export type TreePlacement = { kind: 'palm' | 'shade'; x: number; z: number; scale: number; rotation: number };

export async function loadTrees(scene: Scene, shadows: ShadowGenerator, placements: TreePlacement[]) {
  const assets = await Promise.all((['palm', 'shade'] as const).map(async kind => {
    const filename = kind === 'palm' ? 'campus-palm.glb' : 'campus-shade-tree.glb';
    const container = await LoadAssetContainerAsync(`${import.meta.env.BASE_URL}models/${filename}`, scene);
    return { kind, container };
  }));
  let batches = 0;
  for (const { kind, container } of assets) {
    const trees = placements.filter(tree => tree.kind === kind);
    container.addAllToScene();
    const matrices = new Float32Array(trees.length * 16);
    trees.forEach((tree, i) => {
      Matrix.Compose(new Vector3(tree.scale, tree.scale, tree.scale), Quaternion.RotationAxis(Vector3.Up(), tree.rotation), new Vector3(tree.x, 0, tree.z)).copyToArray(matrices, i * 16);
    });
    for (const mesh of container.meshes) {
      if (!(mesh instanceof Mesh) || !mesh.getTotalVertices()) continue;
      // Bake Blender/glTF axes once. Instance matrices use the game's Y-up coordinates.
      const transform = mesh.computeWorldMatrix(true).clone();
      mesh.parent = null;
      mesh.bakeTransformIntoVertices(transform);
      mesh.position.setAll(0); mesh.scaling.setAll(1); mesh.rotationQuaternion = null; mesh.rotation.setAll(0);
      mesh.computeWorldMatrix(true);
      mesh.name = `${kind} trees / ${mesh.name}`;
      mesh.metadata = { treeAsset: kind };
      // The campus's shared collision data handles tree trunks.
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      if (trees.length) {
        mesh.thinInstanceSetBuffer('matrix', matrices, 16, true);
        mesh.thinInstanceRefreshBoundingInfo();
        shadows.addShadowCaster(mesh, false);
        batches++;
      } else mesh.setEnabled(false);
      mesh.freezeWorldMatrix();
    }
  }
  return { palm: placements.filter(p => p.kind === 'palm').length, shade: placements.filter(p => p.kind === 'shade').length, batches };
}
