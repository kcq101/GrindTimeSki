/* ---------- streamed terrain tiles (built procedurally around the skier) ---------- */
const TILE=128,LOAD_R=700,NEAR_R=300,tiles=new Map(),tileQ=[];
const terrMat=new THREE.MeshPhongMaterial({vertexColors:true,map:snowTex,specularMap:glintTex,specular:0xbfc8d4,shininess:80,side:THREE.DoubleSide});
const bumpTex=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#fbfdff';g.fillRect(0,0,w,h);for(let i=0;i<900;i++){g.fillStyle='rgba(140,160,190,'+(Math.random()*0.10)+')';g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*2,1+Math.random()*2);}});
bumpTex.wrapS=bumpTex.wrapT=THREE.RepeatWrapping;
const terrMatFine=new THREE.MeshPhongMaterial({vertexColors:true,map:bumpTex,specularMap:glintTex,specular:0xbfc8d4,shininess:80,side:THREE.DoubleSide});
/* snow: blue-tinted shade, sun glitter that twinkles as you move, bright sheen at grazing angles */
/* snow surface, cheap: 3 noise-texture fetches + 3 track-texture fetches per pixel, no loops.
   on piste   – a few soft ski-track pairs where people actually ski (middle of the trail, fading toward the edges),
                scraped hardpack in busy spots, corduroy only in a few untouched patches
   trail edge – brighter, softly lumpy pushed-off snow
   off piste  – soft, gently lumpy powder
   plus blue shade, sun glitter and a grazing-angle sheen */
