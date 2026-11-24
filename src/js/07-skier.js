/* ---------- skier ---------- */
const skier=new THREE.Group();const rig=new THREE.Group();skier.add(rig);const skiParts=[];
(function(){
  const jacket=new THREE.MeshLambertMaterial({color:0xe8432f}),pants=new THREE.MeshLambertMaterial({color:0x1f2a44}),skiM=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.3,metalness:0.1,envMap:envTex,envMapIntensity:0.9,map:canvasTex(16,256,(g,w,h)=>{g.fillStyle='#14181d';g.fillRect(0,0,w,h);g.fillStyle='#e8432f';g.fillRect(0,h*0.12,w,h*0.1);g.fillRect(0,h*0.78,w,h*0.05);g.fillStyle='#f2f4f6';g.fillRect(w*0.3,h*0.28,w*0.4,h*0.42);g.fillStyle='#f2b705';g.fillRect(0,h*0.9,w,h*0.03);})}),helm=new THREE.MeshLambertMaterial({color:0xf4f4f4}),gog=new THREE.MeshLambertMaterial({color:0xf2a900,emissive:0x553300});
  [-0.17,0.17].forEach(x=>{const s=new THREE.Mesh(new THREE.BoxGeometry(0.11,0.05,1.75),skiM);s.castShadow=true;s.position.set(x,0.03,0.1);skier.add(s);skiParts.push(s);
    const tip=new THREE.Mesh(new THREE.BoxGeometry(0.11,0.05,0.2),skiM);tip.position.set(x,0.08,1.0);tip.rotation.x=-0.5;skier.add(tip);skiParts.push(tip);});
  [-0.16,0.16].forEach(x=>{const l=new THREE.Mesh(new THREE.BoxGeometry(0.17,0.75,0.2),pants);l.position.set(x,0.42,0);rig.add(l);});
  const torso=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.62,0.3),jacket);torso.position.set(0,1.05,0.05);rig.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.16,12,10),helm);head.position.set(0,1.52,0.09);rig.add(head);
  const g=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.08,0.06),gog);g.position.set(0,1.52,0.24);rig.add(g);
  [-0.33,0.33].forEach(x=>{const a=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.5,0.13),jacket);a.position.set(x,1.02,0.14);a.rotation.x=-0.6;rig.add(a);
    const p=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,1.15,4),skiM);p.position.set(x*1.1,0.62,-0.05);p.rotation.x=0.45;rig.add(p);});
})();
skier.rotation.order='YXZ';scene.add(skier);

