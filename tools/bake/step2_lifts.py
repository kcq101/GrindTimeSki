"""Lift bottom/top stations from OSM, and which trails start near each top."""
import json,math,os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"common.py")).read())

F=json.load(open('osm_features.json'))
T=json.load(open('trails_raw.json'))
lifts=[]
for f in F:
    if f['kind']!='lift' or not f.get('name'): continue
    P=[xy(la,lo) for la,lo in f['coords']]
    a,b=P[0],P[-1]
    if B(*a)>B(*b): a,b=b,a
    if not(inside(*a,20) and inside(*b,20)): continue
    L=math.hypot(b[0]-a[0],b[1]-a[1])
    lifts.append(dict(name=f['name'],type=f.get('liftType'),bx=a[0],bz=a[1],tx=b[0],tz=b[1],len=L,hb=B(*a),ht=B(*b)))
for l in lifts: print(l['name'],l['type'],round(l['len']),round(l['hb']),round(l['ht']),[round(v) for v in (l['bx'],l['bz'],l['tx'],l['tz'])])
print()
for l in lifts:
    near=[]
    for t in T:
        d=math.hypot(t['pts'][0][0]-l['tx'],t['pts'][0][1]-l['tz'])
        if d<220 and t['h0']<l['ht']+15: near.append((round(d),t['name'] or '-',t['diff'],round(t['L'])))
    near.sort()
    print(l['name'],'TOP ->',near)
json.dump(lifts,open('lifts_raw.json','w'))
