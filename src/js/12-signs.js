/* ---------- floating trail signs ----------
   At the top of a lift: one sign per trail (name + arrow in its difficulty colour), placed where the trail splits from
   its neighbours, plus arrows at the screen edge for the ones behind you. During a run: signs for every trail that
   splits off or crosses ahead of you (and one for the trail you're on), ~170 m out.
   One merged billboard mesh (one draw call); labels are redrawn into a shared canvas only when the set changes. */

/* point on a trail at arc length s */
function trailPt(tr,s){s=clamp(s,0,tr.L);let lo=0,hi=tr.cs.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(tr.cs[m]<=s)lo=m;else hi=m;}
  const a=tr.s[lo],b=tr.s[hi],L=tr.cs[hi]-tr.cs[lo],t=L>0?(s-tr.cs[lo])/L:0;return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
/* nearest point of every other trail whose surface contains (x,z): Map trail -> arc length on that trail */
function trailsUnder(x,z,not,pad){const out=new Map(),arr=segGrid.get(Math.floor(x/CELL)*100003+Math.floor(z/CELL));if(!arr)return out;
  for(const g of arr){const tr=g[4];if(tr===not)continue;const ax=g[0],az=g[1],dx=g[2]-ax,dz=g[3]-az;let t=((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz);t=t<0?0:t>1?1:t;
    const d=Math.hypot(x-ax-dx*t,z-az-dz*t);if(d>tr.w+pad)continue;const o=out.get(tr);if(!o||d<o.d)out.set(tr,{d,s:trailS(tr,g[5],t)});}
  return out;}
/* junctions: for each trail A, where other trails leave it (forks, crossings, and what A runs into at its end) */
const JN=new Map();
(function(){const raw=new Map();
  TRAILS.forEach(B=>{if(!B.name||B.L<60)return;const runs=new Map();   /* A -> {sA, sB} while B is on A's surface */
    for(let s=0;s<=B.L;s+=8){const [x,z]=trailPt(B,s),hit=trailsUnder(x,z,B,3);
      hit.forEach((o,A)=>{if(A.name===B.name)return;runs.set(A,{sA:o.s,sB:s});});
      runs.forEach((r,A)=>{if(hit.has(A))return;runs.delete(A);
        if(B.L-r.sB<60||A.L-r.sA<15)return;   /* B ends here (merges into A) or A already ended */
        if(!raw.has(A))raw.set(A,[]);raw.get(A).push({s:r.sA,tr:B,sB:r.sB});});}});
  raw.forEach((list,A)=>{list.sort((a,b)=>a.s-b.s);const groups=[];
    list.forEach(e=>{let g=groups[groups.length-1];if(!g||e.s-g.s>40){g={s:e.s,ents:[]};groups.push(g);}
      if(!g.ents.some(o=>o.tr.name===e.tr.name))g.ents.push(e);});
    groups.forEach(g=>{g.ents=g.ents.slice(0,4).map(e=>signAt(e.tr,Math.min(e.sB+12,e.tr.L-8)));
      g.cont=A.L-g.s>70?signAt(A,g.s+18):null;});
    JN.set(A,groups);});
})();
function signAt(tr,s){const [x,z]=trailPt(tr,s),[qx,qz]=trailPt(tr,s+14);return{tr,s,x,z,qx,qz,y:H(x,z)+4.6,key:tr.name+'@'+Math.round(x)+','+Math.round(z)};}
/* lift tops: each trail's sign sits where it has split from the others off the same top (25–120 m down it) */
function liftSigns(L){if(L._signs)return L._signs;const seen=new Set();
  L._signs=L.trails.filter(tr=>{if(seen.has(tr.name))return false;seen.add(tr.name);return true;}).slice(0,10).map(tr=>{let s=25;
    for(;s<Math.min(120,tr.L*0.6);s+=5){const [x,z]=trailPt(tr,s),hit=trailsUnder(x,z,tr,-2);let shared=false;hit.forEach((o,A)=>{if(A!==tr&&L.trails.includes(A))shared=true;});if(!shared)break;}
    return signAt(tr,Math.min(s,tr.L*0.6));});
  return L._signs;}

/* the shared texture: 2 × 7 label slots (512 × 128) and a row of arrows (128 × 128: green, blue, black) */
const SG_MAX=12,SG_W=1024,SG_H=1024;
const sgCanvas=document.createElement('canvas');sgCanvas.width=SG_W;sgCanvas.height=SG_H;const sgCtx=sgCanvas.getContext('2d');
const sgTex=new THREE.CanvasTexture(sgCanvas);sgTex.minFilter=THREE.LinearFilter;sgTex.generateMipmaps=false;
const SG_COL={g:'#2fae4e',b:'#2f6fe0',k:'#111',dd:'#111'},SG_AR={g:0,b:1,k:2,dd:2};
function sgIcon(g,d,x,y,r){g.lineWidth=9;g.strokeStyle='#fff';g.fillStyle=SG_COL[d];g.lineJoin='round';
  const one=(cx)=>{g.beginPath();if(d==='g')g.arc(cx,y,r,0,Math.PI*2);else if(d==='b')g.rect(cx-r*0.85,y-r*0.85,r*1.7,r*1.7);else{g.moveTo(cx,y-r*1.15);g.lineTo(cx+r*0.85,y);g.lineTo(cx,y+r*1.15);g.lineTo(cx-r*0.85,y);g.closePath();}g.stroke();g.fill();};
  if(d==='dd'){one(x-r*0.75);one(x+r*0.95);return r*3.6;}one(x);return r*2.2;}
function sgLabel(slot,tr){const x0=(slot%2)*512,y0=Math.floor(slot/2)*128,g=sgCtx;g.clearRect(x0,y0,512,128);g.save();
  g.beginPath();g.rect(x0,y0,512,128);g.clip();
  const name=shortName(tr.name);let fs=70;g.font='800 '+fs+'px -apple-system,"Segoe UI",Roboto,sans-serif';
  const iw=(tr.diff==='dd'?100:64)+14;let tw=g.measureText(name).width;if(tw>512-iw-24){fs=Math.floor(fs*(512-iw-24)/tw);g.font='800 '+fs+'px -apple-system,"Segoe UI",Roboto,sans-serif';tw=g.measureText(name).width;}
  const left=x0+(512-(iw+tw))/2;sgIcon(g,tr.diff,left+(tr.diff==='dd'?36:30),y0+64,27);
  g.textBaseline='middle';g.lineJoin='round';g.lineWidth=16;g.strokeStyle='rgba(255,255,255,.96)';g.strokeText(name,left+iw,y0+68);
  g.fillStyle=SG_COL[tr.diff];g.fillText(name,left+iw,y0+68);g.restore();}
['g','b','k'].forEach((d,i)=>{const g=sgCtx,x0=i*128,y0=896;g.save();g.translate(x0+64,y0+64);g.beginPath();
  g.moveTo(-44,-15);g.lineTo(8,-15);g.lineTo(8,-38);g.lineTo(50,0);g.lineTo(8,38);g.lineTo(8,15);g.lineTo(-44,15);g.closePath();
  g.lineJoin='round';g.lineWidth=12;g.strokeStyle='#fff';g.stroke();g.fillStyle=SG_COL[d];g.fill();g.restore();});

/* billboard mesh: label quads keep their screen size (~6 × 1.5 m at 30 m, the same on screen farther out); the arrow under
   each label turns every frame to point where the trail goes on screen */
const sgGeo=new THREE.BufferGeometry();
{const n=SG_MAX*8,idx=[];for(let q=0;q<SG_MAX*2;q++){const b=q*4;idx.push(b,b+2,b+1,b+1,b+2,b+3);}
  sgGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));sgGeo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(n*2),2));
  sgGeo.setAttribute('corner',new THREE.BufferAttribute(new Float32Array(n*2),2));sgGeo.setAttribute('kind',new THREE.BufferAttribute(new Float32Array(n),1));
  sgGeo.setAttribute('ang',new THREE.BufferAttribute(new Float32Array(n),1));sgGeo.setAttribute('yo',new THREE.BufferAttribute(new Float32Array(n),1));sgGeo.setAttribute('alpha',new THREE.BufferAttribute(new Float32Array(n),1));
  sgGeo.setIndex(idx);sgGeo.setDrawRange(0,0);}
