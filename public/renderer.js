import {WORLD,distance} from './world.js';
import {MotionPredictor,samplePosition} from './motion.js';
import {playSound as sound,unlockSound,toggleSound} from './sound.js';
// Rendering and input prediction are disposable. The server owns game rules.
const INK=0x2a3c55;
export function createWorld(parent,{preview=false,getState=()=>null,getUserId=()=>null,onInput=()=>{},onShoot=()=>{},onQuestion=()=>{},onInteract=()=>{},isBlocked=()=>false}={}){
  let scene,game,keys,cursors,lastInput=0,aim=0,pointerAim=false,held=false,touch={x:0,y:0},input={x:0,y:0},seenState=null,showMap=!preview,predictor=new MotionPredictor();
  const entities=new Map(),seenFX=new Set(),effects=[],prints=[];let fxLayer,shotLayer,snowLayer,mini,farmLayer,reticle,lastFire=0,lastFoot=0;
  const size=()=>({width:parent.clientWidth||800,height:parent.clientHeight||500});
  function panel(g,color,x,y,w,h,r=8){g.fillStyle(color);g.fillRoundedRect(x,y,w,h,r);g.lineStyle(3,INK);g.strokeRoundedRect(x,y,w,h,r);}
  function label(s,x,y,text,color='#314b65',fontSize=13){return s.add.text(x,y,text,{fontFamily:'Noto Sans Thai',fontSize,fontStyle:'bold',color,stroke:'#ffffff',strokeThickness:4}).setOrigin(.5).setDepth(y+10);}
  function tree(s,o){
    const x=o.x+o.w/2,y=o.y+o.h/2,g=s.add.graphics({x,y}).setDepth(o.y+o.h+5);
    g.fillStyle(0x6b94a9,.2);g.fillEllipse(8,12,92,26);panel(g,0x9b6b49,-8,-24,16,39,4);
    for(let i=0;i<3;i++){const yy=-110+i*29,w=56+i*24;g.fillStyle([0x3b816e,0x3f9a7f,0x3a8f7a][i]);g.fillTriangle(0,yy,-w/2,yy+55,w/2,yy+55);g.lineStyle(4,INK);g.strokeTriangle(0,yy,-w/2,yy+55,w/2,yy+55);
      g.fillStyle(0xfaffff);g.fillTriangle(0,yy-2,-w*.34,yy+29,w*.34,yy+29);g.lineStyle(3,0x9ccce5);g.lineBetween(-w*.34,yy+29,-w*.11,yy+23);g.lineBetween(-w*.11,yy+23,w*.13,yy+31);g.lineBetween(w*.13,yy+31,w*.34,yy+29);
    }
  }
  function house(s,o){const {x,y,w,h}=o,g=s.add.graphics({x,y}).setDepth(y+h);
    g.fillStyle(0x7398b3,.2);g.fillEllipse(w/2+8,h+5,w+40,42);
    panel(g,o.color,0,15,w,h-15,6);g.fillStyle(0x000000,.08);g.fillRect(w-28,18,28,h-23);
    for(let i=35;i<h;i+=19){g.lineStyle(1,INK,.14);g.lineBetween(0,i,w,i);}
    panel(g,0x846044,w*.72,-43,22,52,2);panel(g,0xf8fdff,w*.72-5,-46,32,10,3);
    g.fillStyle(0x466482);g.fillTriangle(w/2,-57,-15,34,w+15,34);g.lineStyle(5,INK);g.strokeTriangle(w/2,-57,-15,34,w+15,34);
    g.fillStyle(0xfcffff);g.fillTriangle(w/2,-62,-14,19,w+14,19);g.lineStyle(3,0x99c7e2);g.lineBetween(-14,19,w*.25,14);g.lineBetween(w*.25,14,w*.53,22);g.lineBetween(w*.53,22,w+14,19);
    panel(g,0xffffff,-14,23,w+28,14,4);
    panel(g,0x3e5b78,w/2-17,h-59,34,59,8);g.fillStyle(0xffd478);g.fillCircle(w/2+8,h-27,3);
    for(const xx of [22,w-58]){panel(g,0xffe29b,xx,54,36,31,4);g.lineStyle(3,0x536282);g.lineBetween(xx+18,54,xx+18,85);g.lineBetween(xx,69,xx+36,69);panel(g,0xfaffff,xx-5,84,46,9,3);}
    panel(g,0xd4e5ef,w/2-23,h,46,10,3);
  }
  function fence(s,o){const g=s.add.graphics().setDepth(o.y+o.h+4),vertical=o.h>o.w,length=vertical?o.h:o.w;
    g.fillStyle(0x7c9caf,.16);g.fillRect(o.x+5,o.y+14,o.w+8,o.h+10);
    for(const shift of [-19,-2]){if(vertical)panel(g,0xcb9b65,o.x+shift,o.y,10,o.h,3);else panel(g,0xcb9b65,o.x,o.y+shift,o.w,10,3);}
    for(let pos=0;pos<=length;pos+=50){const x=o.x+(vertical?0:pos),y=o.y+(vertical?pos:0);panel(g,0xa67346,x-7,y-29,15,49,5);panel(g,0xecbd80,x-7,y-31,15,10,5);g.fillStyle(0xffffff);g.fillEllipse(x+.5,y-31,18,6);}
  }
  function pond(s,o){const g=s.add.graphics().setDepth(0),{x,y,w,h}=o;
    g.fillStyle(0x91c9e8);g.fillRoundedRect(x-13,y-13,w+26,h+26,36);g.lineStyle(4,0x6cabc8);g.strokeRoundedRect(x-13,y-13,w+26,h+26,36);
    g.fillStyle(0xb5e7f7);g.fillRoundedRect(x,y,w,h,30);g.lineStyle(3,0xf3ffff,.85);
    g.lineBetween(x+20,y+35,x+w-35,y+60);g.lineBetween(x+50,y+h-30,x+w-20,y+h-40);g.lineBetween(x+w*.6,y+8,x+w*.48,y+70);g.lineBetween(x+w*.48,y+70,x+w*.61,y+h-15);
  }
  function village(s){
    const bg=s.add.graphics().setDepth(-10);bg.fillStyle(0xe6f4fd);bg.fillRect(0,0,WORLD.width,WORLD.height);
    // Repeating flakes provide snow texture without washing out silhouettes.
    for(let i=0;i<1700;i++){const x=(i*157)%WORLD.width,y=(i*283)%WORLD.height;bg.fillStyle(i%3?0xffffff:0xc7e2f2,i%3?.6:.35);bg.fillEllipse(x,y,3+i%3*2,2);}
    for(const p of WORLD.paths){bg.fillStyle(0xd0e7f4);bg.fillRoundedRect(p.x-8,p.y-8,p.w+16,p.h+16,35);bg.fillStyle(0xe9f6fd);bg.fillRoundedRect(p.x,p.y,p.w,p.h,30);}
    for(const o of WORLD.obstacles){if(o.type==='house')house(s,o);else if(o.type==='tree')tree(s,o);else if(o.type==='fence')fence(s,o);else if(o.type==='lake')pond(s,o);else {
      const g=s.add.graphics({x:o.x,y:o.y}).setDepth(o.y+o.h);g.fillStyle(0x6494b0,.18);g.fillEllipse(25,38,60,18);panel(g,0x98b1c9,0,6,50,33,13);g.fillStyle(0xfaffff);g.fillEllipse(24,9,48,17);g.lineStyle(3,INK);g.lineBetween(5,22,17,28);
    }}
    for(const f of WORLD.farms){const g=s.add.graphics({x:f.x,y:f.y}).setDepth(1);panel(g,0x96704d,-32,-28,64,56,7);g.fillStyle(0x594f47);g.fillRoundedRect(-25,-21,50,42,4);g.lineStyle(3,0x9d8265);for(let i=0;i<3;i++)g.lineBetween(-20,-13+i*13,20,-13+i*13);g.fillStyle(0xffffff);g.fillRoundedRect(-33,-29,66,8,4);}
    const farmSign=s.add.graphics({x:610,y:637}).setDepth(636);panel(farmSign,0xbe945c,-2,-12,5,39,1);panel(farmSign,0xfff5d5,-58,-34,116,33,6);label(s,610,620,'แปลงเครื่องยิง','#714c33',12).setDepth(638);
    const med=s.add.graphics({x:WORLD.supply.x,y:WORLD.supply.y}).setDepth(530);med.fillStyle(0x6f99b2,.17);med.fillEllipse(0,28,98,29);panel(med,0xfbfdfb,-38,-44,76,72,8);panel(med,0x9fbdca,-42,-54,84,18,5);med.fillStyle(0xee7180);med.fillRect(-7,-29,14,39);med.fillRect(-19,-17,38,14);label(s,1190,561,'รักษา · 20 เหรียญ','#ae4661',12);
    for(const f of WORLD.fishing){const g=s.add.graphics({x:f.x,y:f.y}).setDepth(f.y+8);panel(g,0xd0a475,-30,-23,60,46,4);g.lineStyle(2,0x8b6446);for(let i=-20;i<30;i+=12)g.lineBetween(i,-20,i,21);label(s,f.x,f.y-40,'ท่าตกปลา','#35759b',12);}
    const deco=s.add.graphics();
    // Snowman, presents, lanterns and an expedition flag make the village lived in.
    for(const [x,y]of [[460,250],[1590,430],[410,1110],[1150,900]]){const g=s.add.graphics({x,y}).setDepth(y+25);g.fillStyle(0x7399b1,.2);g.fillEllipse(5,24,61,16);panel(g,0xf7fdff,-23,-13,46,39,19);panel(g,0xf7fdff,-17,-41,34,32,15);g.fillStyle(0x24334a);g.fillCircle(-6,-26,2.5);g.fillCircle(6,-26,2.5);g.fillCircle(0,4,2.5);g.fillCircle(0,14,2.5);g.fillStyle(0xffac50);g.fillTriangle(0,-22,17,-17,0,-12);panel(g,0x4b617e,-20,-47,40,9,3);panel(g,0x4b617e,-13,-62,26,18,4);panel(g,0xee7d7b,-22,-10,44,9,3);g.lineStyle(4,0x956c49);g.lineBetween(-22,0,-34,-16);g.lineBetween(22,0,34,-17);}
    for(const [x,y]of [[760,530],[1110,650],[450,810],[1630,320]]){const g=s.add.graphics({x,y}).setDepth(y);panel(g,0x4c627c,-4,-47,8,55,2);panel(g,0xffda7e,-11,-67,22,23,5);panel(g,0x546783,-15,-73,30,8,4);g.fillStyle(0xffffff);g.fillEllipse(0,-75,31,7);}
    for(const [x,y,c]of [[337,350,0xf78da5],[1510,350,0x83cde3],[455,940,0xf4cb67]]){panel(deco,c,x,y,26,24,4);deco.lineStyle(4,0xfff7df);deco.lineBetween(x+13,y,x+13,y+24);deco.lineBetween(x,y+9,x+26,y+9);}
    label(s,920,920,'FROSTBOUND VILLAGE','#739bb5',24).setAlpha(.65);
  }
  function creature(s,p){
    const shadow=s.add.ellipse(0,15,52,17,0x315977,.24),ring=s.add.ellipse(0,14,63,25).setStrokeStyle(3,0x37b5ed,.8).setVisible(p.id===getUserId());
    const feet=[s.add.ellipse(-11,12,15,17,0x344964).setStrokeStyle(3,INK),s.add.ellipse(11,12,15,17,0x344964).setStrokeStyle(3,INK)];
    const body=s.add.image(0,-20,p.cursed?'zombie':'avatar-'+p.avatar%6).setDisplaySize(66,66);
    const gun=s.add.graphics();panel(gun,0x8b9fba,12,-8,29,16,6);panel(gun,0x344e70,32,-7,13,14,3);panel(gun,0xa5e4f9,35,-6,9,12,3);gun.setVisible(!!p.launcher);
    const shield=s.add.ellipse(0,-12,80,83).setStrokeStyle(3,0x8bbceb,.75).setVisible(false);
    const name=s.add.text(0,36,p.name,{fontFamily:'Noto Sans Thai',fontSize:12,fontStyle:'bold',color:'#283a54',stroke:'#ffffff',strokeThickness:4}).setOrigin(.5);
    const hp=s.add.graphics();const c=s.add.container(p.x,p.y,[shadow,ring,...feet,body,gun,shield,hp,name]);Object.assign(c,{body,feet,gun,shield,hp,role:p.cursed,avatar:p.avatar,prevHP:p.hp,prevCoins:p.coins,prevAmmo:p.ammo,samples:[]});return c;
  }
  function fire(){const room=getState();if(isBlocked()||room?.readyRemaining||Date.now()-lastFire<405)return;lastFire=Date.now();if(onShoot(aim))sound('shoot');}
  const blur=()=>{held=false;touch={x:0,y:0};input={x:0,y:0};if(keys)for(const k of Object.values(keys))k.reset();if(cursors)for(const k of Object.values(cursors))k.reset();onInput(0,0,aim,predictor.drain());};
  class SnowScene extends Phaser.Scene{
    preload(){for(let i=0;i<6;i++)this.load.svg('avatar-'+i,'/art/avatar-'+i+'.svg',{width:128,height:128});this.load.svg('zombie','/art/zombie.svg',{width:128,height:128});}
    create(){
      scene=this;village(this);farmLayer=this.add.graphics().setDepth(805);shotLayer=this.add.graphics().setDepth(1600);fxLayer=this.add.graphics().setDepth(1700);snowLayer=this.add.graphics().setScrollFactor(0).setDepth(2000);mini=this.add.graphics().setScrollFactor(0).setDepth(2010);reticle=this.add.graphics().setDepth(1900);
      this.cameras.main.setBounds(0,0,WORLD.width,WORLD.height);this.cameras.main.setBackgroundColor('#deeffc');
      const resize=()=>{this.cameras.main.setZoom(preview?Math.max(.3,Math.min(.52,this.scale.width/1500)):this.scale.width<700?.92:1.14);if(preview)this.cameras.main.centerOn(940,665);};resize();this.scale.on('resize',resize);
      if(!preview){keys=this.input.keyboard.addKeys('W,A,S,D,Q,E,SPACE');cursors=this.input.keyboard.createCursorKeys();
        this.input.keyboard.on('keydown-Q',()=>{if(!isBlocked())onQuestion();});this.input.keyboard.on('keydown-E',()=>{if(!isBlocked())onInteract();});this.input.keyboard.on('keydown-M',()=>showMap=!showMap);this.input.keyboard.disableGlobalCapture();
        this.input.on('pointermove',pointer=>{if(pointer.pointerType==='touch'||isBlocked())return;const me=entities.get(getUserId());if(!me)return;const w=this.cameras.main.getWorldPoint(pointer.x,pointer.y);aim=Math.atan2(w.y-me.y,w.x-me.x);pointerAim=true;});
        this.input.on('pointerdown',pointer=>{unlockSound();if(isBlocked())return;const me=entities.get(getUserId());if(!me)return;const w=this.cameras.main.getWorldPoint(pointer.x,pointer.y);aim=Math.atan2(w.y-me.y,w.x-me.x);pointerAim=true;held=pointer.pointerType!=='touch';fire();});
        this.input.on('pointerup',()=>held=false);this.input.on('gameout',()=>held=false);window.addEventListener('blur',blur);
      }
    }
    update(time,delta){
      const dt=Math.min(.05,delta/1000),room=getState(),receipt=room?.clientReceivedAt??performance.now(),now=room?(room.serverNow+performance.now()-receipt):Date.now();
      const ps=preview?[
        {id:'a',name:'บลู',avatar:0,x:840+Math.sin(time/1800)*125,y:570+Math.cos(time/2200)*85,cursed:false,moving:true,launcher:true,aim:0,hp:100},
        {id:'b',name:'โมจิ',avatar:1,x:1010+Math.sin(time/2300)*115,y:730+Math.cos(time/2500)*50,cursed:false,moving:true,hp:100},
        {id:'c',name:'ซอมบี้',avatar:2,x:1240+Math.sin(time/2100)*90,y:615+Math.cos(time/1800)*70,cursed:true,moving:true,launcher:true,aim:Math.PI,hp:100},
        {id:'d',name:'มินต์',avatar:3,x:650+Math.sin(time/2400)*80,y:920+Math.cos(time/2000)*65,cursed:false,moving:true,hp:100}
      ]:room?.players||[];
      if(!preview){let x=touch.x,y=touch.y;if(keys&&!isBlocked()&&!room?.readyRemaining){x+=(keys.D.isDown||cursors.right.isDown?1:0)-(keys.A.isDown||cursors.left.isDown?1:0);y+=(keys.S.isDown||cursors.down.isDown?1:0)-(keys.W.isDown||cursors.up.isDown?1:0);}else{x=0;y=0;}
        const n=Math.max(1,Math.hypot(x,y));input={x:x/n,y:y/n};if(!pointerAim&&Math.hypot(x,y)>.01)aim=Math.atan2(y,x);
        if(time-lastInput>50&&room?.status==='playing'){onInput(input.x,input.y,aim,predictor.drain());lastInput=time;}
        if((held||keys?.SPACE.isDown)&&!isBlocked())fire();
      }
      const fresh=seenState!==room;seenState=room;const ids=new Set(ps.map(p=>p.id));for(const [id,c]of entities)if(!ids.has(id)){c.destroy(true);entities.delete(id);}
      for(const p of ps){let c=entities.get(p.id);if(c&&(c.role!==p.cursed||c.avatar!==p.avatar)){effects.push({x:c.x,y:c.y,at:time,kind:'transform'});c.body.setTexture(p.cursed?'zombie':'avatar-'+p.avatar%6);c.role=p.cursed;c.avatar=p.avatar;if(p.id===getUserId())sound('transform');}if(!c){c=creature(this,p);entities.set(p.id,c);}
        const local=p.id===getUserId()&&!preview,oldX=c.x,oldY=c.y;
        if(local){
          if(fresh)predictor.reconcile(p,{...room,readyAt:room.readyAt||0},now);
          predictor.step(input,dt,room,now);Object.assign(c,predictor.position());
        }else if(preview){c.x=p.x;c.y=p.y;}
        else {if(fresh){c.samples.push({x:p.x,y:p.y,at:receipt});if(c.samples.length>20)c.samples.shift();}const position=samplePosition(c.samples,performance.now()-120);if(position)Object.assign(c,position);}
        const moving=local?Math.hypot(input.x,input.y)>.01:p.moving,bob=moving?Math.sin(time/90+p.avatar)*2:Math.sin(time/400+p.avatar)*.6;
        c.body.y=-20+bob;c.feet[0].y=12+(moving?Math.sin(time/100)*4:0);c.feet[1].y=12-(moving?Math.sin(time/100)*4:0);c.body.scaleX=Math.abs(c.body.scaleX)*(Math.cos(local?aim:p.aim||0)<-.2?-1:1);
        c.gun.setVisible(!!p.launcher);c.gun.rotation=local?aim:p.aim||0;c.shield.setVisible(!!p.shielded||p.frozenUntil>now);c.shield.setStrokeStyle(p.frozenUntil>now?5:3,p.frozenUntil>now?0x66d6fa:0x8bbceb,.6+.2*Math.sin(time/200));
        c.hp.clear();if(p.hp<100&&!p.cursed){c.hp.fillStyle(INK);c.hp.fillRoundedRect(-24,-61,48,7,3);c.hp.fillStyle(0xf77d8e);c.hp.fillRoundedRect(-22,-59,44*p.hp/100,3,1);}
        c.setDepth(c.y+20).setAlpha(p.connected===false?.5:1);
        if(fresh&&p.hp<c.prevHP){effects.push({x:c.x,y:c.y,at:time,kind:'hit'});if(local){this.cameras.main.shake(130,.003);sound('hit');}}
        if(fresh&&p.coins>c.prevCoins){const reward=this.add.text(c.x,c.y-65,'+'+(p.coins-c.prevCoins),{fontFamily:'Outfit',fontSize:20,fontStyle:'bold',color:'#ffbc4b',stroke:'#253a58',strokeThickness:4}).setOrigin(.5).setDepth(1800);this.tweens.add({targets:reward,y:reward.y-40,alpha:0,duration:850,onComplete:()=>reward.destroy()});if(local&&!isBlocked())sound('reward');}
        c.prevHP=p.hp;c.prevCoins=p.coins;c.prevAmmo=p.ammo;
        if(moving&&time-lastFoot>140&&Math.hypot(oldX-c.x,oldY-c.y)>1)prints.push({x:c.x,y:c.y+12,at:time});
      }
      if(time-lastFoot>140)lastFoot=time;
      const me=entities.get(getUserId());if(!preview)this.cameras.main.centerOn(me?.x||920,me?.y||620);
      reticle.clear();if(me&&pointerAim&&!isBlocked()){const x=me.x+Math.cos(aim)*100,y=me.y+Math.sin(aim)*100;reticle.lineStyle(2,INK,.8);reticle.strokeCircle(x,y,7);reticle.lineBetween(x-13,y,x-4,y);reticle.lineBetween(x+4,y,x+13,y);reticle.lineBetween(x,y-13,x,y-4);reticle.lineBetween(x,y+4,x,y+13);}
      shotLayer.clear();for(const shot of room?.shots||[]){const age=Math.min(.2,Math.max(0,(performance.now()-receipt)/1000)),x=shot.x+shot.vx*age,y=shot.y+shot.vy*age;shotLayer.lineStyle(4,shot.cursed?0xaacaf4:0xbfe8fa,.7);shotLayer.lineBetween(x-shot.vx*.025,y-shot.vy*.025,x,y);shotLayer.fillStyle(shot.cursed?0xe0ddff:0xffffff);shotLayer.fillCircle(x,y,7);shotLayer.lineStyle(2,INK);shotLayer.strokeCircle(x,y,7);}
      for(const f of room?.fx||[])if(!seenFX.has(f.id)){seenFX.add(f.id);effects.push({...f,at:time});}if(seenFX.size>500)seenFX.clear();
      fxLayer.clear();for(let i=prints.length-1;i>=0;i--){const f=prints[i],age=time-f.at;if(age>1800){prints.splice(i,1);continue;}fxLayer.fillStyle(0x6c9db9,.12*(1-age/1800));fxLayer.fillEllipse(f.x-8,f.y,8,4);fxLayer.fillEllipse(f.x+8,f.y+4,8,4);}
      for(let i=effects.length-1;i>=0;i--){const f=effects[i],age=(time-f.at)/600;if(age>1){effects.splice(i,1);continue;}fxLayer.fillStyle(f.kind==='transform'?0xba9bff:0xffffff,1-age);for(let j=0;j<9;j++){const a=j*Math.PI*2/9;fxLayer.fillCircle(f.x+Math.cos(a)*age*50,f.y+Math.sin(a)*age*50,4*(1-age)+1);}}
      farmLayer.clear();for(const plant of room?.farms||[]){const plot=WORLD.farms[plant.id],ready=now>plant.readyAt;farmLayer.fillStyle(0x68b581);farmLayer.fillRoundedRect(plot.x-4,plot.y-17,8,27,3);farmLayer.fillEllipse(plot.x-8,plot.y-4,21,12);farmLayer.fillEllipse(plot.x+10,plot.y-14,23,12);if(ready){farmLayer.fillStyle(0xffffff);farmLayer.fillCircle(plot.x,plot.y-26,12);farmLayer.lineStyle(3,INK);farmLayer.strokeCircle(plot.x,plot.y-26,12);}else{farmLayer.fillStyle(INK,.7);farmLayer.fillRect(plot.x-22,plot.y+18,44,5);farmLayer.fillStyle(0xa2e08d);farmLayer.fillRect(plot.x-22,plot.y+18,44*Math.max(0,1-(plant.readyAt-now)/5000),5);}}
      const w=this.scale.width,h=this.scale.height,z=this.cameras.main.zoom;for(const layer of [snowLayer,mini])layer.setScale(1/z).setPosition(w/2*(1-1/z),h/2*(1-1/z));snowLayer.clear();snowLayer.fillStyle(0xffffff,.65);for(let i=0;i<28;i++)snowLayer.fillCircle((i*149+Math.sin(time/3000+i)*18)%w,(i*87+time*(.009+i%3*.004))%h,i%4===0?2:1);
      mini.clear();if(showMap&&!preview&&w>600){const mw=156,mh=117,x=w-mw-18,y=h-mh-22;mini.fillStyle(0x243b58,.88);mini.fillRoundedRect(x-5,y-5,mw+10,mh+10,10);mini.fillStyle(0xe6f4fd);mini.fillRoundedRect(x,y,mw,mh,6);for(const o of WORLD.obstacles){mini.fillStyle(o.type==='lake'?0x72c5e4:o.type==='house'?0xa4b8ce:o.type==='tree'?0x6b9c91:0xc19b73);mini.fillRect(x+o.x/WORLD.width*mw,y+o.y/WORLD.height*mh,Math.max(2,o.w/WORLD.width*mw),Math.max(2,o.h/WORLD.height*mh));}for(const p of ps){mini.fillStyle(p.id===getUserId()?0xffca69:p.cursed?0x9471d6:0x2b93c6);mini.fillCircle(x+p.x/WORLD.width*mw,y+p.y/WORLD.height*mh,p.id===getUserId()?3:2);}}
    }
  }
  game=new Phaser.Game({type:Phaser.AUTO,parent,...size(),scene:SnowScene,backgroundColor:'#deeffc',render:{antialias:true},scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},audio:{noAudio:true},banner:false});
  const observer=new ResizeObserver(()=>game.scale.resize(size().width,size().height));observer.observe(parent);
  return {destroy(){observer.disconnect();window.removeEventListener('blur',blur);game.destroy(true);entities.clear();},setTouch(x,y){touch={x,y};pointerAim=false;},setFiring(value){if(value)unlockSound();held=value;},shoot:fire,toggleMap(){showMap=!showMap;},toggleSound};
}
