import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,startRoom,tickRoom,shoot,interact,publicRoom} from '../server/simulation.js';
import {WORLD,blocked} from '../server/world.js';
import {validateQuestions,SAMPLE} from '../server/questions.js';
const fixture=()=>({code:'123456',hostId:'host',players:new Map([['a',newPlayer('a','A')],['b',newPlayer('b','B')]]),duration:60,survivorSpeed:190,cursedSpeed:180,status:'lobby'});
test('movement is authoritative, drains energy, and stops at obstacles',()=>{
  const r=fixture();startRoom(r,1000);const p=r.players.get('a');p.x=900;p.y=600;p.cursed=false;p.input={x:1,y:0};p.lastInput=10050;
  tickRoom(r,.1,10050);assert.equal(p.x,919);assert.ok(p.energy<100);
  p.x=195;p.y=250;p.input={x:1,y:0};p.lastInput=10100;tickRoom(r,.1,10100);assert.equal(p.x,195);
  p.x=900;p.y=600;p.energy=0;p.input={x:1,y:0};p.lastInput=10150;tickRoom(r,.1,10150);assert.ok(p.x<919&&p.x>900);
});
test('three cursed snowballs infect, and friendly snowballs freeze zombies',()=>{
  const r=fixture();startRoom(r,1000);const a=r.players.get('a'),b=r.players.get('b');
  Object.assign(a,{x:600,y:580,cursed:true,launcher:true,ammo:20});Object.assign(b,{x:655,y:580,cursed:false});
  for(const time of [11000,12000,13000]){shoot(r,a,0,time);tickRoom(r,.05,time);}
  assert.equal(b.cursed,true);assert.equal(a.infections,1);assert.equal(r.status,'finished');
  const r2=fixture();startRoom(r2,1000);const c=r2.players.get('a'),d=r2.players.get('b');
  Object.assign(c,{x:600,y:580,cursed:false,launcher:true,ammo:1});Object.assign(d,{x:655,y:580,cursed:true});
  shoot(r2,c,0,11000);tickRoom(r2,.05,11000);assert.equal(d.frozenUntil,13500);assert.equal(d.cursed,true);
});
test('planting costs coins, harvesting gives a launcher, and other players cannot steal',()=>{
  const r=fixture();startRoom(r,1000);const a=r.players.get('a'),b=r.players.get('b');
  Object.assign(a,{x:570,y:720,coins:40,launcher:false,ammo:0});Object.assign(b,{x:570,y:720,ammo:0});
  assert.match(interact(r,a,'plant',11000),/ปลูก/);assert.equal(a.coins,20);
  assert.match(interact(r,b,'plant',17000),/ผู้เล่นอื่น/);assert.equal(b.ammo,0);
  assert.match(interact(r,a,'plant',12000),/เติบโต/);
  assert.match(interact(r,a,'plant',17000),/เก็บเกี่ยว/);assert.equal(a.launcher,true);assert.equal(a.ammo,15);
  Object.assign(a,{x:650,y:720});interact(r,a,'plant',18000);assert.equal(r.farms.at(-1).id,1);a.coins=20;
  Object.assign(a,{x:1190,y:510,hp:40});interact(r,a,'heal',18000);assert.equal(a.hp,90);assert.equal(a.coins,0);
});
test('timed survival ends the round and public snapshots never expose pending answers',()=>{
  const r=fixture();startRoom(r,1000);const p=r.players.get('a');p.question={id:'secret',q:SAMPLE[0]};
  assert.equal(publicRoom(r,'a',11000).players[0].question,undefined);
  tickRoom(r,.05,70000);assert.equal(r.status,'finished');assert.match(r.reason,/ชนะ/);
});
test('invalid question sets are rejected',()=>{assert.throws(()=>validateQuestions([]));assert.throws(()=>validateQuestions([{text:'x',options:['a','b','c','d'],answer:9}]));assert.equal(validateQuestions(SAMPLE).length,10);});

test('countdown prevents attacks, practice pauses both movement and the clock',()=>{
  const r=fixture();r.practice=true;startRoom(r,10000);const p=r.players.get('a');p.cursed=true;p.launcher=true;p.ammo=15;shoot(r,p,0,12000);assert.equal(p.ammo,15);assert.equal(r.shots.length,0);
  const x=p.x;p.input={x:1,y:0};p.lastInput=12000;tickRoom(r,.1,12000);assert.equal(p.x,x);
  r.paused=true;const end=r.endsAt;tickRoom(r,.1,17000);assert.equal(r.endsAt,end+100);assert.equal(p.x,x);assert.equal(r.pausedMs,100);
});
test('fast projectiles hit along their path and fences absorb snowballs',()=>{
  const r=fixture();startRoom(r,1000);const a=r.players.get('a'),b=r.players.get('b');Object.assign(a,{x:550,y:580,cursed:true,launcher:true,ammo:5});Object.assign(b,{x:607,y:580,cursed:false});shoot(r,a,0,11000);tickRoom(r,.1,11000);assert.equal(b.hp,66);assert.equal(r.fx[0].kind,'hit');
  a.x=600;a.y=450;b.x=680;b.y=450;shoot(r,a,0,12000);tickRoom(r,.1,12000);assert.equal(b.hp,66);assert.equal(r.shots.length,0);
});
test('fishing requires a dock and waiting, then rewards resources once',()=>{
  const r=fixture();startRoom(r,1000);const p=r.players.get('a');p.ammo=0;p.coins=0;p.energy=60;assert.match(interact(r,p,'fish',11000),/ท่าเรือ/);p.x=790;p.y=1010;assert.match(interact(r,p,'fish',11000),/หย่อนเบ็ด/);assert.match(interact(r,p,'fish',12000),/กินเหยื่อ/);interact(r,p,'fish',15000);assert.equal(p.ammo,10);assert.equal(p.coins,10);assert.equal(p.energy,75);assert.equal(p.fish,1);interact(r,p,'fish',15100);assert.equal(p.fish,1);
});

test('all spawn points and resource stations are reachable, bots answer for ammunition',()=>{
  for(const point of [...WORLD.spawns,...WORLD.farms,WORLD.supply,...WORLD.fishing])assert.equal(blocked(point.x,point.y),false);
  const r=fixture();startRoom(r,1000);const p=r.players.get('a');Object.assign(p,{bot:true,cursed:true,ammo:0});r.players.get('b').cursed=false;tickRoom(r,.1,11000);assert.equal(p.ammo,0);tickRoom(r,.1,12600);assert.ok(p.ammo>=7);assert.equal(p.correct,1);assert.equal(p.attempts,1);
});

test('point blank snowballs hit even when two players overlap',()=>{
  const r=fixture();startRoom(r,1000);const a=r.players.get('a'),b=r.players.get('b');Object.assign(a,{x:900,y:600,cursed:true,launcher:true,ammo:1});Object.assign(b,{x:900,y:600,cursed:false});shoot(r,a,0,11000);tickRoom(r,.05,11000);assert.equal(b.hp,66);
});
