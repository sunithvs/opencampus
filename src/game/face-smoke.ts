// Development-only rendering test: a real second WebSocket guest changes its
// face while this browser checks that its own material remains independent.
type Snapshot={connected:boolean;player:{customFace:boolean;faceMaterial:number};remoteFaces:{id:string;customFace:boolean;faceMaterial:number}[]};
export async function runSmoke(game:{snapshot:()=>Snapshot}){
  const panel=document.createElement('pre');panel.id='smoke-results';panel.style.cssText='position:fixed;z-index:200;top:100px;left:10px;max-width:360px;background:#10271fe8;color:white;padding:15px;font:12px/1.5 monospace;white-space:pre-wrap';document.body.append(panel);
  const report=(text:string)=>panel.textContent+=`${text}\n`;
  const wait=async(fn:()=>boolean,label:string)=>{const end=performance.now()+12000;while(!fn()){if(performance.now()>end)throw Error(label);await new Promise(r=>setTimeout(r,40));}};
  const assert=(ok:boolean,text:string)=>{if(!ok)throw Error(text);report(`PASS ${text}`);};
  let ws:WebSocket|undefined;
  try{
    (document.getElementById('display-name') as HTMLInputElement).value='Face render check';document.getElementById('join-button')!.click();
    await wait(()=>game.snapshot().connected,'Browser did not connect');
    const url=new URL('/api/campus',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';ws=new WebSocket(url);
    let id='',token='';
    ws.onopen=()=>ws!.send(JSON.stringify({type:'join',version:1,name:'Face fixture guest'}));
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='welcome'){id=m.id;token=m.resumeToken;}};
    await wait(()=>!!id&&game.snapshot().remoteFaces.some(p=>p.id===id),'Remote avatar did not load');
    const own=game.snapshot().player;
    assert(!own.customFace,'Local avatar starts with its default face');
    const photo=await fetch('/scripts/fixtures/face-square.jpg').then(r=>r.blob());
    const upload=await fetch('/api/campus/face',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'image/jpeg'},body:photo});if(!upload.ok)throw Error(await upload.text());
    await wait(()=>!!game.snapshot().remoteFaces.find(p=>p.id===id)?.customFace,'Remote face texture did not load');
    assert(true,'Uploaded face renders on the other guest');
    assert(!game.snapshot().player.customFace,'Changing another guest does not change the local face');
    assert(game.snapshot().remoteFaces.find(p=>p.id===id)!.faceMaterial!==own.faceMaterial,'Avatars own separate face materials');
    await new Promise(r=>setTimeout(r,1100));
    const remove=await fetch('/api/campus/face',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});if(!remove.ok)throw Error(await remove.text());
    await wait(()=>game.snapshot().remoteFaces.find(p=>p.id===id)?.customFace===false,'Default face was not restored');assert(true,'Removal restores the other guest’s default face');
    ws.send(JSON.stringify({type:'leave'}));ws.close(1000);
    await wait(()=>!game.snapshot().remoteFaces.some(p=>p.id===id),'Remote avatar was not disposed');assert(true,'Leaving removes the remote avatar and its face');
    panel.dataset.result='passed';report('DONE · face rendering checks passed');
  }catch(error){panel.dataset.result='failed';report(`FAIL ${String(error)}`);console.error(error);}
  finally{if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify({type:'leave'}));ws.close(1000);}}
}
