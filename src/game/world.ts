import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { PLAYER_RADIUS, type Obstacle, type Vec2 } from './state';
import { describeCampus } from '../../shared/layout';
import { createCampusData } from '../../shared/campus';
import { loadTrees, type TreePlacement } from './trees';

export type Interaction = {
  id: string; x: number; z: number; label: () => string;
  kind: 'door' | 'seat' | 'sign'; action: (player?: Vec2) => string | void; seat?: { x: number; z: number; rotation: number };
};
export type World = { obstacles: Obstacle[]; interactions: Interaction[]; update: (dt: number) => void; cameraMeshes: Mesh[]; trees: ReturnType<typeof loadTrees>; setDoors: (states: Record<string, boolean>) => void };

export function buildWorld(scene: Scene, shadows: ShadowGenerator): World {
  const campus=createCampusData();
  const obstacles=campus.obstacles;
  const interactions: Interaction[] = [];
  const cameraMeshes: Mesh[] = [];
  const treePlacements: TreePlacement[] = [];
  const groups = new Map<string, Mesh[]>();
  const doors: { id: string; pivot: TransformNode; open: boolean; target: number }[] = [];
  let seed = 7284;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const mat = (name: string, color: string, rough = true) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularColor = new Color3(rough ? .025 : .22, rough ? .025 : .22, rough ? .025 : .22);
    return m;
  };
  const pink = mat('Rose plaster', '#c88e82');
  const roseLight = mat('Sunlit plaster', '#deaa96');
  const cream = mat('Ivory stone', '#e3d6b9');
  const white = mat('Warm white', '#eee9d5');
  const dark = mat('Window recess', '#283c3c');
  const glass = mat('Window glass', '#6e9b9b', false); glass.alpha = .86;
  const wood = mat('Teak', '#7b4f32');
  const metal = mat('Dark bronze', '#263e37');
  const soil = mat('Garden soil', '#5c6546');
  const leaf = [mat('Palm green', '#476a35'), mat('Palm light', '#6c853f'), mat('Palm deep', '#304e31')];
  const upholstery = mat('Seat cushions', '#b9b386');
  const blackboard = mat('Chalk board', '#274c43');

  function textureMat(name: string, base: string, kind: 'grass' | 'paving' | 'roof' | 'floor') {
    const m = mat(name, '#ffffff');
    const tex = new DynamicTexture(`${name} texture`, 512, scene, true);
    const c = tex.getContext();
    c.fillStyle = base; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 15000; i++) {
      c.fillStyle = rand() > .5 ? `rgba(255,255,235,${rand() * .085})` : `rgba(20,30,15,${rand() * .12})`;
      c.fillRect(rand() * 512, rand() * 512, 1 + rand() * 3, kind === 'grass' ? 3 + rand() * 6 : 1 + rand() * 3);
    }
    if (kind === 'paving' || kind === 'floor') {
      c.strokeStyle = kind === 'paving' ? '#827e6c' : '#b9b9a5'; c.lineWidth = 2;
      for (let row = 0; row < 8; row++) {
        c.beginPath(); c.moveTo(0, row * 64); c.lineTo(512, row * 64); c.stroke();
        for (let col = 0; col < 5; col++) {
          const x = col * 128 + (row % 2) * 64;
          c.beginPath(); c.moveTo(x, row * 64); c.lineTo(x, (row + 1) * 64); c.stroke();
        }
      }
    }
    if (kind === 'roof') {
      for (let y = 0; y < 512; y += 32) {
        c.fillStyle = 'rgba(55,20,12,.2)'; c.fillRect(0, y, 512, 3);
        for (let x = 0; x < 512; x += 16) {
          c.fillStyle = 'rgba(255,213,153,.13)'; c.fillRect(x, y + 3, 4, 27);
          c.fillStyle = 'rgba(55,20,12,.13)'; c.fillRect(x + 12, y + 3, 2, 27);
        }
      }
    }
    tex.update(); tex.uScale = kind === 'grass' ? 24 : kind === 'roof' ? 4 : 3; tex.vScale = kind === 'grass' ? 24 : 3;
    m.diffuseTexture = tex;
    return m;
  }
  const grass = textureMat('Lawn', '#69784a', 'grass');
  const paving = textureMat('Sandstone pavers', '#b1ab93', 'paving');
  const road = textureMat('Campus road', '#777b70', 'paving');
  const roofMat = textureMat('Terracotta tiles', '#b54d35', 'roof');
  const floor = textureMat('Interior terrazzo', '#d2cdb8', 'floor');

  function collect(mesh: Mesh, material: StandardMaterial, blockCamera = false, cast = true) {
    mesh.material = material; mesh.receiveShadows = true; mesh.isPickable = blockCamera;
    mesh.metadata = { cameraBlocker: blockCamera };
    const key = `${material.name}/${blockCamera}/${cast}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(mesh);
    return mesh;
  }
  function obstacle(_x: number, _z: number, _w: number, _d: number) { /* Colliders come from shared campus data. */ }
  function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: StandardMaterial, solid = false, camera = solid) {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene); m.position.set(x, y, z);
    if (solid) obstacle(x, z, w, d);
    return collect(m, material, camera);
  }
  function cylinder(name: string, x: number, y: number, z: number, height: number, diameter: number, material: StandardMaterial, top = diameter) {
    const m = MeshBuilder.CreateCylinder(name, { height, diameterBottom: diameter, diameterTop: top, tessellation: 10 }, scene); m.position.set(x, y, z);
    return collect(m, material);
  }
  function label(text: string, x: number, y: number, z: number, w: number, h: number, background = '#e3d6b9', ink = '#244238', rotation = Math.PI) {
    const t = new DynamicTexture(text, { width: 1024, height: 256 }, scene, true);
    const c = t.getContext() as CanvasRenderingContext2D; c.fillStyle = background; c.fillRect(0, 0, 1024, 256);
    c.font = '600 64px Georgia'; c.textAlign = 'center'; c.fillStyle = ink; c.fillText(text, 512, 153); t.update();
    const m = mat(text, '#ffffff'); m.diffuseTexture = t; m.emissiveColor = new Color3(.08, .08, .08);
    const p = MeshBuilder.CreatePlane(text, { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE }, scene);
    p.position.set(x, y, z); p.rotation.y = rotation; p.material = m; p.isPickable = false;
    return p;
  }
  function roof(x: number, z: number, w: number, d: number, y: number, rise: number) {
    // Four pitched roof faces with a short ridge, matching the campus reference.
    const a = [-w / 2, y, -d / 2], b = [w / 2, y, -d / 2], c = [w / 2, y, d / 2], e = [-w / 2, y, d / 2];
    const r1 = [-w / 2 + Math.min(w * .25, d * .4), y + rise, 0], r2 = [w / 2 - Math.min(w * .25, d * .4), y + rise, 0];
    const tris = [[a, b, r2], [a, r2, r1], [e, r1, r2], [e, r2, c], [a, r1, e], [b, c, r2]];
    const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
    tris.forEach((tri, i) => tri.forEach((p, j) => { positions.push(p[0], p[1], p[2]); indices.push(i * 3 + j); uvs.push((p[0] + w / 2) / w, (p[2] + d / 2 + (p[1] - y) * .8) / d); }));
    const normals: number[] = []; VertexData.ComputeNormals(positions, indices, normals);
    const data = new VertexData(); data.positions = positions; data.indices = indices; data.normals = normals; data.uvs = uvs;
    const m = new Mesh('Hipped terracotta roof', scene); data.applyToMesh(m); m.position.set(x, 0, z);
    roofMat.backFaceCulling = false; collect(m, roofMat, true);
    box('Roof ridge', x, y + rise, z, Math.max(1, w - d * .8), .18, .2, roofMat);
    box('Front fascia', x, y, z + d / 2, w, .23, .18, cream);
    box('Rear fascia', x, y, z - d / 2, w, .23, .18, cream);
  }
  function windowFront(x: number, y: number, z: number, w = 1.3, h = 1.65) {
    box('Recess', x, y, z, w + .24, h + .24, .18, cream);
    box('Window', x, y, z + .11, w, h, .055, dark);
    box('Glazing', x, y + .025, z + .15, w - .12, h - .14, .025, glass);
    box('Window mullion', x, y, z + .18, .055, h, .035, cream);
    box('Window crossbar', x, y - .12, z + .18, w, .045, .04, cream);
    box('Window sill', x, y - h / 2 - .13, z + .15, w + .4, .13, .38, white);
  }
  function palm(x: number, z: number, height = 8) {
    treePlacements.push({ kind: 'palm', x, z, scale: height / 8, rotation: rand() * Math.PI * 2 });
  }
  function tree(x: number, z: number, scale = 1) {
    treePlacements.push({ kind: 'shade', x, z, scale, rotation: rand() * Math.PI * 2 });
  }
  function hedge(x: number, z: number, w: number, d: number) {
    box('Garden border', x, .12, z, w + .18, .24, d + .18, cream);
    box('Clipped hedge', x, .48, z, w, .7, d, leaf[2], true);
  }
  function bench(x: number, z: number, rotation = 0, id = `bench-${x}-${z}`) {
    const root = new TransformNode('Garden bench', scene); root.position.set(x, 0, z); root.rotation.y = rotation;
    const make = (name: string, xx: number, yy: number, zz: number, w: number, h: number, d: number, m: StandardMaterial) => {
      const mesh = box(name, xx, yy, zz, w, h, d, m); mesh.parent = root;
    };
    for (const xx of [-.85, .85]) { make('Bench legs', xx, .3, 0, .1, .6, .6, metal); make('Bench upright', xx, .7, .28, .07, 1.0, .07, metal); }
    for (let i = 0; i < 4; i++) { make('Seat slat', 0, .56, -.24 + i * .15, 2.1, .09, .12, wood); make('Back slat', 0, .8 + i * .13, .3, 2.1, .095, .075, wood); }
    obstacle(x, z, Math.abs(Math.cos(rotation)) * 2.1 + .4, Math.abs(Math.sin(rotation)) * 2.1 + .65);
    interactions.push({ id, x: x - Math.sin(rotation) * .9, z: z - Math.cos(rotation) * .9, kind: 'seat', label: () => 'Sit for a moment', action: () => {}, seat: { x, z: z, rotation: rotation + Math.PI } });
  }
  function lamp(x: number, z: number) {
    cylinder('Lamp post', x, 1.7, z, 3.4, .09, metal);
    box('Lantern', x, 3.5, z, .35, .4, .35, cream);
    box('Lantern cap', x, 3.75, z, .5, .1, .5, metal);
  }
  function door(id: string, x: number, z: number, alongX: boolean) {
    const pivot = new TransformNode(id, scene);
    const width = 1.8;
    pivot.position.set(alongX ? x - width / 2 : x, 0, alongX ? z : z - width / 2);
    const panel = MeshBuilder.CreateBox('Teak door', { width: alongX ? width : .12, height: 2.7, depth: alongX ? .12 : width }, scene);
    panel.parent = pivot; panel.position.set(alongX ? width / 2 : 0, 1.35, alongX ? 0 : width / 2); panel.material = wood; panel.receiveShadows = true;
    panel.metadata = { cameraBlocker: true }; cameraMeshes.push(panel); shadows.addShadowCaster(panel);
    const state = { id, pivot, open: false, target: 0 }; doors.push(state);
    const h = MeshBuilder.CreateSphere('Brass door handle', { diameter: .1, segments: 6 }, scene);
    h.parent = panel; h.position.set(alongX ? .62 : .1, -.1, alongX ? .1 : .62); h.material = cream;
    interactions.push({ id, x, z, kind: 'door', label: () => state.open ? 'Close classroom door' : 'Open classroom door', action: player => {
      if (player && state.open && Math.abs(player.x - x) < (alongX ? width / 2 : .12) + PLAYER_RADIUS + .1 && Math.abs(player.z - z) < (alongX ? .12 : width / 2) + PLAYER_RADIUS + .1) return 'Step clear of the doorway before closing it.';
      state.open = !state.open; campus.doors[id] = state.open; state.target = state.open ? -Math.PI / 2 : 0;
    } });
  }

  const water = mat('Fountain water', '#719b8e', false); water.alpha = .88;
  const palette: Record<string, StandardMaterial> = { pink, roseLight, cream, white, wood, metal, upholstery, blackboard, grass, paving, road, soil, water, floor, leaf0:leaf[0], leaf1:leaf[1], leaf2:leaf[2] };
  describeCampus({
    box:(n,x,y,z,w,h,d,m,solid,camera)=>box(n,x,y,z,w,h,d,palette[m],solid,camera),
    cylinder:(n,x,y,z,h,d,m,top)=>cylinder(n,x,y,z,h,d,palette[m],top),
    label,windowFront,roof,palm,tree,hedge,bench,lamp,door,obstacle:()=>{},
    ground(){const m=MeshBuilder.CreateGround('Campus lawn',{width:230,height:230},scene);collect(m,grass,false,false);},
    gardenPath(){const m=MeshBuilder.CreateTorus('Garden circular path',{diameter:19,thickness:3.2,tessellation:48},scene);m.position.set(-34,-.95,9);m.scaling.y=.65;collect(m,paving,false,false);},
    shrub(x,z,color){const m=MeshBuilder.CreateSphere('Garden shrub',{diameter:.65,segments:5},scene);m.position.set(x,.4,z);collect(m,leaf[color]);},
    sign(id,x,z){interactions.push({id,x,z,kind:'sign',label:()=> 'Read garden sign',action:()=>{}});},
  });
  // A single mesh per material/category keeps draw calls low on mobile.
  for (const [key, meshes] of groups) {
    if (!meshes.length) continue;
    const merged = Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
    if (!merged) continue;
    merged.name = key; merged.receiveShadows = true;
    const [, camera, cast] = key.split('/');
    merged.isPickable = camera === 'true'; merged.metadata = { cameraBlocker: camera === 'true' };
    if (camera === 'true') cameraMeshes.push(merged);
    if (cast === 'true') shadows.addShadowCaster(merged);
    merged.freezeWorldMatrix();
  }
  return { obstacles, interactions, cameraMeshes, trees: loadTrees(scene, shadows, treePlacements), setDoors(states) { for(const d of doors) { d.open=states[d.id]??false;campus.doors[d.id]=d.open;d.target=d.open?-Math.PI/2:0; } }, update(dt) { for (const d of doors) d.pivot.rotation.y += (d.target - d.pivot.rotation.y) * Math.min(1, dt * 9); } };
}
