/* ---------- ghost: race your best run from this trail top ----------
   While the clock runs, the run is sampled 10 times a second: position, heading, height in the air, lean, crouch, flip and spin
   (11 bytes a sample, ~1 KB per 10 s, kept in localStorage). Finish at a base faster than the saved ghost for that start trail and
   your run becomes the ghost. Start that trail again and a see-through skier replays it on the same clock; the HUD shows the gap,
   measured as the ghost's time at the point on its line nearest you (so it means the same thing on any part of the run).
   Cost: one small merged mesh (~600 triangles) drawn twice (a depth pass so it reads as one solid shape, then the colour), +2 draw calls. */
const GH_HZ=10,GH_B=11,GH_KEY='kr_ghost_';
const GREC={run:-1,n:0,buf:new Uint8Array(GH_B*3000),dv:null,qx:0,qz:0,x0:0,z0:0,name:''};GREC.dv=new DataView(GREC.buf.buffer);
let GHOST=null,ghostTf=0,ghostGapT=0;
const wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a));
function recSample(){
  if((GREC.n+1)*GH_B>GREC.buf.length){const nb=new Uint8Array(GREC.buf.length*2);nb.set(GREC.buf);GREC.buf=nb;GREC.dv=new DataView(nb.buffer);}
  const dv=GREC.dv,o=GREC.n*GH_B;
  /* positions as 2 cm steps from the last *reconstructed* position, so rounding never drifts */
  const dx=clamp(Math.round((S.x-GREC.qx)/0.02),-32767,32767),dz=clamp(Math.round((S.z-GREC.qz)/0.02),-32767,32767);GREC.qx+=dx*0.02;GREC.qz+=dz*0.02;
  dv.setInt16(o,dx,true);dv.setInt16(o+2,dz,true);dv.setInt16(o+4,Math.round(wrapA(S.th)/Math.PI*32767),true);
  dv.setUint8(o+6,S.air?clamp(Math.round((S.y-H(S.x,S.z))*10),0,255):0);
  dv.setInt8(o+7,clamp(Math.round(lean*100),-127,127));dv.setUint8(o+8,clamp(Math.round(crouch*255),0,255));
  dv.setInt8(o+9,clamp(Math.round(wrapA(S.flip)/Math.PI*127),-127,127));dv.setInt8(o+10,clamp(Math.round(wrapA(S.spin)/Math.PI*127),-127,127));
  GREC.n++;}
/* called after every physics step: starts a recording when the clock starts, then samples on the run clock */
function ghostTick(){
  if(S.state!=='ride'||S.pre)return;
  if(GREC.run!==S.runId){GREC.run=S.runId;GREC.n=0;GREC.x0=GREC.qx=S.x;GREC.z0=GREC.qz=S.z;GREC.name=RUN.name;ghostTf=0;ghostGapT=0;
    GHOST=RUN.chal?RUN.chal.G:ghostLoad(RUN.name);if(GHOST){GHOST.gi=0;GHOST.off=false;}
    /* a friend's run is a gold ghost, yours is blue */
    const m=ghostG.userData.mat;if(m){m.color.setHex(RUN.chal?0xffc04a:0x46b8ff);m.emissive.setHex(RUN.chal?0x8a4a08:0x124f8c);}ghostPin.material.map=RUN.chal?PIN_TEX.gold:PIN_TEX.blue;}
  while(GREC.n<=S.t*GH_HZ+1e-6&&GREC.n<36000)recSample();}
function ghostB64(u8){let s='';for(let i=0;i<u8.length;i+=8192)s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));return btoa(s);}
function ghostDecode(o){
  const bin=atob(o.d),u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);return ghostBytes(u8,o.x0,o.z0,o.name,o.t,o.bn);}
