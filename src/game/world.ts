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

export type Interaction = {
  id: string; x: number; z: number; label: () => string;
  kind: 'door' | 'seat' | 'sign'; action: (player?: Vec2) => string | void; seat?: { x: number; z: number; rotation: number };
};
export type World = { obstacles: Obstacle[]; interactions: Interaction[]; update: (dt: number) => void; cameraMeshes: Mesh[] };

export function buildWorld(scene: Scene, shadows: ShadowGenerator): World {
  const obstacles: Obstacle[] = [];
  const interactions: Interaction[] = [];
  const cameraMeshes: Mesh[] = [];
  const groups = new Map<string, Mesh[]>();
  const doors: { pivot: TransformNode; open: boolean; target: number }[] = [];
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
  const trunk = mat('Palm bark', '#82715a');
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
  function obstacle(x: number, z: number, w: number, d: number) { obstacles.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }); }
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
    obstacle(x, z, .55, .55);
    const stem = cylinder('Palm trunk', x, height / 2, z, height, .42, trunk, .27); stem.rotation.z = (rand() - .5) * .07;
    for (let i = 0; i < 9; i++) {
      const angle = i * Math.PI * 2 / 9 + rand() * .25;
      const points: Vector3[] = [];
      const len = 3 + rand() * 1.7;
      for (let j = 0; j <= 6; j++) {
        const t = j / 6;
        points.push(new Vector3(x + Math.cos(angle) * len * t, height + Math.sin(t * Math.PI) * 1.2 - t * t * 1.5, z + Math.sin(angle) * len * t));
      }
      const widths = [0.06, .28, .43, .48, .36, .2, 0];
      const left = points.map((p, j) => p.add(new Vector3(Math.sin(angle) * widths[j], .02, -Math.cos(angle) * widths[j])));
      const right = points.map((p, j) => p.add(new Vector3(-Math.sin(angle) * widths[j], -.04, Math.cos(angle) * widths[j])));
      const frond = MeshBuilder.CreateRibbon('Palm frond', { pathArray: [left, points, right], sideOrientation: Mesh.DOUBLESIDE }, scene);
      collect(frond, leaf[i % 3]);
      // Narrow leaflets give the silhouette a feathered edge.
      for (let j = 2; j < 6; j++) {
        for (const side of [-1, 1]) {
          const p = points[j]; const spread = .6 * Math.sin(j / 6 * Math.PI);
          const tip = p.add(new Vector3(Math.sin(angle) * spread * side + Math.cos(angle) * .35, -.18, -Math.cos(angle) * spread * side + Math.sin(angle) * .35));
          const feather = MeshBuilder.CreateRibbon('Palm leaflet', { pathArray: [[p, tip], [p.add(new Vector3(.08, .02, .08)), tip]], sideOrientation: Mesh.DOUBLESIDE }, scene);
          collect(feather, leaf[(i + j) % 3]);
        }
      }
    }
    cylinder('Palm crown', x, height - .15, z, .7, .55, leaf[2]);
  }
  function tree(x: number, z: number, s = 1) {
    obstacle(x, z, .6, .6); cylinder('Tree trunk', x, 2 * s, z, 4 * s, .5 * s, trunk, .3);
    for (let i = 0; i < 4; i++) {
      const crown = MeshBuilder.CreateSphere('Tree canopy', { diameter: (3.5 + rand()) * s, segments: 6 }, scene);
      crown.position.set(x + (rand() - .5) * 2.5 * s, (4 + rand() * 1.5) * s, z + (rand() - .5) * 2.5 * s);
      crown.scaling.y = .9; collect(crown, leaf[i % 3]);
    }
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
    const state = { pivot, open: false, target: 0 }; doors.push(state);
    const h = MeshBuilder.CreateSphere('Brass door handle', { diameter: .1, segments: 6 }, scene);
    h.parent = panel; h.position.set(alongX ? .62 : .1, -.1, alongX ? .1 : .62); h.material = cream;
    // Keep both the closed doorway and the swung-open leaf solid.
    obstacles.push({ minX: x - (alongX ? width / 2 : .12), maxX: x + (alongX ? width / 2 : .12), minZ: z - (alongX ? .12 : width / 2), maxZ: z + (alongX ? .12 : width / 2), enabled: () => !state.open });
    obstacles.push({
      minX: alongX ? x - width / 2 - .07 : x - width,
      maxX: alongX ? x - width / 2 + .07 : x,
      minZ: alongX ? z : z - width / 2 - .07,
      maxZ: alongX ? z + width : z - width / 2 + .07,
      enabled: () => state.open,
    });
    interactions.push({ id, x, z, kind: 'door', label: () => state.open ? 'Close classroom door' : 'Open classroom door', action: player => {
      if (player && state.open && Math.abs(player.x - x) < (alongX ? width / 2 : .12) + PLAYER_RADIUS + .1 && Math.abs(player.z - z) < (alongX ? .12 : width / 2) + PLAYER_RADIUS + .1) return 'Step clear of the doorway before closing it.';
      state.open = !state.open; state.target = state.open ? -Math.PI / 2 : 0;
    } });
  }

  // Grounds and the broad, palm-lined entrance avenue.
  const ground = MeshBuilder.CreateGround('Campus lawn', { width: 230, height: 230 }, scene); collect(ground, grass, false, false);
  box('Entrance avenue', 0, .015, 39, 10, .035, 86, road);
  box('Main forecourt', 0, .025, -6, 61, .05, 15, paving);
  box('Café walkway', 26, .025, 12, 47, .05, 4, paving);
  box('Garden walkway', -24, .025, 12, 42, .05, 4, paving);
  box('West campus road', -37, .012, -24, 6, .03, 79, road);
  box('East campus road', 34, .012, -33, 6, .03, 58, road);
  for (const side of [-1, 1]) {
    box('Avenue curb', side * 5.2, .12, 37, .3, .24, 79, cream);
    for (let z = 4; z < 73; z += 12) { palm(side * 8, z, 7.7 + rand()); lamp(side * 5.8, z + 5); }
    for (let z = 21; z < 62; z += 12) hedge(side * 12, z, 4, 1.2);
  }
  // Central academic building: real walkable ground floor, with furnished wings.
  box('Academic floor', 0, .025, -24, 54, .05, 20, floor);
  box('North wall', 0, 1.7, -34, 54, 3.4, .4, roseLight, true);
  box('West wall', -27, 1.7, -24, .4, 3.4, 20, roseLight, true);
  box('East wall', 27, 1.7, -24, .4, 3.4, 20, roseLight, true);
  for (const side of [-1, 1]) {
    box('Entrance façade', side * 15, 1.7, -14, 24, 3.4, .45, pink, true);
    box('Corridor partition', side * 4, 1.7, -17.15, .2, 3.4, 6.3, cream, true);
    box('Corridor partition', side * 4, 1.7, -28.05, .2, 3.4, 11.9, cream, true);
    box('Door lintel', side * 4, 3.0, -21.2, .2, .8, 1.8, cream, false, true);
    door(`classroom-${side < 0 ? 'west' : 'east'}-door`, side * 4, -21.2, false);
    for (let x = 7; x < 26; x += 3.5) windowFront(side * x, 1.9, -13.73, 1.3, 1.55);
    label(side < 0 ? '101' : '102', side * 3.86, 2.6, -19.7, .8, .25, '#e3d6b9', '#244238', side * Math.PI / 2);
  }
  box('Entrance lintel', 0, 3.1, -14, 6, .6, .45, cream, false, true);
  box('Ground floor ceiling', 0, 3.5, -24, 54, .2, 20, cream, false, true);
  box('Upper academic floors', 0, 6.65, -24, 54, 6.1, 20, pink, false, true);
  for (const y of [3.6, 6.6, 9.55]) box('Continuous cornice', 0, y, -13.7, 54.6, .23, .5, cream);
  for (let x = -25; x <= 25; x += 3.55) {
    for (const y of [5.1, 8.1]) windowFront(x, y, -13.67);
    box('Façade pilaster', x + 1.68, 5.0, -13.59, .27, 9.1, .35, cream);
  }
  roof(0, -24, 56.2, 22.1, 9.8, 4.7);
  // Central portico and pediment.
  for (const x of [-3.25, 3.25]) {
    box('Portico columns', x, 2.15, -11.3, .55, 4.3, .55, cream, true);
    box('Column plinth', x, .18, -11.3, .8, .36, .8, white);
    box('Column capital', x, 4.0, -11.3, .8, .3, .8, white);
  }
  box('Portico canopy', 0, 4.3, -12, 8.2, .3, 4.9, cream, false, true);
  roof(0, -12, 8.4, 5.1, 4.48, 1.65);
  label('ACADEMIC BLOCK', 0, 3.8, -9.5, 5.8, .65);
  label('WELCOME TO CAMPUS', 0, 2.4, -33.72, 4.6, .65);
  // Interior details: lights, noticeboards, desks, chairs, and teaching walls.
  for (const z of [-17, -24, -31]) {
    box('Hall light', 0, 3.34, z, 1.2, .08, .4, white);
    box('Hall runner', 0, .065, z, 3.2, .025, 5, upholstery);
  }
  for (const side of [-1, 1]) {
    const cx = side * 15.5;
    box('Teaching board frame', cx, 1.95, -33.7, 7.2, 1.8, .16, wood);
    box('Teaching board', cx, 1.95, -33.58, 6.9, 1.55, .06, blackboard);
    label(side < 0 ? 'A place for bright ideas.' : 'Stay curious.', cx, 2.0, -33.53, 6.3, .9, '#274c43', '#e5e7d4');
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      const x = side < 0 ? -23 + col * 4.3 : 8 + col * 4.3;
      const z = -28.5 + row * 3.8;
      box('Student desktop', x, .82, z, 2.5, .1, 1.05, wood, true);
      for (const dx of [-1.0, 1.0]) { box('Desk leg', x + dx, .39, z, .065, .78, .6, metal); }
      for (const dx of [-.64, .64]) {
        box('Student chair seat', x + dx, .46, z + 1.02, .62, .1, .6, upholstery);
        box('Student chair back', x + dx, .82, z + 1.3, .62, .68, .08, wood);
        for (const sx of [-.23, .23]) box('Chair leg', x + dx + sx, .22, z + 1.05, .04, .44, .48, metal);
      }
      if ((row + col) % 2 === 0) box('Notebook', x + .4, .886, z, .4, .03, .3, cream);
    }
    box('Lectern', cx, .65, -31.7, 1.3, 1.3, .8, wood, true);
    for (const x of [side * 10, side * 21]) box('Ceiling fixture', x, 3.34, -24, 1.7, .08, .5, white);
  }
  // Café, open to the courtyard through a wide entrance.
  box('Café floor', 44, .03, 7, 16, .06, 14, floor);
  box('Café rear wall', 44, 1.65, 0, 16, 3.3, .3, roseLight, true);
  box('Café left wall', 36, 1.65, 7, .3, 3.3, 14, roseLight, true);
  box('Café right wall', 52, 1.65, 7, .3, 3.3, 14, roseLight, true);
  for (const x of [38.9, 49.1]) box('Café front wall', x, 1.65, 14, 5.8, 3.3, .3, pink, true);
  box('Café lintel', 44, 2.95, 14, 4.4, .7, .3, cream, false, true);
  box('Café ceiling', 44, 3.35, 7, 16, .15, 14, cream, false, true);
  roof(44, 7, 17.5, 15.5, 3.5, 3.6);
  for (const x of [38.8, 49.2]) windowFront(x, 1.7, 14.2, 3.5, 1.8);
  label('THE CAMPUS CAFÉ', 44, 3.0, 14.24, 4.2, .58);
  box('Café entrance terrace', 44, .03, 18.5, 19, .06, 9, paving);
  box('Service counter', 44, .6, 2.2, 10, 1.2, 1.3, wood, true);
  box('Stone countertop', 44, 1.23, 2.2, 10.2, .1, 1.5, cream);
  box('Coffee machine', 46, 1.56, 2.2, .9, .6, .6, metal);
  label('COFFEE  /  TEA  /  GOOD COMPANY', 44, 2.15, .22, 8, 1.0, '#274c43', '#f1e4c9');
  for (const [x, z] of [[39, 7], [49, 7], [39, 11], [49, 11], [39, 19], [49, 19]]) {
    cylinder('Café table', x, .82, z, .1, 1.45, wood); cylinder('Table pedestal', x, .4, z, .8, .09, metal); obstacle(x, z, 1.45, 1.45);
    for (const dx of [-1.12, 1.12]) {
      cylinder('Café stool', x + dx, .48, z, .1, .55, upholstery); cylinder('Stool leg', x + dx, .24, z, .45, .08, metal);
    }
    cylinder('Cup', x + .25, .95, z, .17, .12, white);
    cylinder('Table planter', x - .2, .96, z, .18, .16, cream); cylinder('Table plant', x - .2, 1.13, z, .2, .23, leaf[0], .05);
  }
  bench(44, 22, 0, 'cafe-bench');
  // Garden with a looping footpath, a fountain, and places to sit.
  const ring = MeshBuilder.CreateTorus('Garden circular path', { diameter: 19, thickness: 3.2, tessellation: 48 }, scene); ring.position.set(-34, -.95, 9); ring.scaling.y = .65; collect(ring, paving, false, false);
  cylinder('Fountain base', -34, .18, 9, .36, 5, cream); obstacle(-34, 9, 5, 5);
  cylinder('Fountain basin', -34, .44, 9, .25, 4.6, white);
  const water = mat('Fountain water', '#719b8e', false); water.alpha = .88;
  cylinder('Water', -34, .59, 9, .025, 4.2, water);
  cylinder('Fountain pedestal', -34, .85, 9, 1.0, .55, cream);
  cylinder('Fountain bowl', -34, 1.38, 9, .18, 1.8, cream, 2.2);
  cylinder('Upper water', -34, 1.49, 9, .025, 1.95, water);
  bench(-34, 18, 0, 'garden-south'); bench(-34, 0, Math.PI, 'garden-north'); bench(-44, 9, -Math.PI / 2, 'garden-west');
  for (const [x, z] of [[-42, 17], [-25, 18], [-43, 0], [-25, 0]]) { tree(x, z, 1.25); lamp(x + 1.7, z); }
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    const x = -34 + Math.cos(a) * 6.5, z = 9 + Math.sin(a) * 6.5;
    cylinder('Flower bed', x, .08, z, .16, 1.0, soil);
    for (let j = 0; j < 3; j++) {
      const shrub = MeshBuilder.CreateSphere('Garden shrub', { diameter: .65, segments: 5 }, scene); shrub.position.set(x + (rand() - .5) * .4, .4, z + (rand() - .5) * .4); collect(shrub, leaf[j]);
    }
  }
  label('PALM GARDEN', -23, 1.7, 14.5, 2.6, .6);
  for (const x of [-24.1, -21.9]) box('Garden sign post', x, .9, 14.5, .09, 1.8, .09, metal);
  interactions.push({ id: 'garden-sign', x: -23, z: 15, kind: 'sign', label: () => 'Read garden sign', action: () => {} });
  // Supporting blocks make a campus silhouette, with dense greenery beyond.
  function backgroundBlock(x: number, z: number, w: number, d: number, h: number) {
    box('Campus building', x, h / 2, z, w, h, d, roseLight, true);
    for (let y = 1.6; y < h; y += 2.8) {
      box('Building cornice', x, y + 1.2, z + d / 2, w + .3, .15, .28, cream);
      for (let xx = x - w / 2 + 1.7; xx < x + w / 2 - 1; xx += 3.1) windowFront(xx, y, z + d / 2 + .12, 1.2, 1.5);
    }
    roof(x, z, w + 1.3, d + 1.3, h + .1, 3.0);
  }
  backgroundBlock(-53, -29, 19, 16, 8.8);
  backgroundBlock(48, -32, 20, 17, 9.2);
  backgroundBlock(-18, -57, 29, 15, 9.1);
  backgroundBlock(21, -62, 20, 14, 11.8);
  for (let i = 0; i < 75; i++) {
    const a = rand() * Math.PI * 2, r = 70 + rand() * 34;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 0 && Math.abs(x) < 14) continue;
    tree(x, z, 1 + rand() * .9);
  }
  for (const [x, z] of [[-31,-9], [31,-9], [-31,-43], [31,-44], [58,18], [57,-6], [-52,28], [-20,37], [22,38], [-58,-3]]) palm(x, z, 8 + rand() * 2);
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
  return { obstacles, interactions, cameraMeshes, update(dt) { for (const d of doors) d.pivot.rotation.y += (d.target - d.pivot.rotation.y) * Math.min(1, dt * 9); } };
}