const trackTex=(function(){const W=512,Hh=512,cv=document.createElement('canvas');cv.width=W;cv.height=Hh;const g=cv.getContext('2d');
  g.fillStyle='#000';g.fillRect(0,0,W,Hh);g.lineCap='round';
  /* texture spans 32 m across × 48 m downhill; 4 track pairs (one every ~8 m), each a smooth turn sequence that tiles vertically */
  const pairs=[[70,22,1,.4,1],[190,30,2,2.1,.85],[318,18,1,4.0,.95],[440,26,2,5.3,.75]];
  pairs.forEach(([x0,amp,k,ph,str])=>{const gap=4.6;
    for(let y=0;y<=Hh;y+=2){const t=y/Hh,x=x0+amp*Math.sin(t*k*Math.PI*2+ph),fade=.55+.45*Math.sin(t*Math.PI*2*(k+1)+ph*1.7);
      const a=str*Math.max(0,fade);
      [[x-gap/2],[x+gap/2]].forEach(([xx])=>{[[7,.08],[4.2,.18],[2.2,.4]].forEach(([w,al])=>{g.fillStyle='rgba(255,255,255,'+(al*a).toFixed(3)+')';g.beginPath();g.ellipse(xx,y,w/2,1.6,0,0,Math.PI*2);g.fill();});});}});
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;})();
const SNOW_GLSL=`
uniform sampler2D uNoise,uTrk;varying vec3 vWP;varying vec4 vT;
`;
function snowify(mat){mat.extensions={derivatives:true};mat.onBeforeCompile=sh=>{
  sh.uniforms.uNoise={value:noiseTex};sh.uniforms.uTrk={value:trackTex};
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 aT;varying vec3 vWP;varying vec4 vT;')
    .replace('#include <project_vertex>','#include <project_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;vT=aT;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+SNOW_GLSL+'\nfloat sIce=0.;float sHgt=0.;float sGl=0.;vec2 sCordG=vec2(0.);')
  .replace('#include <color_fragment>',`#include <color_fragment>
    {vec2 p=vWP.xz;vec2 ud=vT.zw/max(length(vT.zw),1e-3);vec2 q=vec2(p.x*ud.y-p.y*ud.x,dot(p,ud));float cd=distance(cameraPosition,vWP);float near=1.-smoothstep(25.,95.,cd);
     float onP=1.-smoothstep(-1.5,1.5,vT.x);
     float edge=(1.-smoothstep(1.,5.,abs(vT.x+1.5)))*.9;
     vec4 nA=texture2D(uNoise,p*(1./180.));
     vec4 nB=texture2D(uNoise,p*(1./24.));
     sGl=texture2D(uNoise,p*(1./11.)).a;
     float lane=onP*smoothstep(1.02,.62,vT.y)*smoothstep(.3,.62,nA.r+.12);
     /* ski tracks: the groove's slope comes from two neighbouring texture samples (8 cm over), per pixel, not from 2×2-block
        screen derivatives, which chopped each thin track into a dashed line */
     vec2 tq=vec2(q.x*(1./32.),q.y*(1./48.));float t0=texture2D(uTrk,tq).r;
     float trk=t0*lane*near;
     vec2 tg=vec2(texture2D(uTrk,tq+vec2(.08/32.,0.)).r-t0,texture2D(uTrk,tq+vec2(0.,.08/48.)).r-t0)*(-.03*lane*near/.08);
     float traffic=onP*smoothstep(.42,.72,nA.r+.22*(1.-clamp(vT.y,0.,1.)));
     sIce=traffic*smoothstep(.64,.82,nA.g);
     float cordMask=onP*(1.-traffic)*smoothstep(.7,.84,nA.b)*.7;
     /* corduroy: a smooth (cosine) ridge every 32 cm. Its lighting uses the exact slope of the ridge (sCordG, world xz), not
        screen-space derivatives: those are computed per 2×2 pixel block, which at reduced render scale broke each ridge into
        a row of dots. Faded out where a ridge spans fewer than ~7 render pixels, so it never aliases into moiré. */
     float cq=q.x/.32,cfw=fwidth(cq),cfade=cordMask*(1.-smoothstep(.07,.15,cfw))*near;
     float cord=cfade*(.5+.5*cos(6.2832*cq));
     sCordG=vec2(ud.y,-ud.x)*(.0982*cfade*sin(6.2832*cq)+tg.x)+ud*tg.y;
     sHgt=near*((nB.g-.5)*(.045+.08*edge+.03*(1.-onP)+.035*traffic)+(nB.b-.5)*.008/* tracks and corduroy tilt the normal through sCordG */);
     vec3 c=diffuseColor.rgb;
     c*=1.-onP*.035*(1.-nA.r);
     c=mix(c,c*vec3(.88,.92,.97),sIce*.8);
     c*=1.-trk*.11-cord*.05;
     c=mix(c,min(c*1.03,vec3(1.)),max(edge,1.-onP)*.7);
     diffuseColor.rgb=c;}`)
  .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    {vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);vec3 r1=cross(sy,normal),r2=cross(normal,sx);float det=dot(sx,r1);
     vec3 grad=sign(det)*(dFdx(sHgt)*r1+dFdy(sHgt)*r2);normal=normalize(abs(det)*normal-grad);
     normal=normalize(normal-(viewMatrix*vec4(sCordG.x,0.,sCordG.y,0.)).xyz);}`)
  .replace('#include <specularmap_fragment>','#include <specularmap_fragment>\nspecularStrength=specularStrength*(1.-sIce)+sIce*.9;')
  .replace('#include <envmap_fragment>',`
    float dl=length(reflectedLight.directDiffuse);
    outgoingLight=mix(outgoingLight*vec3(.74,.84,1.),outgoingLight,smoothstep(.06,.55,dl));
    vec3 Vw=normalize(cameraPosition-vWP);float cd2=distance(cameraPosition,vWP);
    float tw=fract(sGl*23.7+dot(Vw,vec3(4.1,2.3,3.7))*1.6);
    outgoingLight+=vec3(1.,.97,.9)*step(.985,sGl)*smoothstep(.82,1.,tw)*(1.-smoothstep(14.,60.,cd2))*smoothstep(.2,.7,dl)*1.3;
    float fr=pow(1.-clamp(abs(dot(normal,normalize(vViewPosition))),0.,1.),4.);
    outgoingLight=mix(outgoingLight,vec3(.97,.985,1.),fr*.28);
    #include <envmap_fragment>`);};
  mat.customProgramCacheKey=()=>'snow7';}
snowify(terrMat);snowify(terrMatFine);
function branchy(g,lobes){const P=g.attributes.position;for(let i=0;i<P.count;i++){const x=P.getX(i),z=P.getZ(i),r=Math.hypot(x,z);if(r<1e-4)continue;const a=Math.atan2(x,z),k=0.8+0.2*Math.cos(a*lobes)+0.06*Math.sin(a*3.1);P.setX(i,x*k);P.setZ(i,z*k);}g.computeVertexNormals();return g;}
/* two reusable tree models (origin at the ground, both tiers in one geometry, upper tier a touch lighter).
   Snow bands and trunk shading are per-pixel, so the near model needs only one ring of vertices per tier. */
function treeModel(sl,su,ll,lu){const a=new THREE.ConeGeometry(2.6,6.5,sl,1,true),b=new THREE.ConeGeometry(1.8,5,su,1,true);if(ll)branchy(a,ll);if(lu)branchy(b,lu);
  a.translate(0,3,0);b.translate(0,6.8,0);return mergeGeos([a,b],[1,1.13]);}
const TREE_NEAR=treeModel(10,8,5,4),TREE_FAR=treeModel(6,5,0,0),treeMat=new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true});
const treePool=[[],[]];   /* per-tile geometry views (shared GPU buffers, own bounding sphere) are recycled, never re-created */
function treeView(lod){const pool=treePool[lod];if(pool.length)return pool.pop();const base=lod?TREE_FAR:TREE_NEAR,g=new THREE.BufferGeometry();
  for(const k in base.attributes)g.setAttribute(k,base.attributes[k]);g.setIndex(base.index);g.boundingSphere=new THREE.Sphere();g.userData.lod=lod;return g;}
