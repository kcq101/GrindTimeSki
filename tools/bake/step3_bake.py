"""Widths, difficulty, moguls/snowguns, loop cleanup, segment subdivision, lift metadata -> kdata.json."""
import json,math,os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"common.py")).read())

T=json.load(open('trails_raw.json')); LI=json.load(open('lifts_raw.json'))
DIFF={'novice':'g','easy':'g','intermediate':'b','advanced':'k','expert':'dd','freeride':'dd'}
CAT={'Great Northern','Great Northern - Lower','Bear Trax','Bear Cub','Highridge','Caper','Frolic','High Road','Low Road','Snowshed Crossover','Home Run','Killink','Escape','High Traverse','Low Traverse','Catwalk - Upper','Catwalk - Lower','Nivis Walk','Launch Pad','Northbrook Crossover','Northbrook Trail','Ridgeview','Stash Way','South Ridge Link','Skyewalker','Chunnel','OL Express','Sundog','Idler','Carpenter\'s Run','Yodeler','Edgemont/Whiffletree','Bearly','Sunrise Trail'}
W={'Superstar':30,'Outer Limits':24,'Cascade':19,'Cascade - Headwall':17,'Skyelark - Upper':17,'Skyelark - Lower':16,'Ovation':16,"Devil's Fiddle":18,'Wildfire':17,'Bear Claw':14,'Downdraft':16,'Snowshed Slope':40,'Learn To Ski And Ride Area':28,"Needle's Eye":16,'Bittersweet':15,'Chute':15,'Skye Peak Liftline':13,'Superpipe':14,'Highline Race Trail':15,"Racer's Edge":15,'Dream Maker':14,'Snowshed Crossover':9}
MOG={'Outer Limits':(60,45),"Devil's Fiddle":(45,40),'Ovation':(40,35)}
GUNS={'Superstar','Outer Limits','Cascade'}
out=[]
for t in T:
    nm=t['name']; d=DIFF.get(t['diff'],'b')
    grade=(t['h0']-t['h1'])/max(1,t['L'])
    cat= nm in CAT or (grade<0.11 and t['L']>180)
    w = 8 if cat else {'g':13,'b':14,'k':15,'dd':16}[d]
    if nm in W: w=W[nm]
    if not nm: w=min(w,11)
    P=[tuple(q) for q in t['pts']]
    # cut self-loops / hooks: a point that comes back within reach of an earlier one after a long detour
    ch=True;cut=0
    while ch:
        ch=False
        for i in range(len(P)):
            acc=0
            for j in range(i+1,len(P)):
                acc+=math.hypot(P[j][0]-P[j-1][0],P[j][1]-P[j-1][1])
                dd=math.hypot(P[j][0]-P[i][0],P[j][1]-P[i][1])
                if j>i+1 and dd<w+14 and acc>2.2*dd+25:
                    P=P[:i+1]+P[j:];ch=True;cut+=1;break
            if ch: break
    if cut: print('loop cut',nm,cut)
    Q=[P[0]]
    for a,b in zip(P,P[1:]):
        L=math.hypot(b[0]-a[0],b[1]-a[1]);n=max(1,math.ceil(L/22))
        for k in range(1,n+1):Q.append((a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n))
    P=Q
    tr=dict(n=nm,d=d,w=w,p=[[round(x,1),round(z,1)] for x,z in P])
    if cat: tr['k']=1
    if t['diff']=='freeride': tr['gl']=1
    if nm in MOG: tr['m']=MOG[nm]
    if nm in GUNS: tr['gn']=1
    out.append(tr)
