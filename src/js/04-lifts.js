/* ---------- lift network: every lift is one line of data (OpenStreetMap bottom/top stations) ---------- */
/* speed in m/s (detachables ~5, gondolas ~6, fixed-grips ~2.3) */
const LIFTS=KD.lifts.map(l=>({id:l.id,name:l.name,kind:l.kind,bx:l.bx,bz:l.bz,tx:l.tx,tz:l.tz,speed:l.speed,col:l.col,base:l.base,top:l.top,gond:!!l.gond,trails:l.trails.map(i=>TRAILS[i]).filter(t=>t.h0-t.h1>20)}));
const DSYM={g:'●',b:'■',k:'◆',dd:'◆◆'};
LIFTS.forEach(L=>{L.serves=L.trails.slice(0,3).map(t=>shortName(t.name)+' '+DSYM[t.diff]).join(' · ');});
const LIFT=id=>LIFTS.find(L=>L.id===id);
const GAUGE=2.8,RIDE_SECS=24,CHAIR_GAP=60;
/* lift-top plateaus: the unload area (centred 10 m past the top station) becomes a least-squares plane through the ground within
   30 m, its tilt capped at 3.5% so it still leans the way the terrain falls; blended back into the real slope by 62 m.
   Lift towers, terminals, tiles and physics all read H, so they all sit on it. */
(function(){const TW=Math.PI*2;for(const L of LIFTS){const len=Math.hypot(L.tx-L.bx,L.tz-L.bz),ux=(L.tx-L.bx)/len,uz=(L.tz-L.bz)/len,cx=L.tx+ux*10,cz=L.tz+uz*10;
  let n=0,sh=0,sx=0,sz=0,sxx=0,szz=0,sxz=0,sxh=0,szh=0;
  for(const r of [0,10,20,30])for(let a=0;a<(r?16:1);a++){const dx=Math.sin(a/16*TW)*r,dz=Math.cos(a/16*TW)*r,h=H(cx+dx,cz+dz);n++;sh+=h;sx+=dx;sz+=dz;sxx+=dx*dx;szz+=dz*dz;sxz+=dx*dz;sxh+=dx*h;szh+=dz*h;}
  const mx=sx/n,mz=sz/n,mh=sh/n,cxx=sxx/n-mx*mx,czz=szz/n-mz*mz,cxz=sxz/n-mx*mz,cxh=sxh/n-mx*mh,czh=szh/n-mz*mh,det=cxx*czz-cxz*cxz;
  let gx=det?(cxh*czz-czh*cxz)/det:0,gz=det?(czh*cxx-cxh*cxz)/det:0;const g=Math.hypot(gx,gz),cap=0.035;if(g>cap){gx*=cap/g;gz*=cap/g;}
  PLAT.push({x:cx,z:cz,h:mh-gx*mx-gz*mz,sx:gx,sz:gz,id:L.id});}})();
LIFTS.forEach(L=>{
  const dx=L.tx-L.bx,dz=L.tz-L.bz;L.len=Math.hypot(dx,dz);L.dx=dx/L.len;L.dz=dz/L.len;L.px=-L.dz;L.pz=L.dx;L.ry=Math.atan2(L.dx,L.dz);
  L.real=L.len/L.speed;L.ts=L.real/RIDE_SECS;
  const gnd=s=>H(L.bx+L.dx*s,L.bz+L.dz*s);
  /* towers: start with one at each end, then split any span that is too long or lets the cable sag into a knoll */
  const T=[{s:6,y:gnd(6)+11},{s:L.len-6,y:gnd(L.len-6)+11}];
  const clears=(p,q)=>{for(let s=p.s+4;s<q.s;s+=4){const t=(s-p.s)/(q.s-p.s);if(p.y+(q.y-p.y)*t-0.6*Math.sin(t*Math.PI)-gnd(s)<6.5)return false;}return true;};
  let i=0;while(i<T.length-1){const p=T[i],q=T[i+1];if(q.s-p.s>120||(q.s-p.s>24&&!clears(p,q))){const s=(p.s+q.s)/2;T.splice(i+1,0,{s,y:gnd(s)+12});}else i++;}
  L.T=T;L.gnd=gnd;L.hb=gnd(0);L.ht=gnd(L.len);
});
/* bases: lift bottoms that share a base area. Reaching one ends the run (mid-mountain ones only if you stop at the lift).
   pads are open, groomed ground (no trees, no deep-snow drag). */
