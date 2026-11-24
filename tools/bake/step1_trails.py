"""Project OSM piste ways into game metres, keep those inside the grid, orient them downhill, simplify."""
import json,math,os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"common.py")).read())
F=json.load(open('osm_features.json'))
trails=[]
for f in F:
    if f['kind']!='downhill': continue
    P=[xy(la,lo) for la,lo in f['coords']]
    ins=[inside(x,z,30) for x,z in P]
    if sum(ins)<len(P)*0.7: continue
    # keep the longest stretch that stays inside the grid (dropping outside points would splice a straight jump across the gap)
    runs=[];cur=[]
    for p,i in zip(P,ins):
        if i: cur.append(p)
        elif cur: runs.append(cur);cur=[]
    if cur: runs.append(cur)
    P=max(runs,key=len)
    if len(P)<2: continue
    if B(*P[0])<B(*P[-1]): P=P[::-1]
    L=sum(math.hypot(P[k+1][0]-P[k][0],P[k+1][1]-P[k][1]) for k in range(len(P)-1))
    if L<40: continue
    P=dp(P,2.5)
    # profile uphill check
    prof=[]
    for k in range(len(P)-1):
        n=max(1,int(math.hypot(P[k+1][0]-P[k][0],P[k+1][1]-P[k][1])/5))
        for t in range(n): prof.append(B(P[k][0]+(P[k+1][0]-P[k][0])*t/n,P[k][1]+(P[k+1][1]-P[k][1])*t/n))
    prof.append(B(*P[-1]))
    mn=prof[0]; rise=0
    for h in prof:
        if h>mn: rise=max(rise,h-mn)
        mn=min(mn,h)
    trails.append(dict(id=f['id'],name=f.get('name') or '',diff=f.get('difficulty') or 'intermediate',pts=P,L=L,h0=prof[0],h1=prof[-1],rise=rise))
print(len(trails))
bad=sorted(trails,key=lambda t:-t['rise'])[:25]
for t in bad: print(round(t['rise'],1),t['name'],t['diff'],round(t['L']),round(t['h0']),round(t['h1']))
json.dump(trails,open('trails_raw.json','w'))
