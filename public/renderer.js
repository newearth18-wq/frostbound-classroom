// Phaser renders the world; the server owns movement, combat and resources.
const COLORS=[0x6476e5,0xef9865,0x55b8ad,0xe18fba,0xedbd59,0x7aa7e2];
const TREES=[[110,440],[150,620],[480,160],[1230,160],[1650,460],[1630,690],[490,1030],[1260,1040],[530,470],[1270,730]];
export function createWorld(parent,{preview=false,getState=()=>null,getUserId=()=>null,onInput=()=>{},onShoot=()=>{},onQuestion=()=>{},onInteract=()=>{},isBlocked=()=>false}={}){
  let game,scene,keyboard,entities=new Map(),snow,shotLayer,farmLayer,lastInput=0,keys,aim=0,touch={x:0,y:0};
  const size=()=>({width:parent.clientWidth||700,height:parent.clientHeight||420});
  function tree(s,x,y,scale=1){
    const g=s.add.graphics({x,y}).setDepth(y+58);g.fillStyle(0x739c99,.18);g.fillEllipse(20,50,85,24);
    g.fillStyle(0x8d7870);g.fillRoundedRect(13,12,12,43,3);
    for(let i=0;i<3;i++){const top=-40+i*19,width=58+i*15;
      g.fillStyle([0x456f69,0x527e72,0x668c78][i]);g.fillTriangle(19,top,19-width/2,top+43,19+width/2,top+43);
      g.fillStyle(0xf6faf0);g.fillTriangle(19,top-3,19-width*.32,top+20,19+width*.32,top+20);
    }g.setScale(scale);
  }
  function house(s,x,y,w=180,h=130,color=0xcc8c76){
    const g=s.add.graphics({x,y}).setDepth(y+h);
    g.fillStyle(0x50766e,.15);g.fillRoundedRect(-3,18,w+20,h+12,12);
    g.fillStyle(color);g.fillRoundedRect(0,25,w,h-25,8);
    g.fillStyle(0xaf7362);g.fillRect(0,h-13,w,13);
    g.fillStyle(0x7f6970);g.fillTriangle(w/2,-35,-12,40,w+12,40);
    g.fillStyle(0xfcfcf0);g.fillTriangle(w/2,-43,-12,26,w+12,26);g.fillRoundedRect(-12,24,w+24,12,5);
    g.fillStyle(0x967069);g.fillRect(w*.72,-34,18,32);g.fillStyle(0xf6faf2);g.fillRoundedRect(w*.72-4,-38,26,8,3);
    g.fillStyle(0x6c5b58);g.fillRoundedRect(w/2-15,h-55,30,55,4);g.fillStyle(0xe6c58b);g.fillCircle(w/2+6,h-28,2);
    for(const a of [25,w-54]){g.fillStyle(0xffe8ae);g.fillRoundedRect(a,55,30,27,4);g.lineStyle(3,0x926456);g.strokeRect(a,55,30,27);g.lineBetween(a+15,55,a+15,82);g.lineBetween(a,68,a+30,68);g.fillStyle(0xf8faf2);g.fillRoundedRect(a-5,80,40,7,3);}
  }
  function creature(s,p){
    const g=s.add.graphics();g.fillStyle(0x3c7260,.18);g.fillEllipse(0,18,43,13);
    g.fillStyle(0x374c57);g.fillRoundedRect(-12,9,9,14,3);g.fillRoundedRect(3,9,9,14,3);
    g.fillStyle(p.cursed?0x8a71b8:COLORS[p.avatar%6]);g.fillRoundedRect(-19,-7,38,27,11);
    g.fillStyle(p.cursed?0xc1e09a:0xf8deb7);g.fillRoundedRect(-13,-19,26,23,10);
    g.fillStyle(p.cursed?0x77639b:COLORS[p.avatar%6]);g.fillRoundedRect(-17,-29,34,17,7);
    g.fillStyle(p.cursed?0xbeb0df:0xf5f9ef);g.fillRoundedRect(-20,-16,40,7,3);g.fillCircle(0,-31,6);
    g.fillStyle(0x243d45);g.fillCircle(-5,-5,2);g.fillCircle(5,-5,2);g.lineStyle(1.5,0x806c65);g.lineBetween(-2,1,2,1);
    g.fillStyle(p.cursed?0x7353aa:0xe8c77c);g.fillRoundedRect(-16,4,32,7,2);g.fillRoundedRect(7,5,7,15,2);
    if(p.cursed){g.fillStyle(0x99c870);g.fillTriangle(-19,-16,-24,-6,-14,-6);g.fillTriangle(19,-16,24,-6,14,-6);}
    const label=s.add.text(0,37,p.name,{fontFamily:'Noto Sans Thai, sans-serif',fontSize:11,color:p.cursed?'#705991':'#3b5856',backgroundColor:'#ffffffe0',padding:{x:7,y:3}}).setOrigin(.5);
    const container=s.add.container(p.x,p.y,[g,label]);container.role=p.cursed;container.avatar=p.avatar;
    return container;
  }
  class SnowScene extends Phaser.Scene{
    create(){
      scene=this;this.cameras.main.setBackgroundColor('#dfece7');
      const bg=this.add.graphics();bg.fillStyle(0xe8f0e9);bg.fillRect(0,0,1800,1200);
      // Snowbanks, footpaths and original village art.
      bg.fillStyle(0xf7faf0);bg.fillEllipse(890,560,1780,1130);
      bg.fillStyle(0xecf3e9);bg.fillEllipse(350,420,500,500);bg.fillEllipse(1470,790,600,430);
      bg.lineStyle(115,0xe2e9df,.65);bg.beginPath();bg.moveTo(140,580);bg.lineTo(1690,580);bg.strokePath();
      bg.lineStyle(105,0xe2e9df,.65);bg.beginPath();bg.moveTo(880,370);bg.lineTo(900,840);bg.strokePath();
      bg.lineStyle(2,0xd6e1d1,.65);
      for(let i=0;i<140;i++){let x=(i*197%1700)+50,y=(i*311%1100)+50;bg.lineBetween(x,y,x+6,y-2);}
      for(const [x,y,w,h]of [[710,180,340,175],[735,865,340,170]]){
        bg.fillStyle(0xc5dedb);bg.fillRoundedRect(x-12,y-12,w+24,h+24,65);
        bg.fillStyle(0xa9cdd0);bg.fillRoundedRect(x,y,w,h,55);
        bg.lineStyle(2,0xdcf2ed,.65);bg.lineBetween(x+35,y+h*.35,x+w-60,y+h*.45);bg.lineBetween(x+90,y+h*.65,x+w-45,y+h*.62);
        bg.lineBetween(x+w*.6,y+20,x+w*.48,y+90);bg.lineBetween(x+w*.48,y+90,x+w*.56,y+h-25);
      }
      house(this,220,195);house(this,1390,195,180,130,0x8e9db4);house(this,225,810,180,135,0xb2a082);house(this,1370,820,200,130,0xb793aa);
      for(const [x,y]of TREES)tree(this,x,y);
      for(let i=0;i<22;i++){tree(this,20+(i*353%1740),i%2?55:1140,.7);}
      const farms=this.add.graphics().setDepth(10);
      for(const [x,y]of [[570,720],[650,720],[570,800],[650,800]]){farms.fillStyle(0xa99785);farms.fillRoundedRect(x-30,y-27,60,54,8);farms.fillStyle(0x6f6458);farms.fillRoundedRect(x-25,y-21,50,42,5);farms.lineStyle(2,0x91816c);for(let i=0;i<3;i++)farms.lineBetween(x-20,y-12+i*12,x+20,y-12+i*12);farms.fillStyle(0xf3f8ee);farms.fillRoundedRect(x-32,y-31,64,8,3);}
      this.add.text(610,667,'แปลงปลูก',{fontFamily:'Noto Sans Thai',fontSize:13,color:'#617c68',backgroundColor:'#f7faf1',padding:{x:10,y:5}}).setOrigin(.5);
      const medical=this.add.graphics({x:1190,y:510}).setDepth(510);medical.fillStyle(0x739c99,.18);medical.fillEllipse(0,34,94,20);medical.fillStyle(0xd4dfc4);medical.fillRoundedRect(-33,-27,66,57,10);medical.fillStyle(0xf8faf0);medical.fillRoundedRect(-37,-37,74,20,5);medical.fillStyle(0xd58a79);medical.fillRect(-5,-13,10,29);medical.fillRect(-14,-3,28,10);
      this.add.text(1190,565,'จุดพยาบาล',{fontFamily:'Noto Sans Thai',fontSize:12,color:'#768369',backgroundColor:'#f7faf1',padding:{x:8,y:4}}).setOrigin(.5);
      // Small lanterns and benches along the main path.
      for(const [x,y]of [[455,600],[1325,595],[790,400],[1040,780]]){
        const g=this.add.graphics({x,y}).setDepth(y);g.fillStyle(0x738a7a);g.fillRoundedRect(-3,-50,6,52,2);g.fillStyle(0xefd293);g.fillRoundedRect(-9,-62,18,17,5);g.fillStyle(0x5d7970);g.fillTriangle(0,-71,-12,-62,12,-62);g.fillStyle(0xfcfaf0);g.fillTriangle(0,-73,-10,-65,10,-65);
      }
      shotLayer=this.add.graphics().setDepth(1500);farmLayer=this.add.graphics().setDepth(802);
      snow=this.add.graphics().setScrollFactor(0).setDepth(2000);
      this.cameras.main.setBounds(0,0,1800,1200);
      if(preview){this.cameras.main.setZoom(.49);this.cameras.main.centerOn(900,570);}
      else{
        this.cameras.main.setZoom(Math.min(1.05,Math.max(.73,parent.clientWidth/1200)));
        keys=this.input.keyboard.addKeys('W,A,S,D,Q,E,SPACE');keyboard=this.input.keyboard.createCursorKeys();
        this.input.keyboard.on('keydown-Q',()=>{if(!isBlocked())onQuestion();});
        this.input.keyboard.on('keydown-E',()=>{if(!isBlocked())onInteract();});
        this.input.keyboard.on('keydown-SPACE',()=>{if(!isBlocked())onShoot(aim);});
        this.input.on('pointerdown',p=>{
          if(isBlocked())return;const me=getState()?.players.find(p=>p.id===getUserId());if(!me)return;
          const w=this.cameras.main.getWorldPoint(p.x,p.y);aim=Math.atan2(w.y-me.y,w.x-me.x);onShoot(aim);
        });
        this.input.on('pointermove',p=>{
          const me=getState()?.players.find(p=>p.id===getUserId());if(!me)return;
          const w=this.cameras.main.getWorldPoint(p.x,p.y);aim=Math.atan2(w.y-me.y,w.x-me.x);
        });
        this.input.keyboard.disableGlobalCapture();
      }
      this.scale.on('resize',()=>{if(preview)this.cameras.main.centerOn(900,570);});
    }
    update(time,delta){
      const room=getState();const ps=preview?[
        {id:'a',name:'มินต์',avatar:2,x:865+Math.sin(time/3000)*90,y:520+Math.cos(time/2800)*60,cursed:false},
        {id:'b',name:'โคโค่',avatar:1,x:1040+Math.sin(time/3500)*65,y:625+Math.cos(time/2500)*55,cursed:false},
        {id:'c',name:'ฟรอสต์',avatar:0,x:650+Math.sin(time/4000)*65,y:540+Math.cos(time/3400)*65,cursed:true}
      ]:room?.players||[];
      const ids=new Set(ps.map(p=>p.id));for(const [id,view]of entities)if(!ids.has(id)){view.destroy(true);entities.delete(id);}
      for(const p of ps){
        let view=entities.get(p.id);
        if(view&&(view.role!==p.cursed||view.avatar!==p.avatar)){view.destroy(true);entities.delete(p.id);view=null;}
        if(!view){view=creature(this,p);entities.set(p.id,view);}
        const alpha=preview?1:1-Math.exp(-delta/70);view.x+=(p.x-view.x)*alpha;view.y+=(p.y-view.y)*alpha;view.setDepth(view.y+22);
        view.setAlpha(p.connected===false?.45:1);
        if(p.frozenUntil>Date.now())view.setAlpha(.55+Math.sin(time/100)*.2);
      }
      shotLayer.clear();shotLayer.fillStyle(0xb6d2d4,.5);
      for(const s of room?.shots||[]){shotLayer.fillCircle(s.x+2,s.y+4,8);shotLayer.fillStyle(s.cursed?0xcbb9e5:0xffffff);shotLayer.fillCircle(s.x,s.y,6);shotLayer.lineStyle(1,0xa6c6c9);shotLayer.strokeCircle(s.x,s.y,6);}
      farmLayer.clear();for(const plant of room?.farms||[]){const plot=room.world.farms[plant.id];const ready=Date.now()>plant.readyAt;
        farmLayer.fillStyle(ready?0x9fba71:0x78a582);farmLayer.fillRoundedRect(plot.x-4,plot.y-15,8,28,3);farmLayer.fillEllipse(plot.x-7,plot.y-5,20,10);farmLayer.fillEllipse(plot.x+8,plot.y-11,20,10);
        if(ready){farmLayer.fillStyle(0xffffff);farmLayer.fillCircle(plot.x,plot.y-20,11);}
      }
      if(!preview){
        const me=ps.find(p=>p.id===getUserId());const view=me&&entities.get(me.id);
        if(view){this.cameras.main.centerOn(view.x,view.y);}
        else this.cameras.main.centerOn(900,600);
        if(time-lastInput>80&&room?.status==='playing'){
          let x=touch.x,y=touch.y;
          if(!isBlocked()){x+=(keys.D.isDown||keyboard.right.isDown?1:0)-(keys.A.isDown||keyboard.left.isDown?1:0);y+=(keys.S.isDown||keyboard.down.isDown?1:0)-(keys.W.isDown||keyboard.up.isDown?1:0);}else{x=0;y=0;}
          if(Math.hypot(x,y)>.01)aim=Math.atan2(y,x);
          onInput(x,y);lastInput=time;
        }
      }
      snow.clear();snow.fillStyle(0xffffff,.68);
      const w=this.scale.width,h=this.scale.height;for(let i=0;i<35;i++){
        snow.fillCircle((i*137+Math.sin(time/3000+i)*20)%w,(i*79+time*(.009+i%3*.004))%h,i%3===0?2:1);
      }
    }
  }
  game=new Phaser.Game({type:Phaser.AUTO,parent,width:size().width,height:size().height,backgroundColor:'#e4efe7',scene:SnowScene,transparent:false,render:{antialias:true},scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},audio:{noAudio:true},banner:false});
  const observer=new ResizeObserver(()=>game.scale.resize(size().width,size().height));observer.observe(parent);
  return {destroy(){observer.disconnect();game.destroy(true);entities.clear();},setTouch(x,y){touch={x,y};},shoot(){onShoot(aim);}};
}
