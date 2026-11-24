#!/bin/sh
# Rebuild data/kdata.json from data/dem_grid.txt + data/osm_features.json, then rebuild the page.
set -e
cd "$(dirname "$0")/../../data"
python3 ../tools/bake/step1_trails.py
python3 ../tools/bake/step2_lifts.py
python3 ../tools/bake/step3_bake.py
cd ..
python3 tools/build.py
