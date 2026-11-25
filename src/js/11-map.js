/* ---------- start screen: a live 3D trail map of the mountain ----------
   Trails are draped on the terrain in their difficulty colours, lifts in red. Pins sit on the seven peaks and five bases.
   Drag to orbit, pinch (or wheel) to zoom, tap a pin: the camera flies there and a bottom sheet offers the trails or lifts. */
const MAP_HOME={yaw:2.04,pitch:0.49,dist:7300,tx:300,tz:-700};   /* from the north-east over Snowshed: K-1 Base centre, Killington Peak, Skye Peak and Snowdon behind (Kevin's pick) */
const MAP={...MAP_HOME,goal:null,sel:null,on:false,pins:[]};
/* draped ribbons: one merged mesh, visible only on the map */
const mapLayer=(function(){
  const P=[],C=[],I=[],col={g:new THREE.Color(0x2fb34a),b:new THREE.Color(0x2463e6),k:new THREE.Color(0x111111),dd:new THREE.Color(0x111111),lift:new THREE.Color(0xd8342a)};
  const lift=(x,z)=>Math.max(H(x,z),Bm(x,z))+5;
  function ribbon(pts,half,c){const base=P.length/3,n=pts.length;
    for(let i=0;i<n;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,px=-dz/l*half,pz=dx/l*half;
      for(const sd of [-1,1]){const x=pts[i][0]+px*sd,z=pts[i][1]+pz*sd;P.push(x,lift(x,z),z);C.push(c.r,c.g,c.b);}
      if(i>0){const k=base+i*2;I.push(k-2,k,k-1,k-1,k,k+1);}}}
  TRAILS.forEach(tr=>{if(!tr.name||tr.L<60)return;const s=tr.s,pts=[];for(let i=0;i<s.length;i+=4)pts.push(s[i]);if(pts[pts.length-1]!==s[s.length-1])pts.push(s[s.length-1]);
    ribbon(pts,tr.k===1?5:7.5,col[tr.diff]||col.b);});
  LIFTS.forEach(L=>{const pts=[],n=Math.max(2,Math.ceil(L.len/30));for(let i=0;i<=n;i++)pts.push([L.bx+L.dx*L.len*i/n,L.bz+L.dz*L.len*i/n]);ribbon(pts,4,col.lift);});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-40,side:THREE.DoubleSide}));
  m.renderOrder=2;m.visible=false;m.frustumCulled=false;scene.add(m);return m;})();

/* pins: peaks (top of a lift) and the bottom-of-the-mountain bases */
const ftOf=m=>Math.round(m*3.281/10)*10;
[['ss','Skye Peak'],['k1','Killington Peak'],['bear','Bear Mountain'],['sn6','Snowdon'],['ne',"Needle's Eye"],['skq','Skye Peak east'],['rh','Ramshead Peak']].forEach(([id,label])=>{
  const L=LIFT(id);if(!L)return;
  /* the view for this peak: from down the fall line of its trails, looking back up, centred a third of the way down */
  let ex=0,ez=0;L.trails.forEach(t=>{const e=t.s[Math.min(t.s.length-1,Math.floor(t.s.length*0.6))];ex+=e[0];ez+=e[1];});ex/=L.trails.length||1;ez/=L.trails.length||1;
  const vx=ex-L.tx,vz=ez-L.tz;
  MAP.pins.push({kind:'peak',id,label,L,x:L.tx,z:L.tz,y:H(L.tx,L.tz)+8,pri:2,view:{yaw:Math.atan2(vx,vz),tx:L.tx+vx*0.4,tz:L.tz+vz*0.4}});});
['k1','shs','rh','bear','sky1'].forEach(id=>{const b=BASES.find(b=>b.id===id);if(!b||!b.L.length)return;
  /* the view for a base: from below it, looking up its lifts */
  let ux=0,uz=0;b.L.forEach(L=>{ux+=L.tx-L.bx;uz+=L.tz-L.bz;});
  MAP.pins.push({kind:'base',id:'b-'+id,label:b.name,b,x:b.x,z:b.z,y:H(b.x,b.z)+6,pri:1,view:{yaw:Math.atan2(-ux,-uz),tx:b.x+ux/b.L.length*0.3,tz:b.z+uz/b.L.length*0.3}});});
