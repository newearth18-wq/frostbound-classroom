import {randomUUID} from 'node:crypto';
import {WORLD,blocked,distance,movePosition} from './world.js';
export const COLORS=['#6476e5','#ef9865','#55b8ad','#e18fba','#edbd59','#7aa7e2'];
export function newPlayer(id,name,avatar=0,bot=false) {
  return {id,name,avatar:Number(avatar)%6,bot,x:800+Math.random()*230,y:440+Math.random()*270,
    hp:100,energy:100,coins:0,ammo:0,launcher:false,cursed:false,correct:0,attempts:0,
    infections:0,survived:0,input:{x:0,y:0},lastInput:0,lastShot:0,frozenUntil:0,immuneUntil:0,connected:true,question:null,questionAt:0,matchId:null,
    aim:0,fishingUntil:0,fish:0,nextBotShot:0,botQuestionUntil:0,route:[],routeAt:0};
}
export function startRoom(room,now=Date.now()) {
  room.status='playing';room.startedAt=now;room.readyAt=now+6000;room.endsAt=room.readyAt+room.duration*1000;room.shots=[];room.farms=[];room.fx=[];room.paused=false;room.pausedMs=0;
  const players=[...room.players.values()];
  for (const [i,p] of players.entries()) {
    Object.assign(p,newPlayer(p.id,p.name,p.avatar,p.bot));p.joinedAt=now;p.immuneUntil=room.readyAt;
    const spawn=WORLD.spawns[i%WORLD.spawns.length];p.x=spawn.x+Math.floor(i/WORLD.spawns.length)*45;p.y=spawn.y;
    if(blocked(p.x,p.y)){p.x=spawn.x;p.y=spawn.y;}
  }
  const cursed=players[Math.floor(Math.random()*players.length)];
  cursed.cursed=true;cursed.launcher=true;cursed.ammo=15;
  room.events=[{id:randomUUID(),text:`${cursed.name} ติดคำสาปคนแรก!`,at:now}];
}
export function event(room,text,now=Date.now()) {room.events.push({id:randomUUID(),text,at:now});room.events=room.events.slice(-4);}
export function shoot(room,p,angle,now=Date.now()) {
  if(room.status!=='playing'||room.paused||now<(room.readyAt||0)||!p.connected||!p.launcher||p.ammo<1||p.frozenUntil>now||now-p.lastShot<400||!Number.isFinite(angle))return;
  p.ammo--;p.lastShot=now;p.aim=angle;
  room.shots.push({id:randomUUID(),owner:p.id,cursed:p.cursed,x:p.x+Math.cos(angle)*18,y:p.y+Math.sin(angle)*18,vx:Math.cos(angle)*580,vy:Math.sin(angle)*580,life:1.25});
}
export function interact(room,p,kind,now=Date.now()) {
  if(room.status!=='playing'||!p.connected||p.frozenUntil>now)return;
  if(kind==='fish'){
    if(!WORLD.fishing.some(f=>distance(p,f)<105))return 'เดินไปที่ท่าเรือก่อน';
    if(p.fishingUntil){if(now<p.fishingUntil)return 'ปลากำลังกินเหยื่อ…';p.fishingUntil=0;p.fish++;p.coins+=10;p.ammo=Math.min(99,p.ammo+10);p.energy=Math.min(100,p.energy+15);return 'ตกปลาได้แล้ว! บอลหิมะ +10 · พลังงาน +15 · เหรียญ +10';}
    p.fishingUntil=now+3000;return 'หย่อนเบ็ดแล้ว! กด E อีกครั้งเมื่อครบ 3 วินาที';
  }
  if(kind==='heal' && distance(p,WORLD.supply)<105){
    if(p.coins<20)return 'ต้องใช้ 20 เหรียญ';
    if(p.hp>=100)return 'พลังชีวิตเต็มแล้ว';
    p.coins-=20;p.hp=Math.min(100,p.hp+50);return 'ฟื้นฟูพลังชีวิต +50';
  }
  const plot=[...WORLD.farms].sort((a,b)=>distance(p,a)-distance(p,b)).find(f=>distance(p,f)<90);
  if(!plot)return 'เดินไปที่แปลงปลูกหรือจุดพยาบาลก่อน';
  const plant=room.farms.find(f=>f.id===plot.id);
  if(plant){
    if(plant.owner!==p.id)return 'แปลงนี้มีผู้เล่นอื่นปลูกอยู่';
    if(plant.readyAt>now)return 'กำลังเติบโต รออีกสักครู่';
    p.launcher=true;p.ammo=Math.min(99,p.ammo+15);room.farms=room.farms.filter(f=>f!==plant);return 'เก็บเกี่ยวแล้ว! ได้เครื่องยิงและหิมะ 15 ลูก';
  }
  if(p.coins<20)return 'ตอบคำถามเพื่อสะสม 20 เหรียญก่อน';
  p.coins-=20;room.farms.push({id:plot.id,owner:p.id,readyAt:now+5000});return 'ปลูกเครื่องยิงแล้ว รอเก็บเกี่ยว 5 วินาที';
}
export function finishRoom(room,reason,now=Date.now()) {
  if(room.status!=='playing')return;
  room.status='finished';room.reason=reason;room.finishedAt=now;
  for(const p of room.players.values()) {if(!p.cursed)p.survived=Math.max(0,(now-(room.readyAt||room.startedAt)-(room.pausedMs||0))/1000);p.input={x:0,y:0};}
}
// A small navigation grid keeps practice bots from running into the same fence.
function routeTo(from,to){
  const cell=60,cols=Math.ceil(WORLD.width/cell),rows=Math.ceil(WORLD.height/cell);
  const node=p=>({x:Math.min(cols-1,Math.floor(p.x/cell)),y:Math.min(rows-1,Math.floor(p.y/cell))});
  const start=node(from),goal=node(to),key=n=>n.y*cols+n.x,queue=[start],seen=new Map([[key(start),null]]);let end=null;
  for(let i=0;i<queue.length&&i<1000;i++){
    const n=queue[i];if(n.x===goal.x&&n.y===goal.y){end=n;break;}
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const t={x:n.x+dx,y:n.y+dy};if(t.x<0||t.y<0||t.x>=cols||t.y>=rows||seen.has(key(t))||blocked(t.x*cell+cell/2,t.y*cell+cell/2,22))continue;seen.set(key(t),n);queue.push(t);}
  }
  const route=[];for(let n=end;n&&key(n)!==key(start);n=seen.get(key(n)))route.unshift({x:n.x*cell+cell/2,y:n.y*cell+cell/2});return route;
}
export function tickRoom(room,dt,now=Date.now()) {
  if(room.status!=='playing')return;
  if(room.paused&&room.practice){room.endsAt+=dt*1000;room.pausedMs=(room.pausedMs||0)+dt*1000;return;}
  if(now<(room.readyAt||0))return;
  room.fx=(room.fx||[]).filter(f=>now-f.at<800);
  const ps=[...room.players.values()];
  for(const p of ps){
    if(!p.connected)continue;
    if(p.bot){
      if((p.cursed&&p.ammo<3)||(!p.cursed&&p.energy<35)){
        p.botQuestionUntil ||= now+1500;p.input={x:0,y:0};
        if(now<p.botQuestionUntil)continue;
        p.botQuestionUntil=0;p.correct++;p.attempts++;p.coins+=20;
        if(p.cursed)p.ammo=Math.min(99,p.ammo+8);else p.energy=Math.min(100,p.energy+35);
      }
      const targets=ps.filter(t=>t.connected&&t.cursed!==p.cursed);
      const target=targets.sort((a,b)=>distance(p,a)-distance(p,b))[0];
      if(target){
        let angle=Math.atan2(target.y-p.y,target.x-p.x);
        if(p.cursed&&distance(p,target)<110)angle+=Math.PI;
        else if(p.cursed&&distance(p,target)<160)angle+=Math.PI/2;
        if(!p.cursed&&distance(p,target)<400)angle+=Math.PI;
        else if(!p.cursed)angle=now/2400+p.avatar;
        if(p.cursed&&blocked(p.x+Math.cos(angle)*75,p.y+Math.sin(angle)*75)){
          if(now-p.routeAt>1000){p.route=routeTo(p,target);p.routeAt=now;}
          while(p.route?.length&&distance(p,p.route[0])<30)p.route.shift();
          if(p.route?.length)angle=Math.atan2(p.route[0].y-p.y,p.route[0].x-p.x);
        }else if(blocked(p.x+Math.cos(angle)*60,p.y+Math.sin(angle)*60))angle+=Math.PI/2*(p.avatar%2?1:-1);
        p.input={x:Math.cos(angle),y:Math.sin(angle)};
        if(p.cursed&&now>p.nextBotShot&&distance(p,target)<650){p.nextBotShot=now+1100;shoot(room,p,Math.atan2(target.y-p.y,target.x-p.x)+(Math.sin(now/900+p.avatar)*.13),now);}
      }
      p.lastInput=now;
    }
    if(now-p.lastInput>700)p.input={x:0,y:0};
    if(p.frozenUntil>now)continue;
    const moving=Math.hypot(p.input.x,p.input.y);
    const speed=(p.cursed?room.cursedSpeed:room.survivorSpeed)*(p.cursed||p.energy>0?1:.43);
    if(moving){
      Object.assign(p,movePosition(p,p.input.x*speed*dt,p.input.y*speed*dt));
      if(!p.cursed)p.energy=Math.max(0,p.energy-dt*2.4);
    }
    if(!p.cursed)p.survived=Math.max(0,(now-(room.readyAt||room.startedAt)-(room.pausedMs||0))/1000);
  }
  const aliveShots=[];
  for(const s of room.shots){
    s.life-=dt;let hit=null,wall=false;
    const steps=Math.max(1,Math.ceil(Math.hypot(s.vx,s.vy)*dt/12));
    for(let i=0;i<steps;i++){
      hit=ps.find(p=>p.connected&&p.id!==s.owner&&p.cursed!==s.cursed&&distance(p,s)<25&&p.immuneUntil<now);if(hit)break;
      s.x+=s.vx*dt/steps;s.y+=s.vy*dt/steps;
      wall=s.x<0||s.y<0||s.x>WORLD.width||s.y>WORLD.height||blocked(s.x,s.y,5);
      if(wall)break;hit=ps.find(p=>p.connected&&p.id!==s.owner&&p.cursed!==s.cursed&&distance(p,s)<25&&p.immuneUntil<now);if(hit)break;
    }
    if(wall||hit)room.fx.push({id:s.id,x:s.x,y:s.y,at:now,kind:hit?'hit':'snow',target:hit?.id});
    if(s.life<=0||wall)continue;
    if(hit){
      if(s.cursed){
        hit.hp=Math.max(0,hit.hp-34);hit.immuneUntil=now+600;
        if(hit.hp<=0){hit.cursed=true;hit.launcher=true;hit.ammo=Math.max(15,hit.ammo);hit.hp=100;
          hit.survived=Math.max(0,(now-(room.readyAt||room.startedAt)-(room.pausedMs||0))/1000);hit.immuneUntil=now+1500;
          const owner=room.players.get(s.owner);if(owner)owner.infections++;
          event(room,`${hit.name} ติดคำสาปแล้ว!`,now);
        }
      }else{hit.frozenUntil=now+2500;hit.immuneUntil=now+600;}
    }else aliveShots.push(s);
  }
  room.shots=aliveShots;
  if(ps.every(p=>p.cursed||!p.connected))finishRoom(room,'ผู้เล่นที่อยู่ในเกมติดคำสาปทั้งหมด',now);
  else if(now>=room.endsAt)finishRoom(room,'หมดเวลา · ผู้รอดชีวิตชนะ!',now);
}
export function publicRoom(room,userId,now=Date.now()) {
  return {code:room.code,title:room.title,hostName:room.hostName,isHost:room.hostId===userId,status:room.status,
    duration:room.duration,remaining:Math.max(0,Math.min(room.duration,Math.ceil((room.endsAt-now)/1000))),reason:room.reason,
    startedAt:room.startedAt,endsAt:room.endsAt,serverNow:now,readyRemaining:Math.max(0,Math.ceil(((room.readyAt||0)-now)/1000)),paused:room.paused,
    survivorSpeed:room.survivorSpeed,cursedSpeed:room.cursedSpeed,quizTitle:room.quizTitle,practice:room.practice,
    players:[...room.players.values()].map(({input,lastInput,lastShot,immuneUntil,question,questionAt,route,routeAt,nextBotShot,...p})=>({...p,moving:Math.hypot(input.x,input.y)>.01,moveX:input.x,moveY:input.y,shielded:immuneUntil>now})),
    shots:room.shots||[],farms:room.farms||[],fx:room.fx||[],events:room.events||[],world:WORLD};
}
