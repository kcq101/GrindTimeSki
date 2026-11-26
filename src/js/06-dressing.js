/* ---------- procedural set dressing driven by trail data ---------- */
const DECK={x:1640,z:880};
let crowd=null;const crowdPos=[];const _cm=new THREE.Matrix4();
let crowdIdle=false;function updCrowd(now){if(!crowd)return;const near=(S.state==='ride'||S.state==='finishing'||S.state==='done')&&Math.hypot(S.x-DECK.x,S.z-DECK.z)<330;if(!near&&crowdIdle)return;crowdIdle=!near;crowdPos.forEach((p,i)=>{const hop=near?Math.max(0,Math.sin(now*0.012+p[3]))*0.5:0;_cm.makeTranslation(p[0],p[1]+hop,p[2]);crowd.setMatrixAt(i,_cm);});crowd.instanceMatrix.needsUpdate=true;}
function drawSign(g,tr,w,h){g.fillStyle='#14202e';g.fillRect(0,0,w,h);g.fillStyle='#fff';g.fillRect(10,10,w-20,h-20);g.fillStyle='#14202e';g.fillRect(16,16,w-32,h-32);
  if(tr.diff==='dd'){[62,118].forEach(cx=>{g.save();g.translate(cx,128);g.rotate(Math.PI/4);g.fillStyle='#000';g.fillRect(-26,-26,52,52);g.strokeStyle='#fff';g.lineWidth=5;g.strokeRect(-26,-26,52,52);g.restore();});}
  g.save();g.translate(90,128);if(tr.diff==='k'||tr.diff==='dd')g.rotate(Math.PI/4);g.fillStyle=DIFF[tr.diff].col;
  if(tr.diff==='dd'){}else if(tr.diff==='g'){g.beginPath();g.arc(0,0,42,0,7);g.fill();g.strokeStyle='#fff';g.lineWidth=6;g.stroke();}else{g.fillRect(-38,-38,76,76);g.strokeStyle='#fff';g.lineWidth=6;g.strokeRect(-38,-38,76,76);}
  g.restore();g.fillStyle='#fff';const nm=shortName(tr.name).toUpperCase();const tx=tr.diff==='dd'?162:150;g.font='700 '+(nm.length>13?44:(nm.length>11?52:(nm.length>9?62:76)))+'px "Barlow Condensed",sans-serif';g.textBaseline='middle';g.fillText(nm,tx,112,w-tx-24);g.font='600 32px "Barlow Condensed",sans-serif';g.fillStyle='#f2b705';g.fillText(DIFF[tr.diff].label,tx+2,178);}
const postMat=new THREE.MeshLambertMaterial({color:0x5d6670});
function normalAt(tr,i){const a=tr.s[Math.max(0,i-1)],b=tr.s[Math.min(tr.s.length-1,i+1)];const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1;return[dz/L,-dx/L];}
function headingAt(tr,i){const a=tr.s[Math.max(0,i-1)],b=tr.s[Math.min(tr.s.length-1,i+2)];return Math.atan2(b[0]-a[0],b[1]-a[1]);}
/* ---------- kickers: terrain-park jumps on the long, fast, straight pitches ----------
   Deterministic (hashed per trail), so every session skis the same jumps. A spot qualifies when the trail is wide and not a
   cat track, glade or mogul run, the last ~120 m above it is steep enough to arrive with speed, the landing below it keeps
   falling (no flat landings), the line is nearly straight, and no other trail, lift line or lift top is close.
   The shape lives in H (kickH in 02-mountain.js); here we pick spots, add marker poles, and draw a fine overlay mesh. */