const ghostArrs=n=>{const F=()=>new Float32Array(n);return {n,X:F(),Z:F(),A:F(),TH:F(),LE:F(),CR:F(),FL:F(),SP:F(),gi:0,off:false};};
function ghostBytes(u8,x0,z0,name,t,bn){const n=Math.floor(u8.length/GH_B);
  if(n<2)return null;const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),G=Object.assign(ghostArrs(n),{name,t,base:bn});
  let x=x0,z=z0;
  for(let i=0;i<n;i++){const q=i*GH_B;x+=dv.getInt16(q,true)*0.02;z+=dv.getInt16(q+2,true)*0.02;G.X[i]=x;G.Z[i]=z;G.TH[i]=dv.getInt16(q+4,true)/32767*Math.PI;
    G.A[i]=dv.getUint8(q+6)/10;G.LE[i]=dv.getInt8(q+7)/100;G.CR[i]=dv.getUint8(q+8)/255;G.FL[i]=dv.getInt8(q+9)/127*Math.PI;G.SP[i]=dv.getInt8(q+10)/127*Math.PI;}
  G.dur=(n-1)/GH_HZ;return G;}
function ghostLoad(name){try{const s=localStorage.getItem(GH_KEY+name);if(!s)return null;const o=JSON.parse(s);return o&&o.v===1?ghostDecode(o):null;}catch(e){return null;}}
/* save, and if storage is full drop the ghosts you raced longest ago until it fits */
function ghostStore(name,val){
  for(let a=0;a<8;a++){try{localStorage.setItem(GH_KEY+name,val);return true;}catch(e){
    const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(GH_KEY)&&k!==GH_KEY+name){let w=0;try{w=JSON.parse(localStorage.getItem(k)).w||0;}catch(_){}ks.push([w,k]);}}
    if(!ks.length)return false;ks.sort((p,q)=>p[0]-q[0]);localStorage.removeItem(ks[0][1]);}}
  return false;}
function ghostSave(base){
  const o={v:1,name:GREC.name,t:+S.t.toFixed(2),b:base.id,bn:base.name,x0:+GREC.x0.toFixed(2),z0:+GREC.z0.toFixed(2),w:Date.now(),d:ghostB64(GREC.buf.subarray(0,GREC.n*GH_B))};
  return ghostStore(GREC.name,JSON.stringify(o));}
const fmtGap=d=>d>=60?fmt(d):d.toFixed(1);
/* finish card line; saves this run as the ghost when it's the first or the fastest from this start */
function ghostFinish(base){
  if(GREC.run!==S.runId||GREC.n<2||!base)return '';
  if(RUN.chal&&GHOST===RUN.chal.G){const d=S.t-RUN.chal.t,own=ghostLoad(GREC.name);
    const msg=Math.abs(d)<0.05?'Dead heat with the challenge.':d<0?'You beat the challenge by '+fmtGap(-d)+' s!':'The challenge was '+fmtGap(d)+' s faster.';
    if(!own||S.t<own.t){try{ghostSave(base);}catch(e){}}return msg;}
  const prev=GHOST&&GHOST.name===GREC.name?GHOST:null;let msg;
  if(prev){const d=S.t-prev.t;msg=Math.abs(d)<0.05?'Dead heat with your ghost.':d<0?'Beat your ghost by '+fmtGap(-d)+' s.':'Your ghost was '+fmtGap(d)+' s faster.';}
  else msg='Ghost saved: race it next time.';
  if(!prev||S.t<prev.t){try{ghostSave(base);}catch(e){}}   /* storage can be blocked (private mode, some embeds): never break the finish card */
  return msg;}