treeMat.onBeforeCompile=sh=>{
  /* per-tree snow load from where the tree stands: a random share plus more with altitude (rimed summit spruce) */
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vLP;varying float vSn;').replace('#include <begin_vertex>',`#include <begin_vertex>
    vLP=position;
    #ifdef USE_INSTANCING
    vec3 ip=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
    #else
    vec3 ip=vec3(0.);
    #endif
    vSn=clamp(.3+.45*fract(sin(dot(ip.xz,vec2(12.9898,78.233)))*43758.5453)+.55*smoothstep(820.,1150.,ip.y),0.,1.);`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vLP;varying float vSn;').replace('#include <color_fragment>',`#include <color_fragment>
    float ang=atan(vLP.x,vLP.z);float band=fract(vLP.y*.62+.18*sin(ang*7.)+.07*sin(ang*13.+vLP.y));
    float w=.32*vSn;float sn=smoothstep(.58-w,.68-w,band)*(.55+.45*smoothstep(-.2-vSn,.9,sin(ang*3.+1.3)));
    sn=max(sn,smoothstep(9.5-3.*vSn,11.,vLP.y)*.9);
    float ao=mix(.5,1.,clamp(vLP.y/6.5,0.,1.));
    vec3 frost=mix(diffuseColor.rgb*ao,vec3(.86,.9,.95)*ao,.25+.3*vSn);
    diffuseColor.rgb=mix(frost,vec3(.93,.96,1.)*(.78+.22*ao),sn*.92);`);};
const _Y=new THREE.Vector3(0,1,0),_tm4=new THREE.Matrix4(),_tq=new THREE.Quaternion(),_tv1=new THREE.Vector3(),_tv2=new THREE.Vector3(),_tc=new THREE.Color();
const cTrail=new THREE.Color(0xe6edf5),cWood=new THREE.Color(0xdde5ef),cForest=new THREE.Color(0x4a5d55),cTmp=new THREE.Color();
function hash2(i,j,s){let h=(Math.imul(i,374761393)+Math.imul(j,668265263)+Math.imul(s||0,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
function inLiftCut(x,z){for(const L of LIFTS){const rx=x-L.bx,rz=z-L.bz,s=rx*L.dx+rz*L.dz;if(s>-30&&s<L.len+25&&Math.abs(rx*L.px+rz*L.pz)<10)return true;}return false;}
function buildTile(ti,tj,lod){
  const x0=ti*TILE,z0=tj*TILE;let fine=false;if(!lod)for(const b of MOGBOX)if(x0<b[2]&&x0+TILE>b[0]&&z0<b[3]&&z0+TILE>b[1]){fine=true;break;}
  const res=lod?8:(fine?2:4),n=TILE/res+1,N=n*n,E=4*(n-1);
  const pos=new Float32Array((N+E)*3),col=new Float32Array((N+E)*3),uv=new Float32Array((N+E)*2),nor=new Float32Array((N+E)*3),tA=new Float32Array((N+E)*4);
  /* heights on a grid padded by one cell, so normals come from neighbours instead of four extra lookups per vertex */
  const np=n+2,hp=new Float32Array(np*np);
  for(let j=0;j<np;j++)for(let i=0;i<np;i++){const x=x0+(i-1)*res,z=z0+(j-1)*res;
    if(i===0||j===0||i===np-1||j===np-1){hp[j*np+i]=H(x,z);continue;}
    const k=(j-1)*n+(i-1),y=H(x,z),t=TI;hp[j*np+i]=y;const e=t.tr?t.d-t.w:1e9;
    pos[k*3]=x;pos[k*3+1]=y;pos[k*3+2]=z;tA[k*4]=clamp(e,-60,200);tA[k*4+1]=t.tr?clamp(t.d/t.w,0,3):3;tA[k*4+2]=t.tr?t.ux:0;tA[k*4+3]=t.tr?t.uz:1;
    const pad=inPad(x,z),ec=pad?Math.min(e,-2):(inLiftCut(x,z)?Math.min(e,4):e);
    if(pad&&e>0){tA[k*4]=-2;tA[k*4+1]=0.9;}
    cTmp.copy(cTrail).lerp(cWood,sstep(-2,6,ec)).lerp(cForest,sstep(70,130,ec)*0.85);
    if(fine&&t.tr&&t.tr.mog&&e<0){const mk=mogK(t.tr,t.i,t.t)*sstep(0,-6,e);if(mk>0){const mv=clamp((mogul(x,z)+0.35)/1.3,0,1);cTmp.multiplyScalar(1-mk*(0.16-0.16*mv));}}
    col[k*3]=cTmp.r;col[k*3+1]=cTmp.g;col[k*3+2]=cTmp.b;uv[k*2]=x/2.4;uv[k*2+1]=z/7;}
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*n+i,c=(j+1)*np+(i+1);
    const gx=(hp[c+1]-hp[c-1])/(2*res),gz=(hp[c+np]-hp[c-np])/(2*res),il=1/Math.sqrt(gx*gx+1+gz*gz);nor[k*3]=-gx*il;nor[k*3+1]=il;nor[k*3+2]=-gz*il;
    {const x=pos[k*3],z=pos[k*3+2],bx=(Bm(x+6,z)-Bm(x-6,z))/12,bz=(Bm(x,z+6)-Bm(x,z-6))/12,gm=Math.hypot(bx,bz);if(gm>0.03){const ux=tA[k*4+2],uz=tA[k*4+3],sg=(ux*-bx+uz*-bz)<0?-1:1,f=sstep(0.03,0.1,gm);tA[k*4+2]=ux*sg*(1-f)-bx/gm*f;tA[k*4+3]=uz*sg*(1-f)-bz/gm*f;}}}
  /* skirts hide cracks between near and far detail levels */
  const ring=[];for(let i=0;i<n-1;i++)ring.push(i);for(let j=0;j<n-1;j++)ring.push(j*n+n-1);for(let i=n-1;i>0;i--)ring.push((n-1)*n+i);for(let j=n-1;j>0;j--)ring.push(j*n);
  ring.forEach((src,r)=>{const k=N+r;pos[k*3]=pos[src*3];pos[k*3+1]=pos[src*3+1]-5;pos[k*3+2]=pos[src*3+2];col[k*3]=col[src*3];col[k*3+1]=col[src*3+1];col[k*3+2]=col[src*3+2];nor[k*3]=nor[src*3];nor[k*3+1]=nor[src*3+1];nor[k*3+2]=nor[src*3+2];uv[k*2]=uv[src*2];uv[k*2+1]=uv[src*2+1];for(let q=0;q<4;q++)tA[k*4+q]=tA[src*4+q];});
  const idx=[];
  for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){const a=j*n+i,b=a+1,c=a+n,d=c+1;idx.push(a,c,b,b,c,d);}
  for(let r=0;r<E;r++){const a=ring[r],b=ring[(r+1)%E],sa=N+r,sb=N+(r+1)%E;idx.push(a,sa,b,b,sa,sb);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('aT',new THREE.BufferAttribute(tA,4));g.setIndex(idx);
  const mesh=new THREE.Mesh(g,fine?terrMatFine:terrMat);mesh.receiveShadow=!lod;scene.add(mesh);
  /* trees: deterministic per cell, so a tile rebuilds identically every time it streams back in. Glades keep a sparse stand. */
  const step=lod?8:6,trees=[];
  for(let cj=0;cj<TILE/step;cj++)for(let ci=0;ci<TILE/step;ci++){
    const gi=Math.round(x0/step)+ci,gj=Math.round(z0/step)+cj;
    const x=x0+(ci+hash2(gi,gj,1))*step,z=z0+(cj+hash2(gi,gj,2))*step;
    if(z<ZMIN||z>ZMAX||x<XMIN||x>XMAX)continue;
    const t=trailInfo(x,z),e=t.tr?t.d-t.w:1e9;
    if(e<3&&!(t.tr.glade&&hash2(gi,gj,6)<0.3))continue;
    if(inLiftCut(x,z)||inClear(x,z))continue;
    const dens=(e<25?0.85:0.36)*(lod?1.3:1);
    if(hash2(gi,gj,3)>dens)continue;
    /* size variety: mostly mid-size, some saplings, the odd big one; stunted toward the summits (krummholz) */
    let s=0.7+hash2(gi,gj,4)*0.75;const r8=hash2(gi,gj,8);if(r8<0.12)s*=0.55;else if(r8>0.93)s*=1.35;
    trees.push([x,z,s,hash2(gi,gj,5),hash2(gi,gj,7)]);}
  if(!lod&&trees.length){const cg=mesh.geometry.attributes.color;const tg=new Map();trees.forEach(t=>{const k=Math.floor(t[0]/8)+','+Math.floor(t[1]/8);if(!tg.has(k))tg.set(k,[]);tg.get(k).push(t);});
    for(let k=0;k<N;k++){const x=pos[k*3],z=pos[k*3+2];let occ=0;const ci=Math.floor(x/8),cj=Math.floor(z/8);
      for(let a=ci-1;a<=ci+1;a++)for(let b=cj-1;b<=cj+1;b++){const arr=tg.get(a+','+b);if(!arr)continue;for(const t of arr){const d=Math.hypot(x-t[0],z-t[1]);occ=Math.max(occ,1-sstep(1.2,4.2*t[2],d));}}
      if(occ>0){const f=1-0.3*occ;cg.array[k*3]*=f;cg.array[k*3+1]*=f*1.01;cg.array[k*3+2]*=Math.min(1,f*1.06);}}
    cg.needsUpdate=true;}
  let low=null,up=null;
  if(trees.length){const tg=treeView(lod?1:0);low=new THREE.InstancedMesh(tg,treeMat,trees.length);
    const m=_tm4,q=_tq,sc=_tv1,p=_tv2,c=_tc;let ylo=1e9,yhi=-1e9;
    trees.forEach(([x,z,s,h,v],i)=>{const y=H(x,z);const st=1-0.3*sstep(950,1200,y),hs=s*st*(0.85+0.4*(v||0)),ws=s*st*(0.82+0.3*h);ylo=Math.min(ylo,y);yhi=Math.max(yhi,y+12*hs);q.setFromAxisAngle(_Y,h*6.283);sc.set(ws,hs,ws);p.set(x,y,z);m.compose(p,q,sc);low.setMatrixAt(i,m);
      c.setHSL(0.37+h*0.05,0.32+h*0.15,0.17+h*0.07);low.setColorAt(i,c);});
    tg.boundingSphere.center.set(x0+TILE/2,(ylo+yhi)/2,z0+TILE/2);tg.boundingSphere.radius=Math.hypot(TILE*0.72,(yhi-ylo)/2)+6;
    scene.add(low);}
  return {mesh,low,up,trees,lod};
}
/* the whole mountain at low detail, under the streamed tiles: real ridgelines, white trail cuts and forest out to the horizon.
   It is a 52 m grid 2.5 m under the raw terrain, so in carved dips and cat-track benches (up to ~3.4 m below the raw ground)
   it would cut across the real snow and the skier would look sunk into a grey slab. So it is not drawn where detail tiles are
   loaded: inside LOW_HOLE m of the tile-streaming centre (tiles cover ~610 m), within the surveyed grid. The map turns the hole off. */
let lowHoleOff=false;const LOW_HOLE=540,lowU={uHole:{value:new THREE.Vector3(0,0,0)},uBox:{value:new THREE.Vector4(0,0,0,0)}};
const lowMtn=(function(){const X0=-3400,X1=5000,Z0=-3900,Z1=3000,st=52,nx=Math.round((X1-X0)/st)+1,nz=Math.round((Z1-Z0)/st)+1;
  const P=new Float32Array(nx*nz*3),C=new Float32Array(nx*nz*3),I=[];
  const cSnow=new THREE.Color(0xe9eff6),cFor=new THREE.Color(0x5b6a64),cFrost=new THREE.Color(0x9aa8b1),c=new THREE.Color();
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=X0+i*st,z=Z0+j*st,k=j*nx+i;
    const ox=Math.max(0,GR.x0-x,x-GXMAX),oz=Math.max(0,z-GR.z0,GZMIN-z),out=Math.hypot(ox,oz);
    let y=Bm(x,z);if(out>0){const hl=560+90*Math.sin(x*0.0021+1.3)*Math.sin(z*0.0017+0.4)+45*Math.sin(x*0.0053-z*0.0041)+25*Math.sin(x*0.011+z*0.009);y+=(hl-y)*sstep(0,1400,out);}
    P[k*3]=x;P[k*3+1]=y-2.5;P[k*3+2]=z;
    let snow=0;if(out===0){const t=trailInfo(x,z);if(t.tr)snow=1-sstep(t.w-6,t.w+14,t.d);if(inPad(x,z))snow=1;if(inLiftCut(x,z))snow=Math.max(snow,0.6);}
    const dap=0.5+0.5*Math.sin(x*0.031+z*0.017)*Math.sin(z*0.027-x*0.012);c.copy(cFor).lerp(cFrost,clamp(sstep(780,1250,y)*0.7+dap*0.3,0,1)).lerp(cSnow,snow);C[k*3]=c.r;C[k*3+1]=c.g;C[k*3+2]=c.b;}
  for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){const a=j*nx+i,b=a+1,cc=a+nx,d=cc+1;I.push(a,cc,b,b,cc,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));g.setIndex(I);g.computeVertexNormals();
  const mat=new THREE.MeshLambertMaterial({vertexColors:true});
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,lowU);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vXZ;').replace('#include <project_vertex>','#include <project_vertex>\nvXZ=(modelMatrix*vec4(transformed,1.)).xz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vXZ;uniform vec3 uHole;uniform vec4 uBox;')
      .replace('void main() {','void main() {\n  if(uHole.z>0.&&distance(vXZ,uHole.xy)<uHole.z&&vXZ.x>uBox.x&&vXZ.x<uBox.z&&vXZ.y>uBox.y&&vXZ.y<uBox.w)discard;');};
  mat.customProgramCacheKey=()=>'lowmtn1';
  const m=new THREE.Mesh(g,mat);m.renderOrder=1;scene.add(m);   /* drawn after the tiles so early-z rejects it where they cover it */
  lowU.uBox.value.set(XMIN,ZMIN,XMAX,ZMAX);return m;})();
function dropTile(t){scene.remove(t.mesh);t.mesh.geometry.dispose();if(t.low){scene.remove(t.low);t.low.dispose&&t.low.dispose();treePool[t.low.geometry.userData.lod].push(t.low.geometry);}}
function updateTiles(px,pz,budget){
  lowU.uHole.value.set(px,pz,lowHoleOff?0:LOW_HOLE);
  const ci=Math.floor(px/TILE),cj=Math.floor(pz/TILE),r=Math.ceil(LOAD_R/TILE)+1,want=new Map();
  for(let i=ci-r;i<=ci+r;i++)for(let j=cj-r;j<=cj+r;j++){
    if((i+1)*TILE<XMIN||i*TILE>XMAX||(j+1)*TILE<ZMIN||j*TILE>ZMAX)continue;
    const d=Math.hypot((i+0.5)*TILE-px,(j+0.5)*TILE-pz);if(d>LOAD_R)continue;want.set(i+','+j,{i,j,d,lod:d>NEAR_R?1:0});}
  for(const [k,t] of [...tiles]){const [i,j]=k.split(',').map(Number);const d=Math.hypot((i+0.5)*TILE-px,(j+0.5)*TILE-pz);if(d>LOAD_R+TILE){dropTile(t);tiles.delete(k);}}
  const todo=[];for(const [k,w] of want){const t=tiles.get(k);if(!t||t.lod!==w.lod)todo.push([k,w]);}
  todo.sort((a,b)=>a[1].d-b[1].d);
  let n=0;for(const [k,w] of todo){if(n++>=budget)break;const old=tiles.get(k);tiles.set(k,buildTile(w.i,w.j,w.lod));if(old)dropTile(old);}
  return todo.length;
}

