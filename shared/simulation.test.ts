import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CampusSimulation, predict } from './simulation';
import { createCampusData } from './campus';
import { parseMessage } from './protocol';

test('one campus caps admissions including reconnect reservations, then expires them',()=>{
  const sim=new CampusSimulation();const people=Array.from({length:50},(_,i)=>sim.admit(`Guest ${i}`,undefined,0)!);
  assert.equal(sim.admit('overflow',undefined,0),null);
  sim.disconnect(people[0].player.id,1000);assert.equal(sim.admit('overflow',undefined,1001),null);
  assert.equal(sim.admit('return',people[0].token,1500)?.player.id,people[0].player.id);
  assert.equal(sim.sessions.size,50);
  sim.disconnect(people[0].player.id,2000);sim.expire(32001);assert.ok(sim.admit('next',undefined,32001));
});
test('server movement is fixed-time, normalized, collides, and rejects replay and backlog',()=>{
  const sim=new CampusSimulation(),s=sim.admit('one',undefined,0)!;
  const i={type:'input' as const,seq:1,x:1,z:1,run:true};
  assert.ok(sim.input(s,i,0));assert.equal(sim.input(s,i,0),false);sim.step(50);
  assert.ok(Math.abs(Math.hypot(s.player.x,s.player.z-29)-.29)<1e-9);
  Object.assign(s.player,{x:0,z:-14});s.lastSeq=1;
  for(let n=2;n<42;n++){sim.input(s,{...i,seq:n,x:1,z:0},n*50);sim.step(n*50);}
  assert.ok(s.player.x<2.8,'front façade blocks sideways movement');
  const p={x:3,z:-21.2,rotation:0};const blocked=predict(p,{...i,seq:1,x:1,z:0},sim.campus.obstacles);assert.ok(blocked.x<3.6);
  for(let n=42;n<50;n++)assert.ok(sim.input(s,{...i,seq:n},2500));
  assert.equal(sim.input(s,{...i,seq:50},2500),false);
});
test('stale queued inputs cannot keep a disconnected or backgrounded player walking',()=>{
  const sim=new CampusSimulation(),s=sim.admit('one',undefined,0)!;
  sim.input(s,{type:'input',seq:1,x:1,z:0,run:true},0);sim.step(400);assert.equal(s.player.x,0);assert.equal(s.player.seq,1);
});
test('doors require proximity and cannot swing into another player',()=>{
  const sim=new CampusSimulation(),a=sim.admit('a',undefined,0)!,b=sim.admit('b',undefined,0)!;
  const id='classroom-east-door';
  assert.ok(sim.action(a,'door',id,1000));assert.equal(sim.campus.doors[id],false);
  Object.assign(a.player,{x:3,z:-21.2});assert.equal(sim.action(a,'door',id,1500),null);assert.equal(sim.campus.doors[id],true);
  Object.assign(b.player,{x:4,z:-21.2});assert.ok(sim.action(a,'door',id,2000));assert.equal(sim.campus.doors[id],true);
});
test('seat claims are exclusive and disconnect releases the seat at a safe standing point',()=>{
  const sim=new CampusSimulation(),a=sim.admit('a',undefined,0)!,b=sim.admit('b',undefined,0)!;
  Object.assign(a.player,{x:44,z:20.5});Object.assign(b.player,{x:44,z:20.5});
  assert.equal(sim.action(a,'sit','cafe-bench',1000),null);assert.ok(sim.action(b,'sit','cafe-bench',1000));
  sim.disconnect(a.player.id,2000);assert.equal(a.player.seatId,null);assert.equal(sim.action(b,'sit','cafe-bench',2500),null);
});
test('snapshots never disclose reconnect tokens and resume restores state without replaying movement',()=>{
  const sim=new CampusSimulation(),s=sim.admit('a',undefined,0)!;Object.assign(s.player,{x:10,z:12});
  const restored=new CampusSimulation();restored.restore(sim.export(s));assert.equal(restored.sessions.get(s.player.id)?.player.x,10);
  assert.ok(!JSON.stringify(sim.snapshot(0,true)).includes(s.token));
  assert.equal(sim.snapshot(0)?.players.length,1);assert.equal(sim.snapshot(1),null);
});
test('client and server share a deterministic campus and input rejects malformed values',()=>{
  const a=createCampusData(),b=createCampusData();assert.deepEqual(a.obstacles.map(({enabled,...r})=>r),b.obstacles.map(({enabled,...r})=>r));
  assert.equal(parseMessage('{bad'),null);assert.equal(parseMessage(JSON.stringify({type:'input',seq:1,x:2,z:0,run:true})),null);
  assert.equal(parseMessage(JSON.stringify({type:'input',seq:-1,x:0,z:0,run:false})),null);
  assert.equal(parseMessage(JSON.stringify({type:'join',version:1,name:'x'.repeat(25)})),null);
  assert.ok(parseMessage(JSON.stringify({type:'join',version:1,name:'Student'})));
  assert.equal(parseMessage(JSON.stringify({type:'join',version:1,name:'\u0001'})),null);
  assert.equal(parseMessage(JSON.stringify({type:'join',version:1,name:'Student',resumeToken:42})),null);
});
