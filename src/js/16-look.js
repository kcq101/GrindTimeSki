/* ---------- light presets, speed streaks ----------
   A preset sets the sun (direction, colour, strength), sky and ground fill, the haze colour and distance, the sky dome's colours,
   how far the weather may go, and the colour grade (GRADE, 03-scene.js). Changing one is a handful of uniform writes: no shader
   recompiles, nothing rebuilt. "Changing" is the original light with the full weather cycle; the others hold the weather to suit.
   grade: exposure, contrast (S-curve), saturation, black lift, shadow tint rgb, highlight tint rgb (offsets; 0 = none). */
const LIGHTS={
  changing:{label:'Changing',sun:[0.37,0.52,0.8],sunC:0xfff0d8,sunI:0.78,hemi:[0xdcecff,0x8a93a3,0.56],fill:0.22,fog:0xcfe0f2,thick:0xdde3ea,far0:3800,near0:300,
    zen:[.16,.40,.80],hor:[.81,.88,.95],glow:[1,.88,.68],skyK:0,ridgeK:0,wx:[0,1],grade:[0,.35,.08,.012,-.018,-.004,.028,.006,.003,-.004]},
  bluebird:{label:'Bluebird',sun:[0.37,0.58,0.78],sunC:0xfff3e0,sunI:0.82,hemi:[0xd6e8ff,0x8a93a3,0.54],fill:0.22,fog:0xc9ddf3,thick:0xd6dfe9,far0:4200,near0:400,
    zen:[.10,.33,.78],hor:[.74,.85,.96],glow:[1,.9,.72],skyK:0,ridgeK:0,wx:[0,0.3],grade:[0,.4,.14,.01,-.02,-.004,.032,.006,.003,-.004]},
  golden:{label:'Golden hour',sun:[-0.6,0.38,0.7],sunC:0xffb468,sunI:0.98,hemi:[0xd8cfe8,0x7a7280,0.62],fill:0.16,fog:0xe9cdb8,thick:0xddc9c2,far0:3400,near0:250,
    zen:[.21,.33,.66],hor:[1,.79,.58],glow:[1,.6,.3],skyK:0,ridgeK:0.3,wx:[0,0.25],grade:[0,.4,.1,.014,-.016,0,.026,.04,.012,-.04]},
  flat:{label:'Flat light',sun:[0.2,0.85,0.45],sunC:0xf1f4f9,sunI:0.3,hemi:[0xeef2f7,0xa6aeb9,0.92],fill:0.1,fog:0xd5dae0,thick:0xdde1e6,far0:2100,near0:120,
    zen:[.70,.74,.80],hor:[.86,.88,.91],glow:[.22,.22,.22],skyK:0.8,ridgeK:0.55,wx:[0.45,1],grade:[0,-.04,-.18,.02,0,0,.008,0,0,0]}};
let lightId='changing';
function applyLight(id){const P=LIGHTS[id]||LIGHTS.changing;lightId=LIGHTS[id]?id:'changing';
  SUN_DIR.set(...P.sun).normalize();sun.position.copy(SUN_DIR).multiplyScalar(60);_sunAway.set(-SUN_DIR.x,0,-SUN_DIR.z).normalize();
  sun.color.setHex(P.sunC);SUN_I=P.sunI;sun.intensity=P.sunI;hemi.color.setHex(P.hemi[0]);hemi.groundColor.setHex(P.hemi[1]);hemi.intensity=P.hemi[2];fill.intensity=P.fill;
  FOG_CLEAR.setHex(P.fog);FOG_THICK.setHex(P.thick);Object.assign(WX,{far0:P.far0,near0:P.near0,skyK:P.skyK,ridgeK:P.ridgeK,lo:P.wx[0],hi:P.wx[1]});
  const u=skyMat.uniforms;u.uZen.value.setRGB(...P.zen);u.uHor.value.setRGB(...P.hor);u.uGlow.value.setRGB(...P.glow);
  const g=P.grade;GRADE.set([g[0],g[1],g[2],g[3],g[4],g[5],g[6],0,g[7],g[8],g[9],0]);
  try{localStorage.setItem('kr_light',lightId);}catch(e){}
  document.querySelectorAll('.lite button').forEach(b=>b.classList.toggle('on',b.dataset.l===lightId));}
/* the light picker on the trail-map sheet: the map re-lights as you tap, so you see it before you drop in */
function liteChips(){return '<div class="lite"><span>Light</span>'+Object.keys(LIGHTS).map(k=>'<button data-l="'+k+'"'+(k===lightId?' class="on"':'')+'>'+LIGHTS[k].label+'</button>').join('')+'</div>';}
function wireLite(){document.querySelectorAll('.lite button').forEach(b=>b.onclick=()=>applyLight(b.dataset.l));}
{let s=null;try{s=localStorage.getItem('kr_light');}catch(e){}applyLight(s||'changing');}

