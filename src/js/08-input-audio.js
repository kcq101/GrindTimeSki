/* ---------- spray ---------- */
const SPN=360,spPos=new Float32Array(SPN*3),spVel=new Float32Array(SPN*3),spLife=new Float32Array(SPN);let spI=0;
const spGeo=new THREE.BufferGeometry();spGeo.setAttribute('position',new THREE.BufferAttribute(spPos,3));
const spray=new THREE.Points(spGeo,new THREE.PointsMaterial({color:0xffffff,size:0.2,transparent:true,opacity:0.95,depthWrite:false,map:canvasTex(32,32,(g,w,h)=>{const r=g.createRadialGradient(16,16,0,16,16,16);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(0.45,'rgba(255,255,255,.7)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h);})}));spray.frustumCulled=false;scene.add(spray);
for(let i=0;i<SPN;i++)spPos[i*3+1]=-9999;
function emit(x,y,z,vx,vy,vz,life){const i=spI++%SPN;spPos[i*3]=x;spPos[i*3+1]=y;spPos[i*3+2]=z;spVel[i*3]=vx;spVel[i*3+1]=vy;spVel[i*3+2]=vz;spLife[i]=life||0.7;}
/* bigger, softer puffs: the cloud off a hard skid and powder kicked up behind you (its own pool, one extra draw call) */
const PFN=240,pfPos=new Float32Array(PFN*3),pfVel=new Float32Array(PFN*3),pfLife=new Float32Array(PFN);let pfI=0;
const pfGeo=new THREE.BufferGeometry();pfGeo.setAttribute('position',new THREE.BufferAttribute(pfPos,3));
const puff=new THREE.Points(pfGeo,new THREE.PointsMaterial({color:0xffffff,size:1.35,transparent:true,opacity:0.72,depthWrite:false,map:spray.material.map}));puff.frustumCulled=false;scene.add(puff);
for(let i=0;i<PFN;i++)pfPos[i*3+1]=-9999;
function emitPuff(x,y,z,vx,vy,vz,life){const i=pfI++%PFN;pfPos[i*3]=x;pfPos[i*3+1]=y;pfPos[i*3+2]=z;pfVel[i*3]=vx;pfVel[i*3+1]=vy;pfVel[i*3+2]=vz;pfLife[i]=life||0.8;}
function updPuff(dt){const dr=Math.exp(-dt*2.2);for(let i=0;i<PFN;i++){if(pfLife[i]<=0)continue;pfLife[i]-=dt;if(pfLife[i]<=0){pfPos[i*3+1]=-9999;continue;}
  pfVel[i*3]*=dr;pfVel[i*3+2]*=dr;pfVel[i*3+1]=pfVel[i*3+1]*dr-2.2*dt;pfPos[i*3]+=pfVel[i*3]*dt;pfPos[i*3+1]+=pfVel[i*3+1]*dt;pfPos[i*3+2]+=pfVel[i*3+2]*dt;}pfGeo.attributes.position.needsUpdate=true;}
function updSpray(dt){updPuff(dt);for(let i=0;i<SPN;i++){if(spLife[i]<=0)continue;spLife[i]-=dt;if(spLife[i]<=0){spPos[i*3+1]=-9999;continue;}spVel[i*3+1]-=9*dt;spPos[i*3]+=spVel[i*3]*dt;spPos[i*3+1]+=spVel[i*3+1]*dt;spPos[i*3+2]+=spVel[i*3+2]*dt;}spGeo.attributes.position.needsUpdate=true;}

/* ---------- input ---------- */
let steerIn=0,steer=0,postIn=0,postS=0,touchId=null,x0=0,y0=0;const thumb=document.getElementById('thumb');
let invert=false;   /* push up = tuck (the on-screen toggle was removed) */
let tDown=0,lastSw=null,pendSpin=null;
function registerSwipe(d){const now=performance.now();if(lastSw&&lastSw.d===d&&now-lastSw.t<520){spinTrick(d);lastSw=null;}else lastSw={d,t:now};}
canvas.addEventListener('pointerdown',e=>{if(touchId!==null)return;touchId=e.pointerId;x0=e.clientX;y0=e.clientY;tDown=performance.now();thumb.style.display='block';thumb.style.left=x0+'px';thumb.style.top=y0+'px';});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==touchId)return;const dx=e.clientX-x0,dy=y0-e.clientY;
  {const sx=clamp(dx/88,-1,1);steerIn=Math.sign(sx)*Math.pow(Math.abs(sx),1.3);}   /* longer drag for full lock (70 → 88 px) and a softer centre: small drags turn gently */const pv=Math.abs(dy)<10?0:clamp((dy-Math.sign(dy)*10)/50,-1,1);postIn=invert?-pv:pv;
  thumb.style.left=(x0+clamp(dx,-70,70))+'px';thumb.style.top=(y0-clamp(dy,-60,60))+'px';});
function endTouch(e){if(e.pointerId!==touchId)return;{const dx=e.clientX-x0,dy=e.clientY-y0;if(performance.now()-tDown<300&&Math.abs(dx)>35&&Math.abs(dx)>1.4*Math.abs(dy))registerSwipe(Math.sign(dx));
    else if(performance.now()-tDown<280&&dy<-28&&-dy>1.4*Math.abs(dx))skate();}   /* quick flick up = one skate stroke */touchId=null;steerIn=0;postIn=0;thumb.style.display='none';}
canvas.addEventListener('pointerup',endTouch);canvas.addEventListener('pointercancel',endTouch);
const keys={};window.addEventListener('keydown',e=>{keys[e.key]=true;if(!e.repeat&&(e.key==='ArrowLeft'||e.key==='ArrowRight'))registerSwipe(e.key==='ArrowRight'?1:-1);if(e.code==='Space'){e.preventDefault();if(!e.repeat)jump();}if((e.key==='e'||e.key==='E')&&!e.repeat)skate();if((e.key==='b'||e.key==='B'||e.key==='Shift')&&!e.repeat)boost();});window.addEventListener('keyup',e=>{keys[e.key]=false;});
const jumpBtn=document.getElementById('jumpBtn');
jumpBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();jump();});
/* boost: a short shove of speed (~9 mph over half a second), then a 2.5 s recharge. Works on the snow or in the air. */
const BOOST={push:0.45,acc:9,cd:2.5},boostBtn=document.getElementById('boostBtn');window.__boost=BOOST;
function boost(){if(S.state!=='ride'||S.crashed||(S.bcd||0)>0)return;S.go=true;S.bst=BOOST.push;S.bcd=BOOST.cd;sfxSkate();
  for(let i=0;i<10;i++)emitPuff(S.x-Math.sin(S.th)*(0.6+rnd()*0.6),(S.air?S.y:H(S.x,S.z))+0.15,S.z-Math.cos(S.th)*(0.6+rnd()*0.6),(rnd()-0.5)*2-Math.sin(S.th)*2,0.4+rnd()*1.2,(rnd()-0.5)*2-Math.cos(S.th)*2,0.6);}
boostBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();boost();});
let boostShown=-1;function updBoostBtn(){const c=Math.round(clamp((S.bcd||0)/BOOST.cd,0,1)*40)/40;if(c===boostShown)return;boostShown=c;boostBtn.style.setProperty('--cd',c);boostBtn.classList.toggle('cool',c>0);}
function updPips(){const on=S.air?2-S.boosts:2;jumpBtn.querySelectorAll('.pips i').forEach((el,i)=>el.classList.toggle('on',i<on));}
const GRAV=13;
function spinTrick(d){if(S.state!=='ride'||S.crashed)return;if(S.air){S.spinT+=-d*TAU;}else pendSpin={d,t:performance.now()};}
function jump(){
  if(S.state!=='ride'||S.crashed)return;
  if(!S.air){S.autoAir=false;S.flipArm=Math.abs(postS)<0.3;S.gyp=undefined;S.gvp=undefined;S.air=true;S.y=H(S.x,S.z)+0.05;S.vy=6+Math.min(2,S.v*0.06);S.boosts=0;S.airT=0;trkBreak=true;S.flip=0;S.spin=0;S.spinT=0;if(pendSpin&&performance.now()-pendSpin.t<450)S.spinT=-pendSpin.d*TAU;pendSpin=null;
    for(let i=0;i<14;i++)emit(S.x+(rnd()-0.5)*0.8,S.y,S.z+(rnd()-0.5)*0.8,(rnd()-0.5)*2,0.5+rnd()*1.2,(rnd()-0.5)*2,0.45);}
  else if(S.boosts<2){S.boosts++;S.vy=Math.max(S.vy,0)+5.5;S.v=Math.min(39,S.v+1.5);
    for(let i=0;i<18;i++)emit(S.x+(rnd()-0.5)*0.6,S.y+0.3,S.z+(rnd()-0.5)*0.6,(rnd()-0.5)*3,-1-rnd()*2,(rnd()-0.5)*3,0.5);
    toast(S.boosts===1?'DOUBLE!':'TRIPLE!');}
  updPips();
}

/* ---------- audio: wind (filtered noise until the real recordings in 14-sfx.js are decoded, then a real wind loop) ---------- */
let actx=null,wind=null,windF=null;
function startAudio(){if(actx&&wind){if(actx.state==='suspended')actx.resume();return;}   /* once: later calls used to stack another wind chain each run */
  try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();const len=actx.sampleRate*2,buf=actx.createBuffer(1,len,actx.sampleRate),d=buf.getChannelData(0);let b=0;for(let i=0;i<len;i++){b=(b+0.02*(Math.random()*2-1))/1.02;d[i]=b*3.5;}
  const src=actx.createBufferSource();src.buffer=buf;src.loop=true;windF=actx.createBiquadFilter();windF.type='lowpass';windF.frequency.value=400;wind=actx.createGain();wind.gain.value=0;src.connect(windF);windF.connect(wind);wind.connect(actx.destination);src.start();if(actx.state==='suspended')actx.resume();SFX.noiseSrc=src;}catch(err){actx=null;}sfxInit();}

