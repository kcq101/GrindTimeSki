/* ---------- spray ---------- */
const SPN=360,spPos=new Float32Array(SPN*3),spVel=new Float32Array(SPN*3),spLife=new Float32Array(SPN);let spI=0;
const spGeo=new THREE.BufferGeometry();spGeo.setAttribute('position',new THREE.BufferAttribute(spPos,3));
const spray=new THREE.Points(spGeo,new THREE.PointsMaterial({color:0xffffff,size:0.2,transparent:true,opacity:0.95,depthWrite:false,map:canvasTex(32,32,(g,w,h)=>{const r=g.createRadialGradient(16,16,0,16,16,16);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(0.45,'rgba(255,255,255,.7)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h);})}));spray.frustumCulled=false;scene.add(spray);
for(let i=0;i<SPN;i++)spPos[i*3+1]=-9999;
function emit(x,y,z,vx,vy,vz,life){const i=spI++%SPN;spPos[i*3]=x;spPos[i*3+1]=y;spPos[i*3+2]=z;spVel[i*3]=vx;spVel[i*3+1]=vy;spVel[i*3+2]=vz;spLife[i]=life||0.7;}
function updSpray(dt){for(let i=0;i<SPN;i++){if(spLife[i]<=0)continue;spLife[i]-=dt;if(spLife[i]<=0){spPos[i*3+1]=-9999;continue;}spVel[i*3+1]-=9*dt;spPos[i*3]+=spVel[i*3]*dt;spPos[i*3+1]+=spVel[i*3+1]*dt;spPos[i*3+2]+=spVel[i*3+2]*dt;}spGeo.attributes.position.needsUpdate=true;}

/* ---------- input ---------- */
let steerIn=0,steer=0,postIn=0,postS=0,touchId=null,x0=0,y0=0;const thumb=document.getElementById('thumb');
let invert=false;try{invert=localStorage.getItem('kr_invert')==='1';}catch(e){}
let tDown=0,lastSw=null,pendSpin=null;
function registerSwipe(d){const now=performance.now();if(lastSw&&lastSw.d===d&&now-lastSw.t<520){spinTrick(d);lastSw=null;}else lastSw={d,t:now};}
canvas.addEventListener('pointerdown',e=>{if(touchId!==null)return;touchId=e.pointerId;x0=e.clientX;y0=e.clientY;tDown=performance.now();thumb.style.display='block';thumb.style.left=x0+'px';thumb.style.top=y0+'px';});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==touchId)return;const dx=e.clientX-x0,dy=y0-e.clientY;
  steerIn=clamp(dx/70,-1,1);const pv=Math.abs(dy)<10?0:clamp((dy-Math.sign(dy)*10)/50,-1,1);postIn=invert?-pv:pv;
  thumb.style.left=(x0+clamp(dx,-70,70))+'px';thumb.style.top=(y0-clamp(dy,-60,60))+'px';});
function endTouch(e){if(e.pointerId!==touchId)return;{const dx=e.clientX-x0,dy=e.clientY-y0;if(performance.now()-tDown<300&&Math.abs(dx)>35&&Math.abs(dx)>1.4*Math.abs(dy))registerSwipe(Math.sign(dx));}touchId=null;steerIn=0;postIn=0;thumb.style.display='none';}
canvas.addEventListener('pointerup',endTouch);canvas.addEventListener('pointercancel',endTouch);
const keys={};window.addEventListener('keydown',e=>{keys[e.key]=true;if(!e.repeat&&(e.key==='ArrowLeft'||e.key==='ArrowRight'))registerSwipe(e.key==='ArrowRight'?1:-1);if(e.code==='Space'){e.preventDefault();if(!e.repeat)jump();}});window.addEventListener('keyup',e=>{keys[e.key]=false;});
const jumpBtn=document.getElementById('jumpBtn'),invBtn=document.getElementById('invBtn');
jumpBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();jump();});
function invLabel(){invBtn.textContent=invert?'⇅ Pull down = tuck':'⇅ Push up = tuck';}invLabel();
invBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();invert=!invert;invLabel();postIn=-postIn;try{localStorage.setItem('kr_invert',invert?'1':'0');}catch(err){}toast(invert?'Pull down to tuck':'Push up to tuck');});
function updPips(){const on=S.air?2-S.boosts:2;jumpBtn.querySelectorAll('.pips i').forEach((el,i)=>el.classList.toggle('on',i<on));}
const GRAV=13;
function spinTrick(d){if(S.state!=='ride'||S.crashed)return;if(S.air){S.spinT+=-d*TAU;}else pendSpin={d,t:performance.now()};}
function jump(){
  if(S.state!=='ride'||S.crashed)return;
  if(!S.air){S.autoAir=false;S.gyp=undefined;S.gvp=undefined;S.air=true;S.y=H(S.x,S.z)+0.05;S.vy=6+Math.min(2,S.v*0.06);S.boosts=0;S.airT=0;trkBreak=true;S.flip=0;S.spin=0;S.spinT=0;if(pendSpin&&performance.now()-pendSpin.t<450)S.spinT=-pendSpin.d*TAU;pendSpin=null;
    for(let i=0;i<14;i++)emit(S.x+(rnd()-0.5)*0.8,S.y,S.z+(rnd()-0.5)*0.8,(rnd()-0.5)*2,0.5+rnd()*1.2,(rnd()-0.5)*2,0.45);}
  else if(S.boosts<2){S.boosts++;S.vy=Math.max(S.vy,0)+5.5;S.v=Math.min(36,S.v+1.5);
    for(let i=0;i<18;i++)emit(S.x+(rnd()-0.5)*0.6,S.y+0.3,S.z+(rnd()-0.5)*0.6,(rnd()-0.5)*3,-1-rnd()*2,(rnd()-0.5)*3,0.5);
    toast(S.boosts===1?'DOUBLE!':'TRIPLE!');}
  updPips();
}

/* ---------- audio (wind) ---------- */
let actx=null,wind=null,windF=null;
function startAudio(){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();const len=actx.sampleRate*2,buf=actx.createBuffer(1,len,actx.sampleRate),d=buf.getChannelData(0);let b=0;for(let i=0;i<len;i++){b=(b+0.02*(Math.random()*2-1))/1.02;d[i]=b*3.5;}
  const src=actx.createBufferSource();src.buffer=buf;src.loop=true;windF=actx.createBiquadFilter();windF.type='lowpass';windF.frequency.value=400;wind=actx.createGain();wind.gain.value=0;src.connect(windF);windF.connect(wind);wind.connect(actx.destination);src.start();if(actx.state==='suspended')actx.resume();}catch(err){actx=null;}}

