/* ---------- game state ---------- */
const SES={laps:0,vert:0,chairs:0,runs:{}};
const S={lift:null,ls:0,lt:0,x:0,z:0,th:0,v:0,t:0,top:0,crashes:0,state:'menu',cool:0,shake:0,finT:0,air:false,y:0,vy:0,boosts:0,airT:0,land:0,flip:0,spin:0,spinT:0,tricks:0,path:[],endBase:null};
const toastEl=document.getElementById('toast');let toastT=0;
function toast(msg){toastEl.textContent=msg;toastEl.style.opacity=1;toastT=1.3;}
const $=id=>document.getElementById(id);
const diffIcon=d=>d==='g'?'<div class="ci"></div>':d==='b'?'<div class="sq"></div>':d==='dd'?'<div class="dia"></div><div class="dia"></div>':'<div class="dia"></div>';
function reset(){blob.visible=true;castSh.visible=true;simAcc=0;myRide.visible=false;camera.fov=64;curTrail='';S.path=[];S.endBase=null;S.crashed=false;S.air=false;S.flip=0;S.spin=0;S.spinT=0;S.tricks=0;qAlign.identity();S.boosts=0;S.land=0;postS=0;postIn=0;clearTracks();updPips();if(mixer){crouch=0.3;setMode('ride',0);mixer.update(0.016);}
  S.x=RUN.x;S.z=RUN.z;S.gyp=undefined;S.gvp=undefined;setTxt('lblTop',RUN.top);setTxt('lblBot',RUN.dest?RUN.dest.name:'Base');S.th=RUN.th;S.v=2;S.t=0;S.top=0;S.crashes=0;S.cool=0;S.shake=0;S.finT=0;steer=0;steerIn=0;snapPrev();lerpIn(1);lerpOut();placeCam(true);}
let curTrail='';
function updTrailHud(){const t=trailInfo(S.x,S.z);if(!t.tr||t.d>t.w+6)return;const tr=t.tr;
  if(tr.name&&tr.dest&&tr.dest!==RUN.dest){RUN.dest=tr.dest;RUN.h1=Math.min(tr.dest.h,RUN.h0-30);setTxt('lblBot',tr.dest.name);}
  if(!tr.name||tr.name===curTrail)return;curTrail=tr.name;S.path.push(tr.name);
  $('ttext').textContent=curTrail.toUpperCase();$('ticon').innerHTML=diffIcon(tr.diff);if(S.state==='ride'&&S.path.length>1)toast(shortName(curTrail));}
function fmt(t){const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(1);}
function showHud(on){['top','bot','jumpBtn','invBtn','endBtn'].forEach(i=>$(i).classList.toggle('hidden',!on));$('skipBtn').classList.add('hidden');$('lookHint').classList.add('hidden');}
function fade(fn){const f=$('fade');f.style.opacity=1;setTimeout(()=>{fn();requestAnimationFrame(()=>{f.style.opacity=0;});},360);}
function thump(){if(!actx)return;[0,0.09].forEach(d=>{const t=actx.currentTime+d,o=actx.createOscillator(),g=actx.createGain();o.type='triangle';o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(45,t+0.16);g.gain.setValueAtTime(0.22,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.22);o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+0.25);});}
const mmss=t=>{t=Math.round(t);return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};
const ft=m=>Math.round(m*3.281/10)*10;
/* a run starts a few metres down the chosen trail, facing along it */
function runFromTrail(tr,top){let i=0,hm=-1e9,im=0;for(let q=0;q<tr.s.length-2&&tr.cs[q]<Math.min(150,tr.L*0.5);q++){const h=H(tr.s[q][0],tr.s[q][1]);if(h>hm+0.3){hm=h;im=q;}}
  i=im;while(i<tr.s.length-2&&tr.cs[i]-tr.cs[im]<Math.min(10,tr.L*0.08))i++;let j=i;while(j<tr.s.length-1&&tr.cs[j]-tr.cs[i]<30)j++;const p=tr.s[i],q=tr.s[j];
  RUN={x:p[0],z:p[1],th:Math.atan2(q[0]-p[0],q[1]-p[1]),top:top||shortName(tr.name),name:tr.name,dest:tr.dest,tr};RUN.h0=H(RUN.x,RUN.z);RUN.h1=RUN.dest?Math.min(RUN.dest.h,RUN.h0-30):RUN.h0-200;}
