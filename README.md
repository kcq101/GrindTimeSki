# GrindTimeSki · Killington Run

An arcade ski game on the real Killington, Vermont: USGS terrain, every OpenStreetMap trail from Ramshead and Snowshed to Bear Mountain and the Skyeship base (209 trail segments) and 15 real lifts you ride between runs. It runs in a mobile browser as one self-contained page.

**Play:** https://kcq101.github.io/GrindTimeSki/ (GitHub Pages from `main`; the root `index.html` redirects to `dist/`).

- **Live trail map.** The start screen is the real mountain in 3D with every trail draped in its difficulty colour and lifts in red. Drag to orbit, pinch to zoom, tap a peak or base: the camera flies to it and a sheet offers its trails, the lift ride up, or the lifts at that base.
- **Drop in from seven peaks.** Skye Peak, Killington Peak, Bear Mountain, Snowdon, Needle's Eye, Skye Peak's east side and Ramshead. Each has a picker listing its real trails with length, vertical drop and the base they lead to.
- **Ride up, ski to a sign.** From the map, "Ride up" is the default: step off the chair and every trail off that top floats a sign down the hill (name and arrow in its difficulty colour, green ●, blue ■, black ◆), with arrows on the screen edge for the ones behind you. Ski toward one; the clock starts once you're on it. Signs also appear ahead of every split and crossing on the way down. "Trail list" or the pause button still let you pick from a list.
- **Pause = the trail map.** The pause button under the timer (or Esc/P) freezes the run and opens the 3D trail map on your position, with a blinking "You" marker. Zoom and look around to plan the next run; tap a peak or base to pick a lift or trail (you're asked to confirm ending the run), or ✕ / Keep skiing to carry on exactly where you were.
- **Free-ride network.** Trails link up as they do on the mountain. Ski into any base (K-1, Snowshed, Ramshead, Bear Mountain, Skyeship) to finish, then pick your next chair or gondola. Great Eastern runs the full 3.5 miles from Skye Peak to the Skyeship base.
- **Race your ghost.** Your fastest run from each trail top replays as a see-through skier with a marker over its head, and the clock shows how far ahead or behind you are.
- **Challenge a friend.** Share any finished run as a link; whoever opens it races your run as a gold ghost from the same spot on the same clock.
- **Arcade handling.** Carve, tuck, jump with double boosts, flips and 360s. Moguls on Outer Limits, Devil's Fiddle and Ovation; the Deck crowd at Bear.

## Layout

```
src/index.html        page markup + CSS (markers: <!--@ASSETS-->, <!--@GAME-->)
src/js/NN-*.js        the game: one closure split into ordered files that share scope (order matters)
  01-util             seeded random, clamp, smoothstep
  02-mountain         terrain (bicubic DEM), trail network, trail blending/grooming, height function H(x,z)
  03-scene            renderer, colour grade (in every material's shader), sky, fog, lights, distant ridgelines, geometry helpers
  04-lifts            lifts, towers, cables, chairs/gondola cabins, bases, where each trail leads
  05-terrain          snow shader, trees, streamed terrain tiles, whole-mountain overview mesh
  06-dressing         boundary poles, snowguns, trail-sign atlas, banners, K-1 Lodge, the Deck
  07-skier            skier model, helmet, contact shadows; procedural pose: carve lean, ski edging, leg IK, absorption, arms, poles
  08-input-audio      spray particles, touch/keyboard input, wind audio
  09-game             run flow: pickers, lift rides, physics, crashes, tricks
  10-loop             camera, fixed-step loop, HUD, finish card, test hooks (window.__kr)
  11-map              start screen: 3D trail map, pins, bottom sheet, orbit/pinch gestures (window.__map)
  12-signs            floating trail signs (lift tops + junctions, one billboard mesh), screen-edge arrows, lift-top free-ski, pause menu
  13-weather          weather cycle (seeded per trail): altitude fog + sky/ridge wash, falling snow, summit cloud wisps
  14-sfx              sound: glide + edge loops shaped by speed and lean, landings, falls, tree hits, pole plants, lift towers
  15-ghost            ghost of your best run from each trail top: 10 Hz recording, see-through replay + marker, HUD gap, finish-card line;
                      challenge links (5 Hz nibble-packed run in the URL hash) and the challenge card
  16-look             light presets (Changing, Bluebird, Golden hour, Flat light), Random by default (a new one each run), the picker, speed streaks
  17-fun              medals per trail (times from data/medals.json), flow meter -> flow boost, landing grades + hit-stop + buzz
assets/               skier.glb, helmet.glb, fonts/ (Barlow, OFL), sfx/ (sounds + SOURCES.md credits), all embedded into the page at build time
data/                 dem_grid.txt, osm_features.json -> (bake) -> kdata.json
tools/build.py        bundles everything into dist/index.html
tools/bake/           data pipeline: project + clean trails, lifts, widths, picker lists -> data/kdata.json
tools/fetch_dem.py    re-fetch the original elevation grid (OpenTopoData, USGS 10 m)
tools/extend_dem_cog.py  extend the grid from the USGS 3DEP GeoTIFF on S3 (works from the cloud workspace)
tools/fetch_osm.py    re-fetch trails and lifts (Overpass API)
tools/test/           headless checks: screenshots, all-trails auto-pilot, terrain-step probe
dist/index.html       the built game (what gets published)
index.html            redirect so the short Pages URL opens dist/
docs/ROADMAP.md       design notes, what shipped, what's next
```

## Build and test

```sh
python3 tools/sfx/build_sfx.py   # after changing assets/sfx/src or the sound recipes: rebuild assets/sfx/*.mp3
python3 tools/build.py          # -> dist/index.html (~3 MB, self-contained except three.js r128 from cdnjs)
sh tools/bake/run.sh            # after changing data/ or tools/bake/: rebuild kdata.json, then the page

npm install                     # three@0.128.0 (served locally to tests) + playwright
npx playwright install chromium # or set CHROME=/path/to/chrome
npm run test:shots              # screenshots + draw calls/triangles -> test-output/
npm run test:autopilot          # ski every pickable trail; optional names: node tools/test/autopilot.js Superstar
npm run test:terrain            # sharpest height changes along trail centrelines
npm run test:lifttops           # from each lift's drop-off spot, can you reach every trail off that top?
npm run test:landings           # jumps (with/without boosts, tucked, pulling back) from spots on every trail: % clean landings
npm run test:sfx                # decode sounds, check loop points, ride and log layer levels, fire every one-shot
npm run test:weather            # summit + mid-mountain at clear / flurries / socked in, map while foggy -> test-output/weather/
npm run test:poses              # close-up skier shots (straight, carves, transitions, tuck, jump, landing, bumps) + joint checks -> test-output/poses/
npm run test:tiles              # terrain streaming cost per frame on long runs, and whether tiles keep up (no holes ahead)
npm run test:ghost              # ski a run, race its ghost slower and level: gap readout, finish card, screenshots -> test-output/ghost-*.png
npm run test:challenge          # run -> link (size, decode error), open the link fresh, race it: card, gold ghost, gap, result -> test-output/challenge-*.png
npm run test:tris               # where the triangles go on a run: trees, terrain tiles, whole-mountain mesh, lifts, everything else
npm run test:look               # each light preset on the map and on Superstar (and once ungraded), speed streaks, camera roll -> test-output/look/
npm run test:fun                # medals on the finish card, flow meter filling to a flow boost, landing grades, hit-stop, buzz -> test-output/fun-*.png
npm run medals                  # re-bake medal times (data/medals.json) after physics or trail changes, then rebuild
```

Tests use a software renderer, so frame rates are relative, not phone numbers. Use the Performance overlay toggle on the start card on a real phone.

## How the mountain is made

- **Terrain.** USGS 3DEP 10 m elevation, sampled on a 152 × 101 grid (~41 m east-west × 53 m north-south) over lat 43.5908–43.6383, lon −72.828 to −72.7517, then bicubic-interpolated. The original 100 × 60 core came from OpenTopoData; the extension north (Snowshed, Ramshead), east (Skyeship base) and a strip south (Bear Cub, Solitude) was read from the current 3DEP GeoTIFF and blended into the core with no seam (`tools/extend_dem_cog.py`). Axes in game: x = east, z = south, y = metres above sea level.
- **Trails.** OpenStreetMap piste ways inside the grid are projected to metres, oriented downhill, simplified, cleaned of loops and subdivided. Each gets a never-climbing centreline profile (an isotonic fit to the terrain), so small terrain/map mismatches don't cause uphill stalls. Cat tracks are cut as flat benches; open trails keep half their cross-slope.
- **Junctions.** Up to six nearby trail passes blend by how far inside each one you are, so the surface stays continuous where trails meet.
- **Widths.** OSM has no trail widths: they come from difficulty, a cat-track test (low average grade) and hand overrides for signature trails (`W` in `tools/bake/step3_bake.py`).

## Credits and licences

- **Trails and lifts:** © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0), first obtained via OpenSkiMap-derived extracts. `data/osm_features.json`, `data/trails_raw.json`, `data/lifts_raw.json` and the trail/lift parts of `data/kdata.json` are derived from OSM and remain under the ODbL.
- **Terrain:** USGS 3D Elevation Program (public domain), fetched through the OpenTopoData API and from the USGS 3DEP bucket on AWS.
- **Engine:** three.js r128 (MIT), loaded from cdnjs.
- **Models:** the helmet (`assets/helmet.glb`) was generated with Meshy and decimated for mobile. The skier (`assets/skier.glb`, "Alpine Adventurer", with Meshy-style animations) is assumed to come from the same workflow. Confirm the Meshy licence for your plan before distributing; free-plan generations are CC BY 4.0, which needs a credit line.
- **Code:** no licence chosen yet, so all rights reserved by default. Add a LICENSE file if you want others to reuse it.
