#!/usr/bin/env python3
"""Fetch the ORIGINAL elevation grid from OpenTopoData (USGS 3DEP 10 m, dataset ned10m) into data/dem_grid.txt.

One request per row: 100 evenly spaced samples between two longitudes (`samples=100`). Free API limits:
1 request/second, 1,000/day. Format of each output line: "<row>:<v0>,<v1>,...,<v99>" (metres, rounded).

The original grid (100 x 60): lat 43.596 + 0.000475*row, lon -72.828 to -72.778. It has since been extended with
tools/extend_dem_cog.py (USGS 3DEP from S3), which keeps these cells; see README.
To extend it (e.g. north to Snowshed/Ramshead, east to the Skyeship base), fetch new rows/columns with the same
spacing, then update LAT0/DLAT/LON0/LON1 in tools/bake/common.py to match and rerun tools/bake/run.sh.

Usage: python3 tools/fetch_dem.py --lat0 43.596 --dlat 0.000475 --rows 60 --lon0 -72.828 --lon1 -72.778 [--out data/dem_grid.txt]
"""
import argparse, json, time, urllib.request

ap = argparse.ArgumentParser()
ap.add_argument('--lat0', type=float, default=43.596); ap.add_argument('--dlat', type=float, default=0.000475)
ap.add_argument('--rows', type=int, default=60); ap.add_argument('--first', type=int, default=0)
ap.add_argument('--lon0', type=float, default=-72.828); ap.add_argument('--lon1', type=float, default=-72.778)
ap.add_argument('--out', default='data/dem_grid.txt')
a = ap.parse_args()
with open(a.out, 'a') as f:
    for r in range(a.first, a.first + a.rows):
        lat = a.lat0 + a.dlat * r
        url = f'https://api.opentopodata.org/v1/ned10m?locations={lat:.6f},{a.lon0}|{lat:.6f},{a.lon1}&samples=100'
        for attempt in range(5):
            try:
                res = json.load(urllib.request.urlopen(url, timeout=30)); break
            except Exception as e:
                print('retry', r, e); time.sleep(3)
        vals = [round(p['elevation']) for p in res['results']]
        assert len(vals) == 100
        f.write(f'{r}:' + ','.join(map(str, vals)) + '\n'); f.flush()
        print(r, vals[0], vals[-1]); time.sleep(1.1)
