export const WORLD = { width: 1800, height: 1200,
  obstacles: [
    {x:220,y:195,w:180,h:130,type:'house'}, {x:1390,y:195,w:180,h:130,type:'house'},
    {x:225,y:810,w:180,h:135,type:'house'}, {x:1370,y:820,w:200,h:130,type:'house'},
    {x:710,y:180,w:340,h:175,type:'lake'}, {x:735,y:865,w:340,h:170,type:'lake'},
    ...[[110,440],[150,620],[480,160],[1230,160],[1650,460],[1630,690],[490,1030],[1260,1040],[530,470],[1270,730]].map(([x,y])=>({x,y,w:55,h:58,type:'tree'}))
  ], farms: [{id:0,x:570,y:720},{id:1,x:650,y:720},{id:2,x:570,y:800},{id:3,x:650,y:800}],
  supply: {x:1190,y:510}
};
export function blocked(x,y,radius=19) {
  return WORLD.obstacles.some(o => x+radius>o.x && x-radius<o.x+o.w && y+radius>o.y && y-radius<o.y+o.h);
}
export const distance = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