/* ---------- character model (Alpine Adventurer) ---------- */
let mixer=null,model=null,animMode='ride',crashT=0,crouch=0.3;const acts={},hands=[],poles=[];
/* contact shadow (under the feet, follows the slope) + a soft cast decal stretched away from the sun. No shadow map. */
const shTex=canvasTex(64,64,(g,w,h)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.45,'rgba(255,255,255,.75)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h);});
const shMat=k=>new THREE.MeshBasicMaterial({color:0x12233a,alphaMap:shTex,transparent:true,opacity:k,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
const blob=new THREE.Mesh(new THREE.PlaneGeometry(0.95,2.0),shMat(0.34));scene.add(blob);
const castSh=new THREE.Mesh(new THREE.PlaneGeometry(0.8,2.4).translate(0,1.05,0),shMat(0.13));scene.add(castSh);
const _bn=new THREE.Vector3(),_bf=new THREE.Vector3(),_br=new THREE.Vector3(),_bm=new THREE.Matrix4(),_sunAway=new THREE.Vector3(-SUN_DIR.x,0,-SUN_DIR.z).normalize();
function placeShadows(gx,gz,hgt){const k=1/(1+hgt*0.3);
  _bn.set(-gx,1,-gz).normalize();
  _bf.set(Math.sin(S.th),0,Math.cos(S.th));_bf.addScaledVector(_bn,-_bf.dot(_bn)).normalize();_br.crossVectors(_bf,_bn);
  _bm.makeBasis(_br,_bf,_bn);blob.quaternion.setFromRotationMatrix(_bm);blob.position.set(S.x,H(S.x,S.z)+0.04,S.z);blob.scale.set(k,k,1);blob.material.opacity=0.34*k;
  _bf.copy(_sunAway).addScaledVector(_bn,-_sunAway.dot(_bn)).normalize();_br.crossVectors(_bf,_bn);
  _bm.makeBasis(_br,_bf,_bn);castSh.quaternion.setFromRotationMatrix(_bm);castSh.position.copy(blob.position).addScaledVector(_bf,hgt*0.9);castSh.material.opacity=0.13*k*k;
  castSh.visible=blob.visible;}
const CLIP={ride:'air_squat',fall:'Fall3',arise:'Arise',wave:'Wave_for_Help_2'};
function setMode(m,fade){animMode=m;crashT=0;if(!mixer)return;const target=CLIP[m];const fd=fade===undefined?(m==='fall'?0.25:0.6):fade;
  for(const k in acts){const a=acts[k];
    if(k===target){a.reset();a.setLoop(m==='wave'?THREE.LoopRepeat:THREE.LoopOnce,Infinity);a.clampWhenFinished=true;a.timeScale=(m==='fall'||m==='arise')?1.4:1;a.setEffectiveWeight(1);if(fd>0)a.fadeIn(fd);a.play();
      if(m==='fall')a.time=0.3;if(m==='ride'){a.paused=true;a.time=0.3;}}
    else if(fd===0)a.stop();else if(a.isRunning()||a.getEffectiveWeight()>0)a.fadeOut(fd);}
  const showGear=(m==='ride'||m==='arise');skiParts.forEach(o=>o.visible=(m!=='fall'));poles.forEach(o=>o.visible=showGear&&m==='ride');}
function loadModel(){return new Promise(res=>{
  if(!THREE.GLTFLoader){res(false);return;}
  const to=setTimeout(()=>res(false),25000);
  let buf;try{const bin=atob(document.getElementById('glbdata').textContent.trim());const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);buf=u.buffer;}catch(e){clearTimeout(to);res(false);return;}
  new THREE.GLTFLoader().parse(buf,'',gl=>{clearTimeout(to);
    model=gl.scene;
    model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=true;const m=o.material;if(m){m.metalness=0;m.roughness=1;if(m.map){m.map.encoding=THREE.LinearEncoding;m.map.needsUpdate=true;}if(envTex){m.envMap=envTex;m.envMapIntensity=0.55;}m.needsUpdate=true;}}});
    rig.children.slice().forEach(c=>c.visible=false);
    rig.add(model);
    mixer=new THREE.AnimationMixer(model);
    gl.animations.forEach(c=>{acts[c.name]=mixer.clipAction(c);});
    if(!acts.air_squat){res(false);return;}
    BN.neck=model.getObjectByName('mixamorigNeck');BN.head=model.getObjectByName('mixamorigHead');if(BN.head)addHeadGear(BN.head,model.getObjectByName('mixamorigHeadTop_End'));BN.spine=model.getObjectByName('mixamorigSpine1');BN.armL=model.getObjectByName('mixamorigLeftArm');BN.armR=model.getObjectByName('mixamorigRightArm');BN.foreL=model.getObjectByName('mixamorigLeftForeArm');BN.foreR=model.getObjectByName('mixamorigRightForeArm');
    ['mixamorigLeftHand','mixamorigRightHand'].forEach(n=>{const b=model.getObjectByName(n);if(b)hands.push(b);});
    if(hands.length===2){const pg=new THREE.CylinderGeometry(0.014,0.014,1,5);pg.translate(0,0.5,0);const pm=new THREE.MeshStandardMaterial({color:0x9aa3ad,metalness:0.8,roughness:0.3,envMap:envTex});
      for(let i=0;i<2;i++){const p=new THREE.Mesh(pg,pm);p.castShadow=true;skier.add(p);poles.push(p);}}
    crouch=0.3;setMode('ride',0);mixer.update(0.016);res(true);
  },()=>{clearTimeout(to);res(false);});
});}
const _v=new THREE.Vector3(),_t=new THREE.Vector3(),_u=new THREE.Vector3(0,1,0),_d=new THREE.Vector3();
const _pd=new THREE.Vector3(),_pd2=new THREE.Vector3();
const POLE={out:0.42,rise:0.18,len:1.15,sOut:0.2,sBack:0.6};window.__poleCfg=POLE;
const _fw=new THREE.Vector3();
/* ---- upright arm/pole motion (from ski-instruction references):
   elbows low and slightly out, forearms forward, fists ~waist height a little wider than the elbows;
   pole plant at each turn change with the new inside hand, tip just off the ski tip, mostly wrist;
   upper body partly faces the fall line while the skis turn underneath. Fades out as the skier tucks. */
