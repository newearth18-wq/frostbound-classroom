// One map for server collision, local prediction, art and the minimap.
const trees=[[110,440],[150,620],[480,160],[1230,160],[1650,460],[1630,690],[490,1030],[1260,1040],[530,470],[1270,730],
  [110,120],[190,110],[100,210],[1770,170],[1870,240],[1830,360],[100,1000],[160,1110],[210,1240],[530,1320],[680,1380],[1090,1360],[1760,1210],[1840,1360],[1650,1390]];
const fences=[[420,350,220,18],[640,350,18,170],[700,620,18,50],[1120,350,180,18],[1300,350,18,190],[1300,640,18,110],
  [430,950,180,18],[610,950,18,90],[610,1160,18,120],[1020,1120,170,18],[1190,1120,18,180],[1620,800,18,170],[1620,1080,18,150],
  [50,70,220,18],[400,70,310,18],[850,70,350,18],[1320,70,320,18],[1770,70,180,18],
  [50,1410,400,18],[550,1410,300,18],[1000,1410,380,18],[1500,1410,450,18]];
export const WORLD={width:2000,height:1500,
  obstacles:[{x:220,y:195,w:180,h:130,type:'house',color:0xdf8652},{x:1390,y:195,w:180,h:130,type:'house',color:0x5799ce},
    {x:225,y:810,w:180,h:135,type:'house',color:0xc190df},{x:1370,y:820,w:200,h:130,type:'house',color:0xe2a957},
    {x:790,y:1040,w:230,h:160,type:'lake'},{x:1460,y:1120,w:250,h:150,type:'lake'},
    ...trees.map(([x,y])=>({x,y,w:40,h:30,type:'tree'})),...fences.map(([x,y,w,h])=>({x,y,w,h,type:'fence'})),
    ...[[740,410],[1050,780],[1760,590],[310,650]].map(([x,y])=>({x,y,w:50,h:38,type:'rock'}))],
  farms:[{id:0,x:570,y:720},{id:1,x:650,y:720},{id:2,x:570,y:800},{id:3,x:650,y:800}],
  supply:{x:1190,y:510},fishing:[{x:790,y:1010},{x:1430,y:1180}],
  paths:[{x:420,y:540,w:1190,h:125},{x:810,y:360,w:150,h:640},{x:450,y:670,w:260,h:210},{x:1080,y:405,w:220,h:240}],
  spawns:[{x:840,y:550},{x:960,y:680},{x:1040,y:550},{x:750,y:640},{x:1080,y:680},{x:850,y:820},{x:1450,y:590},{x:440,y:590}]
};
export function blocked(x,y,radius=19){return WORLD.obstacles.some(o=>x+radius>o.x&&x-radius<o.x+o.w&&y+radius>o.y&&y-radius<o.y+o.h);}
export function movePosition(p,dx,dy,radius=19){
  const nx=Math.max(35,Math.min(WORLD.width-35,p.x+dx)),ny=Math.max(35,Math.min(WORLD.height-35,p.y+dy));
  const x=blocked(nx,p.y,radius)?p.x:nx;return {x,y:blocked(x,ny,radius)?p.y:ny};
}
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
