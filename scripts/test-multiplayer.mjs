import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';
const base=process.env.CAMPUS_TEST_URL||'http://127.0.0.1:8788';
const clients=[];let server;
const stateDir=`.wrangler/test-${Date.now()}`;
const waitFor=async(fn,label,timeout=10000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error(`Timed out: ${label}`);await delay(20);}};
async function startServer(){
  server=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--ip','127.0.0.1','--port','8788','--persist-to',stateDir],{env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
  let output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
  try{await waitFor(()=>output.includes('Ready on'), 'local Cloudflare runtime',30000);}catch(e){console.error(output);throw e;}
}
async function stopServer(){if(!server)return;const old=server;server=undefined;if(old.exitCode!==null)return;const exited=new Promise(r=>old.once('exit',r));old.kill('SIGTERM');await exited;}
async function join(name,resumeToken){
  const ws=new WebSocket(base.replace('http','ws')+'/api/campus',{origin:base});
  const c={ws,players:new Map(),doors:{},messages:0,bytes:0,id:'',token:'',seq:0,error:null,welcome:false,lastState:0};clients.push(c);
  ws.on('error',e=>{c.error={code:'transport',message:e.message};});
  ws.on('open',()=>ws.send(JSON.stringify({type:'join',version:1,name,resumeToken})));
  ws.on('message',raw=>{
    if(raw.toString()==='pong')return;
    c.bytes+=raw.length;c.messages++;const m=JSON.parse(raw);
    if(m.type==='error'){c.error=m;return;}
    if(m.type==='welcome'){c.id=m.id;c.token=m.resumeToken;c.welcome=true;c.seq=m.state.players.find(p=>p.id===m.id).seq;}
    const state=m.type==='welcome'?m.state:m;if(state.type==='state'){for(const p of state.players)c.players.set(p.id,p);for(const id of state.removed)c.players.delete(id);c.doors=state.doors;c.count=state.count;c.lastState=Date.now();}
  });
  await waitFor(()=>c.welcome||c.error,`join ${name}`);return c;
}
const send=(c,m)=>c.ws.send(JSON.stringify(m));
const input=(c,x,z,run=true)=>send(c,{type:'input',seq:++c.seq,x,z,run});
async function move(c,x,z,predicate,timeout=12000){
  const start=Date.now();while(!predicate(c.players.get(c.id))){if(Date.now()-start>timeout)throw Error(`Travel blocked at ${JSON.stringify(c.players.get(c.id))}`);input(c,x,z);await delay(50);}
  send(c,{type:'stop'});await delay(180);
}
const action=async(c,action,id)=>{c.error=null;send(c,{type:'action',action,id});await delay(260);};
const status=async()=>fetch(base+'/api/campus/status').then(r=>r.json());
async function checkOrigin(){
  const ws=new WebSocket(base.replace('http','ws')+'/api/campus',{origin:'https://wrong.example'});
  const code=await new Promise((resolve,reject)=>{ws.on('unexpected-response',(_req,res)=>{resolve(res.statusCode);res.resume();ws.terminate();});ws.on('open',()=>reject(Error('wrong origin accepted')));ws.on('error',()=>{});});assert.equal(code,403);
}
try{
  if(!process.env.CAMPUS_TEST_URL)await startServer();
  await checkOrigin();console.log('PASS same-origin WebSocket admission');
  const a=await join('Alice'),b=await join('Bob');assert.ok(a.welcome&&b.welcome);await waitFor(()=>a.players.has(b.id),'mutual presence');
  console.log('PASS two guests share one campus');
  await move(a,0,-1,p=>p.z<=-20.6);
  await move(a,1,0,p=>p.x>3.3,3000);
  const door='classroom-east-door';
  await action(a,'door',door);assert.equal(a.error,null);await waitFor(()=>b.doors[door]===true,'shared door');
  await move(a,1,0,p=>p.x>6,3000);assert.ok(a.players.get(a.id).x>4.5);console.log('PASS authoritative movement, doorway collision, and shared door');
  await action(a,'reset');assert.equal(a.players.get(a.id).z,29);
  await action(a,'wave');await waitFor(()=>b.players.get(a.id).wave>0,'wave sync');console.log('PASS wave event reaches another player');
  await move(a,0,-1,p=>p.z<=17.5);await move(a,1,0,p=>p.x>=44);await move(a,0,1,p=>p.z>=20.1,3000);
  await action(a,'sit','cafe-bench');assert.equal(a.players.get(a.id).seatId,'cafe-bench');await waitFor(()=>b.players.get(a.id).seatId==='cafe-bench','sit sync');
  await action(a,'stand');assert.equal(a.players.get(a.id).seatId,null);console.log('PASS shared sitting and standing');
  const bots=await Promise.all(Array.from({length:48},(_,i)=>join(`Load ${i}`)));assert.ok(bots.every(c=>c.welcome));
  const full=await join('Overflow');assert.equal(full.error?.code,'full');assert.equal((await status()).online,50);console.log('PASS 50 concurrent guests accepted; guest 51 rejected');
  const token=a.token,id=a.id,position={...a.players.get(a.id)};a.ws.close(4000,'network loss');await delay(250);
  assert.equal((await status()).reserved,1);const blocked=await join('Still full');assert.equal(blocked.error?.code,'full');
  const resumed=await join('Alice',token);assert.equal(resumed.id,id);assert.equal(resumed.players.get(id).x,position.x);assert.equal((await status()).online,50);
  console.log('PASS reconnect retains identity and position without bypassing capacity');
  const running=[b,...bots];const start=Date.now();
  for(let tick=0;tick<100;tick++){for(const c of running)input(c,tick%20<10?.5:-.5,0);await delay(50);}
  for(const c of running)send(c,{type:'stop'});await delay(300);
  assert.ok(running.every(c=>c.ws.readyState===WebSocket.OPEN&&!c.error));assert.equal((await status()).online,50);
  assert.ok(running.every(c=>c.players.get(c.id).seq===c.seq));
  console.log(`PASS 49 moving clients + 1 observer for ${((Date.now()-start)/1000).toFixed(1)}s; ${running.reduce((n,c)=>n+c.messages,0)} messages received`);
  const malformed=running[0];send(malformed,{type:'input',seq:++malformed.seq,x:999,z:0,run:true});await waitFor(()=>malformed.ws.readyState===WebSocket.CLOSED,'malformed input close');console.log('PASS malformed movement is rejected');
  for(const c of clients)if(c.ws.readyState===WebSocket.OPEN){send(c,{type:'leave'});c.ws.close(1000);}
  await delay(500);assert.equal((await status()).online,0);
  if(!process.env.CAMPUS_TEST_URL){await stopServer();await startServer();const c=await join('After restart');assert.equal(c.doors[door],true);send(c,{type:'leave'});c.ws.close(1000);console.log('PASS door state persists across runtime restart');}
  console.log('Multiplayer integration checks passed. This tests network/simulation load, not 50 rendered avatars or real phone performance.');
}finally{
  for(const c of clients)if(c.ws.readyState===WebSocket.OPEN||c.ws.readyState===WebSocket.CONNECTING)c.ws.terminate();
  await stopServer();
}
