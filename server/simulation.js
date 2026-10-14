import {randomUUID} from 'node:crypto';
import {WORLD,blocked,distance} from './world.js';
export const COLORS=['#6476e5','#ef9865','#55b8ad','#e18fba','#edbd59','#7aa7e2'];
export function newPlayer(id,name,avatar=0,bot=false) {
  return {id,name,avatar:Number(avatar)%6,bot,x:800+Math.random()*230,y:440+Math.random()*270,
    hp:100,energy:100,coins:0,ammo:0,launcher:false,cursed:false,correct:0,attempts:0,
    infections:0,survived:0,input:{x:0,y:0},lastInput:0,lastShot:0,frozenUntil:0,immuneUntil:0,connected:true,question:null,questionAt:0,matchId:null};
}
export function startRoom(room,now=Date.now()) {
  room.status='playing';room.startedAt=now;room.endsAt=now+room.duration*1000;room.shots=[];room.farms=[];
  const players=[...room.players.values()];
  for (const p of players) { Object.assign(p,newPlayer(p.id,p.name,p.avatar,p.bot));p.joinedAt=now; }
  const cursed=players[Math.floor(Math.random()*players.length)];
  cursed.cursed=true;cursed.launcher=true;cursed.ammo=15;
  room.events=[{id:randomUUID(),text:`${cursed.name} ติดคำสาปคนแรก!`,at:now}];
}
export function event(room,text,now=Date.now()) {room.events.push({id:randomUUID(),text,at:now});room.events=room.events.slice(-4);}
export function shoot(room,p,angle,now=Date.now()) {
  if(room.status!=='playing'||!p.connected||!p.launcher||p.ammo<1||p.frozenUntil>now||now-p.lastShot<400||!Number.isFinite(angle))return;
  p.ammo--;p.lastShot=now;
  room.shots.push({id:randomUUID(),owner:p.id,cursed:p.cursed,x:p.x+Math.cos(angle)*28,y:p.y+Math.sin(angle)*28,vx:Math.cos(angle)*580,vy:Math.sin(angle)*580,life:1.25});
}
export function interact(room,p,kind,now=Date.now()) {
  if(room.status!=='playing'||!p.connected||p.frozenUntil>now)return;
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
    p.launcher=true;p.ammo+=15;room.farms=room.farms.filter(f=>f!==plant);return 'เก็บเกี่ยวแล้ว! ได้เครื่องยิงและหิมะ 15 ลูก';
  }
  if(p.coins<20)return 'ตอบคำถามเพื่อสะสม 20 เหรียญก่อน';
  p.coins-=20;room.farms.push({id:plot.id,owner:p.id,readyAt:now+5000});return 'ปลูกเครื่องยิงแล้ว รอเก็บเกี่ยว 5 วินาที';
}
export function finishRoom(room,reason,now=Date.now()) {
  if(room.status!=='playing')return;
  room.status='finished';room.reason=reason;room.finishedAt=now;
  for(const p of room.players.values()) {if(!p.cursed)p.survived=(now-room.startedAt)/1000;p.input={x:0,y:0};}
}
export function tickRoom(room,dt,now=Date.now()) {
  if(room.status!=='playing')return;
  const ps=[...room.players.values()];
  for(const p of ps){
    if(!p.connected)continue;
    if(p.bot){
      const targets=ps.filter(t=>t.connected&&t.cursed!==p.cursed);
      const target=targets.sort((a,b)=>distance(p,a)-distance(p,b))[0];
      if(target){
        let angle=Math.atan2(target.y-p.y,target.x-p.x);
        if(!p.cursed&&distance(p,target)<400)angle+=Math.PI;
        else if(!p.cursed)angle=now/2400+p.avatar;
        if(blocked(p.x+Math.cos(angle)*42,p.y+Math.sin(angle)*42))angle+=Math.PI/2*(p.avatar%2?1:-1);
        p.input={x:Math.cos(angle),y:Math.sin(angle)};
        if(p.cursed){p.ammo=Math.max(5,p.ammo);shoot(room,p,Math.atan2(target.y-p.y,target.x-p.x),now);}
      }
      p.lastInput=now;
    }
    if(now-p.lastInput>700)p.input={x:0,y:0};
    if(p.frozenUntil>now)continue;
    const moving=Math.hypot(p.input.x,p.input.y);
    const speed=(p.cursed?room.cursedSpeed:room.survivorSpeed)*(p.cursed||p.energy>0?1:.43);
    if(moving){
      const nx=Math.max(35,Math.min(WORLD.width-35,p.x+p.input.x*speed*dt));
      const ny=Math.max(35,Math.min(WORLD.height-35,p.y+p.input.y*speed*dt));
      if(!blocked(nx,p.y))p.x=nx;if(!blocked(p.x,ny))p.y=ny;
      if(!p.cursed)p.energy=Math.max(0,p.energy-dt*2.4);
    }
    if(!p.cursed)p.survived=(now-room.startedAt)/1000;
  }
  const aliveShots=[];
  for(const s of room.shots){
    s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
    if(s.life<=0||s.x<0||s.y<0||s.x>WORLD.width||s.y>WORLD.height||blocked(s.x,s.y,5))continue;
    const hit=ps.find(p=>p.connected&&p.id!==s.owner&&p.cursed!==s.cursed&&distance(p,s)<25&&p.immuneUntil<now);
    if(hit){
      if(s.cursed){
        hit.hp=Math.max(0,hit.hp-34);hit.immuneUntil=now+600;
        if(hit.hp<=0){hit.cursed=true;hit.launcher=true;hit.ammo=Math.max(15,hit.ammo);hit.hp=100;
          hit.survived=(now-room.startedAt)/1000;hit.immuneUntil=now+1500;
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
    duration:room.duration,remaining:Math.max(0,Math.ceil((room.endsAt-now)/1000)),reason:room.reason,
    startedAt:room.startedAt,endsAt:room.endsAt,quizTitle:room.quizTitle,practice:room.practice,
    players:[...room.players.values()].map(({input,lastInput,lastShot,immuneUntil,question,questionAt,...p})=>p),
    shots:room.shots||[],farms:room.farms||[],events:room.events||[],world:WORLD};
}
