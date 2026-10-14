import express from 'express';
import {WebSocketServer,WebSocket} from 'ws';
import {openDatabase} from './database.js';
import {randomUUID,randomBytes,randomInt,scryptSync,timingSafeEqual} from 'node:crypto';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import QRCode from 'qrcode';
import {newPlayer,startRoom,tickRoom,publicRoom,shoot,interact,finishRoom} from './simulation.js';
import {SAMPLE,validateQuestions} from './questions.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(fs.existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
const dataDir=process.env.DATA_DIR||path.join(root,'data');
if(process.env.RENDER==='true'&&!process.env.DATABASE_URL)throw Error('Render deployment requires DATABASE_URL for durable accounts');
const db=await openDatabase({dataDir});
const app=express(),server=createServer(app),wss=new WebSocketServer({noServer:true,maxPayload:8192});
const rooms=new Map(),guests=new Map(),rates=new Map();
const PORT=Number(process.env.PORT||3000);
app.disable('x-powered-by');
if(process.env.TRUST_PROXY==='1'||process.env.RENDER==='true')app.set('trust proxy',1);
app.get('/healthz',async(req,res)=>{try{await db.health();res.json({ok:true});}catch{res.status(503).json({ok:false});}});
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' ws: wss:; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'");
  if(req.path.startsWith('/api'))res.setHeader('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){
    try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'คำขอข้ามเว็บไซต์ไม่ถูกอนุญาต'});}catch{return res.status(403).end();}
  }next();
});
app.use(express.json({limit:'120kb'}));
function token(req){return /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie||'')?.[1];}
async function identify(req){
  const t=token(req);if(!t)return null;
  const guest=guests.get(t);if(guest&&guest.expires>Date.now())return guest.user;
  return (await db.prepare('SELECT u.id,u.email,u.name,u.role,u.avatar FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?').get(t,Date.now()))||null;
}
app.use(async(req,res,next)=>{req.user=await identify(req);next();});
function required(req,res,next){if(!req.user)return res.status(401).json({error:'กรุณาเข้าสู่ระบบก่อน'});next();}
function teacher(req,res,next){if(req.user?.role!=='teacher')return res.status(403).json({error:'บัญชีครูเท่านั้นที่สร้างห้องและชุดคำถามได้'});next();}
function limited(req,res,next){
  const key=req.ip+':'+req.path,now=Date.now();let r=rates.get(key);
  if(!r||r.reset<now){r={count:0,reset:now+60000};rates.set(key,r);}
  if(++r.count>20)return res.status(429).json({error:'ส่งคำขอถี่เกินไป กรุณารอสักครู่'});next();
}
const safeUser=u=>({id:u.id,email:u.email,name:u.name,role:u.role,avatar:u.avatar});
async function session(res,u){const t=randomBytes(32).toString('hex');await db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(t,u.id,Date.now()+7*86400000);cookie(res,t);}
function cookie(res,t){res.cookie('session',t,{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',maxAge:7*86400000,path:'/'});}
function makeGuest(req,res){
  if(req.user)return req.user;
  const name=String(req.body.name||'นักผจญภัย').trim().slice(0,24)||'นักผจญภัย';
  const user={id:randomUUID(),name,role:'guest',avatar:randomInt(6)};const t=randomBytes(32).toString('hex');
  guests.set(t,{user,expires:Date.now()+86400000});cookie(res,t);return user;
}
function fail(res,e,status=400){return res.status(status).json({error:e.message||String(e)});}
app.get('/api/me',(req,res)=>res.json({user:req.user}));
app.post('/api/register',limited,async(req,res)=>{
  try{
    const {name,email,password,role}=req.body;
    if(typeof name!=='string'||name.trim().length<2||name.length>24)throw Error('ชื่อควรยาว 2–24 ตัวอักษร');
    if(typeof email!=='string'||email.length>150||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('กรุณาระบุอีเมลที่ถูกต้อง');
    if(typeof password!=='string'||password.length<8||password.length>128)throw Error('รหัสผ่านต้องยาว 8–128 ตัวอักษร');
    if(!['teacher','student'].includes(role))throw Error('กรุณาเลือกครูหรือนักเรียน');
    const normalized=email.trim().toLowerCase();
    if(await db.prepare('SELECT id FROM users WHERE email=?').get(normalized))throw Error('อีเมลนี้มีบัญชีแล้ว');
    const salt=randomBytes(16).toString('hex'),hash=scryptSync(password,salt,64).toString('hex');
    const u={id:randomUUID(),name:name.trim(),email:normalized,role,avatar:randomInt(6)};
    await db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(u.id,u.email,u.name,`${salt}:${hash}`,u.role,u.avatar);
    await session(res,u);res.json({user:safeUser(u)});
  }catch(e){fail(res,e);}
});
app.post('/api/login',limited,async(req,res)=>{
  const {email,password}=req.body;
  if(typeof email!=='string'||typeof password!=='string'||password.length>128)return fail(res,Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง'),401);
  const u=await db.prepare('SELECT * FROM users WHERE email=?').get(email.trim().toLowerCase());
  // Do the same password work for unknown users to avoid a fast account lookup signal.
  const [salt,hash]=(u?.password||`${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const candidate=scryptSync(password,salt,64);
  if(!u||!timingSafeEqual(candidate,Buffer.from(hash,'hex')))return fail(res,Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง'),401);
  await session(res,u);res.json({user:safeUser(u)});
});
app.post('/api/logout',async(req,res)=>{
  await db.prepare('DELETE FROM sessions WHERE token=?').run(token(req)||'');guests.delete(token(req));
  for(const client of wss.clients)if(client.sessionToken===token(req))client.close(1000,'logged out');
  res.clearCookie('session',{path:'/'});res.json({ok:true});
});
app.patch('/api/profile',required,async(req,res)=>{
  const avatar=req.body.avatar;if(!Number.isInteger(avatar)||avatar<0||avatar>5)return fail(res,Error('ตัวละครไม่ถูกต้อง'));
  if(req.user.role==='guest'){req.user.avatar=avatar;}else await db.prepare('UPDATE users SET avatar=? WHERE id=?').run(avatar,req.user.id);
  for(const room of rooms.values())if(room.status==='lobby'){const p=room.players.get(req.user.id);if(p){p.avatar=avatar;broadcast(room);}}
  res.json({user:{...req.user,avatar}});
});
app.get('/api/quizzes',required,teacher,async(req,res)=>{
  const quizzes=(await db.prepare('SELECT * FROM quizzes WHERE owner=?').all(req.user.id)).map(q=>({...q,questions:JSON.parse(q.questions)}));
  res.json({quizzes:[{id:'sample',title:'รอบรู้รอบโลก',questions:SAMPLE},...quizzes]});
});
app.post('/api/quizzes',required,teacher,async(req,res)=>{
  try{
    const title=String(req.body.title||'').trim();if(!title||title.length>80)throw Error('ชื่อชุดคำถามควรยาว 1–80 ตัวอักษร');
    const questions=validateQuestions(req.body.questions),id=req.body.id||randomUUID();
    if(req.body.id){const owned=await db.prepare('SELECT owner FROM quizzes WHERE id=?').get(id);if(owned?.owner!==req.user.id)throw Error('ไม่สามารถแก้ไขชุดคำถามนี้ได้');
      await db.prepare('UPDATE quizzes SET title=?,questions=? WHERE id=?').run(title,JSON.stringify(questions),id);
    }else await db.prepare('INSERT INTO quizzes VALUES(?,?,?,?)').run(id,req.user.id,title,JSON.stringify(questions));
    res.json({id,title,questions});
  }catch(e){fail(res,e);}
});
app.delete('/api/quizzes/:id',required,teacher,async(req,res)=>{await db.prepare('DELETE FROM quizzes WHERE id=? AND owner=?').run(req.params.id,req.user.id);res.json({ok:true});});
async function makeRoom(user,opts,practice=false){
  if(rooms.size>=100)throw Error('ห้องเล่นเต็ม กรุณาลองใหม่ภายหลัง');
  let code;do{code=String(randomInt(100000,1000000));}while(rooms.has(code));
  let questions=SAMPLE,quizTitle='รอบรู้รอบโลก';
  if(opts.quizId&&opts.quizId!=='sample'){
    const quiz=await db.prepare('SELECT * FROM quizzes WHERE id=? AND owner=?').get(opts.quizId,user.id);if(!quiz)throw Error('ไม่พบชุดคำถาม');
    questions=JSON.parse(quiz.questions);quizTitle=quiz.title;
  }
  const duration=Number(opts.duration||180);if(![60,180,300,600].includes(duration))throw Error('ระยะเวลาเกมไม่ถูกต้อง');
  const difficulty=opts.difficulty||'normal';if(!['easy','normal','hard'].includes(difficulty))throw Error('ความยากไม่ถูกต้อง');
  const room={code,title:String(opts.title||'เมืองหิมะของเรา').trim().slice(0,60)||'เมืองหิมะของเรา',hostId:user.id,hostName:user.name,
    players:new Map(),clients:new Map(),status:'lobby',duration,questions,quizTitle,practice,
    survivorSpeed:190,cursedSpeed:{easy:155,normal:180,hard:210}[difficulty],createdAt:Date.now(),events:[],shots:[],farms:[],endsAt:0};
  if(practice){room.players.set(user.id,newPlayer(user.id,user.name,user.avatar));
    for(let i=0;i<3;i++){const id=`bot-${i}`;room.players.set(id,newPlayer(id,['มินต์','โคโค่','ฟรอสต์'][i],i+1,true));}
    startRoom(room);const human=room.players.get(user.id);human.cursed=false;human.ammo=0;human.launcher=false;
    const bot=[...room.players.values()].find(p=>p.bot);for(const p of room.players.values())if(p.bot)p.cursed=false;
    bot.cursed=true;bot.launcher=true;bot.ammo=15;room.events=[{id:randomUUID(),text:`${bot.name} ติดคำสาปคนแรก!`,at:Date.now()}];
  }
  rooms.set(code,room);return room;
}
app.post('/api/rooms',limited,required,teacher,async(req,res)=>{try{res.json({code:(await makeRoom(req.user,req.body)).code});}catch(e){fail(res,e);}});
app.post('/api/practice',limited,async(req,res)=>{try{const user=makeGuest(req,res);res.json({code:(await makeRoom(user,req.body,true)).code,user});}catch(e){fail(res,e);}});
app.get('/api/rooms/:code',(req,res)=>{
  const room=rooms.get(req.params.code);if(!room)return fail(res,Error('ไม่พบห้อง กรุณาตรวจสอบรหัส 6 หลัก'),404);
  res.json({code:room.code,title:room.title,status:room.status,hostName:room.hostName,players:room.players.size});
});
app.post('/api/rooms/:code/join',limited,(req,res)=>{
  const room=rooms.get(req.params.code);if(!room)return fail(res,Error('ไม่พบห้อง กรุณาตรวจสอบรหัส 6 หลัก'),404);
  if(room.status==='finished')return fail(res,Error('ห้องนี้จบเกมแล้ว'));
  const existing=req.user&&room.players.get(req.user.id);
  if(room.status==='playing'&&!existing&&room.hostId!==req.user?.id)return fail(res,Error('เกมเริ่มแล้ว รอห้องรอบถัดไป'));
  if(room.players.size>=40&&!existing)return fail(res,Error('ห้องเต็มแล้ว (40 คน)'));
  const user=makeGuest(req,res);
  if(!room.players.has(user.id)&&room.hostId!==user.id){const p=newPlayer(user.id,user.name,user.avatar);p.connected=false;room.players.set(user.id,p);}
  res.json({code:room.code,user});
});
function access(req,res){const room=rooms.get(req.params.code);if(!room||room.hostId!==req.user?.id){fail(res,Error('เฉพาะเจ้าของห้องเท่านั้น'),403);return null;}return room;}
app.post('/api/rooms/:code/start',required,(req,res)=>{
  const room=access(req,res);if(!room)return;
  if(room.status!=='lobby')return fail(res,Error('ห้องนี้เริ่มเกมแล้ว'));
  const connected=[...room.players.values()].filter(p=>p.connected);if(connected.length<2)return fail(res,Error('ต้องมีผู้เล่นออนไลน์อย่างน้อย 2 คน'));
  for(const [id,p]of room.players)if(!p.connected)room.players.delete(id);
  startRoom(room);res.json({ok:true});broadcast(room);
});
app.post('/api/rooms/:code/stop',required,async(req,res)=>{const room=access(req,res);if(!room)return;finishRoom(room,'ครูจบเกม');await persist(room);broadcast(room);res.json({ok:true});});
app.post('/api/rooms/:code/reset',required,async(req,res)=>{
  const room=access(req,res);if(!room)return;if(room.status!=='finished')return fail(res,Error('ต้องจบเกมก่อนเริ่มรอบใหม่'));
  await persist(room);
  room.status='lobby';room.saved=false;room.endsAt=0;room.events=[];room.shots=[];room.farms=[];
  for(const p of room.players.values()){const connected=p.connected;Object.assign(p,newPlayer(p.id,p.name,p.avatar,p.bot));p.connected=connected;}
  broadcast(room);res.json({ok:true});
});
app.post('/api/rooms/:code/leave',required,(req,res)=>{
  const room=rooms.get(req.params.code);if(room){const p=room.players.get(req.user.id);if(p)p.connected=false;
    if(room.status==='lobby')room.players.delete(req.user.id);room.clients.get(req.user.id)?.close(1000,'left');broadcast(room);}
  res.json({ok:true});
});
function joinBase(req){
  const configured=process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL;
  if(configured){const url=new URL(configured);if(!['http:','https:'].includes(url.protocol))throw Error('PUBLIC_URL ต้องเป็น http หรือ https');return url.origin;}
  const reqHost=req.headers.host||`localhost:${PORT}`;
  if(/^(localhost|127\.0\.0\.1)(:|$)/.test(reqHost)){
    const entries=Object.entries(os.networkInterfaces()).filter(([name])=>!/virtual|vethernet|vmware|docker|tailscale|loopback/i.test(name));
    const addresses=entries.flatMap(([,items])=>items).filter(n=>n.family==='IPv4'&&!n.internal);
    const ip=(addresses.find(n=>n.address.startsWith('192.168.'))||addresses.find(n=>n.address.startsWith('10.'))||addresses[0])?.address;
    if(ip)return `http://${ip}:${PORT}`;
  }
  return `${req.protocol}://${reqHost}`;
}
app.get('/api/rooms/:code/qr',required,async(req,res)=>{
  const room=rooms.get(req.params.code);if(!room||(room.hostId!==req.user.id&&!room.players.has(req.user.id)))return fail(res,Error('กรุณาเข้าห้องก่อน'),403);
  try{const url=`${joinBase(req)}/?room=${room.code}`;res.json({url,qr:await QRCode.toDataURL(url,{scale:8,margin:4,errorCorrectionLevel:'M',color:{dark:'#182c3d',light:'#ffffff'}})});}catch(e){fail(res,e);}
});
app.get('/api/history',required,async(req,res)=>{
  if(req.user.role==='guest')return res.json({matches:[]});
  res.json({matches:await db.prepare('SELECT * FROM matches WHERE user_id=? ORDER BY played_at DESC LIMIT 30').all(req.user.id)});
});
app.get('/api/rooms/:code/results.csv',required,(req,res)=>{
  const room=access(req,res);if(!room)return;
  if(room.status!=='finished')return fail(res,Error('ผลคะแนนพร้อมเมื่อจบเกม'));
  const cell=v=>`"${String(v).replace(/^[=+@-]/,"'").replaceAll('"','""')}"`;
  const lines=[['ชื่อ','ตอบถูก','ตอบทั้งหมด','รอดชีวิต (วินาที)','ทำให้ติดคำสาป','สถานะ'],...[...room.players.values()].filter(p=>!p.bot).map(p=>[p.name,p.correct,p.attempts,Math.floor(p.survived),p.infections,p.cursed?'ซอมบี้':'ผู้รอดชีวิต'])];
  res.setHeader('Content-Disposition',`attachment; filename="frostbound-${room.code}.csv"`);res.type('text/csv').send('\uFEFF'+lines.map(row=>row.map(cell).join(',')).join('\r\n'));
});
async function persist(room){
  if(room.status!=='finished'||room.saved)return;
  if(room.saving)return room.saving;
  const roundAt=room.startedAt;
  room.saving=(async()=>{
    for(const p of room.players.values())if(!p.bot&&await db.prepare('SELECT id FROM users WHERE id=?').get(p.id)){
      p.matchId ||= randomUUID();
      await db.prepare('INSERT INTO matches VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(p.matchId,p.id,room.title,room.finishedAt,p.correct,p.attempts,Math.floor(p.survived),p.infections,p.cursed?1:0);
    }
    if(room.startedAt===roundAt)room.saved=true;
  })();
  try{await room.saving;}finally{room.saving=null;}
}
function send(ws,msg){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg));}
function broadcast(room){for(const [id,ws]of room.clients)send(ws,{type:'state',room:publicRoom(room,id)});}
server.on('upgrade',async(req,socket,head)=>{
  let url;try{url=new URL(req.url,'http://localhost');}catch{return socket.destroy();}
  let user;try{user=await identify(req);}catch{socket.destroy();return;}
  if(socket.destroyed)return;
  const room=rooms.get(url.searchParams.get('room'));
  const origin=req.headers.origin;let originValid=false;
  try{originValid=!!origin&&new URL(origin).host===req.headers.host;}catch{}
  if(!originValid||url.pathname!=='/ws'||!user||!room||(!room.players.has(user.id)&&room.hostId!==user.id)){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>{ws.user=user;ws.room=room;ws.sessionToken=token(req);wss.emit('connection',ws,req);});
});
wss.on('connection',ws=>{
  const {user,room}=ws;room.clients.get(user.id)?.close(1000,'replaced');room.clients.set(user.id,ws);
  const p=room.players.get(user.id);if(p)p.connected=true;
  send(ws,{type:'state',room:publicRoom(room,user.id)});
  ws.windowAt=Date.now();ws.messages=0;
  ws.on('message',raw=>{
    const now=Date.now();if(now-ws.windowAt>1000){ws.windowAt=now;ws.messages=0;}
    if(++ws.messages>55)return ws.close(1008,'rate limit');
    let m;try{m=JSON.parse(raw);}catch{return;}
    if(!p||room.status!=='playing')return;
    if(m.type==='input'){
      if(!Number.isFinite(m.x)||!Number.isFinite(m.y))return;
      const len=Math.max(1,Math.hypot(m.x,m.y));p.input={x:m.x/len,y:m.y/len};p.lastInput=now;
    }else if(m.type==='shoot'){shoot(room,p,m.angle,now);}
    else if(m.type==='interact')send(ws,{type:'notice',text:interact(room,p,m.kind,now)});
    else if(m.type==='question'){
      if(p.question){send(ws,{type:'question',question:{id:p.question.id,text:p.question.q.text,options:p.question.q.options}});return;}
      if(now-(p.questionAt||0)<1200)return;
      const q=room.questions[randomInt(room.questions.length)];p.question={id:randomUUID(),q};p.questionAt=now;
      send(ws,{type:'question',question:{id:p.question.id,text:q.text,options:q.options}});
    }else if(m.type==='answer'){
      if(!p.question||p.question.id!==m.id||!Number.isInteger(m.answer)||m.answer<0||m.answer>3||now-p.questionAt<350)return;
      const correct=m.answer===p.question.q.answer;const answer=p.question.q.answer;p.question=null;p.attempts++;
      if(correct){p.correct++;p.coins+=20;if(p.cursed)p.ammo=Math.min(99,p.ammo+8);else p.energy=Math.min(100,p.energy+35);}
      send(ws,{type:'answer',correct,answer,reward:correct?(p.cursed?'บอลหิมะ +8 · เหรียญ +20':'พลังงาน +35 · เหรียญ +20'):'ลองใหม่ในข้อถัดไป'});
      broadcast(room);
    }
  });
  ws.on('close',()=>{
    if(room.clients.get(user.id)!==ws)return;
    room.clients.delete(user.id);if(p){p.connected=false;p.input={x:0,y:0};}broadcast(room);
  });
  ws.on('error',()=>{});
});
let previous=Date.now(),count=0;
const tick=setInterval(()=>{
  const now=Date.now(),dt=Math.min(.1,(now-previous)/1000);previous=now;
  count++;for(const room of rooms.values()){tickRoom(room,dt,now);if(room.status==='finished'&&!room.saved&&!room.saving)persist(room).catch(()=>console.error('Could not persist match; retrying'));if(count%2===0)broadcast(room);}
},50);
const cleanup=setInterval(()=>{
  const now=Date.now();Promise.resolve(db.prepare('DELETE FROM sessions WHERE expires<?').run(now)).catch(()=>console.error('Session cleanup failed'));
  for(const [t,g]of guests)if(g.expires<now)guests.delete(t);
  for(const [k,r]of rates)if(r.reset<now)rates.delete(k);
  for(const [code,room]of rooms)if(now-(room.finishedAt||room.createdAt)>6*3600000){for(const ws of room.clients.values())ws.close(1000,'room expired');rooms.delete(code);}
},60000);
app.use('/vendor/phaser',express.static(path.join(root,'node_modules/phaser/dist')));
app.use('/vendor/qr',express.static(path.join(root,'node_modules/jsqr/dist')));
app.use(express.static(path.join(root,'public')));
app.use((err,req,res,next)=>{if(res.headersSent)return next(err);fail(res,Error('คำขอไม่ถูกต้อง'),400);});
server.listen(PORT,'0.0.0.0',()=>console.log(`Frostbound ready: http://localhost:${PORT}`));
function shutdown(){clearInterval(tick);clearInterval(cleanup);for(const ws of wss.clients)ws.terminate();server.close(async()=>{await Promise.allSettled([...rooms.values()].filter(r=>r.status==='finished').map(persist));await db.close();process.exit(0);});}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
