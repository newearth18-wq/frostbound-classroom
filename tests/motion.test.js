import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MotionPredictor,samplePosition} from '../public/motion.js';
import {newPlayer,applyInputCommands,tickRoom} from '../server/simulation.js';

const fixture=()=>({status:'playing',readyAt:0,endsAt:999999,duration:300,survivorSpeed:230,cursedSpeed:205,players:new Map(),shots:[],farms:[],fx:[],events:[]});
test('prediction remains continuous across delayed acknowledgements, turns and stopping',()=>{
  const room=fixture(),server=newPlayer('a','A');Object.assign(server,{x:900,y:600,cursed:false});room.players.set('a',server);
  const client=new MotionPredictor();client.reconcile(server,room,1000);const packets=[],snapshots=[];
  let now=1000,previous=client.position(),maxCorrection=0;
  for(let frame=0;frame<240;frame++){
    now+=1000/60;
    for(const packet of packets.filter(p=>p.at<=now&&!p.done)){applyInputCommands(room,server,packet.commands,now);packet.done=true;snapshots.push({at:now+100,state:{...server}});}
    for(const snapshot of snapshots.filter(s=>s.at<=now&&!s.done)){
      const before=client.position();client.reconcile(snapshot.state,room,now);const after=client.position();maxCorrection=Math.max(maxCorrection,Math.hypot(after.x-before.x,after.y-before.y));snapshot.done=true;
    }
    const input=frame<60?{x:1,y:0}:frame<120?{x:0,y:-1}:{x:0,y:0};client.step(input,1/60,room,now);
    if(frame%3===2)packets.push({at:now+100+(frame%5)*4,commands:client.drain()});
    const position=client.position();assert.ok(Math.hypot(position.x-previous.x,position.y-previous.y)<5);previous=position;
  }
  assert.ok(maxCorrection<.00001,'snapshot arrivals must not snap the visible position');
  assert.ok(Math.hypot(client.position().x-server.x,client.position().y-server.y)<.1);
  assert.ok(Math.abs(client.state.energy-server.energy)<.001);
});
test('command movement respects walls, freezes, sequence acknowledgements and elapsed-time limits',()=>{
  const room=fixture(),p=newPlayer('a','A');Object.assign(p,{x:195,y:250,cursed:false});room.players.set('a',p);
  applyInputCommands(room,p,[{seq:1,x:1,y:0,dt:.05}],1000);assert.equal(p.x,195);assert.equal(p.inputSeq,1);
  p.x=900;p.y=600;const command={seq:2,x:1,y:0,dt:.05};applyInputCommands(room,p,[command],1050);const x=p.x;
  applyInputCommands(room,p,[command],1050);assert.equal(p.x,x,'duplicate cannot move twice');
  p.frozenUntil=2000;applyInputCommands(room,p,[{...command,seq:3}],1100);assert.equal(p.x,x);assert.equal(p.inputSeq,3);
  p.frozenUntil=0;for(let i=4;i<100;i++)applyInputCommands(room,p,[{...command,seq:i}],1100);assert.ok(p.x-x<=46.001,'a burst cannot spend unbounded simulation time');
  const at=p.x;tickRoom(room,.05,1100);assert.equal(p.x,at,'server tick cannot apply acknowledged motion twice');
  const snapshot=JSON.stringify(p);applyInputCommands(room,p,[{seq:100,x:Infinity,y:0,dt:.05},{seq:101,x:1,y:0,dt:5}],1100);assert.equal(p.inputSeq,99);assert.equal(p.x,at);
});
test('remote interpolation uses receipt time, smooths between snapshots and stops extrapolating',()=>{
  const samples=[{at:100,x:0,y:0},{at:200,x:23,y:0},{at:300,x:23,y:23}];
  assert.deepEqual(samplePosition(samples,150),{x:11.5,y:0});assert.deepEqual(samplePosition(samples,250),{x:23,y:11.5});assert.deepEqual(samplePosition(samples,900),{x:23,y:23});
});
