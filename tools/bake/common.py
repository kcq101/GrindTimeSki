import json,math,collections,sys
import numpy as np
G=np.array([[float(v) for v in l.split(':')[1].split(',')] for l in open('dem_grid.txt')])
NI,NJ=G.shape
LAT0,DLAT=43.590775,0.000475; LON0,LON1=-72.828,-72.751737   # 101 rows x 152 cols: original 100x60 (OpenTopoData) + 3DEP extension (tools/extend_dem_cog.py)
OLAT,OLON=43.61,-72.803
KX=111320*math.cos(math.radians(OLAT)); KY=110950
def xy(lat,lon): return ((lon-OLON)*KX, -(lat-OLAT)*KY)   # x east, z south
GX0=(LON0-OLON)*KX; GDX=(LON1-LON0)*KX/(NJ-1)
GZ0=-(LAT0-OLAT)*KY; GDZ=-DLAT*KY      # row i -> z = GZ0 + i*GDZ (decreasing)
def cr(p0,p1,p2,p3,t): return 0.5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
def B(x,z):
    fj=(x-GX0)/GDX; fi=(z-GZ0)/GDZ
    fj=min(max(fj,0),NJ-1.0001); fi=min(max(fi,0),NI-1.0001)
    j=int(fj); i=int(fi); tx=fj-j; tz=fi-i
    rows=[]
    for di in (-1,0,1,2):
        ii=min(max(i+di,0),NI-1)
        r=[G[ii,min(max(j+dj,0),NJ-1)] for dj in (-1,0,1,2)]
        rows.append(cr(*r,tx))
    return cr(*rows,tz)
F=json.load(open('osm_features.json'))
XMIN,XMAX=GX0,GX0+GDX*(NJ-1); ZMAX,ZMIN=GZ0,GZ0+GDZ*(NI-1)
print('bounds x',XMIN,XMAX,'z',ZMIN,ZMAX, 'dx',GDX,'dz',GDZ)
def inside(x,z,m=0): return XMIN+m<x<XMAX-m and ZMIN+m<z<ZMAX-m
def dp(pts,eps):
    if len(pts)<3: return pts
    a,b=np.array(pts[0]),np.array(pts[-1]); ab=b-a; L=np.hypot(*ab) or 1
    dm,im=0,0
    for k in range(1,len(pts)-1):
        p=np.array(pts[k]); d=abs(ab[0]*(p[1]-a[1])-ab[1]*(p[0]-a[0]))/L
        if d>dm: dm,im=d,k
    if dm>eps: return dp(pts[:im+1],eps)[:-1]+dp(pts[im:],eps)
    return [pts[0],pts[-1]]
