#!/usr/bin/env python3
"""Extend data/dem_grid.txt north, east (and south) using the USGS 3DEP 1/3 arc-second (10 m) GeoTIFF read straight from the USGS
S3 bucket (a cloud-optimised GeoTIFF, so only the needed window is downloaded). Needs: pip install rasterio scipy.

The original 100 x 60 grid came from OpenTopoData's ned10m, an older NED release that sits a few metres off the
current 3DEP surface (mean about -5 m, mean |diff| ~6 m here). Existing cells are kept exactly as they are. New cells
are 3DEP plus a correction field: the old-minus-new difference on the old cells, carried smoothly into the new area
(Laplace fill) and faded to zero at the far edges, so there is no step at the seam.

Usage: python3 tools/extend_dem_cog.py --add-rows 30 --add-cols 52 [--add-south 6]   (rows north, cols east, rows south)
The Nov 24, 2026 extension: --add-rows 30 --add-cols 52 --add-south 11 on the original 100 x 60 grid.
Then set LAT0/DLAT/LON0/LON1 in tools/bake/common.py to the printed values and run sh tools/bake/run.sh.
"""
import argparse, numpy as np, rasterio
from rasterio.windows import from_bounds
from scipy.ndimage import map_coordinates

URL = '/vsicurl/https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/n44w073/USGS_13_n44w073.tif'
ap = argparse.ArgumentParser()
ap.add_argument('--grid', default='data/dem_grid.txt')
ap.add_argument('--lat0', type=float, default=43.596); ap.add_argument('--dlat', type=float, default=0.000475)
ap.add_argument('--lon0', type=float, default=-72.828); ap.add_argument('--lon1', type=float, default=-72.778)
ap.add_argument('--add-rows', type=int, default=30); ap.add_argument('--add-cols', type=int, default=52)
ap.add_argument('--add-south', type=int, default=0)
a = ap.parse_args()

old = np.array([[float(v) for v in l.split(':')[1].split(',')] for l in open(a.grid)])
NI0, NJ0 = old.shape
dlon = (a.lon1 - a.lon0) / (NJ0 - 1)
NI, NJ = NI0 + a.add_rows + a.add_south, NJ0 + a.add_cols
S0 = a.add_south   # old row 0 sits at new row S0
lat0 = a.lat0 - a.dlat * S0
lats = lat0 + a.dlat * np.arange(NI); lons = a.lon0 + dlon * np.arange(NJ)

with rasterio.open(URL) as src:
    win = from_bounds(lons[0] - .003, lats[0] - .003, lons[-1] + .003, lats[-1] + .003, src.transform).round_offsets().round_lengths()
    A = src.read(1, window=win).astype(float); tr = src.window_transform(win)
inv = ~tr
LA, LO = np.meshgrid(lats, lons, indexing='ij')
c, r = inv * (LO.ravel(), LA.ravel())
new = map_coordinates(A, [r - 0.5, c - 0.5], order=1).reshape(NI, NJ)   # bilinear at pixel centres

# correction field: fixed = old - new on old cells, 0 on the far outer edges of the new area; Laplace fill elsewhere
res = np.zeros((NI, NJ)); fixed = np.zeros((NI, NJ), bool)
res[S0:S0+NI0, :NJ0] = old - new[S0:S0+NI0, :NJ0]; fixed[S0:S0+NI0, :NJ0] = True
if a.add_rows: fixed[-1, :] = True
if a.add_south: fixed[0, :] = True
if a.add_cols: fixed[:, -1] = True
print('old vs 3DEP: mean %.1f m, mean |d| %.1f m' % (res[S0:S0+NI0, :NJ0].mean(), abs(res[S0:S0+NI0, :NJ0]).mean()))
for it in range(6000):
    p = np.pad(res, 1, mode='edge')
    avg = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) / 4
    res = np.where(fixed, res, avg)
out = np.rint(new + res).astype(int)
out[S0:S0+NI0, :NJ0] = old.astype(int)
with open(a.grid, 'w') as f:
    for i in range(NI): f.write(f'{i}:' + ','.join(map(str, out[i])) + '\n')
print(f'{NI} rows x {NJ} cols -> {a.grid}')
print(f'LAT0,DLAT={lat0:.6f},{a.dlat}; LON0,LON1={a.lon0},{lons[-1]:.6f}')
