/* ---------- weather: fog that thickens with altitude and drifts over time, falling snow, cloud wisps on the upper mountain ----------
   One slow "cloudiness" cycle drives everything, on one continuous clock (lifts, lift tops and runs alike), so weather never
   jumps between them. Altitude scales it: the summits fog in, the
   base mostly stays clear. Cost: a few uniforms per frame, plus two draw calls (snow points, wisp quads) that are skipped when invisible.
   Guardrail: visibility never drops below ~200 m, so signs and the next pitch stay readable at speed. */
let wxSnap=false;   /* WX.snap (tests) or WX.once frames left (a new run's light, behind the fade): jump straight to the target */
const WX={once:0,alt0:780,alt1:1180,farMin:200,nearMin:6,cycle:0.7,force:null,lo:0,hi:1,far0:3800,near0:300,skyK:0,ridgeK:0};   /* lo..hi, far0/near0, skyK/ridgeK: set by the light preset (16-look.js) */window.__wx=WX;
const WXS={cloud:0,k:0,snow:0,wisp:0,t0:performance.now()/1000};   /* smoothed state */
const FOG_CLEAR=new THREE.Color(0xcfe0f2),FOG_THICK=new THREE.Color(0xdde3ea),_fogC=new THREE.Color();
let SUN_I=sun.intensity;
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return ((h>>>0)%10000)/10000;}
/* 0 clear … 1 socked in. Two slow sines (≈82 s and ≈190 s at cycle 0.7): roughly half the time clear, the rest flurries building to thick cloud */
function cloudAt(t,seed){const p=seed*TAU;const c=0.5+0.32*Math.sin(t*0.11+p)+0.18*Math.sin(t*0.047+p*2.7+1.3);return sstep(0.36,0.86,c);}

/* ---- falling snow: 4,000 points in a 22 m box that wraps around the camera; all motion in the vertex shader ---- */
const SNOW_N=4000,SNOW_B=22;
const snowMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,
  uniforms:{uT:{value:0},uCam:{value:new THREE.Vector3()},uAmt:{value:0},uPx:{value:1}},
  vertexShader:`attribute float aR;uniform float uT,uAmt,uPx;uniform vec3 uCam;varying float vA;
  void main(){float B=${SNOW_B.toFixed(1)};
    vec3 p=position+vec3(sin(uT*.7+aR*40.)*.6+uT*.8,-uT*(1.1+aR*.9),cos(uT*.5+aR*31.)*.6+uT*.35);
    p=mod(p-uCam+B*.5,B)-B*.5+uCam;
    vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
    float d=-mv.z;vA=step(aR,uAmt)*smoothstep(.6,2.,d)*(1.-smoothstep(B*.32,B*.5,d));
    gl_PointSize=vA>0.?uPx*(.08+aR*.07)*320./max(d,.5):0.;}`,
  fragmentShader:`varying float vA;void main(){vec2 c=gl_PointCoord-.5;float a=smoothstep(.5,.15,length(c))*vA*.9;if(a<.02)discard;gl_FragColor=vec4(1.,1.,1.,a);}`});
const snowPts=(function(){const g=new THREE.BufferGeometry(),P=new Float32Array(SNOW_N*3),R=new Float32Array(SNOW_N);
  for(let i=0;i<SNOW_N;i++){P[i*3]=hash2(i,1,501)*SNOW_B;P[i*3+1]=hash2(i,2,502)*SNOW_B;P[i*3+2]=hash2(i,3,503)*SNOW_B;R[i]=hash2(i,4,504);}
  g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('aR',new THREE.BufferAttribute(R,1));
  const m=new THREE.Points(g,snowMat);m.frustumCulled=false;m.renderOrder=5;m.visible=false;scene.add(m);return m;})();

/* ---- cloud wisps: 18 camera-facing soft quads in one mesh, drifting across the upper mountain ---- */
const WISP_N=18;
const wispTex=canvasTex(128,64,(g,w,h)=>{for(let i=0;i<26;i++){const x=w*(0.18+0.64*Math.random()),y=h*(0.35+0.3*Math.random()),r=h*(0.14+0.2*Math.random());
  const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.22)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);}});
const wispMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,
  uniforms:{uTex:{value:wispTex},uCol:{value:new THREE.Color(0xf1f4f8)},uFar:{value:3800},uGr:{value:GRADE}},
  vertexShader:`attribute vec3 aC;attribute vec3 aS;varying vec2 vUv;varying float vA;uniform float uFar;
  void main(){vec4 c=modelViewMatrix*vec4(aC,1.);vec2 o=position.xy*aS.xy;c.xy+=o;gl_Position=projectionMatrix*c;vUv=uv;
    float d=-c.z;vA=aS.z*smoothstep(14.,45.,d)*(1.-smoothstep(uFar*.7,uFar,d));}`,
  fragmentShader:`uniform sampler2D uTex;uniform vec3 uCol;varying vec2 vUv;varying float vA;void main(){float a=min(.85,texture2D(uTex,vUv).a*1.7)*vA;if(a<.01)discard;gl_FragColor=vec4(kGrade(uCol),a);}`});
const wisp=(function(){const g=new THREE.BufferGeometry(),P=[],U=[],I=[];
  for(let i=0;i<WISP_N;i++){const b=i*4;P.push(-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0);U.push(0,0,1,0,1,1,0,1);I.push(b,b+1,b+2,b,b+2,b+3);}
  g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);
  const C=new THREE.BufferAttribute(new Float32Array(WISP_N*4*3),3),Sz=new THREE.BufferAttribute(new Float32Array(WISP_N*4*3),3);C.setUsage(THREE.DynamicDrawUsage);Sz.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aC',C);g.setAttribute('aS',Sz);const m=new THREE.Mesh(g,wispMat);m.frustumCulled=false;m.renderOrder=4;m.visible=false;scene.add(m);
  return {m,C,Sz,w:Array.from({length:WISP_N},()=>({x:0,z:0,y:0,h:0,s:0,a:0,live:false}))};})();
const WIND={x:2.2,z:0.9};
function wispSpawn(o,cx,cz,dir,first){
  /* somewhere 70–320 m out, mostly ahead of the camera; only over high ground */
  for(let k=0;k<6;k++){const a=dir+(Math.random()-0.5)*(first?TAU:2.2),r=70+Math.random()*250,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r,gh=H(x,z);
    if(gh<WX.alt0-20)continue;o.x=x;o.z=z;o.h=4+Math.random()*22;o.s=36+Math.random()*44;o.a=0;o.live=true;o.k=sstep(WX.alt0-20,WX.alt0+150,gh);return;}
  o.live=false;}
function updWisps(dt,amt){const W=wisp,cx=camera.position.x,cz=camera.position.z,dir=S.th;let any=false;
  for(let i=0;i<WISP_N;i++){const o=W.w[i];
    if(!o.live||Math.hypot(o.x-cx,o.z-cz)>380){wispSpawn(o,cx,cz,dir,!o.live);if(!o.live)continue;}
    o.x+=WIND.x*dt;o.z+=WIND.z*dt;o.y=H(o.x,o.z)+o.h;o.a=wxSnap?1:Math.min(1,o.a+dt*0.4);   /* fade in after (re)spawning */
    const al=Math.min(1,amt*o.a*o.k*1.6);if(al>0.01)any=true;
    for(let v=0;v<4;v++){const j=(i*4+v)*3;W.C.array[j]=o.x;W.C.array[j+1]=o.y;W.C.array[j+2]=o.z;W.Sz.array[j]=o.s;W.Sz.array[j+1]=o.s*0.42;W.Sz.array[j+2]=al;}}
  W.C.needsUpdate=true;W.Sz.needsUpdate=true;return any;}

/* ---- valley cloud banks: every few minutes a sea of cloud rolls through the valleys below you, mostly when it's clear up top.
   10 big soft camera-facing quads in one mesh (1 draw call), 400-1,900 m out, floating 110-280 m below the camera over lower ground, drifting slowly. ---- */
const BANK_N=10;
const bankTex=canvasTex(256,96,(g,w,h)=>{for(let i=0;i<70;i++){const x=w*(0.1+0.8*Math.random()),y=h*(0.42+0.22*Math.random()-0.1*Math.abs(x/w-0.5)),r=h*(0.12+0.22*Math.random());
  const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.16)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);}});
const bankMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,
  uniforms:{uTex:{value:bankTex},uCol:{value:new THREE.Color(0xf4f6f9)},uShade:{value:new THREE.Color(0xc9d2dd)},uGr:{value:GRADE}},
  vertexShader:`attribute vec3 aC;attribute vec3 aS;varying vec2 vUv;varying float vA;
  void main(){vec4 c=modelViewMatrix*vec4(aC,1.);c.xy+=position.xy*aS.xy;gl_Position=projectionMatrix*c;vUv=uv;
    float d=-c.z;vA=aS.z*smoothstep(150.,380.,d)*(1.-smoothstep(1900.,2400.,d));}`,
  fragmentShader:`uniform sampler2D uTex;uniform vec3 uCol,uShade;varying vec2 vUv;varying float vA;
  void main(){float a=min(.8,texture2D(uTex,vUv).a*1.9)*vA;if(a<.01)discard;gl_FragColor=vec4(kGrade(mix(uShade,uCol,smoothstep(.15,.75,vUv.y))),a);}`});
const banks=(function(){const g=new THREE.BufferGeometry(),P=[],U=[],I=[];
  for(let i=0;i<BANK_N;i++){const b=i*4;P.push(-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0);U.push(0,0,1,0,1,1,0,1);I.push(b,b+1,b+2,b,b+2,b+3);}
  g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);
  const C=new THREE.BufferAttribute(new Float32Array(BANK_N*12),3),Sz=new THREE.BufferAttribute(new Float32Array(BANK_N*12),3);C.setUsage(THREE.DynamicDrawUsage);Sz.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aC',C);g.setAttribute('aS',Sz);const m=new THREE.Mesh(g,bankMat);m.frustumCulled=false;m.renderOrder=3;m.visible=false;scene.add(m);
  return {m,C,Sz,b:Array.from({length:BANK_N},()=>({x:0,z:0,y:0,w:0,a:0,ph:Math.random()*6,live:false}))};})();
function bankSpawn(o,cx,cy,cz,dir,first){
  for(let k=0;k<8;k++){const a=dir+(Math.random()-0.5)*(first?5:2.6),r=400+Math.random()*1500,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r,gh=H(x,z);
    /* a layer 110-280 m below you (like a sea of cloud below the summits), never into the ground */
    const y=Math.max(gh+30,cy-110-Math.random()*170);if(y>cy-90||gh>y-20)continue;o.x=x;o.z=z;o.y=y;o.w=280+Math.random()*340;o.a=first?1:0;o.live=true;return;}
  o.live=false;}
function updBanks(dt,amt,t){const B=banks,cx=camera.position.x,cy=camera.position.y,cz=camera.position.z,dir=S.th;let any=false;
  for(let i=0;i<BANK_N;i++){const o=B.b[i];
    if(!o.live||Math.hypot(o.x-cx,o.z-cz)>2300||o.y>cy-60){bankSpawn(o,cx,cy,cz,dir,!o.live);if(!o.live){for(let v=0;v<4;v++)B.Sz.array[(i*4+v)*3+2]=0;continue;}}
    o.x+=WIND.x*0.8*dt;o.z+=WIND.z*0.8*dt;o.a=wxSnap?1:Math.min(1,o.a+dt*0.08);
    const br=1+0.07*Math.sin(t*0.09+o.ph),al=amt*o.a*0.9;if(al>0.01)any=true;
    for(let v=0;v<4;v++){const j=(i*4+v)*3;B.C.array[j]=o.x;B.C.array[j+1]=o.y;B.C.array[j+2]=o.z;B.Sz.array[j]=o.w*br;B.Sz.array[j+1]=o.w*0.3*br;B.Sz.array[j+2]=al;}}
  B.C.needsUpdate=true;B.Sz.needsUpdate=true;return any;}