const BASES=[
  {id:'k1',name:'K-1 Base',x:40,z:-835,pad:235,trig:150,lifts:['ss','k1','sn6','sn3']},
  {id:'bear',name:'Bear Mountain Base',x:1565,z:858,pad:130,trig:95,lifts:['bear','skq']},
  {id:'mid',name:'Skyeship midstation',x:1320,z:-605,pad:100,trig:70,lifts:['ne','sky','nb']},
  {id:'shs',name:'Snowshed Base',x:540,z:-1715,pad:130,trig:95,lifts:['shs']},
  {id:'rh',name:'Ramshead Base',x:255,z:-1785,pad:85,trig:65,lifts:['rh']},
  {id:'sky1',name:'Skyeship Base',x:3735,z:-505,pad:110,trig:80,lifts:['sky1']},
  {id:'can',name:'Canyon Quad',x:-679,z:-407,pad:45,trig:40,lifts:['can'],mid:true},
  {id:'nr',name:'North Ridge Quad',x:-1203,z:-232,pad:45,trig:40,lifts:['nr'],mid:true},
  {id:'sr',name:'South Ridge Quad',x:167,z:1041,pad:45,trig:40,lifts:['sr'],mid:true}];
BASES.forEach(b=>{b.L=b.lifts.map(LIFT).filter(Boolean);b.h=Bm(b.x,b.z);b.L.forEach(L=>L.baseObj=b);});
function inPad(x,z){for(const b of BASES){const dx=x-b.x,dz=z-b.z;if(dx*dx+dz*dz<b.pad*b.pad)return true;for(const L of b.L){const ex=x-L.bx,ez=z-L.bz;if(ex*ex+ez*ez<2500)return true;}}return false;}
function inClear(x,z){if(inPad(x,z))return true;for(const L of LIFTS){const dx=x-L.tx,dz=z-L.tz;if(dx*dx+dz*dz<38*38)return true;}return false;}
/* where does each trail lead? follow it downhill until it reaches a base */
(function(){
  function nearBase(x,z,r){let best=null,bd=1e9;for(const b of BASES){const d=Math.hypot(x-b.x,z-b.z)-b.trig;if(d<bd){bd=d;best=b;}}return bd<r?best:null;}
  function destOf(tr,depth){if(tr.dest!==undefined)return tr.dest;tr.dest=null;const [ex,ez]=tr.s[tr.s.length-1];
    let b=nearBase(ex,ez,70);if(b)return tr.dest=b;
    if(depth<14){let nt=null,nd=1e9;const stem=tr.name.split(' - ')[0];
      for(const u of TRAILS){if(u===tr)continue;for(let i=0;i<u.s.length-2;i++){let d=Math.hypot(u.s[i][0]-ex,u.s[i][1]-ez);if(d>u.w+25||u.cs[i]>=u.L-30)continue;if(stem&&u.name.split(' - ')[0]===stem)d-=200;else if(u.cs[i]<40)d-=60;if(d<nd){nd=d;nt=u;}}}
      if(nt){const d=destOf(nt,depth+1);if(d)return tr.dest=d;}}
    let best=null,bd=1e9;const eh=tr.h1;for(const bb of BASES){if(bb.mid||bb.h>eh)continue;const d=Math.hypot(ex-bb.x,ez-bb.z);if(d<bd){bd=d;best=bb;}}
    return tr.dest=best;}
  TRAILS.forEach(tr=>destOf(tr,0));
})();
function liftXZ(L,s,side){return[L.bx+L.dx*s+L.px*GAUGE*side,L.bz+L.dz*s+L.pz*GAUGE*side];}
function cableY(L,s){const T=L.T;if(s<=T[0].s)return T[0].y;for(let i=0;i<T.length-1;i++){const a=T[i],b=T[i+1];if(s<=b.s){const t=(s-a.s)/(b.s-a.s);return a.y+(b.y-a.y)*t-0.6*Math.sin(t*Math.PI);}}return T[T.length-1].y;}
function liftSignTex(L){return canvasTex(512,160,(g,w,h)=>{g.fillStyle='#14202e';g.fillRect(0,0,w,h);g.fillStyle='#f2b705';g.fillRect(0,h-14,w,14);g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';
  g.font='bold '+(L.name.length>22?36:(L.name.length>16?44:54))+'px sans-serif';g.fillText(L.name.toUpperCase(),w/2,58);
  g.font='bold 26px sans-serif';g.fillStyle='#b9c9db';g.fillText('TO '+L.top.toUpperCase()+'  ·  '+L.serves.replace(/[◆■●]/g,'').replace(/\s+·\s+/g,' / ').trim().toUpperCase(),w/2,112,w-24);});}
