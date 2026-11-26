/* ---------- renderer / scene ---------- */
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
/* render resolution: 0.8x on phones, steps down (to 0.55x) if frames run long, back up only with real headroom.
   Only the drawing buffer changes; CSS size, layout, camera framing and UI scale are untouched. */
const IS_MOBILE=(window.matchMedia&&matchMedia('(pointer:coarse)').matches)||/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const BASE_DPR=Math.min(window.devicePixelRatio||1,1.75);
const RES={max:IS_MOBILE?0.8:1,min:0.55,scale:IS_MOBILE?0.8:1,ema:16.7,t:0};
renderer.setPixelRatio(BASE_DPR*RES.scale);
renderer.shadowMap.enabled=false;   /* contact + decal shadows replace the real-time shadow map */
/* shared tileable noise texture: R large patches, G lumps, B grain, A per-texel random (glitter). Replaces per-pixel ALU noise. */
const noiseTex=(function(){const N=256,d=new Uint8Array(N*N*4);
  function layer(per,oct,seed,ch){const out=new Float32Array(N*N);let amp=.5,tot=0;
    for(let o=0;o<oct;o++){const P=per<<o;const lat=new Float32Array(P*P);for(let i=0;i<P*P;i++)lat[i]=hash2(i%P,(i/P)|0,seed+o*31);
      for(let y=0;y<N;y++){const fy=y/N*P,iy=fy|0;let ty=fy-iy;ty=ty*ty*(3-2*ty);const r0=iy*P,r1=((iy+1)%P)*P;
        for(let x=0;x<N;x++){const fx=x/N*P,ix=fx|0;let tx=fx-ix;tx=tx*tx*(3-2*tx);const ix1=(ix+1)%P;
          const a=lat[r0+ix],b=lat[r0+ix1],c=lat[r1+ix],e=lat[r1+ix1];out[y*N+x]+=amp*(a+(b-a)*tx+(c-a)*ty+(a-b-c+e)*tx*ty);}}
      tot+=amp;amp*=.5;}
    let lo=1e9,hi=-1e9;for(let i=0;i<N*N;i++){lo=Math.min(lo,out[i]);hi=Math.max(hi,out[i]);}
    for(let i=0;i<N*N;i++)d[i*4+ch]=Math.round((out[i]-lo)/(hi-lo)*255);}
  layer(4,3,11,0);layer(16,2,23,1);layer(64,1,37,2);for(let i=0;i<N*N;i++)d[i*4+3]=(hash2(i,7,91)*255)|0;
  const t=new THREE.DataTexture(d,N,N,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;})();
const scene=new THREE.Scene();
const SKY=0xa9cbe9;
scene.background=new THREE.Color(0xcfe0f2);
scene.fog=new THREE.Fog(0xcfe0f2,300,3800);
/* late-morning winter sun, south-southeast (~155°), ~30° up: it lights the east-facing fall lines from the side */
const SUN_DIR=new THREE.Vector3(0.37,0.52,0.8).normalize();
/* sky dome: gradient, sun glow and drifting cumulus in one cheap fragment shader */
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,uniforms:{uSun:{value:SUN_DIR},uTime:{value:0},uNoise:{value:noiseTex},uFogC:{value:new THREE.Color(0xcfe0f2)},uFogK:{value:0}},
  vertexShader:'varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
  fragmentShader:`uniform vec3 uSun;uniform float uTime;uniform sampler2D uNoise;uniform vec3 uFogC;uniform float uFogK;varying vec3 vDir;
  float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s;}
  void main(){vec3 d=normalize(vDir);float h=d.y;
    vec3 zen=vec3(.16,.40,.80),hor=vec3(.81,.88,.95),gnd=vec3(.87,.91,.96);
    vec3 c=h>0.?mix(hor,zen,pow(clamp(h,0.,1.),.5)):gnd;
    float s=max(dot(d,uSun),0.);
    if(h>.01){vec2 uv=d.xz/(h+.18)*1.15+vec2(uTime*.004,uTime*.0015);float n=texture2D(uNoise,uv*.11).r*.62+texture2D(uNoise,uv*.37+.3).g*.38;
      float cl=smoothstep(.52,.82,n)*smoothstep(.01,.22,h);vec3 cc=mix(vec3(.80,.85,.92),vec3(1.),smoothstep(.5,.9,n))+vec3(1.,.9,.75)*pow(s,6.)*.25;c=mix(c,cc,cl*.85);}
    c+=vec3(1.,.88,.68)*(pow(s,10.)*.28+pow(s,600.)*2.);
    c=mix(c,uFogC,uFogK*(1.-.35*smoothstep(.0,.6,h)));   /* weather: overcast sky, whitest at the horizon */
    gl_FragColor=linearToOutputTexel(vec4(c,1.));}`});
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(4000,32,16),skyMat);skyDome.frustumCulled=false;skyDome.renderOrder=-1;scene.add(skyDome);
/* environment map from the same sky, so glossy gear reflects the real sky and snow */
let envTex=null;try{const pm=new THREE.PMREMGenerator(renderer);const es=new THREE.Scene();es.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16),skyMat));envTex=pm.fromScene(es,0.03).texture;pm.dispose();}catch(e){}
const camera=new THREE.PerspectiveCamera(64,1,0.5,6000);
function resize(){const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();

scene.add(new THREE.HemisphereLight(0xdcecff,0x8a93a3,0.56));
const sun=new THREE.DirectionalLight(0xfff0d8,0.78);sun.position.copy(SUN_DIR).multiplyScalar(60);scene.add(sun);scene.add(sun.target);
sun.castShadow=false;sun.shadow.mapSize.set(1024,1024);{const sc=sun.shadow.camera;sc.left=-7;sc.right=7;sc.top=7;sc.bottom=-7;sc.near=1;sc.far=140;}sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.03;sun.shadow.radius=3;
const fill=new THREE.DirectionalLight(0xdfeaff,0.22);fill.position.set(-0.3,0.8,-1);scene.add(fill);

/* ---------- textures ---------- */
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;}
const snowTex=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#fbfdff';g.fillRect(0,0,w,h);for(let i=0;i<260;i++){g.fillStyle='rgba(150,170,198,'+(Math.random()*0.08)+')';g.fillRect(Math.random()*w,Math.random()*h,1,2);}});
const glintTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='rgb(60,60,60)';g.fillRect(0,0,w,h);for(let i=0;i<1400;i++){const v=170+Math.random()*85|0;g.fillStyle='rgb('+v+','+v+','+v+')';g.fillRect(Math.random()*w|0,Math.random()*h|0,1,1);}});
glintTex.wrapS=glintTex.wrapT=THREE.RepeatWrapping;
snowTex.wrapS=snowTex.wrapT=THREE.RepeatWrapping;

