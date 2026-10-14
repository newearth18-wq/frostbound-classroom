import {createWorld} from './renderer.js';
import {QRScanner} from './scanner.js';
import {WORLD,distance} from './world.js';
const $=s=>document.querySelector(s),app=$('#app'),modalRoot=$('#modal-root');
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const avatarNames=['บลู','ฟ็อกซ์','โมจิ','มินต์','สโนว์','รูบี้'];
const avatars=avatarNames.map((name,i)=>`<img src="/art/avatar-${i}.svg" alt="${name}" draggable="false">`);
const icons={play:'<path d="m9 5 11 7-11 7z"/>',qr:'<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h3v3h3v3h-6z"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',book:'<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4zm16 0h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h3z"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3m1-14a3 3 0 0 1 0 6m2 2a5 5 0 0 1 3 4v2"/>',camera:'<path d="M4 7h4l2-3h4l2 3h4v14H4z"/><circle cx="12" cy="13" r="4"/>',exit:'<path d="M9 4H4v16h5m3-8h9m-4-4 4 4-4 4"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 0-1 1-1 2m0 3h.01"/>',copy:'<path d="M9 9h12v12H9zM15 9V3H3v12h6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',trash:'<path d="M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',check:'<path d="m5 12 4 4L19 6"/>'};
const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.play}</svg>`;
let user=null,page='home',world=null,socket=null,room=null,screen='',quizzes=[],activeQuestion=null,questionTime=0,scanner=null,reconnectTimer,leaving=false,lastResults='',editorId=null,afterAuth=null,modalType='',previousFocus=null;
const send=m=>{if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(m));};
async function api(url,body,method=body?'POST':'GET'){
  const res=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const data=await res.json().catch(()=>({error:'เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง'}));if(!res.ok)throw Object.assign(Error(data.error||'เกิดข้อผิดพลาด'),{status:res.status});return data;
}
let toastTimer;
function toast(text){if(!text)return;$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function brand(){return '<span class="brand-mark">❄</span><span>frostbound<small>CLASSROOM ADVENTURES</small></span>';}
function header(){return `<header class="topbar"><a href="/" class="brand" data-action="home">${brand()}</a><nav class="nav" aria-label="เมนูหลัก"><button data-action="home" class="${page==='home'?'active':''}">สนามหิมะ</button><button data-action="quizzes" class="${page==='quizzes'?'active':''}">ชุดคำถาม</button><button data-action="history" class="${page==='history'?'active':''}">ประวัติการเล่น</button></nav><div class="account">${user&&user.role!=='guest'?`<button class="avatar" data-action="account" aria-label="บัญชีของฉัน">${avatars[user.avatar]}</button><span class="account-name" style="font-size:12px">${escape(user.name)}</span>`:'<button class="btn btn-outline btn-small" data-action="login">เข้าสู่ระบบ '+icon('arrow',15)+'</button>'}</div></header>`;}
function footer(){return '<footer class="footer"><b>FROSTBOUND © 2026</b><span>เปลี่ยนทุกคำตอบ ให้เป็นการผจญภัย ❄</span></footer>';}
function destroyWorld(){world?.destroy();world=null;}
function mountPreview(selector){if($(selector))world=createWorld($(selector),{preview:true});}
function renderHome(){
  page='home';screen='home';destroyWorld();
  app.innerHTML=`<div class="wrap">${header()}<main class="expedition-home"><section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> SNOWY SURVIVAL · ห้องเรียนเมืองหิมะ</div><h1>ตอบให้ไว.<br><span>วิ่งให้รอด!</span></h1><p class="lead">ใครจะรอดจากซอมบี้จนวินาทีสุดท้าย?<br>ตอบคำถามเติมพลัง หลบหิมะ และช่วยเพื่อนในเมืองหิมะ</p><form id="join-form" class="expedition-join"><label for="join-code">มีรหัสห้อง? เข้าสนามกับเพื่อนเลย</label><div class="join-line"><input id="join-code" class="field code-input" name="code" aria-label="รหัสห้อง 6 หลัก" placeholder="รหัส 6 หลัก" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required><button class="btn btn-primary" type="submit">เข้าห้อง ${icon('arrow',18)}</button></div><button class="scanner-link" data-action="scanner" type="button">${icon('qr',18)} สแกน QR จากหน้าจอครู</button></form><div class="hero-actions"><button class="btn btn-yellow" data-action="practice">${icon('play',18)} เล่นทดลองกับบอท</button><button class="btn btn-outline" data-action="host">${icon('plus',18)} ครูสร้างห้อง</button></div><p class="hero-note">เล่นได้บนคอมและมือถือ · สูงสุด 40 คนต่อห้อง</p></div><div class="hero-art"><div id="preview"></div><div class="art-tag"><span class="live-dot"></span> สำรวจเมืองหิมะ</div><div class="art-caption"><div><small>YOUR CLASSROOM. YOUR ADVENTURE.</small><strong>FROSTBOUND</strong></div><span class="art-pill">คน vs ซอมบี้</span></div></div></section><section class="survival-cards"><article><img src="/art/avatar-0.svg" alt="ทีมคน"><div><small>01 · ผู้รอดชีวิต</small><h3>ตอบคำถาม เติมพลัง</h3><p>วิ่งหลบซอมบี้ อยู่รอดให้ถึงเวลาจบ</p></div></article><article><img src="/art/zombie.svg" alt="ทีมซอมบี้"><div><small>02 · ซอมบี้</small><h3>เติมหิมะ แล้วออกล่า</h3><p>เล็งและยิงให้คนติดคำสาปทั้งเมือง</p></div></article><article><span class="feature-emblem">❄</span><div><small>03 · สำรวจสนาม</small><h3>ปลูก รักษา ตกปลา</h3><p>ใช้ทรัพยากรให้เป็น แล้วช่วยเพื่อนเอาตัวรอด</p></div></article></section><button class="field-guide-link" data-action="help">${icon('help',18)} คู่มือควบคุมและกติกาการเล่น ${icon('arrow',16)}</button></main>${footer()}</div>`;
  mountPreview('#preview');$('#join-form').addEventListener('submit',e=>{e.preventDefault();joinFlow(new FormData(e.target).get('code'));});
}
function showModal(content,{wide=false,type='general',className=''}={}){
  if(scanner)stopScanner();previousFocus=document.activeElement;modalType=type;
  modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide':''} ${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="close" data-action="close" aria-label="ปิด">×</button>${content}</section></div>`;
  send({type:'input',x:0,y:0});if(room?.practice)send({type:'practice-pause',paused:true});setTimeout(()=>modalRoot.querySelector('input:not([type=radio]),button:not(.close)')?.focus(),40);
}
async function stopScanner(){const current=scanner;scanner=null;if(current){try{if(current.isScanning)await current.stop();current.clear();}catch{}}}
function closeModal(){if(modalType==='results')return;stopScanner();modalRoot.innerHTML='';modalType='';if(room?.practice)send({type:'practice-pause',paused:false});previousFocus?.focus?.();}
function auth(mode='login',next=null){
  if(next)afterAuth=next;const signup=mode==='register';
  showModal(`<div class="eyebrow">❄ WELCOME TO FROSTBOUND</div><h2 id="modal-title">${signup?'เริ่มการผจญภัยของคุณ':'กลับมาลุยหิมะกัน'}</h2><p class="sub">${signup?'สร้างบัญชีเพื่อเก็บประวัติ และเล่นกับเพื่อน':'เข้าสู่ระบบเพื่อเล่นต่อ หรือสร้างห้องเรียนของคุณ'}</p><form id="auth-form" class="form-stack">${signup?'<label>ชื่อที่แสดง<input name="name" class="field" minlength="2" maxlength="24" placeholder="ชื่อของคุณ" required autocomplete="nickname"></label>':''}<label>อีเมล<input class="field" name="email" type="email" placeholder="you@example.com" required autocomplete="email" maxlength="150"></label><label>รหัสผ่าน<input class="field" name="password" type="password" placeholder="${signup?'อย่างน้อย 8 ตัวอักษร':'รหัสผ่านของคุณ'}" minlength="8" maxlength="128" required autocomplete="${signup?'new-password':'current-password'}"></label>${signup?'<div><span class="form-label" style="margin-bottom:8px">คุณเป็นใคร?</span><div class="role-options"><label><input type="radio" name="role" value="student" checked> 🎒 นักเรียน</label><label><input type="radio" name="role" value="teacher"> 📚 คุณครู</label></div></div>':''}<p class="form-error" role="alert"></p><button class="btn btn-primary" type="submit">${signup?'สร้างบัญชี':'เข้าสู่ระบบ'} ${icon('arrow',16)}</button></form><p class="switch-auth">${signup?'มีบัญชีอยู่แล้ว?':'ยังไม่มีบัญชี?'} <button class="text-btn" data-action="${signup?'login':'register'}">${signup?'เข้าสู่ระบบ':'สมัครสมาชิก'}</button></p>`,{type:'auth'});
  $('#auth-form').addEventListener('submit',async e=>{
    e.preventDefault();const form=e.target,button=form.querySelector('button[type=submit]');button.disabled=true;form.querySelector('.form-error').textContent='';
    try{const data=await api(`/api/${signup?'register':'login'}`,Object.fromEntries(new FormData(form)));user=data.user;const next=afterAuth;afterAuth=null;closeModal();if(room){leaveGame(false);}renderHome();toast(`ยินดีต้อนรับ ${user.name}`);if(next)next();}
    catch(err){form.querySelector('.form-error').textContent=err.message;button.disabled=false;}
  });
}
async function hostFlow(quizId){
  if(!user||user.role==='guest'){auth('register',()=>hostFlow(quizId));return;}
  if(user.role!=='teacher'){toast('การสร้างห้องใช้บัญชีคุณครู · นักเรียนเข้าห้องหรือทดลองเล่นได้');return;}
  try{
    quizzes=(await api('/api/quizzes')).quizzes;
    showModal(`<div class="eyebrow">❄ HOST AN ADVENTURE</div><h2 id="modal-title">สร้างห้องของคุณ</h2><p class="sub">ตั้งค่าการผจญภัย แล้วแชร์ QR Code ให้เพื่อน ๆ</p><form id="host-form" class="form-stack"><label>ชื่อห้อง<input class="field" name="title" maxlength="60" value="เมืองหิมะของ ${escape(user.name)}" required></label><label>ชุดคำถาม<select class="field" name="quizId">${quizzes.map(q=>`<option value="${escape(q.id)}" ${q.id===quizId?'selected':''}>${escape(q.title)} · ${q.questions.length} ข้อ</option>`).join('')}</select></label><div class="two-fields"><label>เวลาเอาชีวิตรอด<select class="field" name="duration"><option value="60">1 นาที</option><option value="180" selected>3 นาที</option><option value="300">5 นาที</option><option value="600">10 นาที</option></select></label><label>ความเร็วซอมบี้<select class="field" name="difficulty"><option value="easy">ช้า · เล่นสบาย</option><option value="normal" selected>ปกติ · ท้าทาย</option><option value="hard">เร็ว · เล่นยาก</option></select></label></div><div class="note-box">ครูเป็นผู้ดูแลสนาม ผู้เล่นอย่างน้อย 2 คนจึงเริ่มได้<br>สามารถสร้างชุดคำถามเองจากเมนู “ชุดคำถาม”</div><p class="form-error" role="alert"></p><button class="btn btn-primary" type="submit">สร้างห้องผจญภัย ${icon('plus',18)}</button></form>`,{type:'host'});
    $('#host-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button[type=submit]');button.disabled=true;try{const d=await api('/api/rooms',Object.fromEntries(new FormData(e.target)));closeModal();connect(d.code);}catch(err){e.target.querySelector('.form-error').textContent=err.message;button.disabled=false;}});
  }catch(err){toast(err.message);}
}
async function joinFlow(code){
  code=String(code||'').trim();if(!/^\d{6}$/.test(code)){toast('กรุณาใส่รหัสห้อง 6 หลัก');return;}
  try{
    const meta=await api(`/api/rooms/${code}`);if(meta.status==='finished')throw Error('ห้องนี้จบเกมแล้ว');
    if(user){const data=await api(`/api/rooms/${code}/join`,{});user=data.user;closeModal();connect(code);return;}
    showModal(`<div class="eyebrow">❄ JOIN THE ADVENTURE</div><h2 id="modal-title">${escape(meta.title)}</h2><p class="sub">ห้อง ${code} · ครู ${escape(meta.hostName)}<br>ใส่ชื่อของคุณ แล้วไปเจอเพื่อนในเมืองหิมะ</p><form id="guest-form" class="form-stack"><label>ชื่อในเกม<input class="field" name="name" maxlength="24" minlength="2" placeholder="ชื่อที่เพื่อนจำได้" required autocomplete="nickname"></label><p class="form-error" role="alert"></p><button class="btn btn-primary" type="submit">เข้าห้อง ${icon('arrow',16)}</button></form><p class="switch-auth">อยากเก็บประวัติการเล่น? <button class="text-btn" id="join-login">เข้าสู่ระบบ</button></p>`,{type:'join'});
    $('#guest-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const d=await api(`/api/rooms/${code}/join`,Object.fromEntries(new FormData(e.target)));user=d.user;closeModal();connect(code);}catch(err){e.target.querySelector('.form-error').textContent=err.message;b.disabled=false;}});
    $('#join-login').onclick=()=>auth('login',()=>joinFlow(code));
  }catch(err){toast(err.message);}
}
async function practice(){
  try{const data=await api('/api/practice',{name:'นักผจญภัย',duration:180});user=data.user;closeModal();connect(data.code);}
  catch(err){toast(err.message);}
}
function connect(code){
  clearTimeout(reconnectTimer);leaving=false;socket?.close();room=null;screen='connecting';destroyWorld();
  app.innerHTML='<div class="wrap"><div class="empty" style="margin-top:70px"><span style="font-size:45px">❄</span><h3>กำลังเดินทางไปเมืองหิมะ…</h3><p>เตรียมตัวให้พร้อม!</p></div></div>';
  history.replaceState(null,'',`/?room=${code}`);openSocket(code);
}
function openSocket(code){
  const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws?room=${code}`);socket=ws;
  ws.onmessage=e=>{
    if(socket!==ws)return;const m=JSON.parse(e.data);
    if(m.type==='state'){
      const old=room;room=m.room;
      if(screen!==room.status){if(room.status==='lobby')renderLobby();else if(room.status==='playing')renderArena();else if(room.status==='finished'){if(!world)renderArena();screen='finished';showResults();}}
      if(room.status==='lobby')updateLobby();else updateHUD();
      if(room.status==='finished'&&lastResults!==String(room.startedAt)){lastResults=String(room.startedAt);showResults();}
      if(old?.status==='finished'&&room.status==='lobby'){lastResults='';}
      $('.disconnected')?.remove();
    }else if(m.type==='question'){showQuestion(m.question);}
    else if(m.type==='answer'){answerResult(m);}
    else if(m.type==='notice')toast(m.text);
  };
  ws.onclose=e=>{
    if(leaving||socket!==ws)return;
    if(e.reason==='replaced'||e.reason==='logged out'||e.reason==='room expired'){toast(e.reason==='replaced'?'บัญชีนี้เปิดห้องจากหน้าจออื่นแล้ว':'เซสชันหรือห้องหมดอายุ');leaveGame();return;}
    if(!$('.disconnected'))app.insertAdjacentHTML('beforeend','<div class="disconnected" role="status">การเชื่อมต่อหลุด · กำลังเชื่อมต่อใหม่…</div>');
    retryConnection(code);
  };
  ws.onerror=()=>{};
}
function retryConnection(code){
  clearTimeout(reconnectTimer);reconnectTimer=setTimeout(async()=>{
    if(leaving)return;
    try{await api(`/api/rooms/${code}`);const me=await api('/api/me');if(!me.user){toast('เซสชันหมดอายุ กรุณาเข้าห้องอีกครั้ง');leaveGame();return;}openSocket(code);}
    catch(err){if(err.status===404||err.status===401){toast(err.message);leaveGame();}else retryConnection(code);}
  },1800);
}
let qrData=null,lobbySignature='';
function renderLobby(){
  screen='lobby';destroyWorld();modalRoot.innerHTML='';modalType='';qrData=null;lobbySignature='';
  app.innerHTML=`<div class="wrap">${header()}<main class="lobby"><div class="lobby-head"><div><div class="eyebrow">❄ GATHER YOUR EXPLORERS</div><h1>${escape(room.title)}</h1><p>${escape(room.quizTitle)} · ${room.duration/60} นาที · รอเริ่มการผจญภัย</p></div><button class="btn btn-outline btn-small" data-action="leave">ออกจากห้อง ${icon('exit',15)}</button></div><div class="lobby-layout"><aside class="qr-panel"><h3>ชวนเพื่อนเข้าห้อง</h3><div class="room-code">${room.code}</div><img id="room-qr" alt="QR Code สำหรับเข้าห้อง ${room.code}" hidden><p>สแกน QR Code หรือใส่รหัสห้องด้านบน<br>ใช้เครือข่ายเดียวกันเพื่อเล่นผ่าน Wi-Fi</p><button class="btn btn-outline btn-small" data-action="copy-link">${icon('copy',15)} คัดลอกลิงก์เข้าห้อง</button><div class="join-url" id="join-url"></div>${room.isHost?'<button class="btn btn-primary" data-action="start">เริ่มการผจญภัย '+icon('play',17)+'</button><p>เริ่มได้เมื่อมีผู้เล่นออนไลน์อย่างน้อย 2 คน</p>':'<div class="note-box m-top">นั่งให้พร้อม ครูจะเริ่มเกมเร็ว ๆ นี้ ❄</div>'}</aside><section class="waiting-panel"><div class="waiting-art" id="waiting-art"></div><div class="waiting-content"><div class="waiting-title"><h3>เพื่อนร่วมผจญภัย</h3><span class="art-pill" id="player-count"></span></div><div id="lobby-players" class="players-grid"></div><div class="lobby-bottom">${room.isHost?'คุณคือผู้ดูแลสนาม · ดูการเล่นและผลคะแนนได้แบบสด':'เลือกตัวละครที่ใช่ แล้วเตรียมพร้อมหนีซอมบี้'}<div class="avatar-picker">${room.isHost?'':avatars.map((a,i)=>`<button class="avatar-choice ${user.avatar===i?'selected':''}" data-action="avatar" data-avatar="${i}" aria-label="เลือกตัวละคร ${i+1}">${a}</button>`).join('')}</div></div></div></section></div></main>${footer()}</div>`;
  mountPreview('#waiting-art');updateLobby();
  api(`/api/rooms/${room.code}/qr`).then(data=>{if(screen!=='lobby')return;qrData=data;$('#room-qr').src=data.qr;$('#room-qr').hidden=false;$('#join-url').textContent=data.url;}).catch(err=>toast(err.message));
}
function updateLobby(){
  const players=room.players.filter(p=>!p.bot);const signature=JSON.stringify(players.map(p=>[p.id,p.name,p.avatar,p.connected]));if(signature===lobbySignature)return;lobbySignature=signature;
  $('#player-count').textContent=`${players.filter(p=>p.connected).length} / 40 คน`;
  $('#lobby-players').className=players.length?'players-grid':'';
  $('#lobby-players').innerHTML=players.length?players.map(p=>`<div class="player-tile"><div class="avatar">${avatars[p.avatar]}</div><strong>${escape(p.name)} ${p.id===user.id?'(คุณ)':''}</strong><small>${p.connected?'● พร้อมลุย':'○ การเชื่อมต่อหลุด'}</small></div>`).join(''):'<div class="waiting-placeholder"><div><span style="font-size:45px">🧣</span><h3 style="margin:12px 0">รอเพื่อนร่วมผจญภัย</h3><p>เปิดห้องนี้บนอุปกรณ์ของนักเรียน<br>ผ่าน QR Code หรือรหัส 6 หลัก</p></div></div>';
  const start=$('[data-action=start]');if(start)start.disabled=players.filter(p=>p.connected).length<2;
}
function renderArena(){
  destroyWorld();modalRoot.innerHTML='';modalType='';activeQuestion=null;screen='playing';eventSignature='';
  if(room.practice&&room.paused)send({type:'practice-pause',paused:false});
  const participant=room.players.some(p=>p.id===user.id);
  app.innerHTML=`<main class="arena"><div class="game-canvas" id="game-canvas" aria-label="สนามเมืองหิมะ"></div><div class="hud-top"><div class="hud-brand"><span class="brand-mark">❄</span><div><strong>FROSTBOUND</strong><small>ห้อง ${room.code}${room.practice?' · ฝึกกับบอท':''}</small></div></div><div class="hud-center" id="hud-center"></div><div class="hud-actions"><button class="icon-btn" data-action="sound" aria-label="เปิดหรือปิดเสียง">♫</button><button class="icon-btn map-toggle" data-action="map" aria-label="เปิดหรือปิดแผนที่">${icon('qr',18)}</button><button class="icon-btn" data-action="help" aria-label="วิธีเล่น">${icon('help',18)}</button>${room.isHost&&!room.practice?'<button class="icon-btn" data-action="stop" aria-label="จบเกม">⏹</button>':''}<button class="icon-btn" data-action="leave" aria-label="ออกจากเกม">${icon('exit',17)}</button></div></div><div id="hud-stats"></div><div class="event-feed" id="event-feed"></div><div id="countdown" class="countdown" aria-live="polite"></div>${participant?`<div id="objective" class="objective-chip"></div><div class="hud-bottom"><button class="btn btn-primary answer-action" data-action="question">${icon('book',20)} ตอบคำถาม <span class="key">Q</span></button><button class="btn btn-light" data-action="interact" id="interact-action"><span id="interact-label">สำรวจจุดใกล้ตัว</span> <span class="key">E</span></button></div><div class="controls-hint"><kbd>W A S D</kbd> เดิน · เมาส์เล็ง · กดค้างเพื่อยิง<br><kbd>Q</kbd> คำถาม · <kbd>E</kbd> ใช้งาน · <kbd>M</kbd> แผนที่</div><div class="joystick" id="joystick" role="button" tabindex="0" aria-label="จอยบังคับทิศทาง"><span class="joystick-thumb"></span></div><button class="touch-shoot" id="touch-fire" aria-label="ยิงบอลหิมะ">❄<small>ยิง</small></button>`:'<div class="spectator-note">ผู้ดูแลสนาม · ดูแผนที่และผลของผู้เล่นได้ · กด ⏹ เพื่อจบเกม</div>'}</main>`;
  world=createWorld($('#game-canvas'),{getState:()=>room,getUserId:()=>user.id,onInput:(x,y,aim)=>send({type:'input',x,y,aim}),onShoot:shoot,onQuestion:question,onInteract:interaction,isBlocked:()=>!!modalType||room.status!=='playing'});
  const stick=$('#joystick');if(stick){let pointer=null;const thumb=stick.querySelector('span');const reset=()=>{pointer=null;world?.setTouch(0,0);thumb.style.transform='translate(0,0)';};
    const move=e=>{const rect=stick.getBoundingClientRect(),dx=e.clientX-(rect.left+rect.width/2),dy=e.clientY-(rect.top+rect.height/2),n=Math.max(1,Math.hypot(dx,dy)/34);world?.setTouch(dx/n/34,dy/n/34);thumb.style.transform=`translate(${dx/n}px,${dy/n}px)`;};
    stick.onpointerdown=e=>{e.preventDefault();pointer=e.pointerId;stick.setPointerCapture(pointer);move(e);};stick.onpointermove=e=>{if(e.pointerId===pointer)move(e);};stick.onpointerup=stick.onpointercancel=stick.onlostpointercapture=reset;
    const fire=$('#touch-fire');fire.onpointerdown=e=>{e.preventDefault();fire.setPointerCapture(e.pointerId);world?.setFiring(true);world?.shoot();};fire.onpointerup=fire.onpointercancel=fire.onlostpointercapture=()=>world?.setFiring(false);
  }
  updateHUD();
}
let eventSignature='';
function updateHUD(){
  if(!$('#hud-center'))return;const survivors=room.players.filter(p=>!p.cursed&&p.connected).length,rem=Math.max(0,room.remaining||0),cursed=room.players.filter(p=>p.cursed&&p.connected).length;
  $('#hud-center').innerHTML=`<div><strong>${String(Math.floor(rem/60)).padStart(2,'0')}:${String(rem%60).padStart(2,'0')}</strong><small>เวลาเอาตัวรอด</small></div><span class="team-count">${survivors} คน <i>vs</i> ${cursed} ซอมบี้</span>`;
  const ready=room.readyRemaining||0;$('#countdown').hidden=!ready;$('#countdown').innerHTML=ready?`<small>เตรียมตัว · ซอมบี้กำลังมา!</small><strong>${ready}</strong><span>WASD เดิน · Q ตอบคำถาม · คลิกยิง</span>`:'';
  const me=room.players.find(p=>p.id===user.id);
  if(me){const low=!me.cursed&&me.energy<25;$('#hud-stats').className='hud-stats '+(me.cursed?'zombie-stats':'')+(low?' low-energy':'');$('#hud-stats').innerHTML=`<div class="hud-player"><div class="avatar">${me.cursed?'<img src="/art/zombie.svg" alt="ซอมบี้">':avatars[me.avatar]}</div><div><b>${escape(me.name)}</b><small>${me.cursed?'ซอมบี้ · ล่าผู้รอดชีวิต':'ทีมคน · อยู่รอดจนหมดเวลา'}</small></div></div><div class="bar-label"><span>${me.cursed?'สถานะ':'พลังชีวิต'}</span><b>${me.cursed?(me.frozenUntil>Date.now()?'ถูกแช่แข็ง':'พร้อมล่า'):`${Math.ceil(me.hp)} / 100`}</b></div>${me.cursed?'':'<div class="bar hp"><i style="width:'+me.hp+'%"></i></div>'}<div class="bar-label"><span>${me.cursed?'บอลหิมะ':'พลังงาน'}</span><b>${me.cursed?`${me.ammo} ลูก`:`${Math.ceil(me.energy)} / 100`}</b></div><div class="bar energy"><i style="width:${me.cursed?Math.min(100,me.ammo):me.energy}%"></i></div><div class="inventory"><span title="บอลหิมะ">❄ <b>${me.ammo}</b></span><span title="เหรียญ">🪙 <b>${me.coins}</b></span><span title="ตอบถูก">✓ <b>${me.correct}</b></span></div>`;
    const plot=[...WORLD.farms].sort((a,b)=>distance(me,a)-distance(me,b))[0],plant=room.farms.find(f=>f.id===plot?.id);let context='สำรวจจุดใกล้ตัว';
    if(distance(me,WORLD.supply)<105)context='รักษา · 20 เหรียญ';else if(WORLD.fishing.some(f=>distance(me,f)<105))context=me.fishingUntil?(me.fishingUntil>Date.now()?'ตกปลา… รอ '+Math.ceil((me.fishingUntil-Date.now())/1000)+' วิ':'เก็บปลา!'):'ตกปลา · ได้ทรัพยากร';else if(plot&&distance(me,plot)<90)context=plant?(plant.owner!==me.id?'แปลงของเพื่อน':plant.readyAt>Date.now()?'กำลังโต · '+Math.ceil((plant.readyAt-Date.now())/1000)+' วิ':'เก็บเครื่องยิง!'):'ปลูกเครื่องยิง · 20 เหรียญ';
    if($('#interact-label'))$('#interact-label').textContent=context;
    if($('#objective'))$('#objective').textContent=me.cursed?(me.ammo<5?'Q ตอบคำถาม รับบอลหิมะ +8':'เล็งแล้วยิงผู้รอดชีวิต · โดน 3 ครั้งติดคำสาป'):low?'พลังงานใกล้หมด! กด Q ตอบคำถามเติมพลัง':!me.launcher?'ตอบให้ถูก 1 ข้อ แล้วไปแปลงปลูกเพื่อรับเครื่องยิง':me.frozenUntil>Date.now()?'คุณถูกแช่แข็งชั่วคราว':'หนีซอมบี้ · ยิงซอมบี้ให้หยุด เพื่อช่วยเพื่อน';
    $('[data-action=question]')?.classList.toggle('needs-resource',low||me.cursed&&me.ammo<5);
  }
  const recent=room.events.filter(e=>Date.now()-e.at<7000),sig=recent.map(e=>e.id).join();if(sig!==eventSignature){eventSignature=sig;$('#event-feed').innerHTML=recent.slice(-2).map(e=>`<p>${escape(e.text)}</p>`).join('');}
}
function shoot(angle){
  const me=room?.players.find(p=>p.id===user.id);if(!me||room.status!=='playing')return;
  if(!me.launcher){toast('ปลูกเครื่องยิงที่แปลงด้านล่างซ้ายก่อน · ใช้ 20 เหรียญ');return;}
  if(!me.ammo){toast(me.cursed?'ตอบคำถามเพื่อรับบอลหิมะเพิ่ม':'ปลูกและเก็บเกี่ยวเพื่อเติมบอลหิมะ');return;}
  send({type:'shoot',angle});
}
function question(){if(room?.status==='playing'&&room.players.some(p=>p.id===user.id))send({type:'question'});}
function interaction(){const me=room?.players.find(p=>p.id===user.id);if(!me)return;send({type:'interact',kind:distance(me,WORLD.supply)<105?'heal':WORLD.fishing.some(f=>distance(me,f)<105)?'fish':'plant'});}
function showQuestion(q){
  activeQuestion=q;questionTime=Date.now();const me=room.players.find(p=>p.id===user.id);
  showModal(`<div class="question-heading"><div class="question-icon">${me.cursed?'❄':'⚡'}</div><div><div class="eyebrow">ANSWER & RECHARGE</div><p style="font-size:11px;color:var(--muted);margin-top:5px">${me.cursed?'ตอบถูก รับบอลหิมะ 8 ลูก':'ตอบถูก รับพลังงาน 35 หน่วย'} + 20 เหรียญ</p></div></div><h2 id="modal-title">${escape(q.text)}</h2><div class="answers">${q.options.map((o,i)=>`<button class="answer-btn" data-action="answer" data-answer="${i}" disabled><span class="answer-letter">${['A','B','C','D'][i]}</span>${escape(o)}</button>`).join('')}</div><div id="answer-feedback"><p class="question-foot">${room.practice?'โหมดฝึกหยุดสนามให้ระหว่างตอบ':'สนามยังเล่นต่ออยู่ · ตอบให้ไว!'} · กด 1–4 เลือกคำตอบ</p></div>`,{type:'question',className:'question-modal'});
  setTimeout(()=>{if(activeQuestion?.id===q.id&&modalType==='question')document.querySelectorAll('.answer-btn').forEach(b=>b.disabled=false);},400);
}
function answerResult(m){
  if(modalType!=='question')return;
  document.querySelectorAll('.answer-btn').forEach(b=>{b.disabled=true;if(Number(b.dataset.answer)===m.answer)b.classList.add('correct');else if(b.dataset.selected)b.classList.add('wrong');});
  $('#answer-feedback').innerHTML=`<div class="answer-result"><strong style="color:${m.correct?'#588042':'#af6b5c'}">${m.correct?'✓ ถูกต้อง! เติมพลังแล้ว':'ลองอีกครั้ง เกือบแล้ว!'}</strong><p>${escape(m.reward)}</p><button class="btn btn-primary btn-small" data-action="next-question">ตอบข้อต่อไป ${icon('arrow',15)}</button> <button class="btn btn-outline btn-small" data-action="close">กลับสู่สนาม</button></div>`;
  activeQuestion=null;
}
function showResults(){
  stopScanner();modalRoot.innerHTML='';modalType='';
  const ranked=[...room.players].sort((a,b)=>b.survived-a.survived||b.correct-a.correct);
  showModal(`<div class="result-medal">${room.reason?.includes('ชนะ')?'🏆':'❄'}</div><div class="eyebrow" style="justify-content:center">ADVENTURE COMPLETE</div><h2 id="modal-title">จบการผจญภัยแล้ว!</h2><p class="result-sub">${escape(room.reason)} · ${escape(room.title)}</p><div class="result-list">${ranked.map((p,i)=>`<div class="result-row ${p.id===user.id?'me':''}"><b>${i+1}</b><div class="avatar">${avatars[p.avatar]}</div><div><b>${escape(p.name)}${p.bot?' · บอท':p.id===user.id?' · คุณ':''}</b><small>ตอบถูก ${p.correct}/${p.attempts} ข้อ · แพร่คำสาป ${p.infections} คน</small></div><div style="text-align:right"><b>${Math.floor(p.survived)} วินาที</b><small>${p.cursed?'🟣 ซอมบี้':'🟢 รอดชีวิต'}</small></div></div>`).join('')}</div><p class="question-foot" style="margin:10px 0 20px">${room.isHost&&!room.practice?'ผลของผู้เล่นพร้อมดาวน์โหลด CSV':user.role==='guest'?'เข้าสู่ระบบในรอบถัดไปเพื่อเก็บประวัติการเล่น':'ผลการเล่นบันทึกในบัญชีของคุณแล้ว'}</p><div class="result-actions">${room.isHost&&!room.practice?`<a class="btn btn-outline" href="/api/rooms/${room.code}/results.csv">ดาวน์โหลดผล CSV</a><button class="btn btn-primary" data-action="reset">เล่นรอบใหม่</button>`:room.practice?'<button class="btn btn-primary" data-action="practice-again">ลองอีกครั้ง</button>':'<span class="note-box">รอครูเริ่มรอบถัดไป หรือกลับหน้าหลัก</span>'}<button class="btn btn-light" data-action="leave">กลับหน้าหลัก</button></div>`,{type:'results',className:'result-modal'});
  $('.close').style.display='none';
}
function leaveGame(render=true){
  leaving=true;clearTimeout(reconnectTimer);const code=room?.code;
  if(code)api(`/api/rooms/${code}/leave`,{}).catch(()=>{});socket?.close();socket=null;room=null;
  stopScanner();destroyWorld();modalRoot.innerHTML='';modalType='';activeQuestion=null;lastResults='';history.replaceState(null,'','/');if(render)renderHome();
}
function help(){
  showModal(`<div class="eyebrow">❄ A LITTLE FIELD GUIDE</div><h2 id="modal-title">คู่มือเอาตัวรอดในหิมะ</h2><p class="sub">บังคับตัวละคร ตอบให้ไว แล้ววิ่งให้รอด</p><div class="help-list"><p><b>🎮 เดินและยิง</b><br>คอมพิวเตอร์: WASD / ลูกศรเพื่อเดิน เล็งด้วยเมาส์ กดคลิกหรือ Space ค้างเพื่อยิง<br>มือถือ: ลากจอยเพื่อเดินและหันหน้า แตะฉากเพื่อเล็ง หรือกดปุ่มยิงค้าง</p><p><b>📚 ตอบคำถาม (Q)</b><br>คนตอบถูกได้พลังงาน +35 · ซอมบี้ได้บอลหิมะ +8<br>ทุกคำตอบที่ถูกได้ 20 เหรียญ พลังงานลดขณะเดิน หากหมดจะเดินช้าลง โหมดฝึกจะหยุดสนามระหว่างตอบคำถาม</p><p><b>🟢 คน กับ 🟣 ซอมบี้</b><br>เกมสุ่มซอมบี้ 1 คน ซอมบี้ยิงโดนคน 3 ครั้งจะแพร่คำสาป<br>คนยิงซอมบี้จะทำให้หยุด 2.5 วินาที ผู้รอดชีวิตชนะเมื่อหมดเวลา ถ้าทุกคนติดคำสาปเกมจะจบ</p><p><b>🌱 ปลูกและเก็บเกี่ยว (E)</b><br>เดินไปแปลงปลูกด้านล่างซ้าย ใช้ 20 เหรียญปลูกเครื่องยิง รอ 5 วินาทีแล้วกดเก็บเกี่ยว จะได้เครื่องยิงและบอลหิมะ 15 ลูก<br>เดินไปจุดพยาบาลด้านขวาแล้วกด E ใช้ 20 เหรียญฟื้นพลังชีวิต 50 หน่วย<br>🎣 เดินไปท่าตกปลา กด E รอ 3 วินาทีแล้วกดอีกครั้ง รับบอลหิมะ พลังงานและเหรียญ</p></div><button class="btn btn-primary full m-top" data-action="close">พร้อมลุยแล้ว ${icon('check',17)}</button>`,{type:'help'});
}
async function renderQuizzes(){
  if(!user||user.role==='guest'){auth('register',renderQuizzes);return;}
  if(user.role!=='teacher'){toast('เมนูจัดการชุดคำถามใช้บัญชีคุณครู');return;}
  try{
    quizzes=(await api('/api/quizzes')).quizzes;page='quizzes';screen='quizzes';destroyWorld();
    app.innerHTML=`<div class="wrap">${header()}<main class="page"><div class="page-head"><div><div class="eyebrow">❄ YOUR QUESTION COLLECTION</div><h1 style="margin-top:10px">ชุดคำถามของคุณ</h1><p>เปลี่ยนบทเรียนให้เป็นทรัพยากรในสนามหิมะ</p></div><button class="btn btn-primary" data-action="new-quiz">${icon('plus',17)} สร้างชุดคำถาม</button></div><div class="quiz-grid">${quizzes.map(q=>`<article class="quiz-card"><div class="quiz-cover">${q.id==='sample'?'🌏':'📚'}</div><div class="eyebrow" style="font-size:9px">${q.id==='sample'?'STARTER COLLECTION':'YOUR COLLECTION'}</div><h3 style="margin-top:8px">${escape(q.title)}</h3><p>${q.questions.length} คำถาม · 4 ตัวเลือก</p><div class="quiz-buttons"><button class="btn btn-primary btn-small" data-action="host-quiz" data-id="${escape(q.id)}">${icon('play',14)} เปิดห้อง</button><button class="btn btn-outline btn-small" data-action="edit-quiz" data-id="${escape(q.id)}">${q.id==='sample'?'ดู / คัดลอก':'แก้ไข'}</button>${q.id!=='sample'?`<button class="icon-btn" data-action="delete-quiz" data-id="${escape(q.id)}" aria-label="ลบชุดคำถาม">${icon('trash',16)}</button>`:''}</div></article>`).join('')}</div></main>${footer()}</div>`;
  }catch(err){toast(err.message);}
}
function questionFields(q,i){return `<article class="editor-question"><div class="editor-top"><span>คำถามที่ <b class="q-number">${i+1}</b></span><button class="text-btn danger" type="button" data-action="remove-question">ลบข้อนี้</button></div><textarea class="field q-text" placeholder="พิมพ์คำถาม…" rows="2" maxlength="500" required>${escape(q.text)}</textarea><div class="editor-options">${q.options.map((o,j)=>`<label><input type="radio" name="answer-${i}" value="${j}" ${q.answer===j?'checked':''} required aria-label="คำตอบที่ถูกต้อง ข้อ ${j+1}"><input class="field q-option" value="${escape(o)}" placeholder="ตัวเลือก ${['A','B','C','D'][j]}" maxlength="200" required></label>`).join('')}</div></article>`;}
function editQuiz(id){
  const q=quizzes.find(q=>q.id===id);editorId=q&&id!=='sample'?id:null;
  showModal(`<div class="eyebrow">❄ BUILD YOUR COLLECTION</div><h2 id="modal-title">${editorId?'แก้ไข':'สร้าง'}ชุดคำถาม</h2><p class="sub">เพิ่มตัวเลือก 4 ข้อ แล้วเลือกวงกลมหน้าคำตอบที่ถูกต้อง</p><form id="quiz-form"><label class="form-label">ชื่อชุดคำถาม<input name="title" class="field" style="margin:8px 0 20px" placeholder="เช่น วิทยาศาสตร์ ม.1" value="${escape(q?`${q.title}${id==='sample'?' (สำเนา)':''}`:'')}" maxlength="80" required></label><div id="editor-questions">${(q?.questions||[{text:'',options:['','','',''],answer:0}]).map(questionFields).join('')}</div><p class="form-error" role="alert"></p><div class="editor-bottom"><button class="btn btn-outline btn-small" data-action="add-question" type="button">${icon('plus',16)} เพิ่มคำถาม</button><button class="btn btn-primary btn-small" type="submit">บันทึกชุดคำถาม ${icon('check',16)}</button></div></form>`,{wide:true,type:'editor'});
  $('#quiz-form').addEventListener('submit',async e=>{e.preventDefault();const questions=[...document.querySelectorAll('.editor-question')].map(el=>({text:el.querySelector('.q-text').value,options:[...el.querySelectorAll('.q-option')].map(o=>o.value),answer:Number(el.querySelector('input[type=radio]:checked')?.value)}));const button=e.target.querySelector('button[type=submit]');button.disabled=true;
    try{await api('/api/quizzes',{id:editorId||undefined,title:new FormData(e.target).get('title'),questions});closeModal();toast('บันทึกชุดคำถามแล้ว');renderQuizzes();}catch(err){e.target.querySelector('.form-error').textContent=err.message;button.disabled=false;}
  });
}
function renumberQuestions(){document.querySelectorAll('.editor-question').forEach((el,i)=>{el.querySelector('.q-number').textContent=i+1;el.querySelectorAll('input[type=radio]').forEach(r=>r.name=`answer-${i}`);});}
async function renderHistory(){
  if(!user||user.role==='guest'){auth('login',renderHistory);return;}
  try{const {matches}=await api('/api/history');page='history';screen='history';destroyWorld();
    app.innerHTML=`<div class="wrap">${header()}<main class="page"><div class="page-head"><div><div class="eyebrow">❄ YOUR ADVENTURE LOG</div><h1 style="margin-top:10px">ประวัติการเล่น</h1><p>ทุกคำตอบ และทุกวินาทีที่คุณเอาตัวรอด</p></div><button class="btn btn-outline btn-small" data-action="home">กลับสนาม ${icon('arrow',15)}</button></div>${matches.length?`<div class="table-wrap"><table><thead><tr><th>ห้องผจญภัย / วันที่</th><th>ตอบถูก</th><th>ความแม่นยำ</th><th>รอดชีวิต</th><th>แพร่คำสาป</th><th>ผลลัพธ์</th></tr></thead><tbody>${matches.map(m=>`<tr><td><b>${escape(m.title)}</b><div style="font-size:10px;color:var(--muted);margin-top:6px">${new Date(m.played_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'})}</div></td><td>${m.correct} / ${m.attempts}</td><td>${m.attempts?Math.round(m.correct/m.attempts*100):0}%</td><td>${m.survived} วินาที</td><td>${m.infections} คน</td><td><span class="status-chip ${m.cursed?'cursed':''}">${m.cursed?'ซอมบี้':'ผู้รอดชีวิต'}</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><span style="font-size:50px">🧭</span><h3>บันทึกหน้าถัดไป ยังว่างอยู่</h3><p>เข้าห้องหรือทดลองเล่น แล้วสร้างเรื่องราวของคุณ</p><button class="btn btn-primary" data-action="home">เริ่มการผจญภัย</button></div>'}</main>${footer()}</div>`;
  }catch(err){toast(err.message);}
}
function account(){
  showModal(`<div class="eyebrow">❄ YOUR EXPLORER PROFILE</div><h2 id="modal-title">${escape(user.name)}</h2><p class="sub">${escape(user.email)}<br>${user.role==='teacher'?'📚 บัญชีคุณครู':'🎒 บัญชีนักเรียน'}</p><div class="note-box">เลือกตัวละครของคุณ<div class="avatar-picker">${avatars.map((a,i)=>`<button class="avatar-choice ${user.avatar===i?'selected':''}" data-action="avatar" data-avatar="${i}" aria-label="เลือกตัวละคร ${i+1}">${a}</button>`).join('')}</div></div><button class="btn btn-outline full m-top" data-action="history">${icon('clock',17)} ดูประวัติการเล่น</button><button class="btn btn-light full m-top danger" data-action="logout">${icon('exit',17)} ออกจากระบบ</button>`,{type:'account'});
}
async function showScanner(){
  showModal(`<div class="eyebrow">❄ SCAN & JOIN</div><h2 id="modal-title">สแกน QR เข้าห้อง</h2><p class="sub">สแกนจากหน้าจอครู หรือเลือกรูป QR Code</p><div id="qr-reader" class="scanner"></div><div class="scanner-actions"><button class="btn btn-primary btn-small" id="camera-start">${icon('camera',16)} เปิดกล้อง</button><label class="btn btn-outline btn-small">${icon('qr',16)} เลือกรูป QR<input type="file" accept="image/*" id="qr-file"></label></div><p class="form-error m-top" id="scan-error" role="alert"></p><p class="question-foot">กล้องต้องใช้ HTTPS หรือ localhost<br>หากใช้ Wi-Fi ผ่าน HTTP เลือกรูป QR หรือใส่รหัสห้องได้</p>`,{type:'scanner'});
  scanner=new QRScanner('qr-reader');
  async function decoded(text){let code;try{const u=new URL(text);code=u.searchParams.get('room');}catch{code=text;}
    if(!/^\d{6}$/.test(code||'')){if($('#scan-error'))$('#scan-error').textContent='QR นี้ไม่มีรหัสห้อง Frostbound';return;}
    await stopScanner();closeModal();joinFlow(code);
  }
  $('#camera-start').onclick=async()=>{
    const button=$('#camera-start');button.disabled=true;
    if(!window.isSecureContext){$('#scan-error').textContent='เบราว์เซอร์อนุญาตกล้องเฉพาะ HTTPS หรือ localhost · กรุณาเลือกรูป QR';button.disabled=false;return;}
    try{await scanner.start(text=>decoded(text));if($('#scan-error'))$('#scan-error').textContent='';}
    catch{if($('#scan-error'))$('#scan-error').textContent='เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง หรือเลือกรูป QR';button.disabled=false;}
  };
  $('#qr-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const current=scanner;if(current.isScanning)await current.stop();const text=await current.scanFile(file,true);decoded(text);}catch{if($('#scan-error'))$('#scan-error').textContent='อ่าน QR ไม่ได้ ลองใช้รูปชัด ๆ ที่เห็น QR ครบทั้งภาพ';}};
}
async function perform(action,el){
  if(action==='home'){closeModal();if(room)leaveGame();else renderHome();}
  else if(action==='login')auth('login');else if(action==='register')auth('register');
  else if(action==='close')closeModal();else if(action==='help')help();else if(action==='map')world?.toggleMap();else if(action==='sound'){const enabled=world?.toggleSound();toast(enabled?'เปิดเสียงแล้ว':'ปิดเสียงแล้ว');}
  else if(action==='host')hostFlow();else if(action==='host-quiz')hostFlow(el.dataset.id);
  else if(action==='practice')practice();else if(action==='practice-again'){leaveGame(false);practice();}
  else if(action==='scanner')showScanner();else if(action==='quizzes'){closeModal();renderQuizzes();}
  else if(action==='history'){closeModal();renderHistory();}else if(action==='account')account();
  else if(action==='logout'){await api('/api/logout',{});user=null;closeModal();if(room)leaveGame();else renderHome();toast('ออกจากระบบแล้ว');}
  else if(action==='new-quiz')editQuiz();else if(action==='edit-quiz')editQuiz(el.dataset.id);
  else if(action==='delete-quiz'){
    const q=quizzes.find(q=>q.id===el.dataset.id);
    showModal(`<h2 id="modal-title">ลบชุดคำถามนี้?</h2><p class="sub">${escape(q.title)} · ${q.questions.length} ข้อ<br>เมื่อลบแล้วจะกู้คืนไม่ได้</p><div class="result-actions"><button class="btn btn-outline" data-action="close">เก็บไว้</button><button class="btn btn-primary" data-action="confirm-delete" data-id="${escape(q.id)}">ลบชุดคำถาม</button></div>`,{type:'delete'});
  }else if(action==='confirm-delete'){await api(`/api/quizzes/${el.dataset.id}`,null,'DELETE');closeModal();renderQuizzes();toast('ลบชุดคำถามแล้ว');}
  else if(action==='add-question'){const count=document.querySelectorAll('.editor-question').length;if(count>=100)return toast('เพิ่มได้สูงสุด 100 ข้อ');$('#editor-questions').insertAdjacentHTML('beforeend',questionFields({text:'',options:['','','',''],answer:0},count));renumberQuestions();$('#editor-questions').lastElementChild.scrollIntoView({block:'nearest',behavior:'smooth'});}
  else if(action==='remove-question'){if(document.querySelectorAll('.editor-question').length===1)return toast('ต้องมีอย่างน้อย 1 คำถาม');el.closest('.editor-question').remove();renumberQuestions();}
  else if(action==='copy-link'){if(qrData){try{await navigator.clipboard.writeText(qrData.url);toast('คัดลอกลิงก์แล้ว');}catch{toast('เลือกและคัดลอกลิงก์ใต้ QR Code ได้เลย');}}}
  else if(action==='start'){await api(`/api/rooms/${room.code}/start`,{});}
  else if(action==='stop'){
    showModal('<h2 id="modal-title">จบการผจญภัยตอนนี้?</h2><p class="sub">เกมจะหยุดและบันทึกผลของผู้เล่นทุกคน</p><div class="result-actions"><button class="btn btn-outline" data-action="close">เล่นต่อ</button><button class="btn btn-primary" data-action="confirm-stop">จบเกมและดูผล</button></div>',{type:'stop'});
  }else if(action==='confirm-stop')await api(`/api/rooms/${room.code}/stop`,{});
  else if(action==='reset')await api(`/api/rooms/${room.code}/reset`,{});
  else if(action==='leave')leaveGame();else if(action==='question')question();else if(action==='interact')interaction();else if(action==='shoot')world?.shoot();
  else if(action==='answer'){
    if(!activeQuestion)return;document.querySelectorAll('.answer-btn').forEach(b=>b.disabled=true);el.dataset.selected='true';send({type:'answer',id:activeQuestion.id,answer:Number(el.dataset.answer)});
  }else if(action==='next-question'){closeModal();setTimeout(question,Math.max(0,1300-(Date.now()-questionTime)));}
  else if(action==='avatar'){
    const avatar=Number(el.dataset.avatar);user=(await api('/api/profile',{avatar},'PATCH')).user;
    document.querySelectorAll('.avatar-choice').forEach(b=>b.classList.toggle('selected',Number(b.dataset.avatar)===avatar));
    if(room){toast('ใช้ตัวละครนี้ในเกมรอบถัดไป');}else toast('เลือกตัวละครแล้ว');
  }
}
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;e.preventDefault();perform(el.dataset.action,el).catch(err=>toast(err.message));});
modalRoot.addEventListener('click',e=>{if(e.target.classList.contains('modal-backdrop'))closeModal();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeModal();
  if(modalType==='question'&&/^[1-4]$/.test(e.key)){const button=document.querySelectorAll('.answer-btn')[Number(e.key)-1];if(button&&!button.disabled)button.click();}
  if(e.key==='Tab'&&modalType){const all=[...modalRoot.querySelectorAll('button:not(:disabled),a,input,select,textarea')].filter(el=>el.offsetParent!==null);const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  if(room?.status==='playing'&&!modalType&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){world?.setTouch(0,0);send({type:'input',x:0,y:0});}});
window.addEventListener('blur',()=>{world?.setTouch(0,0);send({type:'input',x:0,y:0});});
async function boot(){
  try{user=(await api('/api/me')).user;}catch{toast('ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');}
  renderHome();const code=new URLSearchParams(location.search).get('room');if(code)joinFlow(code);
}
boot();