(function(){
  /* all lifts: towers, arms and terminals → 1 mesh; cables → 1 line set; one sign each */
  const vc=new THREE.MeshLambertMaterial({vertexColors:true}),cm=new THREE.LineBasicMaterial({color:0x2b3138});
  const gs=[],cs=[],cab=[];
  LIFTS.forEach(L=>{
    L.T.forEach(t=>{const [x,z]=liftXZ(L,t.s,0),g=L.gnd(t.s);
      gs.push(placed(new THREE.CylinderGeometry(0.45,0.6,t.y-g,6),x,(t.y+g)/2,z,0));cs.push(0x6d7783);
      gs.push(placed(new THREE.BoxGeometry(GAUGE*2+1.4,0.5,0.6),x,t.y,z,L.ry));cs.push(0x6d7783);});
    [-8,L.len+8].forEach(s=>{const [x,z]=liftXZ(L,s,0);gs.push(placed(new THREE.BoxGeometry(12,7,16),x,H(x,z)+3.5,z,L.ry));cs.push(L.col);
      gs.push(placed(new THREE.BoxGeometry(13,1,17),x,H(x,z)+7.4,z,L.ry));cs.push(0x3a4048);});
    {const [x,z]=liftXZ(L,-22,-1);const sx=x-L.px*6,sz=z-L.pz*6;[-4,4].forEach(o=>{gs.push(placed(new THREE.CylinderGeometry(0.1,0.1,4.2,5),sx+L.px*o,H(x,z)+2.1,sz+L.pz*o,0));cs.push(0x5d6670);});
      const sg=new THREE.Mesh(new THREE.PlaneGeometry(9,2.8),new THREE.MeshBasicMaterial({map:liftSignTex(L)}));sg.position.set(sx,H(x,z)+4.2,sz);sg.rotation.y=L.ry+Math.PI;scene.add(sg);}
    [-1,1].forEach(sd=>{let prev=null;const n=Math.ceil(L.len/8);for(let k=0;k<=n;k++){const s=Math.min(L.len,k*8),[x,z]=liftXZ(L,s,sd),p=[x,cableY(L,s),z];if(prev)cab.push(...prev,...p);prev=p;}});
  });
  scene.add(new THREE.Mesh(mergeGeos(gs,cs),vc));
  const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(cab,3));scene.add(new THREE.LineSegments(cg,cm));
})();
const chairs=[];
function makeChair(col,riders){
  const steel=new THREE.MeshLambertMaterial({color:0x3c4148}),seat=new THREE.MeshLambertMaterial({color:col});
  const g=new THREE.Group();
  const hang=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.4,4),steel);hang.position.y=-1.2;g.add(hang);
  const s=new THREE.Mesh(new THREE.BoxGeometry(3.2,0.18,0.8),seat);s.position.y=-2.4;g.add(s);
  const bk=new THREE.Mesh(new THREE.BoxGeometry(3.2,0.9,0.12),seat);bk.position.set(0,-2,-0.38);g.add(bk);
  const bar=new THREE.Mesh(new THREE.BoxGeometry(3.0,0.06,0.06),steel);bar.position.set(0,-1.75,0.55);g.add(bar);
  scene.add(g);return g;
}
/* open-sided gondola cabin: floor at the chair's seat height so the rider sits the same way */
function cabinGeos(){return [placed(new THREE.CylinderGeometry(0.07,0.07,1.2,4),0,-0.6,0),placed(new THREE.BoxGeometry(2.3,0.16,2.0),0,-1.25,0),placed(new THREE.BoxGeometry(2.3,0.12,2.0),0,-3.05,0),
  placed(new THREE.BoxGeometry(2.3,0.75,0.08),0,-2.62,-0.96),placed(new THREE.BoxGeometry(2.3,0.75,0.08),0,-2.62,0.96),placed(new THREE.BoxGeometry(0.08,0.75,2.0),-1.11,-2.62,0),placed(new THREE.BoxGeometry(0.08,0.75,2.0),1.11,-2.62,0),
  ...[[-1.1,-0.95],[1.1,-0.95],[-1.1,0.95],[1.1,0.95]].map(([x,z])=>placed(new THREE.BoxGeometry(0.1,1.8,0.1),x,-2.15,z))];}
