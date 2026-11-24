# Working on GrindTimeSki (Killington Run)

Owner: Kevin. Mobile-first arcade ski game on the real Killington terrain. He plays on a phone; judge every change by how it looks and runs there.

## Rules
- Edit `src/`, `data/`, `tools/` — never hand-edit `dist/index.html`. Run `python3 tools/build.py` after every change and commit `dist/` with it.
- `src/js/*.js` are slices of ONE closure, concatenated in filename order. They share variables; there are no imports. Keep `/*@KDATA*/null` in 02-mountain.js exactly once.
- Data changes go through the bake: edit `tools/bake/*` or `data/dem_grid.txt` / `data/osm_features.json`, then `sh tools/bake/run.sh`. Lift picker lists come from trail indices in `kdata.json`, so they shift if the trail set changes.
- Keep the page self-contained: artifact/Pages hosting blocks runtime fetches except three.js from cdnjs. Data and models are inlined at build time.
- Performance budget (headless, 390×844): ~160 draw calls, ~500k triangles. Merge static meshes, use instancing, avoid per-object textures (signs share one atlas).
- `H(x,z)` is the single source of ground height (physics, tiles, props). Anything that changes it must keep it continuous: run `node tools/test/terrain-steps.js` (paired ± values > ~1.5 that aren't moguls = a step that will eject the skier).
- Before shipping gameplay or terrain changes: `node tools/test/autopilot.js` (most starts should reach a base) and `node tools/test/screenshots.js`, then look at the screenshots.
- OSM attribution must stay visible on the start card.

## Publishing
The playable link is a claude.ai artifact (slug `af59a9c1-26d9-442d-879c-0a28d15127b4`). Republish `dist/index.html` to it after merging changes. The public link is https://kcq101.github.io/GrindTimeSki/ — GitHub Pages serves `main`, and the root `index.html` redirects to `dist/`, so pushing `dist/` to `main` updates it.

## Context
`docs/ROADMAP.md` has the design rationale (vs. Bonvo Ride), what shipped and what's next. Coordinates: x = east, z = south (m), origin lat 43.61, lon −72.803.
