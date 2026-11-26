/* ---------- compass heading strip: 1.2 px per degree, labels every 45°, ticks every 15°, laid out over -180..540 so it never runs out ---------- */
const CMP_PX=1.2,cmpT=document.getElementById('cmpT'),_cd=new THREE.Vector3();let cmpLast=1e9;
(function(){const L=['N','NE','E','SE','S','SW','W','NW'];let h='';for(let d=-180;d<=540;d+=15){const a=((d%360)+360)%360,x=((d+180)*CMP_PX).toFixed(1);
  h+=a%45===0?'<i class="'+(a===0?'n':(a%90?'mi':''))+'" style="left:'+x+'px"><b>'+L[a/45]+'</b></i>':'<i class="m" style="left:'+x+'px"></i>';}cmpT.innerHTML=h;})();
function updCompass(){camera.getWorldDirection(_cd);if(_cd.x*_cd.x+_cd.z*_cd.z<1e-6)return;
  const b=((Math.atan2(_cd.x,-_cd.z)*180/Math.PI)+360)%360;if(Math.abs(b-cmpLast)<0.15)return;cmpLast=b;   /* x = east, z = south, so north is -z */
  cmpT.style.transform='translateX('+(52-(b+180)*CMP_PX).toFixed(1)+'px)';}
/* ---------- camera ---------- */
const camPos=new THREE.Vector3(),camLook=new THREE.Vector3(),_cT=new THREE.Vector3(),_cL=new THREE.Vector3();let camTh=0;
const CAM_D=5.8,CAM_H=3.0;   /* was 8.5 → 7.0 → 5.8 (Nov 25 night: closer behind the skier) */
/* Nov 25 (Bonvo reference): a lazier chase camera. It swings round after the heading instead of locking behind the skier, so in a turn
   you see the skier's side and they drift off-centre; it sits a little lower and looks further down the hill (more slope ahead, horizon higher). */
const CAMF={yaw:1.8,lat:6,h:2.1,look:21,lookH:1.0};   /* h was 2.55: lower, flatter view */window.__camf=CAMF;
/* steadier in quick left-right turns: "wiggle" = mean |yaw rate| minus |mean yaw rate| over ~0.7 s. It is ~0 in a sustained wide
   turn (the camera follows as before) and large when the heading swings back and forth (short turns, moguls), where the camera
   follows the heading more slowly and only drifts sideways with the skier instead of tracking every swing. */
const CAMW={off:false,w:0,ya:0,ym:0,th:0,ax:0,az:0};window.__camw=CAMW;
function placeCam(snap,dt){
  if(snap){camTh=S.th;CAMW.th=S.th;CAMW.ya=CAMW.ym=CAMW.w=0;CAMW.ax=S.x;CAMW.az=S.z;}
  else{let d=S.th-CAMW.th;d=Math.atan2(Math.sin(d),Math.cos(d));CAMW.th=S.th;const yr=dt>0?d/dt:0,k1=1-Math.exp(-dt*1.5);
    CAMW.ya+=(Math.abs(yr)-CAMW.ya)*k1;CAMW.ym+=(yr-CAMW.ym)*k1;
    const wt=CAMW.off||S.air?0:clamp((CAMW.ya-Math.abs(CAMW.ym)-0.12)/0.5,0,1);CAMW.w+=(wt-CAMW.w)*(1-Math.exp(-dt*(wt>CAMW.w?4:1.2)));
    let dth=S.th-camTh;dth=Math.atan2(Math.sin(dth),Math.cos(dth));camTh+=dth*(1-Math.exp(-dt*(CAMF.yaw-0.9*CAMW.w)));
    /* anchor: exact along the view, smoothed across it */
    const fx=Math.sin(camTh),fz=Math.cos(camTh),ex=S.x-CAMW.ax,ez=S.z-CAMW.az,al=ex*fx+ez*fz,la=ex*fz-ez*fx,kl=1-Math.exp(-dt*(CAMF.lat-1.5*CAMW.w));
    CAMW.ax+=fx*al+fz*la*kl;CAMW.az+=fz*al-fx*la*kl;
    {const ex2=S.x-CAMW.ax,ez2=S.z-CAMW.az,lr=ex2*fz-ez2*fx,lc=clamp(lr,-1.6,1.6);if(lr!==lc){CAMW.ax+=fz*(lr-lc);CAMW.az-=fx*(lr-lc);}}}   /* never lets the skier drift more than ~1.6 m off the view line */
  const dx=Math.sin(camTh),dz=Math.cos(camTh),AX=CAMW.ax,AZ=CAMW.az;
  const gy0=H(S.x,S.z),y=S.air?S.y:gy0;
  const tx=AX-dx*CAM_D,tz=AZ-dz*CAM_D;let ty=Math.max(y+CAMF.h,H(tx,tz)+1.8);
  const lx=AX+dx*CAMF.look,lz=AZ+dz*CAMF.look,ly=H(lx,lz)+CAMF.lookH+(S.air?(S.y-gy0)*0.5:0);
  if(snap){camPos.set(tx,ty,tz);camLook.set(lx,ly,lz);}else{const k=1-Math.exp(-dt*6);camPos.lerp(_cT.set(tx,ty,tz),k);camLook.lerp(_cL.set(lx,ly,lz),1-Math.exp(-dt*9));}
  {const gc=H(camPos.x,camPos.z)+1.6;if(camPos.y<gc)camPos.y=gc;}
  camera.position.copy(camPos);
  if(S.shake>0){camera.position.x+=(rnd()-0.5)*S.shake*0.8;camera.position.y+=(rnd()-0.5)*S.shake*0.8;}
  camera.lookAt(camLook);
}