function makeCabin(col){const g=new THREE.Group();const m=new THREE.Mesh(CAB_GEO,new THREE.MeshLambertMaterial({vertexColors:true,color:col}));g.add(m);g.userData.mat=m.material;scene.add(g);return g;}
const CHAIR_GEO=mergeGeos([placed(new THREE.CylinderGeometry(0.06,0.06,2.4,4),0,-1.2,0),placed(new THREE.BoxGeometry(3.2,0.18,0.8),0,-2.4,0),placed(new THREE.BoxGeometry(3.2,0.9,0.12),0,-2,-0.38),placed(new THREE.BoxGeometry(3.0,0.06,0.06),0,-1.75,0.55)],[0.3,1,1,0.3]);
const CAB_GEO=mergeGeos(cabinGeos(),[0.3,1,0.35,1,1,1,1,0.35,0.35,0.35,0.35]);
let NCH=0,NCB=0;LIFTS.forEach(L=>{L.nChairs=Math.max(8,Math.round(L.len*2/CHAIR_GAP));if(L.gond)NCB+=L.nChairs;else NCH+=L.nChairs;});
const chairIM=new THREE.InstancedMesh(CHAIR_GEO,new THREE.MeshLambertMaterial({vertexColors:true}),NCH);chairIM.frustumCulled=false;scene.add(chairIM);
const cabIM=new THREE.InstancedMesh(CAB_GEO,new THREE.MeshLambertMaterial({vertexColors:true}),Math.max(1,NCB));cabIM.frustumCulled=false;scene.add(cabIM);
const riderIM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.5,0.9,0.45),new THREE.MeshLambertMaterial({color:0xffffff}),NCH*3);riderIM.frustumCulled=false;scene.add(riderIM);
{const jackets=[0xe8432f,0x2f7de8,0xf2b705,0x2fae63,0x8a3fe0,0xffffff,0x111111],c=new THREE.Color(),z0=new THREE.Matrix4().makeScale(0,0,0);let ic=0,ib=0;
  LIFTS.forEach(L=>{for(let i=0;i<L.nChairs;i++){const rs=[];let im,idx;c.set(L.col);
    if(L.gond){im=cabIM;idx=ib++;cabIM.setColorAt(idx,c);}
    else{im=chairIM;idx=ic++;chairIM.setColorAt(idx,c);
      const n=(i%2===0&&rnd()<0.8)?1+Math.floor(rnd()*3):0;
      for(let r=0;r<3;r++){const ri=idx*3+r;if(r<n){c.set(jackets[Math.floor(rnd()*jackets.length)]);riderIM.setColorAt(ri,c);rs.push([ri,-1.1+r*1.1]);}else riderIM.setMatrixAt(ri,z0);}}
    chairs.push({s:i/L.nChairs*L.len*2,L,i,idx,rs,im});}});}
const myChair=makeChair(0x1f4f7a,false);myChair.visible=false;
const myCab=makeCabin(0xb3261e);myCab.visible=false;
let myRide=myChair;
const _cpos={x:0,y:0,z:0,ry:0};
function chairAt(L,s){const loop=L.len*2;s=((s%loop)+loop)%loop;let side=1,ry=L.ry;if(s>=L.len){s=loop-s;side=-1;ry=L.ry+Math.PI;}
  _cpos.x=L.bx+L.dx*s+L.px*GAUGE*side;_cpos.z=L.bz+L.dz*s+L.pz*GAUGE*side;_cpos.y=cableY(L,s);_cpos.ry=ry;return _cpos;}
function placeChair(g,L,s){const c=chairAt(L,s);g.position.set(c.x,c.y,c.z);g.rotation.y=c.ry;}
const _chM=new THREE.Matrix4(),_chR=new THREE.Matrix4();
function updateChairs(dt){
  for(const c of chairs){const L=c.L,k=(S.state==='lift'&&S.lift===L)?L.ts:1;c.s=(c.s+dt*L.speed*k)%(L.len*2);
    const p=chairAt(L,c.s);_chM.makeRotationY(p.ry).setPosition(p.x,p.y,p.z);c.im.setMatrixAt(c.idx,_chM);
    for(const [ri,ox] of c.rs){_chR.makeTranslation(ox,-1.85,-0.1).premultiply(_chM);riderIM.setMatrixAt(ri,_chR);}}
  chairIM.instanceMatrix.needsUpdate=true;cabIM.instanceMatrix.needsUpdate=true;riderIM.instanceMatrix.needsUpdate=true;
}
/* open a gap on the up-line so the player's chair slots in between two others */
function gapChairs(L,at){const loop=L.len*2,sp=loop/L.nChairs;chairs.forEach(c=>{if(c.L===L)c.s=(at+sp*0.5+c.i*sp)%loop;});}