function dropIn(tr,top){$('pick').classList.add('hidden');$('start').classList.add('hidden');$('finish').classList.add('hidden');startAudio();
  fade(()=>{runFromTrail(tr,top);updateTiles(RUN.x,RUN.z,999);reset();S.state='ride';showHud(true);$('ttext').textContent=tr.name.toUpperCase();$('ticon').innerHTML=diffIcon(tr.diff);curTrail=tr.name;S.path=[tr.name];toast(shortName(tr.name));});}
/* the card at the top of a lift (or from the menu): every trail off this top, with its real length and drop */
let pickFrom=null;
function showPicker(L,fromMenu){pickFrom=fromMenu?'menu':'lift';
  $('pickK').textContent=fromMenu?'Drop in':'Top of '+L.name;$('pickH').textContent=L.top;
  const box=$('pickList');box.innerHTML='';
  L.trails.forEach((tr,i)=>{const b=document.createElement('button');b.className='lift'+(i===0?' rec':'');
    const drop=Math.max(0,tr.h0-tr.h1),to=tr.dest?' · to '+tr.dest.name:'';
    b.innerHTML='<div class="ic tico">'+diffIcon(tr.diff)+'</div><div><b>'+shortName(tr.name)+'</b><small>'+DIFF[tr.diff].label.toLowerCase()+' · '+ft(tr.L).toLocaleString()+' ft long · '+ft(drop).toLocaleString()+' ft drop'+to+'</small></div><div class="go">›</div>';
    b.onclick=()=>dropIn(tr,L.top);box.appendChild(b);});
  const tb=BASES.find(b=>b.name===L.top);if(tb)tb.L.forEach(M=>{const b=document.createElement('button');b.className='lift';
    b.innerHTML='<div class="chair" style="background:#'+M.col.toString(16).padStart(6,'0')+'">▲</div><div><b>'+M.name+'</b><small>To '+M.top+' · '+M.serves+'</small><small>Right here · '+mmss(M.real)+' ride</small></div><div class="go">›</div>';
    b.onclick=()=>startLift(M);box.appendChild(b);});
  $('pickBack').classList.toggle('hidden',!fromMenu);$('pick').classList.remove('hidden');}
/* the card at a base: its lifts first, then a few others you can skate or shuttle to */
function showLifts(base,boxId){const box=$(boxId);box.innerHTML='';
  const here=base?base.L:[],others=['ss','k1','bear','sn6','skq'].map(LIFT).filter(L=>!here.includes(L)).slice(0,base?3:5);
  [...here,...others].forEach((L,i)=>{const b=document.createElement('button');b.className='lift'+(i===0?' rec':'');
    const from=here.includes(L)?'Right here':'Skate over to '+L.base;
    b.innerHTML='<div class="chair" style="background:#'+L.col.toString(16).padStart(6,'0')+'">▲</div><div><b>'+L.name+'</b><small>To '+L.top+' · '+L.serves+'</small><small>'+from+' · '+mmss(L.real)+' ride</small></div><div class="go">›</div>';
    b.onclick=()=>startLift(L);box.appendChild(b);});}