/* the see-through skier: primitives merged into one geometry (+z = forward, y = up, skis on y = 0) */
const ghostG=new THREE.Group();ghostG.visible=false;scene.add(ghostG);
const ghostU={uTuck:{value:0}};
(function(){
  const parts=[];const P=(g,x,y,z,rx)=>{if(rx)g.rotateX(rx);g.translate(x,y,z);parts.push(g);};
  for(const sx of [0.16,-0.16]){
    P(new THREE.BoxGeometry(0.1,0.035,1.7),sx,0.02,0.1);P(new THREE.BoxGeometry(0.1,0.035,0.22),sx,0.07,1.0,-0.5);
    P(new THREE.BoxGeometry(0.13,0.15,0.28),sx,0.1,0.02);
    P(new THREE.CylinderGeometry(0.075,0.065,0.5,7),sx,0.4,0.1,0.35);          /* shin, leaning forward */
    P(new THREE.CylinderGeometry(0.09,0.078,0.48,7),sx*0.94,0.84,0.12,-0.45);  /* thigh, hips back over the boots */
    P(new THREE.CylinderGeometry(0.05,0.042,0.32,6),sx*1.35,1.36,0.3,0.25);    /* upper arm */
    P(new THREE.CylinderGeometry(0.042,0.036,0.3,6),sx*1.5,1.2,0.44,1.35);     /* forearm, fists forward */
    P(new THREE.CylinderGeometry(0.012,0.012,1.3,4),sx*1.8,0.67,0.19,0.65);}   /* pole, tips back */
  P(new THREE.CylinderGeometry(0.16,0.13,0.62,8),0,1.28,0.15,0.5);             /* torso, folded forward */
  P(new THREE.SphereGeometry(0.125,10,8),0,1.68,0.37);                         /* helmet */
  let nv=0,ni=0;parts.forEach(g=>{nv+=g.attributes.position.count;ni+=g.index.count;});
  const pos=new Float32Array(nv*3),nor=new Float32Array(nv*3),idx=new Uint16Array(ni);let ov=0,oi=0;
  parts.forEach(g=>{pos.set(g.attributes.position.array,ov*3);nor.set(g.attributes.normal.array,ov*3);const I=g.index.array;for(let i=0;i<I.length;i++)idx[oi+i]=I[i]+ov;ov+=g.attributes.position.count;oi+=I.length;g.dispose();});
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));geo.setIndex(new THREE.BufferAttribute(idx,1));
  geo.computeBoundingSphere();geo.boundingSphere.radius+=0.4;
  /* tuck: everything above the knees folds down and forward (same uniform in both passes so the depth matches the colour) */
  const tuck=sh=>{Object.assign(sh.uniforms,ghostU);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uTuck;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\n  {float a=max(0.,transformed.y-.55);transformed.y-=a*.32*uTuck;transformed.z+=a*.42*uTuck;}');};
  const depthM=new THREE.MeshBasicMaterial({colorWrite:false,transparent:true});depthM.onBeforeCompile=tuck;depthM.customProgramCacheKey=()=>'ghostD1';
  const colM=new THREE.MeshLambertMaterial({color:0x46b8ff,emissive:0x124f8c,transparent:true,opacity:0.6,depthWrite:false});
  colM.onBeforeCompile=sh=>{tuck(sh);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying float vRim;').replace('#include <project_vertex>','#include <project_vertex>\n  vRim=pow(1.-abs(dot(normalize(transformedNormal),normalize(-mvPosition.xyz))),2.);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vRim;').replace('#include <tonemapping_fragment>','gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.82,.96,1.),vRim*.75);gl_FragColor.a=min(1.,gl_FragColor.a*(1.+1.3*vRim));\n#include <tonemapping_fragment>');};
  colM.customProgramCacheKey=()=>'ghostC1';
  const d=new THREE.Mesh(geo,depthM),c=new THREE.Mesh(geo,colM);d.renderOrder=20;c.renderOrder=21;ghostG.add(d,c);ghostG.userData.mat=colM;})();
/* a small marker over the ghost's head, constant size on screen and drawn over everything, so you can find it 50 m down the hill */
const PIN_TEX={};
const ghostPin=(function(){const mk=fill=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  g.lineJoin='round';g.beginPath();g.moveTo(9,13);g.lineTo(55,13);g.lineTo(32,52);g.closePath();
  g.shadowColor='rgba(0,20,40,.45)';g.shadowBlur=5;g.lineWidth=7;g.strokeStyle='#fff';g.stroke();g.shadowBlur=0;g.fillStyle=fill;g.fill();return new THREE.CanvasTexture(c);};
  const t=PIN_TEX.blue=mk('#46b8ff');PIN_TEX.gold=mk('#ffb31f');const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,depthWrite:false,transparent:true,sizeAttenuation:false,fog:false}));
  sp.scale.set(0.034,0.034,1);sp.renderOrder=22;sp.visible=false;scene.add(sp);return sp;})();
