// The single source of campus placement data. No DOM or rendering-engine imports.
export interface CampusRenderer {
  box(name:string,x:number,y:number,z:number,w:number,h:number,d:number,material:string,solid?:boolean,camera?:boolean):unknown;
  cylinder(name:string,x:number,y:number,z:number,h:number,d:number,material:string,top?:number):unknown;
  label(text:string,x:number,y:number,z:number,w:number,h:number,bg?:string,ink?:string,rotation?:number):unknown;
  windowFront(x:number,y:number,z:number,w?:number,h?:number):unknown;
  roof(x:number,z:number,w:number,d:number,y:number,rise:number):unknown;
  palm(x:number,z:number,height?:number):unknown;
  tree(x:number,z:number,scale?:number):unknown;
  hedge(x:number,z:number,w:number,d:number):unknown;
  bench(x:number,z:number,rotation?:number,id?:string):unknown;
  lamp(x:number,z:number):unknown;
  door(id:string,x:number,z:number,alongX:boolean):unknown;
  obstacle(x:number,z:number,w:number,d:number):unknown;
  ground():unknown;
  gardenPath():unknown;
  shrub(x:number,z:number,color:number):unknown;
  sign(id:string,x:number,z:number):unknown;
}
export function describeCampus(renderer: CampusRenderer) {
  const {box,cylinder,label,windowFront,roof,palm,tree,hedge,bench,lamp,door,obstacle,ground,gardenPath,shrub,sign}=renderer;
  const [pink,roseLight,cream,white,wood,metal,upholstery,blackboard,grass,paving,road,soil,water,floor]=['pink','roseLight','cream','white','wood','metal','upholstery','blackboard','grass','paving','road','soil','water','floor'];
  const leaf=['leaf0','leaf1','leaf2'];
  let seed=7284;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  // Grounds and the broad, palm-lined entrance avenue.
  ground();
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
  gardenPath();
  cylinder('Fountain base', -34, .18, 9, .36, 5, cream); obstacle(-34, 9, 5, 5);
  cylinder('Fountain basin', -34, .44, 9, .25, 4.6, white);

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
      shrub(x + (rand() - .5) * .4, z + (rand() - .5) * .4, j);
    }
  }
  label('PALM GARDEN', -23, 1.7, 14.5, 2.6, .6);
  for (const x of [-24.1, -21.9]) box('Garden sign post', x, .9, 14.5, .09, 1.8, .09, metal);
  sign('garden-sign', -23, 15);
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
}
