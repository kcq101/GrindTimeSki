/* ---------- the real mountain ----------
   Terrain: USGS 3DEP 10 m elevation, sampled on a 100 x 60 grid (~41 m x 53 m) covering Killington Peak, Skye Peak,
   Bear Mountain, Snowdon, Needle's Eye and the K-1 base, then smoothed with bicubic interpolation.
   Trails and lifts: OpenStreetMap linework (via OpenSkiMap), projected to metres.
   Axes: x = east, z = south, y = elevation in metres above sea level. */
const KD=/*@KDATA*/null;
const GR=KD.grid,DEM=Float32Array.from(KD.dem),GNI=GR.ni,GNJ=GR.nj;
const GXMAX=GR.x0+GR.dx*(GNJ-1),GZMIN=GR.z0+GR.dz*(GNI-1);
const XMIN=GR.x0+30,XMAX=GXMAX-30,ZMIN=GZMIN+30,ZMAX=GR.z0-30;
function crs(a,b,c,d,t){return b+0.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));}
const _row=[0,0,0,0];
/* bare-earth elevation (bicubic through the DEM samples; clamps to the edge outside the grid) */
function Bm(x,z){let fj=(x-GR.x0)/GR.dx,fi=(z-GR.z0)/GR.dz;fj=fj<0?0:fj>GNJ-1.0001?GNJ-1.0001:fj;fi=fi<0?0:fi>GNI-1.0001?GNI-1.0001:fi;
  const j=fj|0,i=fi|0,tx=fj-j,tz=fi-i,j0=j>0?j-1:0,j2=j+1,j3=j+2<GNJ?j+2:GNJ-1;
  for(let a=0;a<4;a++){let ii=i+a-1;ii=ii<0?0:ii>=GNI?GNI-1:ii;const o=ii*GNJ;_row[a]=crs(DEM[o+j0],DEM[o+j],DEM[o+j2],DEM[o+j3],tx);}
  return crs(_row[0],_row[1],_row[2],_row[3],tz);}
function Nz(x,z){return 1.4*Math.sin(x*0.11+z*0.07)*Math.sin(z*0.13-x*0.05)+0.8*Math.sin(x*0.31+z*0.23);}

/* The whole trail network is data: every OpenStreetMap piste way inside the grid. w = half-width (m),
   k = how much the groomer flattens the cross-slope (cat tracks 1, open trails 0.5). */
const TRAILS=KD.trails.map(t=>({name:t.n,diff:t.d,w:t.w,k:t.k?1:0.5,glade:!!t.gl,mog:t.m||null,guns:!!t.gn,pts:t.p}));
const DIFF={g:{label:'EASIER',col:'#2f9e44'},b:{label:'MORE DIFFICULT',col:'#2f6fe0'},k:{label:'MOST DIFFICULT',col:'#111'},dd:{label:'EXPERTS ONLY',col:'#111'}};
const shortName=n=>n.replace(/ - (Upper|Headwall)$/,'');
/* decreasing isotonic fit (pool-adjacent-violators): the gentlest change that makes a profile never climb */
function isoDec(y){const v=[],w=[];for(let i=0;i<y.length;i++){v.push(-y[i]);w.push(1);
    while(v.length>1&&v[v.length-2]>v[v.length-1]){const b=v.pop(),wb=w.pop(),a=v.pop(),wa=w.pop();v.push((a*wa+b*wb)/(wa+wb));w.push(wa+wb);}}
  const out=new Float64Array(y.length);let k=0;for(let b=0;b<v.length;b++)for(let j=0;j<w[b];j++)out[k++]=-v[b];return out;}