const pinBox=$('pins');
MAP.pins.forEach(p=>{const e=document.createElement('button');e.className='pin '+p.kind;e.dataset.id=p.id;
  e.innerHTML=p.kind==='peak'?'<b>'+p.label+'</b><small>'+ftOf(p.L.ht).toLocaleString()+' ft</small>':'<i>▲</i><b>'+p.label+'</b>';
  pinBox.appendChild(e);p.el=e;p.w=0;p.h=0;});

/* the bottom sheet */
function trailChip(t){return '<span class="chip">'+diffIcon(t.diff)+shortName(t.name)+'</span>';}
function sheetIdle(){if(S.state==='paused'){sheetPaused();return;}$('sheet').innerHTML='<div class="k">Killington, Vermont · the real mountain</div><h1>Where are you dropping in?</h1>'+
  '<p>Tap a peak to drop in, or a base to ride a lift. Drag to look around, pinch to zoom.</p>'+
  '<div class="row"><button class="btn alt" id="mapList">☰ All peaks</button><button class="btn alt" id="mapHow">How to play</button></div>'+
  '<p class="attr">Terrain: USGS 3DEP. Trails &amp; lifts: © OpenStreetMap contributors (ODbL).</p>';
  $('mapList').onclick=$('mapHow').onclick=()=>{$('map').classList.add('hidden');$('start').classList.remove('hidden');};}
/* paused mid-run: where you are, and the way back to the run */
function sheetPaused(){const sh=$('sheet'),pre=S.pre;
  sh.innerHTML='<button class="x" id="sheetX" aria-label="Keep skiing">✕</button><div class="k">Paused · '+(pre?'top of '+pre.name:fmt(S.t)+' on the clock')+'</div><h1>'+(pre?pre.top:shortName(RUN.name))+'</h1>'+
    '<p>The red dot is you. Pinch to zoom and drag to look around; tap a peak or base to plan where to go next.</p>'+
    '<button class="btn" id="sheetResume">▶ Keep skiing</button>'+(pre?'':'<button class="btn alt" id="sheetEnd">End run here</button>')+
    '<p class="attr">Terrain: USGS 3DEP. Trails &amp; lifts: © OpenStreetMap contributors (ODbL).</p>';
  $('sheetX').onclick=$('sheetResume').onclick=()=>resumeGame();
  if(!pre)$('sheetEnd').onclick=()=>{$('map').classList.add('hidden');$('mapPause').classList.add('hidden');S.endBase=null;S.endWhy='Run ended';S.state='done';finish();};}
function sheetFor(p){const sh=$('sheet');
  if(p.kind==='peak'){const L=p.L,tr=L.trails;
    sh.innerHTML='<button class="x" id="sheetX" aria-label="Back to the map">✕</button><div class="k">Top of '+L.name+' · '+ftOf(L.ht).toLocaleString()+' ft</div><h1>'+p.label+'</h1>'+
      '<div class="chips">'+tr.slice(0,6).map(trailChip).join('')+(tr.length>6?'<span class="chip more">+'+(tr.length-6)+' more</span>':'')+'</div>'+
      '<button class="btn" id="sheetRide">▲ Ride up from '+L.base+' · '+mmss(L.real)+'</button>'+
      '<button class="btn alt" id="sheetGo">Or pick a trail · '+tr.length+' from here ›</button>'+
      '<p class="attr">Trails &amp; lifts: © OpenStreetMap contributors (ODbL).</p>';
    $('sheetGo').onclick=()=>leaveRun('pick a trail',()=>{$('map').classList.add('hidden');showPicker(L,true);});
    $('sheetRide').onclick=()=>leaveRun('ride '+shortLift(L),()=>startLift(L));
  }else{const b=p.b;
    sh.innerHTML='<button class="x" id="sheetX" aria-label="Back to the map">✕</button><div class="k">Base area · '+b.L.length+' lift'+(b.L.length>1?'s':'')+'</div><h1>'+b.name+'</h1><div id="sheetLifts"></div>'+
      '<p class="attr">Trails &amp; lifts: © OpenStreetMap contributors (ODbL).</p>';
    const box=$('sheetLifts');b.L.forEach(L=>{const e=document.createElement('button');e.className='lift';
      e.innerHTML='<div class="chair" style="background:#'+L.col.toString(16).padStart(6,'0')+'">▲</div><div><b>'+L.name+'</b><small>To '+L.top+' · '+L.serves+'</small><small>'+mmss(L.real)+' ride</small></div><div class="go">›</div>';
      e.onclick=()=>leaveRun('ride '+shortLift(L),()=>startLift(L));box.appendChild(e);});}
  $('sheetX').onclick=()=>mapSelect(null);}