/* ---------- loop ---------- */
let last=performance.now(),fcount=0;
const STEP=1/60,MAX_STEPS=6;let simAcc=0,lastSim={tk:false,off:false};
const PREV={x:0,z:0,y:0,th:0,v:0},CUR={x:0,z:0,y:0,th:0,v:0};
/* on the ground S.y isn't kept up to date (it still holds the height of your last landing), so start from the snow there;
   otherwise the first frame after a takeoff blends from that old height and the skier flashes up the mountain */
function snapPrev(){PREV.x=S.x;PREV.z=S.z;PREV.y=S.air?S.y:H(S.x,S.z);PREV.th=S.th;PREV.v=S.v;}
function lerpIn(a){CUR.x=S.x;CUR.z=S.z;CUR.y=S.y||0;CUR.th=S.th;CUR.v=S.v;
  if(Math.abs(CUR.x-PREV.x)+Math.abs(CUR.z-PREV.z)>3)return;   /* teleport (reset/crash nudge): don't smear */
  S.x=PREV.x+(CUR.x-PREV.x)*a;S.z=PREV.z+(CUR.z-PREV.z)*a;if(S.air)S.y=PREV.y+(CUR.y-PREV.y)*a;S.th=PREV.th+(CUR.th-PREV.th)*a;S.v=PREV.v+(CUR.v-PREV.v)*a;}
function lerpOut(){S.x=CUR.x;S.z=CUR.z;if(S.air)S.y=CUR.y;S.th=CUR.th;S.v=CUR.v;}
function simStep(h){
  const r=physics(h);
  if(S.state==='ride'){if(!S.pre)S.t+=h;ghostTick();const b=baseHit();if(b){S.endBase=b;S.state='finishing';S.finT=0;toast(b.name.toUpperCase()+'!');}
    else if(S.x<XMIN+22||S.x>XMAX-22||S.z<ZMIN+22||S.z>ZMAX-22){S.endBase=null;S.endWhy='Edge of the map';S.state='finishing';S.finT=0;toast('Edge of the map');}}
  else{S.v*=1-h*1.6;S.finT+=h;if(S.finT>1.6){S.state='done';finish();}}
  S.shake=Math.max(0,S.shake-h);
  return r;}
