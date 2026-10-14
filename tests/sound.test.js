import {test} from 'node:test';
import assert from 'node:assert/strict';
test('audio unlocks from a gesture, plays effects, and respects persistent mute',async()=>{
  const nodes=[];let created=0,resumed=0,started=0;
  const param={value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}};
  class AudioContextMock{
    constructor(){created++;this.state='suspended';this.currentTime=1;this.sampleRate=44100;}
    createGain(){return {gain:{...param},connect(){}};}
    createOscillator(){const o={frequency:{...param},connect(){},start(){started++;},stop(){}};nodes.push(o);return o;}
    createBuffer(){return {};}
    createBufferSource(){return {connect(){},start(){}};}
    resume(){resumed++;this.state='running';return Promise.resolve();}
  }
  globalThis.localStorage={getItem:()=>null,setItem:(key,value)=>assert.equal(key,'frostbound-muted')};
  globalThis.window={AudioContext:AudioContextMock};
  const sound=await import('../public/sound.js');sound.playSound('shoot');assert.equal(created,0,'network effects must not create locked audio contexts');
  sound.unlockSound();assert.equal(created,1);assert.equal(resumed,1);sound.playSound('shoot');sound.playSound('hit');sound.playSound('reward');assert.equal(started,7);
  assert.equal(sound.toggleSound(),false);sound.playSound('shoot');assert.equal(started,7);assert.equal(sound.toggleSound(),true);assert.ok(started>7);assert.equal(created,1,'scene changes reuse the unlocked context');
  delete globalThis.localStorage;delete globalThis.window;
});