let camSnapLift=false,lookYaw=0;
function startLift(L){
  $('finish').classList.add('hidden');$('start').classList.add('hidden');$('pick').classList.add('hidden');startAudio();
  fade(()=>{
    S.state='lift';S.lift=L;S.ls=22;S.lt=0;S.crashed=false;S.air=false;S.flip=0;S.spin=0;S.spinT=0;S.v=0;
    myChair.visible=false;myCab.visible=false;myRide=L.gond?myCab:myChair;
    gapChairs(L,S.ls);if(L.gond)myCab.userData.mat.color.setHex(L.col);else myChair.children[1].material.color.setHex(L.col);myRide.visible=true;blob.visible=false;castSh.visible=false;clearTracks();
    updateTiles(L.bx+L.dx*60,L.bz+L.dz*60,30);
    if(mixer){crouch=0.55;setMode('ride',0);}
    showHud(false);$('top').classList.remove('hidden');$('bot').classList.remove('hidden');$('skipBtn').classList.remove('hidden');$('lookHint').classList.remove('hidden');
    $('ticon').innerHTML='<span style="font-size:15px">▲</span>';$('ttext').textContent=L.name.toUpperCase();
    $('time').textContent='Real ride '+mmss(L.real)+' · '+Math.round(L.ts)+'× speed';
    setTxt('lblTop',L.base);setTxt('lblBot',L.top);
    $('spd').textContent=Math.round(L.speed*2.237);camSnapLift=true;lookYaw=0;
    setTimeout(()=>{if(S.state==='lift')$('lookHint').classList.add('hidden');},3500);
    toast(L.name);
  });
}
function updLift(dt){
  const L=S.lift;const prev=S.ls;S.ls+=L.speed*L.ts*dt;S.lt+=dt;
  for(const t of L.T)if(prev<t.s&&S.ls>=t.s){thump();S.shake=Math.max(S.shake,0.06);}
  if(S.ls>=L.len-4){unload(L);return;}
  placeChair(myRide,L,S.ls);const cy=myRide.position.y;
  S.x=myRide.position.x;S.z=myRide.position.z;S.th=L.ry;
  qAlign.setFromAxisAngle(_yA,L.ry);poseSkier(cy-2.95);rig.rotation.set(0,0,0);updModel(dt,false);
  /* camera: a few metres behind and above the chair, drag to look around */
  lookYaw+=(steerIn*1.5-lookYaw)*Math.min(1,dt*4);
  const yaw=L.ry+lookYaw,fx=Math.sin(yaw),fz=Math.cos(yaw);
  const tx=S.x-L.dx*4.6-L.px*2.8,tz=S.z-L.dz*4.6-L.pz*2.8,ty=Math.max(cy+0.9,H(tx,tz)+2.5);
  const ahead=S.ls+28,lx=S.x+fx*28,lz=S.z+fz*28,ly=(Math.abs(lookYaw)<0.4?cableY(L,Math.min(L.len,ahead)):cy)-7+postIn*6;
  if(camSnapLift){camPos.set(tx,ty,tz);camLook.set(lx,ly,lz);camSnapLift=false;}else{camPos.lerp(_cT.set(tx,ty,tz),1-Math.exp(-dt*5));camLook.lerp(_cL.set(lx,ly,lz),1-Math.exp(-dt*5));}
  camera.position.copy(camPos);if(S.shake>0)camera.position.y+=(rnd()-0.5)*S.shake;camera.lookAt(camLook);
  camera.fov+=(60-camera.fov)*Math.min(1,dt*3);camera.updateProjectionMatrix();
  const pr=clamp(S.ls/L.len,0,1);setBar(pr);
  setTxt('vert',Math.round(Math.max(0,(L.T[L.T.length-1].y-11-L.gnd(S.ls))*3.281)).toLocaleString()+' ft to top');
  if(wind&&actx){wind.gain.setTargetAtTime(0.04,actx.currentTime,0.3);windF.frequency.setTargetAtTime(300,actx.currentTime,0.3);}
}
/* step off at the top, look around, pick a trail */
function unload(L){
  if(S.state!=='lift')return;S.state='unloading';SES.chairs++;
  fade(()=>{myRide.visible=false;blob.visible=true;castSh.visible=true;
    const s=L.len+16;S.x=L.bx+L.dx*s;S.z=L.bz+L.dz*s;S.th=L.ry;S.v=0;S.air=false;S.crashed=false;
    updateTiles(S.x,S.z,999);qAlign.setFromAxisAngle(_yA,S.th);poseSkier(H(S.x,S.z)+0.02);{const [gx,gz]=grad(S.x,S.z);placeShadows(gx,gz,0);}
    if(mixer)setMode('ride',0);S.state='pick';showHud(false);showPicker(L,false);});
}
$('skipBtn').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(S.state==='lift')unload(S.lift);});
$('endBtn').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(S.state==='ride'){S.endBase=null;S.endWhy='Run ended';S.state='done';finish();}});
$('goLift').onclick=()=>{$('start').classList.add('hidden');$('pickK').textContent='K-1 Base';$('pickH').textContent='Pick a lift';showLifts(BASES[0],'pickList');$('pickBack').classList.remove('hidden');pickFrom='menu';$('pick').classList.remove('hidden');};
$('pickBack').onclick=()=>{$('pick').classList.add('hidden');$('start').classList.remove('hidden');};
$('toMenu').onclick=()=>{$('finish').classList.add('hidden');S.state='menu';showHud(false);$('start').classList.remove('hidden');};
$('perfBtn').onclick=()=>{perfOn=!perfOn;$('perf').classList.toggle('hidden',!perfOn);$('perfBtn').textContent='Performance overlay: '+(perfOn?'on':'off');};
(function(){const box=$('peakList');['ss','k1','bear','sn6','ne','skq','rh'].map(LIFT).filter(Boolean).forEach((L,i)=>{const b=document.createElement('button');b.className='lift'+(i===0?' rec':'');
  b.innerHTML='<div class="chair" style="background:#'+L.col.toString(16).padStart(6,'0')+'">▲</div><div><b>'+L.top+'</b><small>'+L.trails.slice(0,4).map(t=>shortName(t.name)+' '+DSYM[t.diff]).join(' · ')+'</small><small>Top of '+L.name+' · '+L.trails.length+' trails</small></div><div class="go">›</div>';
  b.onclick=()=>{$('start').classList.add('hidden');showPicker(L,true);};box.appendChild(b);});})();
