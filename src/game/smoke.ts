// Development-only integration checks, exercised by opening /?smoke in the browser.
// These drive the same DOM keyboard events and controls as a player, with isolated saves.
type Snapshot = { x: number; z: number; paused: boolean; seated: boolean; place: string; interaction?: string; fps: number; player: { animation: string; animationPaused: boolean; bones: number; face: string; clips: string[]; animationFrame: number; weights: Record<string, number> } };
export async function runSmoke(game: { snapshot: () => Snapshot }) {
  const panel=document.createElement('pre');panel.id='smoke-results';panel.style.cssText='position:fixed;z-index:200;top:100px;left:10px;max-width:380px;max-height:50vh;overflow:auto;padding:15px;background:#10271fe8;color:#edffe8;font:12px/1.5 monospace;pointer-events:none;border-radius:8px;white-space:pre-wrap;';document.body.append(panel);
  const result=(text:string)=>panel.textContent+=`${text}\n`;
  const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
  const key=(code:string,type='keydown')=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));
  const click=(id:string)=>document.getElementById(id)!.click();
  const assert=(ok:boolean,label:string)=>{if(!ok)throw new Error(label);result(`PASS ${label}`);};
  const travel=async(code:string,predicate:(s:Snapshot)=>boolean,timeout=15000)=>{
    const start=performance.now();key('ShiftLeft');key(code);
    while(!predicate(game.snapshot())){if(performance.now()-start>timeout){key(code,'keyup');key('ShiftLeft','keyup');throw new Error(`Movement ${code} timed out: ${JSON.stringify(game.snapshot())}`);}await wait(25);}
    key(code,'keyup');key('ShiftLeft','keyup');await wait(80);
  };
  try {
    await wait(800);click('start-button');await wait(100);
    assert(!game.snapshot().paused,'Start exploring begins play');
    assert(game.snapshot().player.bones>=16 && game.snapshot().player.face==='FaceImage','Rigged GLB and square face loaded');
    assert(game.snapshot().player.clips.length===5,'All five animation clips loaded');
    click('wave-button');await wait(250);
    assert(game.snapshot().player.animation==='Wave','Hand button plays Wave');
    click('map-button');await wait(150);
    const frozenFrame=game.snapshot().player.animationFrame;
    await wait(200);
    assert(game.snapshot().player.animationPaused && Math.abs(game.snapshot().player.animationFrame-frozenFrame)<.01,'Pause freezes skeletal animation');
    (document.querySelector('#map-dialog .close-dialog') as HTMLButtonElement).click();await wait(2800);
    assert(game.snapshot().player.animation==='Idle','Wave finishes in Idle');
    key('KeyW');await wait(250);
    assert(game.snapshot().player.animation==='Walk','Movement plays Walk');
    const walkFrame=game.snapshot().player.animationFrame;await wait(200);
    assert(Math.abs(game.snapshot().player.animationFrame-walkFrame)>.01,'Walk skeleton animation advances');
    key('ShiftLeft');await wait(200);
    assert(game.snapshot().player.animation==='Run','Shift movement plays Run');
    key('KeyW','keyup');key('ShiftLeft','keyup');await wait(300);
    assert(game.snapshot().player.animation==='Idle' && game.snapshot().player.weights.Idle>.95,'Stopping blends back to Idle');
    await travel('KeyW',s=>s.z<=-21.2);
    assert(game.snapshot().place==='Academic block','Walk from entrance into academic hall');
    await travel('KeyA',s=>s.x>=3.45);
    key('KeyA');await wait(350);key('KeyA','keyup');
    assert(game.snapshot().x<3.8,'Closed classroom door blocks entry');
    assert(game.snapshot().interaction==='classroom-east-door','Classroom door interaction is reachable');
    key('KeyE');key('KeyE','keyup');await wait(400);
    await travel('KeyA',s=>s.x>6,4000);
    assert(game.snapshot().x>4.5,'Open classroom door allows entry');
    await travel('KeyW',s=>s.z<=-23,4000);
    await travel('KeyA',s=>s.x>=10,4000);
    assert(game.snapshot().place==='Classroom 102','Furnished classroom is reachable');
    click('map-button');await wait(80);
    assert(game.snapshot().paused && (document.getElementById('map-dialog') as HTMLDialogElement).open,'Map pauses the game');
    (document.querySelector('#map-dialog .close-dialog') as HTMLButtonElement).click();await wait(80);
    assert(!game.snapshot().paused,'Closing map resumes play');
    click('settings-button');click('reset-button');await wait(80);
    assert(Math.abs(game.snapshot().z-29)<.1,'Return to entrance resets player');
    await travel('KeyW',s=>s.z<17.5);
    await travel('KeyA',s=>s.x>44,12000);
    await travel('KeyS',s=>s.z>20.1,5000);
    assert(game.snapshot().interaction==='cafe-bench','Café seating is reachable');
    key('KeyE');key('KeyE','keyup');await wait(350);assert(game.snapshot().seated && game.snapshot().player.animation==='Sit' && game.snapshot().player.weights.Sit>.95,'Player sits using the rigged Sit clip');
    key('KeyE');key('KeyE','keyup');await wait(350);assert(!game.snapshot().seated && game.snapshot().player.animation==='Idle','Player stands and returns to Idle');
    await travel('KeyW',s=>s.z<11,5000);
    assert(game.snapshot().place==='The Campus Café','Café interior is reachable');
    click('settings-button');click('reset-button');await wait(80);
    const q=document.getElementById('quality') as HTMLSelectElement;q.value='low';q.dispatchEvent(new Event('change',{bubbles:true}));
    assert(q.value==='low','Graphics preset changes');
    assert(Number.isFinite(game.snapshot().x),'Render loop and player state remain valid');
    result(`DONE · ${Math.round(game.snapshot().fps)} FPS observed (local desktop, not a mobile benchmark)`);
    panel.dataset.result='passed';
  }catch(error){result(`FAIL ${String(error)}`);panel.dataset.result='failed';console.error('Campus smoke test',error);}
  finally {for(const code of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft'])key(code,'keyup');}
}
