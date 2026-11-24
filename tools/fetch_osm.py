#!/usr/bin/env python3
"""Fetch downhill pistes and aerialways from OpenStreetMap (Overpass API) into data/osm_features.json.

Output schema (one object per way), the same as the extract the game was first baked from:
  {"id": "w123", "kind": "downhill"|"lift"|"nordic", "difficulty": "easy"|..., "name": str, "liftType": str, "coords": [[lat, lon], ...]}
Data (c) OpenStreetMap contributors, ODbL 1.0.

Usage: python3 tools/fetch_osm.py [--bbox 43.58,-72.86,43.68,-72.74] [--out data/osm_features.json]
"""
import argparse, json, urllib.parse, urllib.request

ap = argparse.ArgumentParser()
ap.add_argument('--bbox', default='43.58,-72.86,43.68,-72.74')
ap.add_argument('--out', default='data/osm_features.json')
a = ap.parse_args()
q = f'[out:json][timeout:90];(way["piste:type"]({a.bbox});way["aerialway"]({a.bbox}););out tags geom;'
req = urllib.request.Request('https://overpass-api.de/api/interpreter', data=urllib.parse.urlencode({'data': q}).encode(),
                             headers={'User-Agent': 'GrindTimeSki data fetch'})
els = json.load(urllib.request.urlopen(req, timeout=120))['elements']
out = []
for e in els:
    t = e.get('tags', {}); g = e.get('geometry') or []
    if len(g) < 2: continue
    f = {'id': 'w' + str(e['id']), 'coords': [[round(p['lat'], 5), round(p['lon'], 5)] for p in g]}
    if 'aerialway' in t:
        f['kind'] = 'lift'; f['liftType'] = t['aerialway']
    else:
        f['kind'] = t.get('piste:type', 'downhill')
        if t.get('piste:difficulty'): f['difficulty'] = t['piste:difficulty']
    nm = t.get('piste:name') or t.get('name')
    if nm: f['name'] = nm
    out.append(f)
json.dump(out, open(a.out, 'w'))
print(len(out), 'features ->', a.out)