let best=null;
$('again').onclick=()=>{$('finish').classList.add('hidden');fade(()=>{runFromTrail(RUN.tr,RUN.top);updateTiles(RUN.x,RUN.z,999);reset();S.state='ride';showHud(true);toast('Drop in!');});};
/* has the skier reached a base (or skied off the edge of the map)? */
function baseHit(){if(S.t<2)return null;const h=H(S.x,S.z);if(RUN.h0-h<25)return null;
  for(const b of BASES){let hit=Math.hypot(S.x-b.x,S.z-b.z)<b.trig;if(!hit)for(const L of b.L)if(Math.hypot(S.x-L.bx,S.z-L.bz)<45){hit=true;break;}if(hit&&(!b.mid||S.v<5))return b;}return null;}



const _gr=[0,0];function grad(x,z){_gr[0]=(H(x+0.85,z)-H(x-0.85,z))/1.7;_gr[1]=(H(x,z+0.85)-H(x,z-0.85))/1.7;return _gr;}

const qAlign=new THREE.Quaternion(),_qs=new THREE.Quaternion(),_qf=new THREE.Quaternion(),_yA=new THREE.Vector3(0,1,0),_xA=new THREE.Vector3(1,0,0),_c0=new THREE.Vector3(),_c1=new THREE.Vector3();
const TAU=Math.PI*2,FLIP_B=6.2,FLIP_F=4.4,SPIN_R=9;
function poseSkier(baseY){_qs.setFromAxisAngle(_yA,S.spin);_qf.setFromAxisAngle(_xA,S.flip);
  skier.quaternion.copy(qAlign).multiply(_qs).multiply(_qf);
  _c0.set(0,0.9,0).applyQuaternion(qAlign);_c1.set(0,0.9,0).applyQuaternion(skier.quaternion);
  skier.position.set(S.x,baseY,S.z).add(_c0).sub(_c1);}