const _gq=new THREE.Quaternion(),_gq2=new THREE.Quaternion(),_gn=new THREE.Vector3(),_gf=new THREE.Vector3(),_gR=new THREE.Vector3(),_gm=new THREE.Matrix4(),_ge=new THREE.Euler();
function lerpA(a,b,u){return a+wrapA(b-a)*u;}
/* place the ghost at run time tv (seconds on the clock) */
function ghostFrame(tv,dt){
  const G=GHOST;if(!G||(S.state!=='ride'&&S.state!=='finishing')||S.pre){ghostG.visible=ghostPin.visible=false;return;}
  if(S.state==='finishing'){ghostTf+=dt;tv=S.t+ghostTf;}   /* your clock stopped at the base; the ghost keeps skiing */
  const f=clamp(tv*GH_HZ,0,G.n-1),i=Math.min(G.n-2,Math.floor(f)),u=f-i;
  const x=G.X[i]+(G.X[i+1]-G.X[i])*u,z=G.Z[i]+(G.Z[i+1]-G.Z[i])*u,th=lerpA(G.TH[i],G.TH[i+1],u),air=G.A[i]+(G.A[i+1]-G.A[i])*u;
  const ln=G.LE[i]+(G.LE[i+1]-G.LE[i])*u,cr=G.CR[i]+(G.CR[i+1]-G.CR[i])*u,fl=lerpA(G.FL[i],G.FL[i+1],u),sp=lerpA(G.SP[i],G.SP[i+1],u);
  const gy=H(x,z);ghostG.position.set(x,gy+air+0.02,z);
  /* stand on the slope like the skier does (half as much in the air), then spin, flip and lean */
  const g=grad(x,z),k=air>0.3?0.5:1;_gn.set(-g[0]*k,1,-g[1]*k).normalize();_gf.set(Math.sin(th),0,Math.cos(th));_gf.addScaledVector(_gn,-_gf.dot(_gn)).normalize();
  _gR.crossVectors(_gn,_gf).normalize();_gm.makeBasis(_gR,_gn,_gf);_gq.setFromRotationMatrix(_gm);
  _gq2.setFromAxisAngle(_yA,sp);_gq.multiply(_gq2);_gq2.setFromAxisAngle(_xA,fl);_gq.multiply(_gq2);_ge.set(0,0,ln);_gq2.setFromEuler(_ge);_gq.multiply(_gq2);
  ghostG.quaternion.copy(_gq);ghostU.uTuck.value=sstep(0.45,1,cr);
  /* fade: near the camera (don't fill the screen), when it's on top of you, and after it finishes */
  const dc=camera.position.distanceTo(ghostG.position),dp=Math.hypot(x-S.x,z-S.z);
  const a=0.62*sstep(2.2,6,dc)*(0.45+0.55*sstep(0.8,3,dp))*(1-sstep(G.dur,G.dur+1.2,tv));
  ghostG.userData.mat.opacity=a;ghostG.visible=a>0.01;
  const pa=sstep(6,12,dp)*(1-sstep(G.dur,G.dur+1.2,tv));ghostPin.material.opacity=pa;ghostPin.visible=pa>0.01;ghostPin.position.set(x,gy+air+2.35,z);}
/* gap to the ghost: + behind, - ahead. Searches a window along its line near the last match, or the whole line after you've been off it. */
function ghostGap(){const G=GHOST;if(!G)return null;
  const lo=G.off?0:Math.max(0,G.gi-10),hi=G.off?G.n-1:Math.min(G.n-1,G.gi+80);let bj=lo,bd=1e18;
  for(let j=lo;j<=hi;j++){const dx=G.X[j]-S.x,dz=G.Z[j]-S.z,d=dx*dx+dz*dz;if(d<bd){bd=d;bj=j;}}
  if(bd>25*25){G.off=true;return null;}
  G.off=false;G.gi=bj;let best=bj,bu=0,bd2=1e18;
  for(const a of [bj-1,bj]){if(a<0||a>=G.n-1)continue;const ax=G.X[a],az=G.Z[a],sx=G.X[a+1]-ax,sz=G.Z[a+1]-az,l2=sx*sx+sz*sz;if(l2<1e-6)continue;
    const u=clamp(((S.x-ax)*sx+(S.z-az)*sz)/l2,0,1),px=ax+sx*u-S.x,pz=az+sz*u-S.z,d=px*px+pz*pz;if(d<bd2){bd2=d;best=a;bu=u;}}
  return S.t-(best+bu)/GH_HZ;}