const JUMPS=[];
function jumpLip(x,z){for(const J of JUMPS){const dx=x-J.x,dz=z-J.z;if(dx*dx+dz*dz<100)return J;}return null;}
(function(){
  const at=(tr,s)=>{const cs=tr.cs;s=clamp(s,0,tr.L);let lo=0,hi=cs.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(cs[m]<=s)lo=m;else hi=m;}
    const a=tr.s[lo],b=tr.s[hi],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1,t=clamp((s-cs[lo])/((cs[hi]-cs[lo])||1),0,1),x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
    return {x,z,ux:(b[0]-a[0])/l,uz:(b[1]-a[1])/l,h:Bm(x,z)+tr.dl[lo]+(tr.dl[hi]-tr.dl[lo])*t};};
  const grade=(tr,s0,s1)=>(at(tr,s0).h-at(tr,s1).h)/(s1-s0);
  const clear=(tr,s)=>{for(let u=-25;u<=35;u+=10){const p=at(tr,s+u);if(inClear(p.x,p.z)||inLiftCut(p.x,p.z))return false;trailInfo(p.x,p.z);
      for(let q=0;q<NK&&KT[q];q++){const o=KT[q];if(KDd[q]>o.w+18)continue;if(o!==tr||Math.abs(tr.cs[KI[q]]-(s+u))>60)return false;}}
    return true;};
  TRAILS.forEach(tr=>{
    if(!tr.name||tr.k===1||tr.glade||tr.w<8||tr.L<450)return;
    const m0=tr.mog?tr.mog[0]-70:1e9,m1=tr.mog?tr.L-tr.mog[1]+70:-1e9;let last=-1e9,n=0;
    for(let s=110;s<tr.L-90&&n<2;s+=10){
      if(s>m0&&s<m1)continue;if(s-last<320)continue;
      const gRun=grade(tr,s-110,s-15),gRamp=grade(tr,s-15,s),gLand=grade(tr,s,s+35);
      if(gRun<0.17||gRamp<0.12||gLand<0.17||gLand>0.6||gRamp>0.6)continue;
      const p=at(tr,s);let turn=0;for(let u=-25;u<=35;u+=5){const q=at(tr,s+u);turn=Math.max(turn,Math.acos(clamp(q.ux*p.ux+q.uz*p.uz,-1,1)));}
      if(turn>0.2)continue;
      if(hash2(tr.id,s|0,41)>0.4)continue;
      if(JUMPS.some(J=>Math.hypot(J.x-p.x,J.z-p.z)<240))continue;
      if(!clear(tr,s))continue;
      const r1=hash2(tr.id,s|0,42),r2=hash2(tr.id,s|0,43),r3=hash2(tr.id,s|0,44);
      const h=1.1+0.8*r1,hw=Math.min(3+1.3*r2,tr.w-4.5),room=Math.max(0,tr.w-hw-3.5);
      const J={tr,s,h,lr:7.5+4*r1,lb:6.5+1.5*r1,hw,off:(r3-0.5)*2*room,x:0,z:0,ux:p.ux,uz:p.uz};
      J.x=p.x+p.uz*J.off;J.z=p.z-p.ux*J.off;
      (tr.jp=tr.jp||[]).push(J);JUMPS.push(J);MOGBOX.push([p.x-30,p.z-30,p.x+30,p.z+30]);last=s;n++;}
  });
  if(!JUMPS.length)return;
  /* overlay: the tiles are 2 m at best, which rounds the lip off. This is the same snow on a 0.3–1 m grid, a hair above the
     ground, with a blue dye line across the lip like a real park. One mesh, one draw call. */
  const P=[],C=[],UV=[],NO=[],TA=[],PW=[],I=[],c=new THREE.Color(),dye=new THREE.Color(0x2f6fe0);
  for(const J of JUMPS){
    const us=[];for(let u=-J.lr-2;u<-2;u+=1.6)us.push(u);for(let u=-2;u<0.6;u+=0.3)us.push(u);for(let u=0.6;u<J.lb+3;u+=0.85)us.push(u);us.push(J.lb+3);
    /* across: fine over the sidewalls, coarse over the flat top */
    const W=J.hw+2.6,ls=[];for(let l=-W;l<-J.hw;l+=0.55)ls.push(l);const ni=Math.max(2,Math.round(2*J.hw/1.3));for(let q=0;q<ni;q++)ls.push(-J.hw+2*J.hw*q/ni);for(let l=J.hw;l<W-0.01;l+=0.55)ls.push(l);ls.push(W);
    const b=P.length/3,nl=ls.length;
    us.forEach(u=>{const p=at(J.tr,J.s+u),nx=p.uz,nz=-p.ux;
      ls.forEach(l=>{const x=p.x+nx*(J.off+l),z=p.z+nz*(J.off+l),y=H(x,z),t=TI,e=t.tr?t.d-t.w:1e9;
        let ux=t.tr?t.ux:0,uz=t.tr?t.uz:1;const ta=[clamp(e,-60,200),t.tr?clamp(t.d/t.w,0,3):3];
        const bx=(Bm(x+6,z)-Bm(x-6,z))/12,bz=(Bm(x,z+6)-Bm(x,z-6))/12,gm=Math.hypot(bx,bz);
        if(gm>0.03){const sg=(ux*-bx+uz*-bz)<0?-1:1,f=sstep(0.03,0.1,gm);ux=ux*sg*(1-f)-bx/gm*f;uz=uz*sg*(1-f)-bz/gm*f;}
        const gx=(H(x+0.3,z)-H(x-0.3,z))/0.6,gz=(H(x,z+0.3)-H(x,z-0.3))/0.6,il=1/Math.sqrt(gx*gx+1+gz*gz);
        const lap=H(x+1,z)+H(x-1,z)+H(x,z+1)+H(x,z-1)-4*y,f=1-clamp(lap*CURV_K,-0.035,0.09);
        c.copy(cTrail);if(u>-1.8&&u<-0.1&&Math.abs(l)<J.hw)c.lerp(dye,0.85);
        P.push(x,y+0.04,z);C.push(c.r*f,c.g*f,Math.min(1,c.b*(f*1.015+0.004)));UV.push(x/2.4,z/7);NO.push(-gx*il,il,-gz*il);TA.push(ta[0],ta[1],ux,uz);PW.push(0);});});
    for(let j=0;j<us.length-1;j++)for(let i=0;i<nl-1;i++){const a=b+j*nl+i,bb=a+1,cc=a+nl,d=cc+1;I.push(a,cc,bb,bb,cc,d);}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(NO,3));g.setAttribute('aT',new THREE.Float32BufferAttribute(TA,4));g.setAttribute('aP',new THREE.Float32BufferAttribute(PW,1));g.setIndex(I);
  const jm=terrMatFine.clone();snowify(jm);jm.polygonOffset=true;jm.polygonOffsetFactor=-1;jm.polygonOffsetUnits=-2;
  scene.add(new THREE.Mesh(g,jm));
})();
(function(){
  /* bamboo boundary poles on every named trail, one instanced draw */
  const poles=[];
  TRAILS.forEach(tr=>{if(!tr.name)return;
    for(let i=4;i<tr.s.length-6;i+=8){const [cx,cz]=tr.s[i],[nx,nz]=normalAt(tr,i);
      [-1,1].forEach(sd=>{const x=cx+nx*sd*(tr.w+1),z=cz+nz*sd*(tr.w+1);const t=trailInfo(x,z);if(t.tr&&t.d<t.w-1)return;if(inPad(x,z))return;poles.push([x,z]);});}});
  /* a marker pole each side of every kicker's lip */
  JUMPS.forEach(J=>[-1,1].forEach(sd=>{const l=J.off+sd*(J.hw+1.6);poles.push([J.x+J.uz*(l-J.off),J.z-J.ux*(l-J.off)]);}));
  const pm=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06,0.06,2.2,4,1,true),new THREE.MeshLambertMaterial({color:0xf2a900}),poles.length);
  const m=new THREE.Matrix4();poles.forEach(([x,z],i)=>{m.makeTranslation(x,H(x,z)+1.1,z);pm.setMatrixAt(i,m);});scene.add(pm);
  /* snowguns on Superstar, Outer Limits and Cascade: one mesh for the guns, one for the plumes */
  const gg=[],gc=[],pl=[];
  TRAILS.forEach(tr=>{if(!tr.guns)return;let sd=1;
    for(let i=20;i<tr.s.length-14;i+=18){sd=-sd;const [cx,cz]=tr.s[i],[nx,nz]=normalAt(tr,i);const x=cx+nx*sd*(tr.w-1.5),z=cz+nz*sd*(tr.w-1.5);
      const t=trailInfo(x,z);if(t.tr!==tr)continue;const y=H(x,z),a=Math.atan2(nx*sd,nz*sd)+Math.PI/2;
      gg.push(placed(new THREE.CylinderGeometry(0.12,0.16,7,6).rotateZ(0.22).translate(0,3.3,0),x,y,z,a));gc.push(0x5d6670);
      gg.push(placed(new THREE.CylinderGeometry(0.45,0.3,1.2,8).rotateZ(1.1).translate(-1.4,6.6,0),x,y,z,a));gc.push(0xd8dde3);
      if((i/18|0)%2===0)pl.push(placed(new THREE.ConeGeometry(3.5,14,10,1,true).rotateZ(1.35).translate(-7.5,7,1),x,y,z,a));}});
  if(gg.length)scene.add(new THREE.Mesh(mergeGeos(gg,gc),new THREE.MeshLambertMaterial({vertexColors:true})));
  if(pl.length){const pm2=new THREE.Mesh(mergeGeos(pl),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.35,depthWrite:false}));scene.add(pm2);}
  /* trail signs at the top of every trail you can pick off a lift: one texture atlas, one mesh */
  const signTr=[];LIFTS.forEach(L=>L.trails.forEach(tr=>{if(!signTr.includes(tr))signTr.push(tr);}));
  const CW=256,CH=128,COLS=8,rows=Math.ceil(signTr.length/COLS),AH=Math.pow(2,Math.ceil(Math.log2(Math.max(1,rows)*CH)));
  const drawAll=(g)=>{signTr.forEach((tr,k)=>{g.save();g.translate((k%COLS)*CW,Math.floor(k/COLS)*CH);g.scale(0.5,0.5);drawSign(g,tr,512,256);g.restore();});};
  const atlas=canvasTex(CW*COLS,AH,drawAll);
  atlas.flipY=true;
  /* the inlined fonts load asynchronously: redraw the signs once Barlow Condensed is ready */
  if(document.fonts&&document.fonts.load)document.fonts.load('700 40px "Barlow Condensed"').then(()=>{const c=atlas.image,g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);drawAll(g);atlas.needsUpdate=true;}).catch(()=>{});
  const sp=[],su=[],si=[],posts=[];
  signTr.forEach((tr,k)=>{const i=Math.min(3,tr.s.length-1),[cx,cz]=tr.s[i],[nx,nz]=normalAt(tr,i),off=Math.min(tr.w*0.7,12)+2;
    const x=cx-nx*off,z=cz-nz*off,y=H(x,z),f=headingAt(tr,i)+Math.PI,c=Math.cos(f),s=Math.sin(f);
    const u0=(k%COLS)/COLS,u1=u0+1/COLS,v1=1-Math.floor(k/COLS)*CH/AH,v0=v1-CH/AH,b=sp.length/3;
    [[-2.2,1.1,u0,v1],[2.2,1.1,u1,v1],[-2.2,-1.1,u0,v0],[2.2,-1.1,u1,v0]].forEach(([lx,ly,u,v])=>{sp.push(x+lx*c,y+3.4+ly,z-lx*s);su.push(u,v);});
    si.push(b,b+2,b+1,b+1,b+2,b+3);
    [-1.8,1.8].forEach(o=>posts.push(placed(new THREE.CylinderGeometry(0.08,0.08,3.4,5),x+o*c,y+1.7,z-o*s+0.05,0)));});
  if(sp.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(su,2));g.setIndex(si);
    scene.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:atlas,side:THREE.DoubleSide})));scene.add(new THREE.Mesh(mergeGeos(posts),postMat));}
  /* banners across a trail, a set distance up from its bottom */
  function banner(name,fromEnd,label,bg,fg){const tr=TRAILS.filter(t=>t.name===name).sort((a,b)=>b.L-a.L)[0];if(!tr)return;
    let i=tr.s.length-1;while(i>0&&tr.L-tr.cs[i]<fromEnd)i--;const [cx,cz]=tr.s[i],[nx,nz]=normalAt(tr,i),fw=tr.w*0.9;
    const tex=canvasTex(512,128,(g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);g.fillStyle=fg;g.font='bold '+(label.length>12?50:76)+'px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(label,w/2,h/2+4);});
    let top=-1e9;const ps=[];[-1,1].forEach(sd=>{const x=cx+nx*sd*fw,z=cz+nz*sd*fw,y=H(x,z);top=Math.max(top,y);ps.push(placed(new THREE.CylinderGeometry(0.33,0.33,9,8),x,y+4.5,z,0));});
    scene.add(new THREE.Mesh(mergeGeos(ps,[0x14202e,0x14202e]),new THREE.MeshLambertMaterial({vertexColors:true})));
    const b=new THREE.Mesh(new THREE.PlaneGeometry(fw*2,fw*2/7),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));b.position.set(cx,top+7.6,cz);b.rotation.y=headingAt(tr,i)+Math.PI;scene.add(b);}
  banner('Superstar',70,'FINISH','#e8432f','#fff');
  banner('Outer Limits',70,'◆◆ OUTER LIMITS','#111','#fff');
  /* a building in its own frame (front faces local −z), turned to face `ry` and merged into one mesh */
  function building(cx,cz,ry,parts){const y0=Math.min(...[[-20,-10],[20,-10],[-20,10],[20,10]].map(([a,b])=>H(cx+a,cz+b))),c=Math.cos(ry),s=Math.sin(ry),gs=[],cs=[];
    parts.forEach(([g,lx,ly,lz,col,rot])=>{if(rot)g.applyMatrix4(rot);gs.push(placed(g,cx+lx*c+lz*s,y0+ly,cz-lx*s+lz*c,ry));cs.push(col);});
    const me=new THREE.Mesh(mergeGeos(gs,cs),new THREE.MeshLambertMaterial({vertexColors:true}));scene.add(me);return {y0,c,s,w:(lx,lz)=>[cx+lx*c+lz*s,cz-lx*s+lz*c]};}
  /* K-1 Lodge, north of the lifts, facing up the mountain (south) */
  {const wd=0x7a5236,rf=0x3a4048,gl=0x9cc5e8,parts=[[new THREE.BoxGeometry(78,14,30),0,7,15,wd],[new THREE.BoxGeometry(60,1,10),0,0.5,-5,wd]];
    const roof=new THREE.ConeGeometry(48,12,4,1);roof.rotateY(Math.PI/4);roof.scale(1.15,1,0.5);parts.push([roof,0,20,15,rf]);
    for(let i=-3;i<=3;i++)parts.push([new THREE.BoxGeometry(7,6,0.4),i*10,7,-0.1,gl]);
    const B=building(20,-1010,Math.PI,parts);
    const lodgeTex=canvasTex(512,128,(g,w,h)=>{g.fillStyle='#14202e';g.fillRect(0,0,w,h);g.fillStyle='#fff';g.font='bold 70px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('K-1 LODGE',w/2,h/2+4);});
    const [sx,sz]=B.w(0,-0.3);const ls=new THREE.Mesh(new THREE.PlaneGeometry(22,5.5),new THREE.MeshBasicMaterial({map:lodgeTex}));ls.position.set(sx,B.y0+12.6,sz);ls.rotation.y=Math.PI+Math.PI;scene.add(ls);}
  /* The Deck at Bear Mountain base, facing up Outer Limits (west), with its crowd */
  {const wd=0x7a5236,parts=[[new THREE.BoxGeometry(46,1.2,14),0,1.4,0,wd],[new THREE.BoxGeometry(46,0.15,0.15),0,3,-7,wd],[new THREE.BoxGeometry(50,9,16),0,4.5,15,0x6b4a33]];
    for(let i=-4;i<=4;i++)parts.push([new THREE.BoxGeometry(0.15,1.6,0.15),i*5.5,2.4,-7,wd]);
    const B=building(DECK.x,DECK.z,Math.PI/2,parts);
    const n=38;crowd=new THREE.InstancedMesh(new THREE.BoxGeometry(0.55,1.55,0.4),new THREE.MeshLambertMaterial({color:0xffffff}),n);
    const jc=[0xe8432f,0x2f7de8,0xf2b705,0x2fae63,0x8a3fe0,0xffffff,0x111111,0xff7a1a];const c=new THREE.Color();
    for(let i=0;i<n;i++){const [x,z]=B.w(-20+rnd()*40,-5.5+rnd()*10);crowdPos.push([x,B.y0+2.8,z,rnd()*6]);c.setHex(jc[Math.floor(rnd()*jc.length)]);crowd.setColorAt(i,c);}
    scene.add(crowd);}
})();