const _n=new THREE.Vector3(),_f=new THREE.Vector3(),_r=new THREE.Vector3(),_m=new THREE.Matrix4(),_q=new THREE.Quaternion();
function alignToSlope(gx,gz,dt){
  _n.set(-gx,1,-gz).normalize();_f.set(Math.sin(S.th),0,Math.cos(S.th));_f.addScaledVector(_n,-_f.dot(_n)).normalize();
  _r.crossVectors(_n,_f).normalize();_m.makeBasis(_r,_n,_f);_q.setFromRotationMatrix(_m);qAlign.slerp(_q,1-Math.pow(0.65,(dt||1/60)*60));
}
/* ski tracks: thin compressed lines, not trenches */
const TRK=700,trackMat=new THREE.MeshBasicMaterial({color:0xb9c9db,transparent:true,opacity:0.5,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
function mkTrack(){const pos=new Float32Array(TRK*2*3);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));const idx=[];for(let i=0;i<TRK-1;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}g.setIndex(idx);g.setDrawRange(0,0);const m=new THREE.Mesh(g,trackMat);m.frustumCulled=false;scene.add(m);return{pos,g,n:0};}
const tracks=[mkTrack(),mkTrack()];let trkLX=null,trkLZ=null,trkBreak=false;
function trkPush(t,ax,ay,az,bx,by,bz){if(t.n>=TRK){t.pos.copyWithin(0,6);t.n=TRK-1;}const i=t.n*6;t.pos[i]=ax;t.pos[i+1]=ay;t.pos[i+2]=az;t.pos[i+3]=bx;t.pos[i+4]=by;t.pos[i+5]=bz;t.n++;}
function clearTracks(){tracks.forEach(t=>{t.n=0;t.g.setDrawRange(0,0);});trkLX=null;}
function addTracks(){
  if(S.crashed||S.air||S.v<0.5)return;
  if(trkLX!==null){const dd=Math.hypot(S.x-trkLX,S.z-trkLZ);if(dd<0.6)return;if(dd>2.5)trkBreak=true;}
  if(trkBreak&&trkLX!==null){tracks.forEach(t=>{if(t.n>0){const i=(t.n-1)*6;const mx=(t.pos[i]+t.pos[i+3])/2,my=(t.pos[i+1]+t.pos[i+4])/2,mz=(t.pos[i+2]+t.pos[i+5])/2;trkPush(t,mx,my,mz,mx,my,mz);}});
    const rx0=Math.cos(S.th),rz0=-Math.sin(S.th);[-0.17,0.17].forEach((o,k)=>{const cx=S.x+rx0*o,cz3=S.z+rz0*o,cy=H(cx,cz3)+0.03;trkPush(tracks[k],cx,cy,cz3,cx,cy,cz3);});}
  trkBreak=false;
  trkLX=S.x;trkLZ=S.z;const rx=Math.cos(S.th),rz=-Math.sin(S.th);const hw=0.045+Math.abs(steer)*0.03;
  [-0.17,0.17].forEach((o,k)=>{const t=tracks[k];
    const cx=S.x+rx*o,cz2=S.z+rz*o;
    const ax=cx-rx*hw,az=cz2-rz*hw,bx=cx+rx*hw,bz=cz2+rz*hw;
    trkPush(t,ax,H(ax,az)+0.03,az,bx,H(bx,bz)+0.03,bz);
    t.g.attributes.position.needsUpdate=true;t.g.setDrawRange(0,Math.max(0,(t.n-1)*6));});
}
function bail(msg){S.crashes++;S.cool=1.2;S.shake=0.5;S.air=false;updPips();if(mixer){S.crashed=true;S.v=0;setMode('fall');}else S.v=0;toast(msg);
  for(let i=0;i<40;i++)emit(S.x,H(S.x,S.z)+0.5,S.z,(rnd()-0.5)*5,rnd()*3,(rnd()-0.5)*5,0.9);}