/* HUD writes only when the value changes (no per-frame DOM/style churn) */
const _hud={};function setTxt(id,v){v=String(v);if(_hud[id]!==v){_hud[id]=v;$(id).textContent=v;}}
let _barP=-1;function setBar(pr){const q=Math.round(pr*400)/4;if(q!==_barP){_barP=q;$('fill').style.width=q+'%';$('dot').style.left=q+'%';}}
let _vigO=-1,_tileX=1e9,_tileZ=1e9,_tilePend=1;
/* terrain streaming gets ~2.5 ms of JS per frame (more when it falls behind); see updateTiles in 05-terrain.js */
const TILE_MS={base:2.5,behind:5};window.__tileMs=TILE_MS;
function streamTiles(){const tx=S.state==='menu'?MENU.tx:S.x+Math.sin(S.th)*60,tz=S.state==='menu'?MENU.tz:S.z+Math.cos(S.th)*60;
  if(_tilePend>0||Math.abs(tx-_tileX)+Math.abs(tz-_tileZ)>12){_tilePend=updateTiles(tx,tz,_tilePend>12?TILE_MS.behind:TILE_MS.base);_tileX=tx;_tileZ=tz;}}
/* dynamic resolution: frame time EMA, checked every 2 s */
function adaptRes(ms,dt){if(ms<80)RES.ema=RES.ema*0.94+ms*0.06;RES.t+=dt;if(RES.t<2)return;RES.t=0;
  let s=RES.scale;if(RES.ema>21&&s>RES.min+1e-3)s=Math.max(RES.min,s-0.1);else if(RES.ema<13&&s<RES.max-1e-3)s=Math.min(RES.max,s+0.05);
  if(s!==RES.scale){RES.scale=s;renderer.setPixelRatio(BASE_DPR*s);resize();RES.ema=16.7;}}
let perfOn=false,_pf={n:0,t:0,ms:0};
function perfHud(ms,dt){if(!perfOn)return;_pf.n++;_pf.t+=dt;_pf.ms+=ms;if(_pf.t<0.5)return;const i=renderer.info.render;
  $('perf').textContent=`${(_pf.n/_pf.t).toFixed(0)} fps  ${(_pf.ms/_pf.n).toFixed(1)} ms\n${i.calls} draws  ${(i.triangles/1000).toFixed(0)}k tris\nres ${RES.scale.toFixed(2)}x  (${renderer.domElement.width}x${renderer.domElement.height})`;_pf.n=0;_pf.t=0;_pf.ms=0;}