/* spline-sample each trail (~5 m), measure it, fit a no-uphill centreline profile, and index segments in a coarse grid */
const CELL=32,segGrid=new Map(),MOGBOX=[];
TRAILS.forEach((tr,ti)=>{
  const P=tr.pts,s=[];
  for(let i=0;i<P.length-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)];
    const L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),n=Math.max(2,Math.ceil(L/5));
    for(let k=0;k<n;k++){const t=k/n,t2=t*t,t3=t2*t;
      const f=(a,b,c,d)=>0.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);
      s.push([f(p0[0],p1[0],p2[0],p3[0]),f(p0[1],p1[1],p2[1],p3[1])]);}}
  s.push(P[P.length-1].slice());tr.s=s;tr.id=ti;
  const n=s.length,cs=new Float32Array(n),pr=new Float64Array(n);
  for(let i=0;i<n;i++){if(i)cs[i]=cs[i-1]+Math.hypot(s[i][0]-s[i-1][0],s[i][1]-s[i-1][1]);pr[i]=Bm(s[i][0],s[i][1]);}
  tr.cs=cs;tr.L=cs[n-1];
  let iso=isoDec(pr);for(let pass=0;pass<2;pass++){const sm=new Float64Array(n);for(let i=0;i<n;i++){let a=0,c=0;for(let j=-3;j<=3;j++){const q=Math.min(n-1,Math.max(0,i+j));a+=iso[q];c++;}sm[i]=a/c;}iso=sm;}
  tr.dl=new Float32Array(n);for(let i=0;i<n;i++)tr.dl[i]=iso[i]-pr[i];
  tr.h0=iso[0];tr.h1=iso[n-1];
  let bx0=1e9,bz0=1e9,bx1=-1e9,bz1=-1e9;
  const reach=tr.w+18;
  for(let i=0;i<n-1;i++){const a=s[i],b=s[i+1];
    bx0=Math.min(bx0,a[0]);bz0=Math.min(bz0,a[1]);bx1=Math.max(bx1,a[0]);bz1=Math.max(bz1,a[1]);
    const i0=Math.floor((Math.min(a[0],b[0])-reach)/CELL),i1=Math.floor((Math.max(a[0],b[0])+reach)/CELL);
    const j0=Math.floor((Math.min(a[1],b[1])-reach)/CELL),j1=Math.floor((Math.max(a[1],b[1])+reach)/CELL);
    const seg=[a[0],a[1],b[0],b[1],tr,i];
    for(let ii=i0;ii<=i1;ii++)for(let jj=j0;jj<=j1;jj++){const k=ii*100003+jj;if(!segGrid.has(k))segGrid.set(k,[]);segGrid.get(k).push(seg);}}
  if(tr.mog)MOGBOX.push([bx0-tr.w-10,bz0-tr.w-10,bx1+tr.w+10,bz1+tr.w+10]);
});
/* nearest three trails (by distance past their edge), so junctions blend instead of stepping. TI.* = the best one. */
const TI={d:1e9,w:0,tr:null,cx:0,cz:0,i:0,t:0,sc:1e9,ux:0,uz:1,n:0};
const NK=6,KT=new Array(NK).fill(null),KDd=new Float64Array(NK),KX=new Float64Array(NK),KZ=new Float64Array(NK),KI=new Int32Array(NK),KTT=new Float64Array(NK),KS=new Float64Array(NK),KU=new Float64Array(NK),KV=new Float64Array(NK);
function trailInfo(x,z){
  KT.fill(null);KS.fill(1e9);
  const arr=segGrid.get(Math.floor(x/CELL)*100003+Math.floor(z/CELL));
  if(arr)for(const g of arr){const ax=g[0],az=g[1],dx=g[2]-ax,dz=g[3]-az;let t=((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz);t=t<0?0:t>1?1:t;
    const px=ax+dx*t,pz=az+dz*t,d=Math.hypot(x-px,z-pz),tr=g[4],sc=d-tr.w;let k=-1;for(let q=0;q<NK;q++){const o=KT[q];if(!o)break;if(o===tr&&Math.abs(tr.cs[KI[q]]-tr.cs[g[5]])<60){k=q;break;}}
    if(k>=0){if(sc>=KS[k])continue;}else{if(sc>=KS[NK-1])continue;k=NK-1;}
    /* write into slot k, then bubble up */
    KT[k]=tr;KS[k]=sc;KDd[k]=d;KX[k]=px;KZ[k]=pz;KI[k]=g[5];KTT[k]=t;const il=1/(Math.hypot(dx,dz)||1);KU[k]=dx*il;KV[k]=dz*il;
    while(k>0&&KS[k]<KS[k-1]){for(const A of [KT,KS,KDd,KX,KZ,KI,KTT,KU,KV]){const tmp=A[k];A[k]=A[k-1];A[k-1]=tmp;}k--;}}
  TI.tr=KT[0];TI.d=KT[0]?KDd[0]:1e9;TI.sc=KS[0];TI.w=KT[0]?KT[0].w:0;TI.cx=KX[0];TI.cz=KZ[0];TI.i=KI[0];TI.t=KTT[0];TI.ux=KU[0];TI.uz=KV[0];
  return TI;
}
/* staggered mogul field: rounded bumps ~5 m apart, each a slightly different height */
function mogul(x,z){const L=5.2,row=Math.floor(z/L),off=(row&1)*L*0.5;const u=(x+off)/L,v=z/L;const fu=u-Math.floor(u)-0.5,fv=v-Math.floor(v)-0.5;const r=Math.sqrt(fu*fu+fv*fv)*2;
  const hv=0.8+0.55*hash2(Math.floor(u),row,9);return r<1?hv*(0.5+0.5*Math.cos(Math.PI*r))-0.35:-0.35;}
function trailS(tr,i,t){const j=Math.min(i+1,tr.cs.length-1);return tr.cs[i]+(tr.cs[j]-tr.cs[i])*t;}
function mogK(tr,i,t){if(!tr.mog)return 0;const s=trailS(tr,i,t),m0=tr.mog[0],m1=tr.L-tr.mog[1];return sstep(m0-25,m0+15,s)*(1-sstep(m1-15,m1+25,s));}
/* the groomer: pull the surface toward a smooth, never-climbing centreline and flatten the cross-slope.
   Each nearby trail pulls with weight m (1 on the trail, fading to 0 over 14 m past its edge); overlaps average. */
/* kickers (placed in 06-dressing.js): a parabolic ramp up to a lip, then a rounded knuckle back down to the trail.
   u = metres along the trail from the lip, c = metres across from the kicker's centre line. Sidewalls fade over 2.2 m. */
function kickH(tr,i,t,lat){let h=0;const s=trailS(tr,i,t);
  for(const J of tr.jp){const u=s-J.s;if(u<-J.lr||u>J.lb)continue;const c=Math.abs(lat-J.off);if(c>J.hw+2.2)continue;
    const p=u<0?(u+J.lr)/J.lr:0,pr=u<0?J.h*p*p:J.h*(0.5+0.5*Math.cos(Math.PI*u/J.lb));h+=pr*(1-sstep(J.hw,J.hw+2.2,c));}
  return h;}
function carveG(tr,cx,cz,i,t,x,z,bx,d,lat){
  const j=Math.min(i+1,tr.dl.length-1),bc=Bm(cx,cz),dl=tr.dl[i]+(tr.dl[j]-tr.dl[i])*t;
  let g=bc+dl+(bx-bc)*(1-tr.k)+0.35*Math.sin(z*0.09+x*0.02)*Math.sin(z*0.05+0.7);
  if(tr.mog){const mk=mogK(tr,i,t);if(mk>0)g+=mogul(x,z)*sstep(tr.w-1,tr.w-7,d)*mk;}
  if(tr.jp&&d<tr.w)g+=kickH(tr,i,t,lat);
  return g;
}
/* lift-top plateaus (filled in 04-lifts.js): {x,z,h,sx,sz} = a gentle plane over each unload area, blended out between PLAT_R0 and PLAT_R1 */
let PLAT=[];const PLAT_R0=26,PLAT_R1=62;
function H(x,z){const h=H0(x,z);if(!PLAT.length)return h;
  let sw=0,acc=0;for(let i=0;i<PLAT.length;i++){const p=PLAT[i],dx=x-p.x,dz=z-p.z,d2=dx*dx+dz*dz;if(d2>=PLAT_R1*PLAT_R1)continue;
    const w=1-sstep(PLAT_R0,PLAT_R1,Math.sqrt(d2));sw+=w;acc+=w*(p.h+p.sx*dx+p.sz*dz);}
  return sw>0?h+(acc/sw-h)*Math.min(1,sw):h;}
function H0(x,z){
  const bx=Bm(x,z),raw=bx+Nz(x,z)*0.8;trailInfo(x,z);
  let sw=0,acc=0;
  /* cat tracks (k=1) weigh 3x where they cross fall-line trails, so a traverse keeps its bench instead of climbing the other trail's surface */
  for(let k=0;k<NK;k++){const tr=KT[k];if(!tr)break;let m=1-sstep(tr.w,tr.w+14,KDd[k]);if(m<=0)break;if(tr.k===1)m*=3;
    acc+=m*(carveG(tr,KX[k],KZ[k],KI[k],KTT[k],x,z,bx,KDd[k],(x-KX[k])*KV[k]-(z-KZ[k])*KU[k])-raw);sw+=m;}
  return sw>0?raw+acc/Math.max(1,sw):raw;
}
let RUN={x:0,z:0,th:Math.PI,top:'Skye Peak',name:'Superstar',h0:0,h1:0,dest:null};