function weatherFrame(dt,now){wxSnap=WX.snap||WX.once>0;if(WX.once>0)WX.once--;
  const map=typeof MAP!=='undefined'&&MAP.on;
  const riding=S.state==='ride'||S.state==='finishing'||S.state==='paused';
  /* one continuous weather clock for lifts, lift tops and runs, so nothing jumps when you pick a trail */
  const t=now/1000-WXS.t0,seed=0.37;
  const cl=WX.force!=null?WX.force:clamp(cloudAt(t*WX.cycle,seed),WX.lo,WX.hi);
  const camY=camera.position.y,alt=sstep(WX.alt0,WX.alt1,camY);
  /* fog: a light haze down low even in cloud, socked in up top */
  /* at a lift top while choosing a trail: moderate fog at most, so you can see the signs and where the trails go */
  const kT=Math.min(S.pre&&riding?0.55:1,clamp(cl*(0.18+0.82*alt),0,1)),sT=clamp(cl*(0.25+0.75*alt)*1.15-0.08,0,1),wT=cl*alt;
  const f=wxSnap?1:1-Math.exp(-dt*0.3);   /* ~3 s ease: fog closes in gradually as you ski off the top */   /* WX.snap: tests jump straight to the target */WXS.k+=(kT-WXS.k)*f;WXS.snow+=(sT-WXS.snow)*f;WXS.wisp+=(wT-WXS.wisp)*f;
  const k=map?0:WXS.k;
  if(!map){const e=k*k*(3-2*k);scene.fog.far=WX.far0+(WX.farMin-WX.far0)*Math.pow(e,0.6);scene.fog.near=WX.near0+(WX.nearMin-WX.near0)*Math.pow(e,0.5);
    _fogC.copy(FOG_CLEAR).lerp(FOG_THICK,e);scene.fog.color.copy(_fogC);scene.background.copy(_fogC);
    skyMat.uniforms.uFogC.value.copy(_fogC);skyMat.uniforms.uFogK.value=Math.min(1,Math.max(WX.skyK,e*1.15));
    RIDGE_U.uFogC.value.copy(_fogC);RIDGE_U.uFogK.value=Math.min(1,Math.max(WX.ridgeK,e*1.6));
    sun.intensity=SUN_I*(1-0.35*e);wispMat.uniforms.uFar.value=scene.fog.far;}
  else{skyMat.uniforms.uFogK.value=WX.skyK;RIDGE_U.uFogK.value=WX.ridgeK;skyMat.uniforms.uFogC.value.copy(FOG_CLEAR);RIDGE_U.uFogC.value.copy(FOG_CLEAR);sun.intensity=SUN_I;scene.fog.color.copy(FOG_CLEAR);scene.background.copy(FOG_CLEAR);}
  /* snow */
  const sn=map?0:WXS.snow;snowPts.visible=sn>0.02;
  if(snowPts.visible){const u=snowMat.uniforms;u.uT.value=now/1000;u.uCam.value.copy(camera.position);u.uAmt.value=sn;u.uPx.value=renderer.getPixelRatio()*window.innerHeight/844;}
  /* wisps */
  const wa=map?0:WXS.wisp;wisp.m.visible=wa>0.02&&updWisps(dt,wa);
  /* valley cloud: its own slow cycle (~5 min), strongest when it's clear where you are */
  {const inv=WX.forceBank!=null?WX.forceBank:sstep(0.45,0.85,0.5+0.35*Math.sin(t*0.021+1.7)+0.15*Math.sin(t*0.0083+0.4));const bT=inv*(1-0.85*WXS.k);
   WXS.bank=(WXS.bank||0)+(bT-(WXS.bank||0))*(wxSnap?1:1-Math.exp(-dt*0.15));const ba=map?0:WXS.bank;banks.m.visible=ba>0.02&&updBanks(dt,ba,t);}
}
window.__kr.weather=()=>({bank:+(WXS.bank||0).toFixed(2),bankVis:banks.m.visible,cloud:WX.force!=null?WX.force:null,k:+WXS.k.toFixed(3),snow:+WXS.snow.toFixed(3),wisp:+WXS.wisp.toFixed(3),near:Math.round(scene.fog.near),far:Math.round(scene.fog.far),camY:Math.round(camera.position.y),wispVis:wisp.m.visible,wispLive:wisp.w.filter(o=>o.live).length,wispD:wisp.w.filter(o=>o.live).map(o=>Math.round(Math.hypot(o.x-camera.position.x,o.z-camera.position.z))).sort((a,b)=>a-b).slice(0,4)});