function frame(now){
  const raw=now-last,fdt=Math.min(0.1,raw/1000),dt=Math.min(0.05,raw/1000);last=now;fcount++;
  adaptRes(raw,dt);perfHud(raw,dt);
  updateChairs(dt);updCrowd(now);mapFrame(dt);
  streamTiles();
  if(S.state==='ride'||S.state==='finishing'){
    if(window.__freeze){if(window.__camHook)window.__camHook(camera,skier,S);else placeCam(true);ghostFrame(S.t,dt);return endFrame(now,dt);}   /* test hook: hold the pose for screenshots */
    /* physics runs in fixed 1/60 s steps (what it was tuned at); visuals interpolate between the last two steps */
    simAcc+=fdt;let n=0,r=lastSim;
    while(simAcc>=STEP&&n<MAX_STEPS){snapPrev();r=simStep(STEP);simAcc-=STEP;n++;if(S.state!=='ride'&&S.state!=='finishing')break;}
    if(n===MAX_STEPS)simAcc=0;lastSim=r;
    if(S.state==='done')return endFrame(now,dt);
    const al=simAcc/STEP;lerpIn(al);
    ghostFrame(S.pre?0:Math.max(0,S.t-STEP*(1-al)),dt);   /* the clock of the step being shown, so the ghost moves as smoothly as you do */
    const y=S.air?S.y:H(S.x,S.z)+0.02;const [gx,gz]=grad(S.x,S.z);
    placeShadows(gx,gz,Math.max(0,y-H(S.x,S.z)));
    alignToSlope(S.air?gx*0.5:gx,S.air?gz*0.5:gz,dt);poseSkier(y);
    addTracks();
    if(!model){rig.rotation.z=steer*0.45;rig.rotation.x=r.tk?0.55:0.15;rig.position.y=r.tk?-0.25:0;}   /* with the model, updModel sets lean, edging and leg IK */
    updModel(dt,r.tk);
    placeCam(false,dt);
    if(window.__side){const yy=skier.position.y;camera.position.set(S.x-4,yy+1,S.z+0.5);camera.lookAt(S.x,yy+0.8,S.z);}
    if(window.__camHook)window.__camHook(camera,skier,S);   /* test hook: tools/test/skier-poses.js frames the skier close up */
    {const f=64+Math.max(0,postS)*8+S.v*0.15;if(Math.abs(f-camera.fov)>0.01){camera.fov+=(f-camera.fov)*(1-Math.exp(-dt*3));camera.updateProjectionMatrix();}}
    updCompass();updBoostBtn();
    const mph=S.v*2.237;setTxt('spd',Math.round(mph));setTxt('time',S.pre?'Ski toward a sign':fmt(S.t));
    const hy=S.air?S.y:H(S.x,S.z);const ft=Math.max(0,(hy-RUN.h1)*3.281);setTxt('vert',(Math.round(ft/10)*10).toLocaleString()+' ft to go');
    const pr=clamp((RUN.h0-hy)/(RUN.h0-RUN.h1),0,1);updTrailHud();setBar(pr);
    if(wind&&actx&&(fcount&3)===0){wind.gain.setTargetAtTime(0.75*Math.min(0.45,mph/150),actx.currentTime,0.1);   /* wind 25% under the carving (Kevin, Nov 24) */windF.frequency.setTargetAtTime(SFX.on?700+mph*60:250+mph*14,actx.currentTime,0.1);}
    lerpOut();
  } else if(S.state==='lift'){
    updLift(dt);S.shake=Math.max(0,S.shake-dt);
  } else if(S.state==='done'||S.state==='pick'){
    updModel(dt,false);const t=now/1000;camera.position.set(S.x+6*Math.sin(t*0.4),H(S.x,S.z)+2.4,S.z+6*Math.cos(t*0.4));camera.lookAt(S.x,H(S.x,S.z)+1.1,S.z);
  }
  endFrame(now,dt);
}
const _hp=new THREE.Vector3();const MENU={tx:60,tz:-560};
function endFrame(now,dt){
  updSpray(dt);
  signFrame(dt);
  skyDome.position.copy(camera.position);skyMat.uniforms.uTime.value=now/1000;
  {const sp=(S.state==='ride'||S.state==='finishing')?clamp(S.v/30,0,1):0;const o=Math.round((0.45+sp*0.5)*25)/25;if(o!==_vigO){_vigO=o;$('vig').style.opacity=o;}}
  if(window.__close&&BN.head){BN.head.getWorldPosition(_hp);const a=window.__close;camera.position.set(_hp.x+Math.sin(S.th+a)*1.3,_hp.y+0.15,_hp.z+Math.cos(S.th+a)*1.3);camera.lookAt(_hp.x,_hp.y+0.05,_hp.z);}
  if(toastT>0){toastT-=dt;if(toastT<=0)toastEl.style.opacity=0;}
  if(S.state!=='ride'&&S.state!=='finishing')ghostG.visible=ghostPin.visible=false;ghostHud(dt);
  weatherFrame(dt,now);sfxFrame(dt);
  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}