const sgMesh=new THREE.Mesh(sgGeo,new THREE.ShaderMaterial({uniforms:{map:{value:sgTex}},transparent:true,depthTest:false,depthWrite:false,
  vertexShader:'attribute vec2 corner;attribute float kind,ang,alpha,yo;varying vec2 vUv;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);float k=max(-mv.z,16.0)/26.0;vec2 c=corner;'+
    'if(kind>0.5){float cs=cos(ang),sn=sin(ang);c=vec2(c.x*cs-c.y*sn,c.x*sn+c.y*cs)+vec2(0.0,-1.55);}mv.xy+=(c+vec2(0.0,yo))*k;gl_Position=projectionMatrix*mv;vUv=uv;vA=alpha;}',
  fragmentShader:'uniform sampler2D map;varying vec2 vUv;varying float vA;void main(){vec4 t=texture2D(map,vUv);float a=t.a*vA;if(a<0.01)discard;gl_FragColor=vec4(t.rgb,a);}'}));
sgMesh.frustumCulled=false;sgMesh.renderOrder=10;sgMesh.visible=false;scene.add(sgMesh);

let sgList=[],sgKey='';const sgFade=new Map();
function setSigns(list){const key=list.map(e=>e.key).join('|');if(key===sgKey)return;sgKey=key;sgList=list;
  const P=sgGeo.attributes.position.array,U=sgGeo.attributes.uv.array,C=sgGeo.attributes.corner.array,K=sgGeo.attributes.kind.array;
  list.forEach((e,i)=>{sgLabel(i,e.tr);const x0=(i%2)*512/SG_W,y0=Math.floor(i/2)*128/SG_H,u1=x0+512/SG_W,vt=1-y0,vb=vt-128/SG_H;
    const ax=SG_AR[e.tr.diff]*128/SG_W,au=ax+128/SG_W,avt=1-896/SG_H,avb=0;
    const quads=[[[-3,0.75,x0,vt],[3,0.75,u1,vt],[-3,-0.75,x0,vb],[3,-0.75,u1,vb]],[[-0.8,0.8,ax,avt],[0.8,0.8,au,avt],[-0.8,-0.8,ax,avb],[0.8,-0.8,au,avb]]];
    quads.forEach((q,k)=>q.forEach(([cx,cy,u,v],j)=>{const n=i*8+k*4+j;P[n*3]=e.x;P[n*3+1]=e.y;P[n*3+2]=e.z;C[n*2]=cx;C[n*2+1]=cy;U[n*2]=u;U[n*2+1]=v;K[n]=k;}));});
  ['position','uv','corner','kind'].forEach(a=>sgGeo.attributes[a].needsUpdate=true);sgTex.needsUpdate=true;sgGeo.setDrawRange(0,list.length*12);}