const ARM={elbowOut:0.22,elbowFwd:0.3,foreFwd:1,foreUp:-0.08,foreOut:0.2,plantDur:0.55,counter:0.45};window.__arm=ARM;
const _amS=new THREE.Vector3(),_amE=new THREE.Vector3(),_amC=new THREE.Vector3(),_amX=new THREE.Vector3(),_aL=new THREE.Vector3(),_aF=new THREE.Vector3(),_aU=new THREE.Vector3(),_amT=new THREE.Vector3(),_amY=new THREE.Vector3(0,1,0);
const plantT=[-1,-1];let lastTurn=0,counterYaw=0;
function aimBone(b,child,dir,w){if(!b||!child||w<=0)return;b.getWorldPosition(_amS);child.getWorldPosition(_amE);_amC.subVectors(_amE,_amS).normalize();
  const ang=Math.acos(Math.max(-1,Math.min(1,_amC.dot(dir))));if(ang<1e-4)return;_amX.crossVectors(_amC,dir);if(_amX.lengthSq()<1e-10)return;_amX.normalize();rotBone(b,_amX,ang*w);}
const sm01=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function plantEnv(i){const t=plantT[i];if(t<0)return 0;const p=t/ARM.plantDur;return p<0.3?sm01(p/0.3):p<0.6?1:1-sm01((p-0.6)/0.4);}
const POSE={foreUp:0,armOut:0,spine:0.75,arm:0.9,fore:1.2,neck:-0.42,head:-0.52,neck0:-0.08,head0:-0.12};window.__pose=POSE;
let gear=null,helmEdge=null;
function addHeadGear(head,top){
  model.updateMatrixWorld(true);const ws=new THREE.Vector3();head.getWorldScale(ws);
  const hp=new THREE.Vector3(),tp=new THREE.Vector3();head.getWorldPosition(hp);let hh=0.2;if(top){top.getWorldPosition(tp);hh=hp.distanceTo(tp);}
  const G=window.__helm||{};const R=hh*(G.r||0.5);gear=new THREE.Group();gear.scale.setScalar(1/ws.x);head.add(gear);
  const cy=hh*(G.cy||0.33),cz=hh*(G.cz||-0.03);
  const shell=new THREE.MeshStandardMaterial({color:0x3a3e44,roughness:0.42,metalness:0.1,envMap:envTex,envMapIntensity:0.9});
  const dark=new THREE.MeshStandardMaterial({color:0x17191c,roughness:0.85,envMap:envTex,envMapIntensity:0.25});
  const orange=new THREE.MeshStandardMaterial({color:0xf26a1b,roughness:0.4,envMap:envTex,envMapIntensity:0.6});
  /* shell edge height (in units of R) by azimuth: high at the front (just above the goggles), low over the ears and the back */
  const ss=(e0,e1,x)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t);};const edge=a=>{const b=Math.abs(a);return -0.06-0.56*ss(0.45,1.4,b)-0.34*ss(1.8,2.7,b);};
  helmEdge=edge;
  const SX=1,SY=0.92,SZ=1.16;
  const sg=new THREE.SphereGeometry(R,36,24,0,Math.PI*2,0,Math.PI*0.94),P=sg.attributes.position;
  for(let i=0;i<P.count;i++){let x=P.getX(i),y=P.getY(i),z=P.getZ(i);const a=Math.atan2(x,z),e=edge(a)*R;
    if(y<e){y=e;const r=Math.sqrt(Math.max(0,R*R-y*y)),h=Math.hypot(x,z)||1;x=x/h*r;z=z/h*r;P.setXYZ(i,x,y,z);}}
  sg.computeVertexNormals();
  const hm=new THREE.Mesh(sg,shell);hm.scale.set(SX,SY,SZ);hm.position.set(0,cy,cz);gear.add(hm);
  /* rolled front lip over the goggles */
  const lip=new THREE.Mesh(new THREE.TorusGeometry(R*0.995,R*0.045,6,28,Math.PI*0.62),shell);lip.rotation.set(Math.PI/2,0,Math.PI*0.5-Math.PI*0.31);
  lip.scale.set(SX,SZ,SY);lip.position.set(0,cy+edge(0)*R*SY+R*0.02,cz);gear.add(lip);
  /* vents: four slots across the crown, running front-to-back */
  [[-0.3,0.5],[0.3,0.5],[-0.14,0.05],[0.14,0.05]].forEach(([vx,vz])=>{const v=new THREE.Mesh(new THREE.BoxGeometry(R*0.13,R*0.07,R*0.36),dark);
    const yy=Math.sqrt(Math.max(0,1-vx*vx-vz*vz*0.6));v.position.set(vx*R*SX,cy+yy*R*SY*0.995,cz+vz*R*SZ*0.8);v.rotation.set(-vz*0.9,0,vx*1.3);gear.add(v);});
  /* twin orange stripes on each side, toward the back */
  [-1,1].forEach(sd=>[0,1].forEach(k=>{const st=new THREE.Mesh(new THREE.SphereGeometry(R*1.006,6,6,0,0.075,Math.PI*0.36,Math.PI*0.2),orange);
    st.scale.set(SX,SY,SZ);st.position.set(0,cy,cz);st.rotation.set(0.35*sd,(sd>0?Math.PI*0.5+0.55+k*0.14:-Math.PI*0.5-0.55-k*0.14-0.075),0.25*sd);gear.add(st);}));
  /* ear pads */
  [-1,1].forEach(sd=>{const ep=new THREE.Mesh(new THREE.SphereGeometry(R*0.27,12,8),dark);ep.scale.set(0.35,1,0.9);ep.position.set(sd*R*0.86,cy-R*0.62,cz-R*0.1);gear.add(ep);});
  /* goggles: wide black frame, big mirrored orange lens, strap around the shell */
  const gy=cy+hh*(G.gy||-0.12);
  const strap=new THREE.Mesh(new THREE.CylinderGeometry(R*1.035,R*1.035,R*0.26,30,1,true),dark);strap.scale.set(SX,1,SZ);strap.position.set(0,gy,cz);gear.add(strap);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(R*1.045,R*1.045,R*0.05,30,1,true,Math.PI*0.62,Math.PI*0.76),orange);band.scale.set(SX,1,SZ);band.position.set(0,gy-R*0.07,cz);gear.add(band);
  const frame=new THREE.Mesh(new THREE.SphereGeometry(R*1.1,30,8,Math.PI*0.5-1.0,2.0,Math.PI*0.5-0.2,0.42),dark);frame.scale.set(SX,1,SZ*0.98);frame.position.set(0,gy,cz);gear.add(frame);
  const lens=new THREE.Mesh(new THREE.SphereGeometry(R*1.13,30,8,Math.PI*0.5-0.88,1.76,Math.PI*0.5-0.155,0.32),
    new THREE.MeshStandardMaterial({color:0xff7a1c,metalness:1,roughness:0.05,envMap:envTex,envMapIntensity:1.25,emissive:0x3a1200}));
  lens.scale.set(SX,1,SZ*0.98);lens.position.set(0,gy,cz);gear.add(lens);
  gear.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  /* Meshy helmet (decimated to ~10k tris, one 1024 texture). Replaces the procedural shell once parsed; procedural stays as fallback. */
  try{const bin=atob(document.getElementById('helmdata').textContent.trim());const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(u.buffer,'',g=>{const H2=window.__helm2||{};const hmod=g.scene;
      hmod.traverse(o=>{if(o.isMesh){o.frustumCulled=false;const mt=o.material;if(envTex){mt.envMap=envTex;mt.envMapIntensity=0.8;}mt.needsUpdate=true;}});
      /* model is ±0.81 wide, Y up, facing +Z; scale its width to the shell we tuned the hair tuck for */
      const k=(2*R*SX*(H2.w||1.0))/1.62;hmod.scale.setScalar(k);hmod.position.set(0,cy+R*(H2.y!=null?H2.y:-0.12),cz+R*(H2.z!=null?H2.z:-0.04));hmod.rotation.x=H2.rx||0;
      [...gear.children].forEach(c=>gear.remove(c));gear.add(hmod);},e=>console.warn('helmet model failed, keeping procedural',e));}catch(e){}
  /* tuck the hair inside the helmet: any head vertex above the goggle line that sits outside the shell is pulled onto it */
  let sm=null;model.traverse(o=>{if(o.isSkinnedMesh)sm=o;});
  if(sm){const sk=sm.skeleton,idx=sk.bones.indexOf(head);if(idx>=0){
    const hb=new THREE.Matrix4().copy(sk.boneInverses[idx]).invert();
    const hc=hm.position.clone().multiplyScalar(1/ws.x).applyMatrix4(hb);
    const rot=new THREE.Matrix3().setFromMatrix4(hb),inv=new THREE.Matrix3().copy(rot).transpose();
    const U={uHC:{value:hc},uHT:{value:rot},uHI:{value:inv},uHR:{value:new THREE.Vector3(R*0.95*SX,R*0.95*SY,R*0.95*SZ).multiplyScalar(1/ws.x)}};
    const mat=sm.material;mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
      sh.fragmentShader=sh.fragmentShader.replace('#include <tonemapping_fragment>','gl_FragColor.rgb*=1.-.3*pow(1.-clamp(abs(dot(normal,normalize(vViewPosition))),0.,1.),2.5);\n#include <tonemapping_fragment>');
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 uHC,uHR;uniform mat3 uHT,uHI;').replace('#include <begin_vertex>',`#include <begin_vertex>
        {vec3 dl=uHI*(transformed-uHC);float az=abs(atan(dl.x,dl.z));float tq2=clamp((az-.45)/.95,0.,1.);float ed=-.06-.56*tq2*tq2*(3.-2.*tq2)-.34*smoothstep(1.8,2.7,az);float w=smoothstep(ed-.1,ed+.02,dl.y/uHR.y);vec3 e=dl/uHR;float le=length(e);
         if(le>1.&&w>0.)transformed=mix(transformed,uHC+uHT*((e/le)*uHR),w);}`);};
    mat.customProgramCacheKey=()=>'helmethair';mat.needsUpdate=true;}}
}
const _q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_ax=new THREE.Vector3(),_rw=new THREE.Vector3();const BN={};
function rotBone(b,axW,ang){if(!b||!ang)return;b.parent.getWorldQuaternion(_q1);_ax.copy(axW).applyQuaternion(_q1.invert()).normalize();_q2.setFromAxisAngle(_ax,ang);b.quaternion.premultiply(_q2);b.updateMatrixWorld(true);}
function updModel(dt,tk){
  if(!mixer)return;
  if(animMode==='ride'){let tgt=postS>=0?0.3+postS*0.7:0.3+postS*0.3;tgt+=Math.abs(steer)*0.12;if(S.air)tgt=Math.abs(postS)>0.55?0.85:Math.max(0.5,tgt);if(S.land>0)tgt=Math.max(tgt,0.85);
    crouch+=(clamp(tgt,0,1)-crouch)*Math.min(1,dt*(S.land>0?5:2.4));acts.air_squat.time=0.2+crouch*0.44;}
  else if(animMode==='fall'||animMode==='arise'){crashT+=dt;const clip=acts[CLIP[animMode]].getClip();const dur=(clip.duration-(animMode==='fall'?0.3:0))/1.4;
    if(crashT>dur){if(animMode==='fall')setMode('arise');else{setMode('ride');S.crashed=false;}}}
  if(BN.saved){BN.saved.forEach((q,b)=>b.quaternion.copy(q));BN.saved=null;}
  mixer.update(dt);
  const c=clamp(crouch,0,1),tq=sstep(0.45,1,c);
  if(animMode==='ride'&&BN.spine){BN.saved=new Map();[BN.spine,BN.armL,BN.armR,BN.foreL,BN.foreR,BN.neck,BN.head].forEach(b=>{if(b)BN.saved.set(b,b.quaternion.clone());});skier.updateMatrixWorld(true);_rw.set(1,0,0).applyQuaternion(skier.quaternion);
    rotBone(BN.spine,_rw,POSE.spine*tq);
    rotBone(BN.armL,_rw,POSE.arm*c);rotBone(BN.armR,_rw,POSE.arm*c);
    rotBone(BN.foreL,_rw,-POSE.fore*tq-POSE.foreUp*(1-tq));rotBone(BN.foreR,_rw,-POSE.fore*tq-POSE.foreUp*(1-tq));
    _fw.set(0,0,1).applyQuaternion(skier.quaternion);rotBone(BN.armL,_fw,-POSE.armOut*(1-tq));rotBone(BN.armR,_fw,POSE.armOut*(1-tq));
    rotBone(BN.neck,_rw,POSE.neck*tq+POSE.neck0*c);rotBone(BN.head,_rw,POSE.head*tq+POSE.head0*c);
    const wU=1-sm01((tq-0.15)/0.6);   /* 1 upright → 0 in the tuck */
    /* turn change → plant with the new inside hand (steer>0 turns right; right hand sits at local -x) */
    const ts=steer>0.22?1:steer<-0.22?-1:0;
    if(ts!==0&&ts!==lastTurn){if(lastTurn!==0&&S.state==='ride'&&!S.air&&!S.crashed&&S.v>4&&wU>0.4){const hi=ts>0?1:0;plantT[hi]=0;}lastTurn=ts;}
    for(let i=0;i<2;i++)if(plantT[i]>=0){plantT[i]+=dt;if(plantT[i]>ARM.plantDur)plantT[i]=-1;}
    /* upper body faces partly down the fall line */
    {const g=grad(S.x,S.z);let rel=Math.atan2(-g[0],-g[1])-S.th;rel=Math.atan2(Math.sin(rel),Math.cos(rel));const tgt=(S.air||Math.hypot(g[0],g[1])<0.05)?0:clamp(rel,-0.7,0.7)*ARM.counter;
     counterYaw+=(tgt-counterYaw)*(1-Math.exp(-dt*5));rotBone(BN.spine,_amY,counterYaw*wU);}
    if(wU>0.001&&hands.length===2){skier.updateMatrixWorld(true);
      _aL.set(1,0,0).applyQuaternion(skier.quaternion);_aF.set(0,0,1).applyQuaternion(skier.quaternion);_aU.set(0,1,0).applyQuaternion(skier.quaternion);_aL.applyAxisAngle(_aU,counterYaw*wU);_aF.applyAxisAngle(_aU,counterYaw*wU);
      [[BN.armL,BN.foreL,hands[0],1,0],[BN.armR,BN.foreR,hands[1],-1,1]].forEach(([ua,fa,hd,sx,hi])=>{
        const pe=plantEnv(hi),inside=(sx<0?steer:-steer);
        /* upper arm: down, elbow a little forward and out; reaches forward on a plant, inside arm leads slightly in the carve */
        _amT.copy(_aU).multiplyScalar(-1).addScaledVector(_aF,ARM.elbowFwd+0.3*pe+0.08*Math.max(0,inside)).addScaledVector(_aL,sx*ARM.elbowOut).normalize();aimBone(ua,fa,_amT,wU);
        /* forearm: forward and slightly up; drops toward the snow on a plant */
        _amT.copy(_aF).multiplyScalar(ARM.foreFwd).addScaledVector(_aU,ARM.foreUp-0.55*pe+0.06*Math.max(0,inside)).addScaledVector(_aL,sx*ARM.foreOut).normalize();aimBone(fa,hd,_amT,wU);});}
  }
  if(poles.length===2&&poles[0].visible){skier.updateMatrixWorld(true);
    hands.forEach((h,i)=>{h.getWorldPosition(_v);skier.worldToLocal(_v);
      /* standing: poles hang down and slightly back. Tucked: racer style, shafts run back under the arms, past the hips, tips rising behind */
      const sx=Math.sign(_v.x),tk=tq*tq*(3-2*tq),pt=plantT[i];
      _d.set(sx*(POLE.sOut+(POLE.out-POLE.sOut)*tk),-0.76+(0.76+POLE.rise)*tk,-POLE.sBack-(1-POLE.sBack)*tk).normalize();
      if(pt>=0&&tk<0.6){const p=pt/ARM.plantDur;/* reach: tip swings forward next to the ski tip; plant: tip holds while the skier passes; release back */
        if(p<0.3)_pd.set(sx*0.14,-1,0.5).normalize(),_d.lerp(_pd,sm01(p/0.3)*(1-tk));
        else if(p<0.65){_pd.set(sx*0.14,-1,0.5).normalize();_pd2.set(sx*0.16,-1,-0.3).normalize();_pd.lerp(_pd2,(p-0.3)/0.35);_d.lerp(_pd,1-tk);}
        else{_pd.set(sx*0.16,-1,-0.3).normalize();_pd.lerp(_d,sm01((p-0.65)/0.35));_d.lerp(_pd,1-tk);}
        _d.normalize();}
      const tipLen=_d.y<-0.05?Math.min(POLE.len,(_v.y-0.08)/-_d.y):POLE.len;
      _t.copy(_v).addScaledVector(_d,tipLen);
      const p=poles[i];p.position.copy(_t);_d.negate();p.quaternion.setFromUnitVectors(_u,_d);p.scale.set(1,tipLen+0.12,1);});}
}