const shortLift=L=>L.name.replace(/ (Express|Quad|Triple|Double|Six|Chair|Gondola|Stage 1)\b.*$/,'').trim()||L.name;
function mapSelect(id){const p=MAP.pins.find(q=>q.id===id)||null;MAP.sel=p;
  MAP.pins.forEach(q=>q.el.classList.toggle('sel',q===p));
  if(p){MAP.goal={...p.view,dist:3600,pitch:0.72};sheetFor(p);}
  else{MAP.goal={...MAP_HOME,yaw:MAP.yaw};sheetIdle();}}
function openMap(){S.state='menu';$('mapPause').classList.add('hidden');$('confirm').classList.add('hidden');$('mapTop').classList.remove('hidden');showHud(false);['start','pick','finish'].forEach(i=>$(i).classList.add('hidden'));$('map').classList.remove('hidden');
  if(MAP.sel)sheetFor(MAP.sel);else sheetIdle();}
function mapShown(){return (S.state==='menu'||S.state==='paused')&&!$('map').classList.contains('hidden');}
/* pause: open the map on the skier, seen from behind and above, with the selection cleared */
function mapPause(){MAP.sel=null;MAP.pins.forEach(q=>q.el.classList.remove('sel'));$('confirm').classList.add('hidden');
  const fx=Math.sin(S.th),fz=Math.cos(S.th);MAP.goal={yaw:Math.atan2(-fx,-fz),pitch:0.8,dist:1500,tx:S.x+fx*250,tz:S.z+fz*250};
  $('mapPause').classList.remove('hidden');$('mapTop').classList.add('hidden');$('mapPauseT').textContent='Paused · '+(S.pre?S.pre.top:shortName(RUN.name)+' · '+fmt(S.t));
  $('map').classList.remove('hidden');sheetPaused();}

/* camera: orbit around a target; the sheet covers the bottom, so the view centre sits a little high */
let _mapFog=false;
function mapCam(dt){
  if(MAP.goal){const g=MAP.goal,k=1-Math.exp(-dt*3);let done=true;
    for(const key in g){let d=g[key]-MAP[key];if(key==='yaw')d=Math.atan2(Math.sin(d),Math.cos(d));MAP[key]+=d*k;if(Math.abs(d)>(key==='dist'||key==='tx'||key==='tz'?1:0.002))done=false;}
    if(done)MAP.goal=null;}
  const cp=Math.cos(MAP.pitch),ty=Bm(MAP.tx,MAP.tz);
  let cx=MAP.tx+Math.sin(MAP.yaw)*cp*MAP.dist,cz=MAP.tz+Math.cos(MAP.yaw)*cp*MAP.dist,cy=ty+Math.sin(MAP.pitch)*MAP.dist;
  cy=Math.max(cy,Bm(cx,cz)+120);
  if(camera.fov!==50){camera.fov=50;camera.updateProjectionMatrix();}
  const w=window.innerWidth,h=window.innerHeight;camera.setViewOffset(w,h,0,Math.round(h*0.17),w,h);
  camera.position.set(cx,cy,cz);camera.lookAt(MAP.tx,ty,MAP.tz);camera.updateMatrixWorld();
}
const _pv=new THREE.Vector3();
function mapPins(){const w=window.innerWidth,h=window.innerHeight,top=56,bot=h-$('sheet').offsetHeight-8,placed=[];
  const order=MAP.pins.slice().sort((a,b)=>(b===MAP.sel)-(a===MAP.sel)||b.pri-a.pri);
  for(const p of order){_pv.set(p.x,p.y,p.z).project(camera);const e=p.el;
    const sx=(_pv.x+1)/2*w,sy=(1-_pv.y)/2*h;
    if(_pv.z>1||sx<-20||sx>w+20||sy<top||sy>bot){e.style.display='none';continue;}
    e.style.display='';if(!p.w){p.w=e.offsetWidth;p.h=e.offsetHeight;}
    const lx=clamp(sx,p.w/2+4,w-p.w/2-4),r=[lx-p.w/2,sy-p.h-10,lx+p.w/2,sy];let hit=false;for(const q of placed)if(r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1]){hit=true;break;}
    e.classList.toggle('mini',hit);if(!hit)placed.push(r);
    e.style.transform='translate('+(hit?sx:lx).toFixed(1)+'px,'+sy.toFixed(1)+'px) translate(-50%,-100%)';}}