/* speed streaks: 220 thin snow-dust streaks in a 22 m box that wraps around the camera, each stretched along your motion over the
   last ~0.075 s, so they read as speed. All in the vertex shader (one draw call, 440 triangles), only above ~35 mph. */
const STREAK_N=220,STREAK_B=22;
const streakMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  uniforms:{uCam:{value:new THREE.Vector3()},uVel:{value:new THREE.Vector3()},uAmt:{value:0},uW:{value:1.5},uRes:{value:new THREE.Vector2(1,1)}},
  vertexShader:`attribute vec4 aSeed;attribute vec2 aEnd;uniform vec3 uCam,uVel;uniform float uAmt,uW;uniform vec2 uRes;varying float vA,vS;
  void main(){float B=${STREAK_B.toFixed(1)};
    vec3 p=vec3(aSeed.x*B,aSeed.y*6.,aSeed.z*B);p=mod(p-uCam+vec3(B*.5,2.,B*.5),vec3(B,6.,B))-vec3(B*.5,2.,B*.5)+uCam;
    vec3 t=p-uVel*.09;mat4 pv=projectionMatrix*viewMatrix;vec4 h=pv*vec4(p,1.),q=pv*vec4(t,1.);
    float d=distance(p,uCam);vA=uAmt*aSeed.w*smoothstep(1.,3.,d)*(1.-smoothstep(7.,11.,d));
    if(vA<.004||h.w<.3||q.w<.3){gl_Position=vec4(0.,0.,2.,1.);vA=0.;vS=0.;return;}
    vec2 a=h.xy/h.w,b=q.xy/q.w,dd=(a-b)*uRes;vec2 n=normalize(vec2(-dd.y,dd.x)+1e-4)/uRes;
    vec4 c=mix(h,q,aEnd.x);c.xy+=n*aEnd.y*uW*2.*c.w;vS=aEnd.y;gl_Position=c;}`,
  fragmentShader:`varying float vA,vS;void main(){gl_FragColor=vec4(vec3(.9,.95,1.)*vA*(1.-vS*vS)*.5,1.);}`});
const streaks=(function(){const N=STREAK_N,S4=new Float32Array(N*4*4),E=new Float32Array(N*4*2),I=[];
  for(let i=0;i<N;i++){const sd=[hash2(i,1,701),hash2(i,2,702),hash2(i,3,703),0.45+0.55*hash2(i,4,704)];
    [[0,-1],[0,1],[1,-1],[1,1]].forEach(([e,s],v)=>{const o=i*4+v;S4.set(sd,o*4);E[o*2]=e;E[o*2+1]=s;});const b=i*4;I.push(b,b+2,b+1,b+1,b+2,b+3);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*4*3),3));g.setAttribute('aSeed',new THREE.BufferAttribute(S4,4));g.setAttribute('aEnd',new THREE.BufferAttribute(E,2));g.setIndex(I);
  const m=new THREE.Mesh(g,streakMat);m.frustumCulled=false;m.renderOrder=6;m.visible=false;scene.add(m);return m;})();
const STREAK={on:true,amt:0,force:null,vel:null},_lkP=new THREE.Vector3(),_lkV=new THREE.Vector3(),_lkT=new THREE.Vector3();let _lkInit=false;window.__streak=STREAK;
function lookFrame(dt){const cp=camera.position,u=streakMat.uniforms;
  if(!_lkInit||dt<=0||cp.distanceToSquared(_lkP)>400){_lkP.copy(cp);_lkV.set(0,0,0);_lkInit=true;}
  else{_lkV.lerp(_lkT.copy(cp).sub(_lkP).divideScalar(dt),1-Math.exp(-dt*12));_lkP.copy(cp);}
  if(STREAK.vel)_lkV.copy(STREAK.vel);   /* tests: a fixed motion */
  /* strength and length follow the skier's real speed (the camera can lurch when it catches up); the camera gives the direction */
  const ride=S.state==='ride'||S.state==='finishing',sp=ride?S.v:0,tgt=STREAK.force!=null?STREAK.force:(STREAK.on&&ride?sstep(15,28,sp):0);
  STREAK.amt+=(tgt-STREAK.amt)*(1-Math.exp(-dt*4));streaks.visible=STREAK.amt>0.01;
  if(streaks.visible){u.uCam.value.copy(cp);u.uVel.value.copy(_lkV);if(!STREAK.vel&&ride){const l=_lkV.length();if(l>0.5)u.uVel.value.multiplyScalar(Math.max(sp,5)/l);}u.uAmt.value=STREAK.amt;const db=renderer.domElement;u.uRes.value.set(db.width,db.height);u.uW.value=Math.max(1.2,renderer.getPixelRatio()*1.1);}}
window.__kr.light={apply:applyLight,get id(){return lightId},LIGHTS,GRADE,streaks};