const RIDGE_U={uFogC:{value:new THREE.Color(0xcfe0f2)},uFogK:{value:0}};
/* ---------- distant mountains: three layered ridgeline rings, flat-shaded, haze baked in ---------- */
(function(){
  const cx=0,cz=0,yb=430,hz=new THREE.Color(0xcfe0f2),sn=new THREE.Color(),lo=new THREE.Color(),cc=new THREE.Color();
  const sunA=Math.atan2(SUN_DIR.x,SUN_DIR.z);
  const LAYERS=[ /* radius, height range, snow + forest tone, haze, lobes, seed */
    {r:3300,h:[180,430],snow:0xe3e9f0,low:0x5a6e80,haze:.45,lob:9,sd:1.3},
    {r:4300,h:[260,540],snow:0xe8edf3,low:0x7a90a6,haze:.6,lob:7,sd:4.1},
    {r:5400,h:[330,640],snow:0xeef2f7,low:0x9db2c6,haze:.75,lob:5,sd:7.7}];
  const mat=new THREE.MeshBasicMaterial({vertexColors:true,fog:false,side:THREE.DoubleSide});
  /* weather (13-weather.js) washes the ridgelines out toward the fog colour */
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,RIDGE_U);sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uFogC;uniform float uFogK;').replace('#include <fog_fragment>','gl_FragColor.rgb=mix(gl_FragColor.rgb,uFogC,uFogK);');};
  LAYERS.forEach(L=>{const seg=144,P=new Float32Array((seg+1)*3*3),C=new Float32Array((seg+1)*3*3),I=[];
    sn.set(L.snow).lerp(hz,L.haze*.6);lo.set(L.low).lerp(hz,L.haze);
    for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2;
      let t=.5+.27*Math.sin(a*L.lob+L.sd)+.15*Math.sin(a*(L.lob*2+3)+L.sd*2.3)+.07*Math.sin(a*(L.lob*4+1)+L.sd*5.1);t=clamp(t,0,1);
      const top=yb+L.h[0]+(L.h[1]-L.h[0])*t,snowY=top-22-14*Math.sin(a*11+L.sd)-26*(1-t),x=cx+Math.sin(a)*L.r,z=cz+Math.cos(a)*L.r;
      const lit=1+.05*Math.cos(a-sunA);
      [[top,sn,1],[snowY,sn,.93],[yb-220,lo,1]].forEach(([y,col,k],r)=>{const o=(i*3+r)*3;P[o]=x;P[o+1]=y;P[o+2]=z;cc.copy(col).multiplyScalar(k*lit);C[o]=cc.r;C[o+1]=cc.g;C[o+2]=cc.b;});
      if(i<seg)for(let r=0;r<2;r++){const a0=i*3+r,b0=(i+1)*3+r;I.push(a0,a0+1,b0,b0,a0+1,b0+1);}}
    /* lower band blends snow into the layer's forest tone */
    for(let i=0;i<=seg;i++){const o=(i*3+1)*3;cc.setRGB(C[o],C[o+1],C[o+2]).lerp(lo,.7);C[o]=cc.r;C[o+1]=cc.g;C[o+2]=cc.b;}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));g.setIndex(I);
    const m=new THREE.Mesh(g,mat);m.frustumCulled=false;m.renderOrder=-0.5;scene.add(m);});
})();