function treeHit(gy,dt){
  S.cool-=dt;
  if(S.air&&S.y-gy>6)return;
  if(S.cool>0)return;
  const ci=Math.floor(S.x/TILE),cj=Math.floor(S.z/TILE);
  for(let a=ci-1;a<=ci+1;a++)for(let b=cj-1;b<=cj+1;b++){const tl=tiles.get(a+','+b);if(!tl)continue;
    for(const t of tl.trees){const ddx=S.x-t[0],ddz=S.z-t[1];const r=1.1*t[2]+0.3;if(ddx*ddx+ddz*ddz<r*r){
      S.crashes++;S.cool=1.2;S.shake=0.5;const sp=S.v;S.v*=0.15;if(mixer&&sp>9){S.crashed=true;S.v=0;S.air=false;updPips();setMode('fall');}
      const L=Math.hypot(ddx,ddz)||1;S.x+=ddx/L*1.2;S.z+=ddz/L*1.2;S.th+=(rnd()<0.5?-1:1)*0.9;
      toast(sp>14?'YARD SALE!':'Oof — tree!');
      for(let i=0;i<45;i++)emit(S.x,H(S.x,S.z)+0.6,S.z,(rnd()-0.5)*5,rnd()*3.5,(rnd()-0.5)*5,0.9);
      return;}}}
}
function physics(dt){
  let si=steerIn;if(keys.ArrowLeft||keys.a)si=-1;if(keys.ArrowRight||keys.d)si=1;
  let pi=postIn;if(keys.ArrowUp||keys.w)pi=invert?-1:1;if(keys.ArrowDown||keys.s)pi=invert?1:-1;
  steer+=(si-steer)*Math.min(1,dt*7);postS+=(pi-postS)*Math.min(1,dt*6);
  const tk=postS>0.5;
  if(S.crashed){S.v=0;steer=0;return {tk:false,off:false};}
  if(S.land>0)S.land-=dt;
  if(S.air){
    S.airT+=dt;S.vy-=GRAV*dt;S.y+=S.vy*dt;S.v*=1-0.03*dt;
    S.th-=steer*0.6*dt;
    if(postS<-0.55)S.flip-=FLIP_B*dt;else if(postS>0.6)S.flip+=FLIP_F*dt;
    else{const d=Math.round(S.flip/TAU)*TAU-S.flip,st=5*dt;S.flip+=Math.abs(d)<st?d:Math.sign(d)*st;}
    {const d=S.spinT-S.spin,st=SPIN_R*dt;S.spin+=Math.abs(d)<st?d:Math.sign(d)*st;}
    S.x+=Math.sin(S.th)*S.v*dt;S.z+=Math.cos(S.th)*S.v*dt;
    S.x=clamp(S.x,XMIN+8,XMAX-8);S.z=clamp(S.z,ZMIN+8,ZMAX-8);
    const gy=H(S.x,S.z);
    if(S.y<=gy){S.air=false;S.land=0.3;updPips();S.gyp=undefined;S.gvp=undefined;
      {const gvl=(H(S.x+Math.sin(S.th)*S.v*dt,S.z+Math.cos(S.th)*S.v*dt)-gy)/dt,vr=S.vy-gvl,crL=Math.max(0,postS),upL=Math.max(0,-postS);
       const lim=upL>0.3?-11:(crL>0.5?-18:-13);
       if(vr<lim){S.flip=0;S.spin=0;S.spinT=0;bail('SLAMMED!');S.y=gy;return {tk:false,off:false};}
       if(vr<-8){S.v*=1-0.15*(1-0.6*crL);S.shake=Math.max(S.shake,0.3);}}
      const fe=Math.abs(S.flip-Math.round(S.flip/TAU)*TAU),se=Math.abs(S.spinT-S.spin)+Math.abs(S.spin-Math.round(S.spin/TAU)*TAU),err=Math.max(fe,se);
      const nf=Math.round(S.flip/TAU),ns=Math.round(Math.abs(S.spinT)/TAU);
      if(err>1.0){S.flip=0;S.spin=0;S.spinT=0;bail('BAILED!');S.y=gy;return {tk:false,off:false};}
      else if(err>0.5){S.v*=0.5;S.shake=0.35;toast('Sketchy!');}
      else if(nf||ns){const fl=nf<0?(nf===-1?'Backflip':(nf===-2?'Double backflip':'Triple backflip')):(nf===1?'Front flip':(nf>1?'Double front flip':''));
        const name=(fl+(ns?(fl?' ':'')+(ns*360):'')).trim()+'!';S.tricks++;S.v=Math.min(36,S.v+2);toast(name);}
      else if(S.airT>(S.autoAir?1.4:0.9))toast(S.airT.toFixed(1)+'s AIR!');
      S.flip=0;S.spin=0;S.spinT=0;
      for(let i=0;i<20;i++)emit(S.x+(rnd()-0.5)*1,gy+0.05,S.z+(rnd()-0.5)*1,(rnd()-0.5)*3,0.4+rnd()*1.2,(rnd()-0.5)*3,0.4);}
    else{treeHit(gy,dt);S.top=Math.max(S.top,S.v);return {tk,off:false};}
  }
  const [gx,gz]=grad(S.x,S.z);
  const dx=Math.sin(S.th),dz=Math.cos(S.th);
  const along=gx*dx+gz*dz;
  const g=9.8;
  let a=-g*along/Math.sqrt(1+along*along);
  const ti=trailInfo(S.x,S.z),off=(!ti.tr||ti.d>ti.w+1)&&!inPad(S.x,S.z);
  const mu=off?0.28:0.03;
  a-=g*mu*(S.v>0.1?1:0);
  const up=Math.max(0,-postS),cr=Math.max(0,postS);
  a-=(0.0042-0.0021*cr+0.0038*up)*S.v*S.v;
  a-=0.7*up*(S.v>2?1:0);
  S.v+=a*dt;
  S.v*=1-Math.abs(steer)*0.22*dt;
  if(S.v<4&&S.state==='ride'&&!off)S.v+=1.1*dt;
  else if(S.v<2.5&&S.state==='ride'&&off)S.v+=3.2*dt;
  S.v=clamp(S.v,0,36);
  const rate=steer*(2.3-Math.min(1.25,S.v/22));
  S.th-=rate*dt;
  if(S.v<1.2&&Math.hypot(gx,gz)>0.03){let d=Math.atan2(-gx,-gz)-S.th;d=Math.atan2(Math.sin(d),Math.cos(d));S.th+=d*Math.min(1,dt*0.8);}
  S.x+=Math.sin(S.th)*S.v*dt;S.z+=Math.cos(S.th)*S.v*dt;
  S.x=clamp(S.x,XMIN+8,XMAX-8);S.z=clamp(S.z,ZMIN+8,ZMAX-8);

  /* terrain reactions: get bucked off crests, absorb (or get ejected by) the faces of bumps */
  const gyN=H(S.x,S.z);
  if(S.gyp!==undefined&&dt>0.001){const gv=(gyN-S.gyp)/dt;
    if(S.gvp!==undefined){const ga=(gv-S.gvp)/dt,cr=Math.max(0,postS);
      if(ga<-GRAV*2.4&&S.v>10&&S.gvp<-1&&H(S.x+Math.sin(S.th)*S.v*0.15,S.z+Math.cos(S.th)*S.v*0.15)<gyN+S.gvp*0.15-0.146-0.2){S.autoAir=true;S.air=true;S.y=gyN+0.02;S.vy=S.gvp;S.boosts=0;S.airT=0;S.flip=0;S.spin=0;S.spinT=0;trkBreak=true;S.gyp=undefined;S.gvp=undefined;updPips();S.top=Math.max(S.top,S.v);return {tk,off};}
      if(ga>55&&S.v>7){const jolt=(ga-55)/100;S.v*=1-Math.min(0.2,jolt*0.09*(1-0.75*cr));S.shake=Math.max(S.shake,Math.min(0.22,jolt*0.07));S.land=Math.max(S.land,0.14);
        if(ga>230&&cr<0.3&&S.v>15&&S.cool<=0){S.gyp=undefined;S.gvp=undefined;bail('EJECTED!');return {tk:false,off};}}}
    S.gvp=gv;}
  S.gyp=gyN;

  treeHit(H(S.x,S.z),dt);

  if(Math.abs(steer)>0.25&&S.v>5&&!off){const y=H(S.x,S.z);const sd=steer>0?1:-1;const n=Math.min(5,1+Math.floor(Math.abs(steer)*S.v/6));for(let i=0;i<n;i++){const o=0.3+rnd()*0.25,sp=1+rnd()*1.6*Math.abs(steer);emit(S.x+Math.cos(S.th)*sd*o-Math.sin(S.th)*(rnd()*0.8),y+0.06,S.z-Math.sin(S.th)*sd*o-Math.cos(S.th)*(rnd()*0.8),Math.cos(S.th)*sd*sp+Math.sin(S.th)*S.v*0.15,0.3+rnd()*0.9,-Math.sin(S.th)*sd*sp+Math.cos(S.th)*S.v*0.15,0.35+rnd()*0.15);}}
  if(off&&S.v>4){for(let i=0;i<2;i++)emit(S.x+(rnd()-0.5)*0.6,H(S.x,S.z)+0.1,S.z+(rnd()-0.5)*0.6,(rnd()-0.5)*1.6,0.8+rnd()*1.2,(rnd()-0.5)*1.6,0.5);}

  S.top=Math.max(S.top,S.v);
  return {tk,off};
}