/* the blinking "You" marker while paused */
const youEl=$('youPin');let youOn=false;
function youPin(on){if(on!==youOn){youOn=on;youEl.classList.toggle('hidden',!on);}if(!on)return;
  _pv.set(S.x,H(S.x,S.z)+4,S.z).project(camera);const w=window.innerWidth,h=window.innerHeight;
  youEl.style.transform='translate('+((_pv.x+1)/2*w).toFixed(1)+'px,'+((1-_pv.y)/2*h).toFixed(1)+'px)';youEl.style.visibility=_pv.z>1?'hidden':'';}
function mapFrame(dt){
  const on=mapShown();
  if(on!==MAP.on){MAP.on=on;mapLayer.visible=on;lowHoleOff=on;lowU.uHole.value.z=on?0:LOW_HOLE;scene.fog.near=on?3500:300;scene.fog.far=on?14000:3800;camera.far=on?16000:6000;
    if(!on){camera.clearViewOffset();camera.fov=64;}camera.updateProjectionMatrix();}
  /* the map is the whole-mountain mesh plus ribbons; streamed tiles (detail + trees) would show as square patches, so hide them */
  if(on)for(const t of tiles.values()){t.mesh.visible=false;if(t.low)t.low.visible=false;}
  else if(MAP.tilesHidden)for(const t of tiles.values()){t.mesh.visible=true;if(t.low)t.low.visible=true;}
  MAP.tilesHidden=on;
  if(on){mapCam(dt);mapPins();}
  youPin(on&&S.state==='paused');
}

/* gestures on the map (the sheet scrolls and takes its own taps) */
{const el=$('map'),ptr=new Map();let tap=null,pinch=null;
  const span=()=>{const [a,b]=[...ptr.values()];return Math.hypot(a.x-b.x,a.y-b.y)||1;};
  el.addEventListener('pointerdown',e=>{if(e.target.closest('#sheet'))return;e.preventDefault();ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});try{el.setPointerCapture(e.pointerId);}catch(err){}
    if(ptr.size===1)tap={x:e.clientX,y:e.clientY,t:performance.now(),pin:e.target.closest('.pin')};else{tap=null;pinch={d:span(),dist:MAP.dist};}});
  el.addEventListener('pointermove',e=>{const p=ptr.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    if(ptr.size===1){if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>9)tap=null;if(!tap){MAP.goal=null;MAP.yaw-=dx*0.006;MAP.pitch=clamp(MAP.pitch+dy*0.004,0.28,1.25);}}
    else if(ptr.size===2&&pinch){MAP.goal=null;MAP.dist=clamp(pinch.dist*pinch.d/span(),700,8000);}});
  const up=e=>{if(!ptr.has(e.pointerId))return;ptr.delete(e.pointerId);if(ptr.size<2)pinch=null;
    if(tap&&e.type==='pointerup'&&performance.now()-tap.t<600){const pin=tap.pin;mapSelect(pin?pin.dataset.id:null);}tap=null;};
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  el.addEventListener('wheel',e=>{e.preventDefault();MAP.goal=null;MAP.dist=clamp(MAP.dist*Math.exp(e.deltaY*0.0012),700,8000);},{passive:false});
}
$('startBack').onclick=()=>openMap();
window.__map={MAP,select:mapSelect,open:openMap,layer:mapLayer};
