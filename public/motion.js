import {movePosition} from './world.js';

// Identical collision and energy integration on the client and authoritative server.
export function advancePlayer(player,command,room,now){
  if(room.status!=='playing'||room.paused||now<(room.readyAt||0)||player.frozenUntil>now)return {...player};
  const n=Math.max(1,Math.hypot(command.x,command.y)),x=command.x/n,y=command.y/n;
  const speed=(player.cursed?room.cursedSpeed:room.survivorSpeed)*(player.cursed||player.energy>0?1:.43);
  const position=movePosition(player,x*speed*command.dt,y*speed*command.dt);
  return {...player,...position,energy:player.cursed?player.energy:Math.max(0,player.energy-Math.hypot(x,y)*command.dt*2.4)};
}

export class MotionPredictor{
  constructor(){this.pending=[];this.unsent=[];this.sequence=0;this.state=null;this.offset={x:0,y:0};}
  reconcile(player,room,now){
    this.sequence=Math.max(this.sequence,player.inputSeq||0);
    this.pending=this.pending.filter(c=>c.seq>(player.inputSeq||0));
    const previous=this.state&&this.position();
    this.state={...player};
    for(const c of this.pending)this.state=advancePlayer(this.state,c,room,now);
    if(previous&&Math.hypot(previous.x-this.state.x,previous.y-this.state.y)<250){
      this.offset={x:previous.x-this.state.x,y:previous.y-this.state.y};
    }else this.offset={x:0,y:0};
  }
  step(input,dt,room,now){
    if(!this.state)return;
    const c={seq:++this.sequence,x:input.x,y:input.y,dt:Math.min(.05,dt)};
    this.state=advancePlayer(this.state,c,room,now);this.pending.push(c);this.unsent.push(c);
    // A disconnected tab must not accumulate minutes of stale input.
    if(this.pending.length>180)this.pending.splice(0,this.pending.length-180);
    const decay=Math.exp(-dt/0.12);this.offset.x*=decay;this.offset.y*=decay;
  }
  drain(){return this.unsent.splice(0);}
  position(){return {x:this.state.x+this.offset.x,y:this.state.y+this.offset.y};}
}

// Render other players on a short, locally timed timeline. No server/client clock assumption.
export function samplePosition(samples,time){
  if(!samples.length)return null;
  while(samples.length>2&&samples[1].at<=time)samples.shift();
  const a=samples[0],b=samples[1];if(!b||time<=a.at)return {x:a.x,y:a.y};
  const t=Math.max(0,Math.min(1,(time-a.at)/Math.max(1,b.at-a.at)));
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