# lifts
LIFTMETA={
 'Superstar Express Six':dict(id='ss',kind='Express six',speed=5.0,col=0x1f4f7a,top='Skye Peak',base='K-1 Base'),
 'K-1 Express Gondola':dict(id='k1',kind='Gondola',speed=6.0,col=0xb3261e,top='Killington Peak',base='K-1 Base',gond=1),
 'Bear Mountain Quad':dict(id='bear',kind='Fixed-grip quad',speed=2.3,col=0x8a2f22,top='Bear Mountain',base='Bear Mountain Base'),
 'Skye Peak Express Quad':dict(id='skq',kind='Express quad',speed=5.0,col=0x2b6f8f,top='Skye Peak',base='Bear Mountain Base'),
 'Snowdon Six':dict(id='sn6',kind='Express six',speed=5.0,col=0x2a6b3f,top='Snowdon',base='K-1 Base'),
 'Snowdon Triple':dict(id='sn3',kind='Fixed-grip triple',speed=2.3,col=0x6b5a2a,top='Snowdon',base='K-1 Base'),
 'Canyon Quad':dict(id='can',kind='Fixed-grip quad',speed=2.3,col=0x4a4a8a,top='Killington Peak ridge',base='Canyon'),
 'North Ridge Quad':dict(id='nr',kind='Fixed-grip quad',speed=2.3,col=0x5a7a2a,top='North Ridge',base='North Ridge'),
 'South Ridge Quad':dict(id='sr',kind='Fixed-grip quad',speed=2.3,col=0x8a6d2a,top='South Ridge',base='South Ridge'),
 "Needle's Eye Express Quad":dict(id='ne',kind='Express quad',speed=5.0,col=0x6a3b8a,top="Needle's Eye",base='Skyeship midstation'),
 'Skyeship Express Gondola Stage 2':dict(id='sky',kind='Gondola',speed=6.0,col=0x1d3557,top='Skye Peak',base='Skyeship midstation',gond=1),
 'Northbrook Quad':dict(id='nb',kind='Fixed-grip quad',speed=2.3,col=0x3a7a7a,top='Northbrook',base='Skyeship midstation'),
 'Snowshed Express Quad':dict(id='shs',kind='Express quad',speed=5.0,col=0x2f7d6b,top='Upper Snowshed',base='Snowshed Base'),
 'Ramshead Express Quad':dict(id='rh',kind='Express quad',speed=5.0,col=0x9a4a1f,top='Ramshead Peak',base='Ramshead Base'),
 'Skyeship Express Gondola Stage 1':dict(id='sky1',kind='Gondola',speed=6.0,col=0x1d3557,top='Skyeship midstation',base='Skyeship Base',gond=1),
}
PRI=['Superstar','Outer Limits','Cascade','Skyelark - Upper','Ovation',"Devil's Fiddle",'Wildfire','Great Northern','Downdraft','Bear Trax','Bear Claw','Chute','Bunny Buster - Upper','Frolic','Double Dipper - Upper','Rime','Ridge Run','Skyeburst - Upper',"Needle's Eye",'Vertigo - Headwall','Stitch Line','Pipe Dream','Snowshed Slope','Highlander','Old Superstar','Gateway','Blue Heaven','Royal Flush - Upper','North Star','Low Rider','Panic Button','The Jug - Upper','Home Run','Powerline','High Traverse','Reason']
lifts=[]
for l in LI:
    m=LIFTMETA.get(l['name']);
    if not m: continue
    cand=[]
    for i,t in enumerate(T):
        if not t['name']: continue
        dd=math.hypot(t['pts'][0][0]-l['tx'],t['pts'][0][1]-l['tz'])
        if dd<135 and t['h0']<l['ht']+15 and t['L']>120: cand.append((PRI.index(t['name']) if t['name'] in PRI else 99, -t['L'], i, t['name']))
    cand.sort(); seen=set(); pick=[]
    for c in cand:
        if c[3] in seen: continue
        seen.add(c[3]); pick.append(c[2])
    pick=pick[:7]
    L=dict(name=l['name'],bx=round(l['bx'],1),bz=round(l['bz'],1),tx=round(l['tx'],1),tz=round(l['tz'],1),trails=pick,**m)
    lifts.append(L)
    print(L['name'],'->',[T[i]['name'] for i in pick])
dem=[int(round(v)) for v in G.flatten()]
data=dict(grid=dict(ni=NI,nj=NJ,x0=round(GX0,3),dx=round(GDX,4),z0=round(GZ0,3),dz=round(GDZ,4)),dem=dem,trails=out,lifts=lifts,
  src='USGS 3DEP 10 m DEM via OpenTopoData + USGS S3 (sampled 41x53 m), trails/lifts from OpenStreetMap via OpenSkiMap')
s=json.dumps(data,separators=(',',':'))
open('kdata.json','w').write(s); print(len(s),'bytes',len(out),'trails',len(lifts),'lifts')