/* screen-edge arrows for lift-top signs you can't see */
const sgEdges=[];{const box=$('edges');for(let i=0;i<SG_MAX;i++){const d=document.createElement('div');d.className='edge hidden';d.innerHTML='<i></i><span></span>';box.appendChild(d);sgEdges.push({el:d,on:false,name:''});}}
function edgeHide(i){const e=sgEdges[i];if(e.on){e.on=false;e.el.classList.add('hidden');}}

const _sv=new THREE.Vector3(),_sq=new THREE.Vector3(),edgeQ=[];
/* the trail you're on and how far down it you are */
function curS(){const tr=S.curTr;if(!tr)return null;trailInfo(S.x,S.z);for(let q=0;q<NK&&KT[q];q++)if(KT[q]===tr){S.curS=trailS(tr,KI[q],KTT[q]);break;}return S.curS;}
function signFrame(dt){
  const live=(S.state==='ride'||S.state==='finishing');   /* paused = the trail map is up: no signs */
  let list=[];
  if(live&&S.pre)list=liftSigns(S.pre);
  else if(live&&S.curTr&&S.state!=='finishing'){const s=curS(),gs=JN.get(S.curTr);
    if(s!==null&&gs){let n=0;for(const g of gs){if(g.s<s-12)continue;if(g.s>s+170||n>=2)break;n++;
      if(n===1&&g.cont)list.push(g.cont);for(const e of g.ents)if(list.length<SG_MAX&&e.tr!==S.curTr&&!list.some(o=>o.key===e.key))list.push(e);}}}
  setSigns(list);sgMesh.visible=list.length>0;
  const showEdges=live;
  if(!list.length){for(let i=0;i<SG_MAX;i++)edgeHide(i);return;}
  camera.updateMatrixWorld();const VI=camera.matrixWorldInverse,A=sgGeo.attributes.ang.array,AL=sgGeo.attributes.alpha.array,Y=sgGeo.attributes.yo.array,w=innerWidth,h=innerHeight,placed=[];
  const order=list.map((e,i)=>[i,(e.x-camera.position.x)**2+(e.z-camera.position.z)**2]).sort((p,q)=>p[1]-q[1]).map(p=>p[0]);
  order.forEach(i=>{const e=list[i];
    _sv.set(e.x,e.y,e.z).applyMatrix4(VI);_sq.set(e.qx,H(e.qx,e.qz)+4.6,e.qz).applyMatrix4(VI);
    const dx=_sq.x-_sv.x,dy=_sq.y-_sv.y,dz=_sq.z-_sv.z,sx=-dx*_sv.z+_sv.x*dz,sy=-dy*_sv.z+_sv.y*dz,ang=Math.atan2(sy,sx);
    const dist=Math.hypot(_sv.x,_sv.y,_sv.z),goal=sstep(5,14,dist)*(S.pre?1:1-sstep(200,240,dist));
    let a=sgFade.get(e.key);a=a===undefined?0:a;a+=(goal-a)*Math.min(1,dt*4);sgFade.set(e.key,a);
    /* declutter: nearer signs keep their place; a farther one that would overlap moves up a row */
    _sq.set(e.x,e.y,e.z).project(camera);let yo=0;
    if(_sv.z<0){const U=h*0.5/(26*Math.tan(camera.fov*Math.PI/360)),sx2=_sq.x*w/2,sy2=_sq.y*h/2;   /* px per sign unit; a sign is 6 × 3.1 units with its arrow */
      for(let tries=0;tries<4;tries++){const yy=sy2+yo*U;if(!placed.some(p=>Math.abs(p.x-sx2)<6*U&&Math.abs(p.y-yy)<3.2*U))break;yo+=3.3;}
      placed.push({x:sx2,y:sy2+yo*U});}
    for(let j=0;j<8;j++){A[i*8+j]=ang;AL[i*8+j]=a;Y[i*8+j]=yo;}
    /* off-screen (or behind): an arrow on the screen edge, pointing at it */
    if(!showEdges){edgeHide(i);return;}
    _sq.set(e.x,e.y,e.z).project(camera);const behind=_sv.z>0;
    if(!S.pre&&(behind||a<0.05)){edgeHide(i);return;}   /* during a run: only splits still ahead of you */
    if(!behind&&Math.abs(_sq.x)<0.9&&Math.abs(_sq.y)<0.86){edgeHide(i);return;}
    /* which side of you it is (view-space x), and roughly how far up the screen: arrows live on the left and right edges */
    const side=_sv.x<0?-1:1,fwd=-_sv.z;
    edgeQ.push({i,e,side,y:clamp(h*0.52-(fwd/Math.max(8,Math.hypot(_sv.x,_sv.z)))*h*0.2,130,h-190),ang:Math.atan2(-(fwd/Math.hypot(_sv.x,_sv.z))*0.8,side)});});
  /* stack each side top to bottom, at least 44 px apart */
  [-1,1].forEach(sd=>{const q=edgeQ.filter(o=>o.side===sd).sort((a,b)=>a.y-b.y);for(let j=1;j<q.length;j++)q[j].y=Math.max(q[j].y,q[j-1].y+44);
    const over=q.length?q[q.length-1].y-(h-190):0;if(over>0)q.forEach(o=>o.y-=over);
    q.forEach(o=>{const E=sgEdges[o.i];if(!E.on){E.on=true;E.el.classList.remove('hidden');}
      if(E.name!==o.e.key){E.name=o.e.key;E.el.querySelector('span').textContent=shortName(o.e.tr.name);E.el.style.setProperty('--c',SG_COL[o.e.tr.diff]);}
      E.el.classList.toggle('r',sd>0);E.el.style.transform='translate('+(sd<0?22:w-22)+'px,'+o.y.toFixed(0)+'px)';E.el.querySelector('i').style.transform='rotate('+o.ang.toFixed(2)+'rad)';});});
  edgeQ.length=0;
  for(let i=list.length;i<SG_MAX;i++)edgeHide(i);
  sgGeo.attributes.ang.needsUpdate=true;sgGeo.attributes.alpha.needsUpdate=true;sgGeo.attributes.yo.needsUpdate=true;
}

