import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
const base='http://localhost:3107',delay=ms=>new Promise(r=>setTimeout(r,ms));
test('real accounts, room authorization, WebSockets, rewards, QR and history', {timeout:30000},async t=>{
  const dataDir=mkdtempSync(path.join(tmpdir(),'frostbound-test-'));
  const server=spawn(process.execPath,['server/index.js'],{cwd:process.cwd(),env:{...process.env,PORT:'3107',DATA_DIR:dataDir,PUBLIC_URL:base},stdio:['ignore','pipe','pipe']});
  let log='';server.stderr.on('data',d=>log+=d);const sockets=[];
  t.after(()=>{sockets.forEach(ws=>ws.terminate());server.kill();});
  for(let i=0;i<80;i++){try{if((await fetch(base+'/api/me')).ok)break;}catch{}await delay(100);if(i===79)throw Error('Server did not boot: '+log);}
  async function request(url,body,cookie,method=body?'POST':'GET',origin=base){
    const res=await fetch(base+url,{method,headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
    return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  }
  const teacher=await request('/api/register',{name:'ครูทดสอบ',email:'teacher@example.com',password:'testpass123',role:'teacher'});
  assert.equal(teacher.status,200);assert.ok(!JSON.stringify(teacher.data).includes('password'));
  const student=await request('/api/register',{name:'นักเรียนทดสอบ',email:'student@example.com',password:'testpass123',role:'student'});
  assert.equal((await request('/api/login',{email:'student@example.com',password:'wrongpass'})).status,401);
  assert.equal((await request('/api/login',{email:'student@example.com',password:'testpass123'})).status,200);
  assert.equal((await request('/api/rooms',{},student.cookie)).status,403);
  assert.equal((await request('/api/rooms',{},teacher.cookie,'POST','http://evil.example')).status,403);
  const quiz=await request('/api/quizzes',{title:'ทดสอบ',questions:[{text:'2 + 2 = ?',options:['1','2','3','4'],answer:3}]},teacher.cookie);
  assert.equal(quiz.status,200);
  assert.equal((await request('/api/quizzes',{},student.cookie)).status,403);
  const created=await request('/api/rooms',{title:'ห้องทดสอบ',quizId:quiz.data.id,duration:60},teacher.cookie);assert.equal(created.status,200);
  const code=created.data.code;
  const a=await request(`/api/rooms/${code}/join`,{},student.cookie);assert.equal(a.status,200);
  const guest=await request(`/api/rooms/${code}/join`,{name:'เพื่อน'});assert.equal(guest.status,200);
  function connect(cookie){
    const ws=new WebSocket(`ws://localhost:3107/ws?room=${code}`,{headers:{Cookie:cookie,Origin:base}});sockets.push(ws);ws.messages=[];
    ws.on('message',raw=>ws.messages.push(JSON.parse(raw)));return ws;
  }
  async function wait(ws,predicate){for(let i=0;i<100;i++){const index=ws.messages.findIndex(predicate);if(index>=0)return ws.messages.splice(index,1)[0];await delay(30);}throw Error('Expected websocket message: '+log);}
  assert.equal((await request(`/api/rooms/${code}/start`,{},teacher.cookie)).status,400);
  const teacherWS=connect(teacher.cookie),studentWS=connect(student.cookie),guestWS=connect(guest.cookie);
  await wait(studentWS,m=>m.type==='state');await wait(guestWS,m=>m.type==='state');await wait(teacherWS,m=>m.type==='state');
  assert.equal((await request(`/api/rooms/${code}/start`,{},student.cookie)).status,403);
  const qr=await request(`/api/rooms/${code}/qr`,null,teacher.cookie);assert.match(qr.data.qr,/^data:image\/png;base64,/);assert.equal(qr.data.url,`${base}/?room=${code}`);
  assert.equal((await request(`/api/rooms/${code}/start`,{},teacher.cookie)).status,200);
  const state=(await wait(studentWS,m=>m.type==='state'&&m.room.status==='playing')).room;
  const me=state.players.find(p=>p.id===student.data.user.id);
  studentWS.send(JSON.stringify({type:'question'}));const q=(await wait(studentWS,m=>m.type==='question')).question;
  assert.equal(q.answer,undefined);assert.deepEqual(q.options,['1','2','3','4']);
  await delay(450);studentWS.send(JSON.stringify({type:'answer',id:q.id,answer:3}));
  const answer=await wait(studentWS,m=>m.type==='answer');assert.equal(answer.correct,true);
  const rewarded=(await wait(studentWS,m=>m.type==='state'&&m.room.players.find(p=>p.id===me.id)?.correct===1)).room.players.find(p=>p.id===me.id);
  assert.equal(rewarded.coins,20);assert.equal(rewarded.correct,1);if(me.cursed)assert.equal(rewarded.ammo,23);else assert.equal(rewarded.energy,100);
  guestWS.send(JSON.stringify({type:'question'}));const guestQ=(await wait(guestWS,m=>m.type==='question')).question;
  await delay(450);guestWS.send(JSON.stringify({type:'answer',id:guestQ.id,answer:3}));assert.equal((await wait(guestWS,m=>m.type==='answer')).correct,true);
  const guestReward=(await wait(guestWS,m=>m.type==='state'&&m.room.players.find(p=>p.id===guest.data.user.id)?.correct===1)).room.players.find(p=>p.id===guest.data.user.id);
  assert.equal(guestReward.cursed,!me.cursed);assert.equal(guestReward.coins,20);if(guestReward.cursed)assert.equal(guestReward.ammo,23);else assert.equal(guestReward.energy,100);
  studentWS.send(JSON.stringify({type:'answer',id:q.id,answer:3}));await delay(200);
  assert.equal((await request(`/api/rooms/${code}/stop`,{},teacher.cookie)).status,200);
  await wait(studentWS,m=>m.type==='state'&&m.room.status==='finished');
  const history=await request('/api/history',null,student.cookie);assert.equal(history.data.matches.length,1);assert.equal(history.data.matches[0].correct,1);assert.equal(history.data.matches[0].attempts,1);
  const csv=await fetch(base+`/api/rooms/${code}/results.csv`,{headers:{Cookie:teacher.cookie}});assert.equal(csv.status,200);assert.match(await csv.text(),/นักเรียนทดสอบ/);
  assert.equal((await request(`/api/rooms/${code}/reset`,{},teacher.cookie)).status,200);
  const reset=await wait(studentWS,m=>m.type==='state'&&m.room.status==='lobby');assert.equal(reset.room.players.find(p=>p.id===me.id).correct,0);
  assert.equal((await request('/api/logout',{},student.cookie)).status,200);assert.equal((await request('/api/me',null,student.cookie)).data.user,null);
  assert.equal(log,'');
});