let _gapS='',_gapC='',_gapEl=null,_gapV=null;
function ghostHud(dt){const el=_gapEl||(_gapEl=$('gap'));let s='',c='';
  if(GHOST&&S.state==='ride'&&!S.pre){
    if(S.t<2.5){s=(RUN.chal?'Beat ':'Ghost ')+fmt(GHOST.t);c='g0';}
    else{ghostGapT-=dt;if(ghostGapT<=0){ghostGapT=0.2;_gapV=ghostGap();}
      if(_gapV!==null){const v=_gapV;s=(v<0?'−':'+')+fmtGap(Math.abs(v));c=Math.abs(v)<0.05?'g0':(v<0?'ga':'gb');}}}
  else _gapV=null;
  if(s!==_gapS||c!==_gapC){_gapS=s;_gapC=c;el.textContent=s;el.className=s?c:'hidden';}}
window.__kr.ghost={pin:ghostPin,rec:GREC,get g(){return GHOST},load:ghostLoad,decode:ghostDecode,gap:ghostGap,group:ghostG,clear:()=>{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith(GH_KEY))localStorage.removeItem(k);}GHOST=null;}};

/* ---------- challenge links: share a run as a URL that loads it as the ghost ----------
   The 10 Hz recording is cut to 5 Hz (3.3 Hz past 2.5 min, 2.5 Hz past 5 min) and packed as 4-bit groups: position at 10 cm as
   the miss against a constant-velocity guess, heading as a change in 64ths of a turn (zig-zag, variable length), then tuck, air,
   trick and lean fields. A header carries the trail, lift top, base, time, top speed and start point, and a checksum catches links
   that a messaging app cut short. Superstar (~50 s) is about 1 KB of link. On the other end the line is upsampled back to 10 Hz
   (Catmull-Rom), so replay and the HUD gap work exactly as for your own ghost. */
