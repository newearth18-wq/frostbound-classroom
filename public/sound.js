let context,master;
let muted=localStorage.getItem('frostbound-muted')==='true';
export function unlockSound(){
  if(muted)return;
  try{
    if(!context){context=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});master=context.createGain();master.gain.value=.3;master.connect(context.destination);}
    // Called synchronously inside pointerdown/keydown, including the Start button.
    if(context.state!=='running')context.resume().catch(()=>{});
    const silent=context.createBufferSource();silent.buffer=context.createBuffer(1,1,context.sampleRate);silent.connect(master);silent.start();
  }catch{}
}
export function playSound(kind){
  if(muted||context?.state!=='running')return;
  const t=context.currentTime;
  const tone=(frequency,end,start,length,type='sine',volume=.6)=>{
    const o=context.createOscillator(),g=context.createGain();o.type=type;o.connect(g);g.connect(master);
    o.frequency.setValueAtTime(frequency,t+start);o.frequency.exponentialRampToValueAtTime(end,t+start+length);
    g.gain.setValueAtTime(volume,t+start);g.gain.exponentialRampToValueAtTime(.001,t+start+length);o.start(t+start);o.stop(t+start+length+.02);
  };
  if(kind==='shoot'){tone(650,100,0,.12,'triangle');tone(1800,450,0,.065,'sawtooth',.15);}
  else if(kind==='hit'){tone(180,45,0,.2,'square',.3);tone(400,90,.02,.12,'triangle');}
  else if(kind==='transform'){tone(180,700,0,.3,'triangle');tone(700,90,.16,.35,'sawtooth',.2);}
  else if(kind==='wrong')tone(280,130,0,.2,'triangle');
  else {tone(660,660,0,.12);tone(880,880,.09,.15);tone(1320,1320,.2,.22);}
}
export function soundEnabled(){return !muted;}
export function toggleSound(){muted=!muted;localStorage.setItem('frostbound-muted',String(muted));if(!muted){unlockSound();playSound('reward');}return !muted;}
