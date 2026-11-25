/* ---------- sound effects: skis on snow, carving edges, wind, landings, falls, tree hits, pole plants, lift towers ----------
   All from real CC0 recordings (assets/sfx/SOURCES.md), inlined as MP3 and decoded once on the first tap. Two looping layers carry
   the skiing and are shaped live from the controller:
     glide  the base on the snow: pitch, brightness and level rise with speed; duller and lower in powder
     edge   a second take, high-passed: comes in with the edge angle (the skier's lean) and rises in pitch as the edge bites harder
   One-shots are layered from snow crunches, a wood chop and a metal clank, pitched and filtered per event.
   Cost: 3 looping sources + a few filters; parameters update every other frame; one-shots create 2–3 short-lived nodes each. */
const SFX={buf:{},on:false,master:null,glide:null,edge:null,fr:0,wasAir:false,landP:0};window.__sfx=SFX;
function b64buf(s){const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u.buffer;}
function decodeBuf(ab){return new Promise((res,rej)=>{try{const p=actx.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej);}catch(e){rej(e);}});}
/* exact loop points: browsers differ on stripping the MP3 encoder delay (1105 samples for LAME), so check the decoded length */
function loopPts(src,m){const b=src.buffer,secs=b.length/b.sampleRate,tr=m.n/m.rate,d=1105/m.rate;
  if(secs>=tr+d*0.8){src.loopStart=d;src.loopEnd=d+tr;}else{src.loopStart=0;src.loopEnd=Math.min(secs,tr);}}
function sfxLoop(name,fType,f0){const m=SFX.meta[name],src=actx.createBufferSource();src.buffer=SFX.buf[name];src.loop=true;loopPts(src,m);
  const f=actx.createBiquadFilter();f.type=fType;f.frequency.value=f0;const g=actx.createGain();g.gain.value=0;src.connect(f);f.connect(g);g.connect(SFX.master);
  src.start(0,src.loopStart+Math.random()*(src.loopEnd-src.loopStart)*0.9);return {src,f,g};}
function sfxInit(){
  if(SFX.started||!actx)return;SFX.started=true;
  let data;try{data=JSON.parse(document.getElementById('sfxdata').textContent);}catch(e){return;}
  SFX.meta=data;SFX.master=actx.createGain();SFX.master.gain.value=0.9;SFX.master.connect(actx.destination);
  Promise.all(Object.keys(data).map(k=>decodeBuf(b64buf(data[k].b64)).then(b=>{SFX.buf[k]=b;data[k].b64=null;}))).then(()=>{
    SFX.glide=sfxLoop('glide','lowpass',2000);SFX.edge=sfxLoop('edge','highpass',1500);
    /* the wind is a real recording now (was filtered noise): same wind/windF handles the loop and lift code already drive */
    if(wind){const w=sfxLoop('wind','lowpass',800);w.g.disconnect();w.g.connect(windF);w.g.gain.value=1;if(SFX.noiseSrc)SFX.noiseSrc.stop();}
    SFX.on=true;}).catch(e=>console.warn('sfx decode failed',e));}
/* one-shot: o = {g gain, r playback rate, lp/hp filter Hz, d delay s, off/dur: a slice of a loop, fade: s} */
function sfx(name,o){if(!SFX.on)return;const b=SFX.buf[name];if(!b)return;o=o||{};const t=actx.currentTime+(o.d||0);
  const s=actx.createBufferSource();s.buffer=b;s.playbackRate.value=(o.r||1)*(1+(Math.random()-0.5)*0.08);
  const g=actx.createGain();g.gain.value=o.g==null?1:o.g;let n=s;
  if(o.lp||o.hp){const f=actx.createBiquadFilter();f.type=o.lp?'lowpass':'highpass';f.frequency.value=o.lp||o.hp;n.connect(f);n=f;}
  n.connect(g);g.connect(SFX.master);
  if(o.dur){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(o.g,t+0.02);g.gain.setTargetAtTime(0,t+0.04,o.fade||o.dur/3);s.start(t,o.off||0);s.stop(t+o.dur+0.05);}
  else s.start(t);}
const CRUNCH=['crunch1','crunch2','crunch3','crunch4','crunch5'];const crunch=()=>CRUNCH[(Math.random()*5)|0];
/* events */
function sfxLand(imp){const k=clamp(imp/16,0.15,1);
  sfx(crunch(),{g:0.45+0.55*k,r:0.95-0.25*k});                      /* boots and skis into the snow */
  sfx(crunch(),{g:0.5*k+0.1,r:0.55,lp:700,d:0.012});                 /* the weight behind it */
  sfx('glide',{g:0.35*k,r:0.9,lp:3000,off:Math.random()*4,dur:0.35,fade:0.12});}   /* a short skid as the skis bite */