const SHARE_URL='https://kcq101.github.io/GrindTimeSki/',CH_TAG='#c1.';
let PEND_CHAL=null;
function grecGhost(){return GREC.n>=2?ghostBytes(GREC.buf.subarray(0,GREC.n*GH_B),GREC.x0,GREC.z0,GREC.name,S.t,''):null;}
function b64url(u8){return ghostB64(u8).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function chalEncode(base,topMph,topName){const G=grecGhost();if(!G||!base)return null;
  const n=G.n,dur=(n-1)/GH_HZ,p=dur<=150?2:dur<=300?3:4,m=Math.floor((n-1)/p)+1;if(m<3)return null;
  const nb=[],uv=v=>{do{let b=v&7;v=Math.floor(v/8);if(v)b|=8;nb.push(b);}while(v);},sv=v=>uv(v<0?-2*v-1:2*v);
  const q=a=>Math.round(a*10),qx0=q(G.X[0]),qz0=q(G.Z[0]),qa=a=>Math.round(wrapA(a)/(2*Math.PI)*64);let px=qx0,pz=qz0,ppx=qx0,ppz=qz0,qh=qa(G.TH[0]);const qh0=(qh+64)%64;
  for(let k=0;k<m;k++){const i=k*p;
    if(k>0){const tx=q(G.X[i]),tz=q(G.Z[i]),ex=k>1?2*px-ppx:px,ez=k>1?2*pz-ppz:pz;sv(tx-ex);sv(tz-ez);ppx=px;ppz=pz;px=tx;pz=tz;
      const d=((qa(G.TH[i])-qh)%64+96)%64-32;sv(d);qh+=d;}
    const air=G.A[i]>0.05,trk=air&&(Math.abs(G.FL[i])>0.2||Math.abs(G.SP[i])>0.2);
    nb.push(Math.round(clamp(G.CR[i],0,1)*3)|(air?4:0)|(trk?8:0),clamp(Math.round(G.LE[i]*10),-7,7)+8);
    if(air)uv(Math.round(G.A[i]*4));
    if(trk)nb.push(Math.round(wrapA(G.FL[i])/Math.PI*8)&15,Math.round(wrapA(G.SP[i])/Math.PI*8)&15);}
  const te=new TextEncoder(),out=[],b=v=>out.push(v&255),b24=v=>{b(v);b(v>>8);b(v>>16);},str=s=>{const u=te.encode(String(s||'')).subarray(0,255);b(u.length);u.forEach(b);};
  b(1);b(p);b24(Math.round(S.t*100));b24(qx0);b24(qz0);b(qh0);b(clamp(Math.round(topMph||0),0,255));b(m);b(m>>8);
  str(GREC.name);str(topName);str(base.id);str(base.name);
  for(let i=0;i<nb.length;i+=2)b(nb[i]<<4|(nb[i+1]||0));
  let sum=0;out.forEach(v=>sum=(sum+v)&255);b(sum);
  return SHARE_URL+CH_TAG+b64url(Uint8Array.from(out));}
function chalDecode(s){try{
  s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  if(u.length<24)return {err:'cut'};let sum=0;for(let i=0;i<u.length-1;i++)sum=(sum+u[i])&255;if(sum!==u[u.length-1])return {err:'cut'};
  let o=0;const td=new TextDecoder(),u8=()=>u[o++],u24=()=>u8()|u8()<<8|u8()<<16,i24=()=>{const v=u24();return v&0x800000?v-0x1000000:v;},str=()=>{const L=u8(),t=td.decode(u.subarray(o,o+L));o+=L;return t;};
  if(u8()!==1)return {err:'version'};
  const p=u8(),t=u24()/100,qx0=i24(),qz0=i24(),qh0=u8(),topMph=u8(),m=u8()|u8()<<8,name=str(),top=str(),bid=str(),bname=str();
  if(!(p>=1&&p<=10)||m<3)return {err:'cut'};
  const end=u.length-1;let ni=o*2;const nib=()=>{if(ni>=end*2)throw new Error('short');const v=u[ni>>1];return (ni++&1)?v&15:v>>4;};
  const uv=()=>{let v=0,s=1,b;do{b=nib();v+=(b&7)*s;s*=8;}while(b&8);return v;},sv=()=>{const v=uv();return v&1?-(v+1)/2:v/2;};
  const L=ghostArrs(m);let px=qx0,pz=qz0,ppx=qx0,ppz=qz0,qh=qh0;
  for(let k=0;k<m;k++){
    if(k>0){const ex=k>1?2*px-ppx:px,ez=k>1?2*pz-ppz:pz,tx=ex+sv(),tz=ez+sv();ppx=px;ppz=pz;px=tx;pz=tz;qh+=sv();}
    L.X[k]=px/10;L.Z[k]=pz/10;L.TH[k]=wrapA(qh/64*2*Math.PI);
    const f=nib();L.LE[k]=(nib()-8)/10;L.CR[k]=(f&3)/3;if(f&4)L.A[k]=uv()/4;
    if(f&8){const a=nib(),c=nib();L.FL[k]=(a>7?a-16:a)/8*Math.PI;L.SP[k]=(c>7?c-16:c)/8*Math.PI;}}
  /* back to 10 Hz: Catmull-Rom through the line, straight blends for the rest */
  const n=(m-1)*p+1,G=Object.assign(ghostArrs(n),{name,t,base:bname,chal:true}),cr=(a,b,c,d,x)=>0.5*(2*b+(c-a)*x+(2*a-5*b+4*c-d)*x*x+(3*b-a-3*c+d)*x*x*x);
  for(let j=0;j<n;j++){const k=Math.min(m-2,Math.floor(j/p)),x=(j-k*p)/p,k0=Math.max(0,k-1),k3=Math.min(m-1,k+2);
    G.X[j]=cr(L.X[k0],L.X[k],L.X[k+1],L.X[k3],x);G.Z[j]=cr(L.Z[k0],L.Z[k],L.Z[k+1],L.Z[k3],x);
    G.TH[j]=lerpA(L.TH[k],L.TH[k+1],x);G.LE[j]=L.LE[k]+(L.LE[k+1]-L.LE[k])*x;G.CR[j]=L.CR[k]+(L.CR[k+1]-L.CR[k])*x;G.A[j]=L.A[k]+(L.A[k+1]-L.A[k])*x;
    G.FL[j]=lerpA(L.FL[k],L.FL[k+1],x);G.SP[j]=lerpA(L.SP[k],L.SP[k+1],x);}
  G.dur=(n-1)/GH_HZ;
  /* which trail: the one with this name that passes closest to where the clock started (survives a re-bake) */
  let tr=null,bd=1e18;for(const T of TRAILS){if(T.name!==name)continue;for(const [x,z] of T.s){const d=(x-G.X[0])**2+(z-G.Z[0])**2;if(d<bd){bd=d;tr=T;}}}
  if(!tr){const ti=trailInfo(G.X[0],G.Z[0]);tr=ti.tr;}
  if(!tr||G.X[0]<XMIN||G.X[0]>XMAX||G.Z[0]<ZMIN||G.Z[0]>ZMAX)return {err:'trail'};
  return {G,t,name,top,bid,bname,topMph,tr,p,bytes:u.length};
  }catch(e){return {err:'cut'};}}
function chalFromHash(h){if(!h||h.indexOf(CH_TAG)!==0)return null;return chalDecode(h.slice(CH_TAG.length));}
function chalOffer(){const C=PEND_CHAL;if(!C)return;PEND_CHAL=null;try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}
  const ok=!C.err;$('cName').textContent=ok?shortName(C.name):'Challenge link';$('cRoute').textContent=ok?C.top+' → '+C.bname:'';
  $('cStats').classList.toggle('hidden',!ok);$('cGo').classList.toggle('hidden',!ok);$('cNo').textContent=ok?'Not now':'OK';
  if(ok){$('cTime').textContent=fmt(C.t);$('cTop').textContent=C.topMph;$('cLen').textContent=ft(C.tr.L).toLocaleString();
    $('cMsg').textContent="A friend's run, replayed as a gold ghost from the same spot on the same clock. Ski into "+C.bname+' faster to win.';
    $('cGo').onclick=()=>startChallenge(C);}
  else $('cMsg').textContent=C.err==='trail'?"This run is on a part of the mountain this version doesn't have.":'This link looks cut off. Ask for it again, or copy the whole thing.';
  $('cNo').onclick=()=>$('chal').classList.add('hidden');$('chal').classList.remove('hidden');}