/* ---------- top of the lift: step off and ski toward a sign ---------- */
/* where the lift drops you: the spot (6 m grid within 50 m of the lift top, on a trail or in the cleared area around it, outside
   the top terminal, with the chase camera clear of it too) from which the least climbing reaches the first 10 m of every trail
   off this top; ties go to the higher, then nearer, spot. Faces the first trail you can see without the terminal in the way. Computed once per lift. */
function topSpot(L){if(L._spot)return L._spot;const sg=liftSigns(L),inTerm=(x,z)=>{const a=(x-L.tx)*L.dx+(z-L.tz)*L.dz,b=(x-L.tx)*L.px+(z-L.tz)*L.pz;return a>-4&&a<20&&Math.abs(b)<10;};
  const goals=sg.map(e=>trailPt(e.tr,Math.min(10,e.tr.L*0.3)));let best=null;
  for(let gx=-48;gx<=48;gx+=6)for(let gz=-48;gz<=48;gz+=6){const r=Math.hypot(gx,gz);if(r>50)continue;const x=L.tx+gx,z=L.tz+gz;
    if(inTerm(x,z))continue;if(r>36){const t=trailInfo(x,z);if(!t.tr||t.d>t.w)continue;}
    /* face the first trail (in list order) whose direction has a clear view (nothing of the terminal in the next 20 m) and a clear camera
       spot 7 m behind; failing that, face straight away from the terminal */
    const ok=t=>{const fx=Math.sin(t),fz=Math.cos(t);if(inTerm(x-fx*7,z-fz*7))return false;for(let d=4;d<=20;d+=4)if(inTerm(x+fx*d,z+fz*d))return false;return true;};
    let th=null;for(const g of goals){if(Math.hypot(g[0]-x,g[1]-z)<4)continue;const t=Math.atan2(g[0]-x,g[1]-z);if(ok(t)){th=t;break;}}
    if(th===null){const t=Math.atan2(x-(L.tx+L.dx*8),z-(L.tz+L.dz*8));if(!ok(t))continue;th=t;}
    const h0=H(x,z);let climb=0;
    for(const [qx,qz] of goals){const n=Math.max(2,Math.ceil(Math.hypot(qx-x,qz-z)/8));let mx=-1e9;for(let i=1;i<=n;i++)mx=Math.max(mx,H(x+(qx-x)*i/n,z+(qz-z)*i/n));climb+=Math.max(0,mx-h0-0.5);}
    const score=climb*10-h0+r*0.02;if(!best||score<best.score)best={score,x,z,th};}
  if(!best){const x=L.bx+L.dx*(L.len+16),z=L.bz+L.dz*(L.len+16);best={x,z,th:L.ry};}
  L._spot=[best.x,best.z,best.th];
  /* trees within 24 m of the spot are cleared (inClear): rebuild any tile already streamed in around it */
  for(const [k,t] of [...tiles]){const [i,j]=k.split(',').map(Number),x0=i*TILE,z0=j*TILE;
    if(best.x>x0-30&&best.x<x0+TILE+30&&best.z>z0-30&&best.z<z0+TILE+30){dropTile(t);tiles.delete(k);_tilePend=Math.max(_tilePend,1);}}
  return L._spot;}