function sfxBump(k){sfx(crunch(),{g:0.12+0.25*k,r:1.05,lp:2500});}
function sfxPop(){sfx(crunch(),{g:0.3,r:1.15,hp:400});}
function sfxFall(){                                                  /* a body hitting snow, then tumbling to a stop */
  sfx(crunch(),{g:1,r:0.5,lp:600});sfx(crunch(),{g:0.8,r:0.8,d:0.03});
  sfx('glide',{g:0.7,r:0.85,lp:2600,off:Math.random()*4,dur:1.1,fade:0.35,d:0.05});
  sfx('chop2',{g:0.22,r:1.7,hp:900,d:0.18});                         /* a ski knocking */
  sfx(crunch(),{g:0.55,r:0.65,lp:1200,d:0.38});sfx(crunch(),{g:0.3,r:0.75,lp:1500,d:0.7});}
function sfxTree(sp){const k=clamp(sp/15,0.2,1);
  sfx('chop1',{g:0.5+0.5*k,r:0.62,lp:3500});sfx(crunch(),{g:0.6*k,r:0.7,d:0.01});
  sfx('edge',{g:0.3*k,r:1.25,hp:2500,off:Math.random()*4,dur:1.4,fade:0.5,d:0.12});}   /* snow sifting off the branches */
function sfxPlant(){sfx(crunch(),{g:0.14,r:1.5,hp:1200,d:0.15});}
function sfxClank(){sfx('clank1',{g:0.5,r:0.7,lp:4000});sfx('clank2',{g:0.32,r:0.62,lp:3000,d:0.09});}
/* per frame: shape the loops from the controller, catch landings / jolts / takeoffs */
let _sfxLand=0;
function sfxFrame(dt){if(!SFX.on)return;
  const ride=(S.state==='ride'||S.state==='finishing'),onSnow=ride&&!S.crashed&&!S.air&&S.v>0.3;
  if(ride){if(SFX.wasAir&&!S.air&&!S.crashed)sfxLand(Math.max(0,-S.vy));else if(!SFX.wasAir&&S.air&&!S.autoAir)sfxPop();
    if(!S.air&&S.land>_sfxLand+0.08&&!(SFX.wasAir))sfxBump(clamp((S.gAcc||0)/150,0,1));}
  SFX.wasAir=S.air;_sfxLand=S.land;
  if((++SFX.fr&1)&&dt<0.2)return;
  const t=actx.currentTime,sv=clamp(S.v/30,0,1),e=clamp(Math.abs(lean)/LEAN.max,0,1),pw=ride&&lastSim&&lastSim.off?1:0,G=SFX.glide,E=SFX.edge;
  /* glide: speed brings up pitch, brightness and level; carving shifts some of it into the edge layer */
  const gg=onSnow?(0.05+0.5*Math.sqrt(sv))*(1-0.3*e)*(pw?1.2:1):0;
  G.g.gain.setTargetAtTime(gg,t,0.06);G.src.playbackRate.setTargetAtTime((0.72+0.5*sv+0.08*e)*(pw?0.8:1),t,0.08);
  G.f.frequency.setTargetAtTime(pw?700+1400*sv:1300+5200*sv,t,0.08);
  /* edge: the lean is the edge angle; the harder it's on edge, the louder and higher the hiss */
  const eg=onSnow?Math.pow(e,1.3)*(0.12+0.7*sv)*(pw?0.35:1)*0.6:0;
  E.g.gain.setTargetAtTime(eg,t,0.05);E.src.playbackRate.setTargetAtTime(0.85+0.3*sv+0.45*e,t,0.06);E.f.frequency.setTargetAtTime(700+2300*e,t,0.06);}
window.__kr.sfxState=()=>SFX.on?{glide:+SFX.glide.g.gain.value.toFixed(3),glideRate:+SFX.glide.src.playbackRate.value.toFixed(3),edge:+SFX.edge.g.gain.value.toFixed(3),edgeRate:+SFX.edge.src.playbackRate.value.toFixed(3),
  loops:Object.fromEntries(['glide','edge'].map(k=>[k,[+SFX[k].src.loopStart.toFixed(4),+SFX[k].src.loopEnd.toFixed(4),SFX.buf[k].length,SFX.buf[k].sampleRate]]))}:{on:false};
window.__kr.sfxTest=()=>{sfxLand(12);sfxBump(0.5);sfxPop();sfxFall();sfxTree(14);sfxPlant();sfxClank();return actx.currentTime;};