/* same start point, heading and rolling speed as the run that made the link */
function startChallenge(C){['chal','map','pick','start','finish'].forEach(i=>$(i).classList.add('hidden'));startAudio();
  fade(()=>{const G=C.G,tr=C.tr,j=Math.min(G.n-1,2);
    RUN={x:G.X[0],z:G.Z[0],th:Math.atan2(G.X[j]-G.X[0],G.Z[j]-G.Z[0])||G.TH[0],top:C.top||shortName(tr.name),name:tr.name,dest:tr.dest,tr,chal:C};
    RUN.h0=H(RUN.x,RUN.z);RUN.h1=RUN.dest?Math.min(RUN.dest.h,RUN.h0-30):RUN.h0-200;
    updateTiles(RUN.x,RUN.z,999);reset();S.v=clamp(Math.hypot(G.X[j]-G.X[0],G.Z[j]-G.Z[0])/(j/GH_HZ),2,25);S.state='ride';showHud(true);
    $('ttext').textContent=tr.name.toUpperCase();$('ticon').innerHTML=diffIcon(tr.diff);curTrail=tr.name;S.curTr=tr;S.path=[tr.name];toast('Beat '+fmt(C.t)+'!');});}
/* finish card: share this run */
function shareRun(){const base=S.endBase;if(!base)return;const url=chalEncode(base,S.top*2.237,RUN.top);if(!url)return;
  const text='Beat my '+fmt(S.t)+' down '+shortName(RUN.name)+' at Killington',btn=$('share'),done=l=>{btn.textContent=l;setTimeout(()=>btn.textContent='Challenge a friend',2200);};
  let inFrame=false;try{inFrame=window.top!==window;}catch(e){inFrame=true;}
  const copy=()=>navigator.clipboard.writeText(text+': '+url).then(()=>done('Link copied ✓'),()=>{const b=$('shareBox');b.value=url;b.classList.remove('hidden');b.focus();b.select();done('Copy the link below');});
  if(navigator.share&&!inFrame)navigator.share({title:'GrindTime Skiing challenge',text,url}).catch(e=>{if(!e||e.name!=='AbortError')copy();});
  else if(navigator.clipboard)copy();else{const b=$('shareBox');b.value=url;b.classList.remove('hidden');b.select();}}
$('share').onclick=shareRun;
PEND_CHAL=chalFromHash(location.hash);
window.addEventListener('hashchange',()=>{const C=chalFromHash(location.hash);if(C&&S.state!=='ride'){PEND_CHAL=C;chalOffer();}});
window.__kr.chal={encode:chalEncode,decode:chalDecode,fromHash:chalFromHash,start:startChallenge,offer:()=>chalOffer(),set pend(v){PEND_CHAL=v},grec:grecGhost,share:shareRun};