function topStart(L){
  const [x,z,th]=topSpot(L);
  RUN={x,z,th,top:L.top,name:'',dest:null,tr:null};RUN.h0=H(x,z);RUN.h1=RUN.h0-200;
  updateTiles(x,z,999);reset();_hud.time=_hud.spd=_hud.vert=null;S.pre=L;S.go=false;S.v=0;S.state='ride';showHud(true);
  $('ttext').textContent=L.top.toUpperCase();$('ticon').innerHTML='<span style="font-size:15px">▲</span>';setTxt('lblBot','Pick a trail');
  S.x0=x;S.z0=z;}
/* once you're clearly on one trail (or well down the hill), that's your run: the clock starts here */
function preCommit(){if(!S.go||Math.hypot(S.x-S.x0,S.z-S.z0)<8)return;const L=S.pre,drop=RUN.h0-H(S.x,S.z),sg=liftSigns(L);let mine=null,ms=0,n=0,other=null;
  for(let q=0;q<NK&&KT[q];q++){const tr=KT[q];if(!tr.name||KDd[q]>tr.w+2)continue;
    if(L.trails.includes(tr)){if(!mine||mine.name!==tr.name){if(!mine){mine=tr;ms=trailS(tr,KI[q],KTT[q]);}n++;}}else if(!other)other=tr;}
  /* yours once you're the only trail here and within ~15 m of its sign (or well down the hill); a trail with no sign once you've dropped 15 m */
  const e=mine&&sg.find(o=>o.tr.name===mine.name);let pick=null;
  if(mine&&((n===1&&e&&(ms>e.s-15||Math.hypot(S.x-e.x,S.z-e.z)<15))||drop>45))pick=mine;else if(!mine&&other&&drop>15)pick=other;if(!pick)return;
  S.pre=null;$('listBtn').classList.add('hidden');RUN.name=pick.name;RUN.tr=pick;RUN.top=L.top;RUN.h0=H(S.x,S.z);if(pick.dest){RUN.dest=pick.dest;RUN.h1=Math.min(pick.dest.h,RUN.h0-30);setTxt('lblBot',pick.dest.name);}else RUN.h1=Math.max(pick.h1,RUN.h0-400);
  S.t=0;S.path=[];curTrail='';S.curTr=null;S.top=0;updTrailHud();toast(shortName(pick.name));}

