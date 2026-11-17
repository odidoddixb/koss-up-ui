/* Safari media playback adapter. News content, event timing and WebAudio effects stay in module 5. */
(function(){
 'use strict';
 const safari=/AppleWebKit/.test(navigator.userAgent)&&/Safari/.test(navigator.userAgent)&&!/Chrome|Chromium|CriOS|FxiOS|Edg|OPR/.test(navigator.userAgent);
 const paths={chime:'assets/audio/chime.wav',page:'assets/audio/page.wav',alert:'assets/audio/alert.wav',rumble:'assets/audio/rumble.wav',good:'assets/audio/good.wav',bad:'assets/audio/bad.wav',tick:'assets/audio/tick.wav'};
 const bank=new Map();let active=safari,muted=false,enabled=true,lastError='';
 function session(){try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch{}}
 function entry(name){
  if(!bank.has(name)){const media=new Audio(window.GTAsset?window.GTAsset(paths[name]):paths[name]);media.preload='auto';media.setAttribute('playsinline','');media.volume=1;bank.set(name,{media,generation:0,unlocked:false})}
  return bank.get(name);
 }
 function prime(){
  if(!active||!enabled||muted)return;session();
  Object.keys(paths).forEach(name=>{const item=entry(name);if(item.unlocked||!item.media.paused)return;const generation=item.generation;item.media.volume=0;
   try{Promise.resolve(item.media.play()).then(()=>{item.unlocked=true;if(item.generation===generation){item.media.pause();item.media.currentTime=0;item.media.volume=1}}).catch(error=>{if(item.generation===generation)item.media.volume=1;lastError=error.message})}catch(error){item.media.volume=1;lastError=error.message}
  });
 }
 function play(name){
  if(!enabled||muted||!paths[name])return Promise.resolve();session();const item=entry(name);item.generation++;item.media.pause();item.media.currentTime=0;item.media.muted=false;item.media.volume=1;
  try{return Promise.resolve(item.media.play()).then(()=>{item.unlocked=true;lastError=''}).catch(error=>{lastError=error.message;throw error})}catch(error){lastError=error.message;return Promise.reject(error)}
 }
 window.GoldenTimeAudio={isActive:()=>active,prime,play,
  reconnect(){active=true;enabled=true;muted=false;prime();return play('chime')},
  player(){const media=entry('chime').media;media.controls=true;media.setAttribute('aria-label','확인음 직접 재생');return media},
  setMuted(value){muted=!!value;if(muted)bank.forEach(({media})=>media.pause())},setEnabled(value){enabled=!!value;if(!enabled)bank.forEach(({media})=>media.pause())},getError:()=>lastError
 };
})();