/* merge several (already transformed) geometries into one, with a flat colour per source geometry */
function mergeGeos(gs,cols){let nv=0,ni=0;gs.forEach(g=>{nv+=g.attributes.position.count;ni+=g.index?g.index.count:g.attributes.position.count;});
  const P=new Float32Array(nv*3),Nn=new Float32Array(nv*3),C=new Float32Array(nv*3),I=new Uint32Array(ni),col=new THREE.Color();let vo=0,io=0;
  gs.forEach((g,k)=>{if(!g.attributes.normal)g.computeVertexNormals();const p=g.attributes.position,n=g.attributes.normal,c=cols?cols[k]:1;
    if(typeof c==='number'&&c<=4)col.setRGB(c,c,c);else col.set(c);
    for(let i=0;i<p.count;i++){const o=(vo+i)*3;P[o]=p.getX(i);P[o+1]=p.getY(i);P[o+2]=p.getZ(i);Nn[o]=n.getX(i);Nn[o+1]=n.getY(i);Nn[o+2]=n.getZ(i);C[o]=col.r;C[o+1]=col.g;C[o+2]=col.b;}
    if(g.index)for(let i=0;i<g.index.count;i++)I[io+i]=g.index.getX(i)+vo;else for(let i=0;i<p.count;i++)I[io+i]=i+vo;
    vo+=p.count;io+=g.index?g.index.count:p.count;});
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.BufferAttribute(P,3));out.setAttribute('normal',new THREE.BufferAttribute(Nn,3));out.setAttribute('color',new THREE.BufferAttribute(C,3));out.setIndex(new THREE.BufferAttribute(I,1));return out;}
/* three r128 cones emit one zero-area triangle per segment at the apex: half of every tree's triangles drew nothing */
function dropDegen(g){const P=g.attributes.position.array,I=g.index.array,keep=[];
  for(let t=0;t<I.length;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2];
    const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;if(cx*cx+cy*cy+cz*cz>1e-12)keep.push(I[t],I[t+1],I[t+2]);}
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(keep),1));return g;}
const _mm=new THREE.Matrix4(),_mq=new THREE.Quaternion(),_mp=new THREE.Vector3(),_ms=new THREE.Vector3(1,1,1),_mY=new THREE.Vector3(0,1,0);
function placed(g,x,y,z,ry){_mq.setFromAxisAngle(_mY,ry||0);_mp.set(x,y,z);_mm.compose(_mp,_mq,_ms);return g.applyMatrix4(_mm);}