/* ---------- pause: the run freezes and the trail map opens on where you are (11-map.js draws the "You" marker) ---------- */
function pauseGame(){if(S.state!=='ride')return;S.state='paused';if(wind&&actx)wind.gain.setTargetAtTime(0,actx.currentTime,0.1);
  showHud(false);for(let i=0;i<SG_MAX;i++)edgeHide(i);sgMesh.visible=false;mapPause();}
function resumeGame(){if(S.state!=='paused')return;$('map').classList.add('hidden');$('confirm').classList.add('hidden');$('mapPause').classList.add('hidden');
  S.state='ride';simAcc=0;showHud(true);if(S.pre)$('listBtn').classList.remove('hidden');}
/* leaving a paused run for something else on the map: confirm first (nothing to lose at a lift top before you've picked a trail) */
function leaveRun(what,go){if(S.state!=='paused'){go();return;}
  const doIt=()=>{$('confirm').classList.add('hidden');$('mapPause').classList.add('hidden');S.pre=null;S.state='menu';go();};
  if(S.pre){doIt();return;}
  $('cfH').textContent='End this run?';$('cfP').textContent=fmt(S.t)+' into '+shortName(RUN.name)+'. This run won\'t count toward your times.';
  $('cfGo').textContent='End run · '+what;$('cfGo').onclick=doIt;$('cfBack').onclick=()=>$('confirm').classList.add('hidden');
  $('confirm').classList.remove('hidden');}
$('pauseBtn').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();pauseGame();});
$('listBtn').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(S.state!=='ride'||!S.pre)return;S.state='pick';showPicker(S.pre,false);pickFrom='top';$('pickBack').classList.remove('hidden');});
$('mapResume').onclick=resumeGame;
window.addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='p'||e.key==='P'){if(S.state==='ride')pauseGame();else if(S.state==='paused')resumeGame();}});
/* work out every lift's drop-off spot in the background after load, one lift per tick, so unloading never hitches */
setTimeout(function spots(i=0){const L=LIFTS[i];if(!L)return;if(L.trails.length)topSpot(L);setTimeout(()=>spots(i+1),120);},4000);
Object.assign(window.__kr,{jump,topSpot,topStart,JN,liftSigns,pauseGame,resumeGame});Object.defineProperty(window.__kr,'sgList',{get:()=>sgList});