function finish(){
  const base=S.endBase,key='kr_best_'+RUN.name+'>'+(base?base.id:'x');
  try{best=parseFloat(localStorage.getItem(key))||null;}catch(e){best=null;}
  const drop=Math.max(0,RUN.h0-H(S.x,S.z));SES.laps++;SES.vert+=drop*3.281;SES.runs[RUN.name]=(SES.runs[RUN.name]||0)+1;
  showHud(false);if(mixer)setMode('wave');if(wind&&actx)wind.gain.setTargetAtTime(0,actx.currentTime,0.2);
  const route=S.path.filter((n,i,a)=>i===0||n!==a[i-1]).map(shortName);
  $('fName').textContent=shortName(RUN.name)+(base?' ✓':'');$('fRoute').textContent=route.join(' → ')+' → '+(base?base.name:(S.endWhy||'Run ended'));
  $('fTime').textContent=fmt(S.t);$('fTop').textContent=Math.round(S.top*2.237);$('fCr').textContent=S.crashes;
  let msg='';if(base){if(best===null||S.t<best){if(best!==null)msg='New personal best! Old: '+fmt(best);else msg='First run in the books.';best=S.t;try{localStorage.setItem(key,String(best));}catch(e){}}else msg='Personal best: '+fmt(best);}
  else msg=ft(drop).toLocaleString()+' ft of vert.';
  {const g=ghostFinish(base);if(g)msg+=' '+g;}
  const ol=route.includes('Outer Limits')&&base&&base.id==='bear';
  $('fBest').textContent=(ol?(S.crashes===0?'The Deck goes wild! ':'The Deck jeers. '):'')+msg+(S.tricks?' · Tricks landed: '+S.tricks:'');
  $('nextK').textContent=base?'Next chair from '+base.name:'Skate to a chair';showLifts(base,'liftList');
  $('sess').textContent='Today: '+SES.laps+' run'+(SES.laps===1?'':'s')+' · '+Math.round(SES.vert).toLocaleString()+' vert ft · '+SES.chairs+' chair'+(SES.chairs===1?'':'s');
  $('finish').classList.remove('hidden');
}
window.__kr={get plantT(){return plantT},simTest(fps,secs,steerFn,sc){reset();S.state='ride';if(sc){S.x=sc.x;S.z=sc.z;S.v=sc.v;S.gyp=undefined;S.gvp=undefined;}let t=0,acc=0;const fd=1/fps;while(t<secs){steerIn=steerFn(t);postIn=t>2?1:0;acc+=Math.min(0.1,fd);while(acc>=STEP){physics(STEP);S.t+=STEP;acc-=STEP;}t+=fd;}return{z:+S.z.toFixed(1),x:+S.x.toFixed(1),v:+S.v.toFixed(2),crashes:S.crashes};},get RES(){return RES},get model(){return model},get gear(){return gear},skier,get envTex(){return envTex},POSE,S,TRAILS,LIFTS,BASES,simStep,physicsOnly:(n)=>{for(let i=0;i<n&&(S.state==='ride'||S.state==='finishing');i++){snapPrev();simStep(STEP);}return S.state;},H,Bm,trailInfo,runFromTrail,JUMPS,jumpLip,get KT(){return KT},KDd,KX,KZ,KI,KTT,KS,dropIn,showPicker,get RUN(){return RUN},MENU,updateTiles,streamTiles,buildTileSync:buildTile,dropTile,XMIN,XMAX,ZMIN,ZMAX,tiles,renderer,camera,startLift,SES,finish:()=>{S.state='done';finish();},jump,placeCam,skate,
  /* test hook: advance physics + skier visuals in lock-step at 60 Hz without rendering (headless renders are too slow for real-time pose checks) */
  stepVis(n,inp){for(let i=0;i<n&&(S.state==='ride'||S.state==='finishing');i++){const o=inp?inp(i/60,S):{};if(o.stop)break;steerIn=o.s||0;postIn=o.p||0;if(o.jump)jump();if(o.skate)skate();snapPrev();simStep(STEP);
    const y=S.air?S.y:H(S.x,S.z)+0.02,g=grad(S.x,S.z);placeShadows(g[0],g[1],Math.max(0,y-H(S.x,S.z)));alignToSlope(S.air?g[0]*0.5:g[0],S.air?g[1]*0.5:g[1],STEP);poseSkier(y);updModel(STEP,false);
    if(window.__probe&&o.log)o.log.push(window.__probe());}return S.state;},set steerIn(v){steerIn=v},get postIn(){return postIn},set postIn(v){postIn=v}};
runFromTrail(TRAILS.filter(t=>t.name==='Superstar').sort((a,b)=>b.L-a.L)[0],'Skye Peak');reset();S.state='menu';
requestAnimationFrame(frame);
updateTiles(MENU.tx,MENU.tz,999);
loadModel().then(()=>{reset();document.getElementById('loading').remove();openMap();});
