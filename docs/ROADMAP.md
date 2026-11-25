# Killington Run — design notes & roadmap

_Started Nov 20, 2026 as a teardown of Bonvo Ride. Moved to GitHub Nov 24, 2026._

## Bonvo Ride in one line
Free browser game: 6,000+ real resorts, terrain from elevation data, trails/lifts/difficulty from OpenStreetMap. Multiplayer lobbies (10) and parties (16), free ride, arcade missions/combos/unlocks, shareable "race my line" challenge links, live map of where people ride. Breadth over depth.

## Keep (we already do it, or it's table stakes)
- Real trail names, difficulty signs, a recognizable layout
- Arcade handling: carve, tuck, jump, double/triple boost, flips, 360s
- Runs in a mobile browser, no install

## Improve (Bonvo does it; we should do it better)
- Shareable challenge link (race my time on Outer Limits) — cheap, viral
- Missions and combos, but tied to real Killington lore (Outer Limits zipper line with no stops, Superstar top-to-bottom in one tuck)
- Ghost of your personal best

## Uniquely ours (Bonvo can't do this at 6,000 resorts)
- One mountain, hand-tuned: pitch, mogul fields, snowguns, the Deck crowd on Bear
- Lifts are part of the game: ride the real chair over the trail, session laps and vert
- Killington-only moments: Bear Mountain mogul challenge, Superstar spring bumps, K-1 lodge finish

## Real terrain + full trail network (Nov 24, 2026, shipped)
The mountain is now real Killington, baked into the page (no runtime fetches).

Data
- Terrain: USGS 3DEP 10 m DEM, sampled through OpenTopoData on a 100 × 60 grid (~41 m E-W × 53 m N-S) covering lat 43.596–43.624, lon −72.828 to −72.778. Bicubic interpolation in game. High point 1,288 m (Killington Peak is 1,289 m).
- Trails and lifts: OpenStreetMap linework via OpenSkiMap-derived extracts. 164 piste ways, 12 lifts.
- Projection: x = east, z = south, y = elevation in metres; origin 43.61, −72.803.
- Baked data is ~104 KB of the page. Pipeline: `tools/bake/` (DP simplify, loop removal, subdivide long segments to ≤22 m, widths, cat-track detection, picker lists). Re-fetch or extend with `tools/fetch_dem.py` and `tools/fetch_osm.py`.

How trails are carved
- Each trail gets a never-climbing centreline profile (isotonic fit to the DEM, then smoothed), so small DEM/OSM mismatches don't create uphill stalls.
- Cross-slope flattening: cat tracks fully (bench cuts), open trails 50%.
- Up to 6 nearby trail "passes" blend by how far inside each one you are. This removed 1–3 m steps at junctions that were ejecting the skier. Remaining big curvature on centrelines is mostly intentional moguls (Outer Limits, Devil's Fiddle, Ovation).

Gameplay
- Start card lists peaks (Skye Peak, Killington Peak, Bear Mountain, Snowdon, Needle's Eye, Skye Peak east). Each opens a trail picker with real length, drop and where the trail leads.
- Getting off any lift shows the same picker for that lift top (up to 7 trails). Trails under 20 m of drop are left out.
- Runs are free-ride: ski into any base (K-1, Bear Mountain, Skyeship midstation, or stop at a mid-mountain lift) to finish. The finish card shows the route, e.g. "Cascade → Cascade Runout → K-1 Base", plus lifts at that base and others to skate over to.
- HUD destination updates as you change trails. Best times are keyed by start trail + base.
- An "End run" button handles dead ends; skiing off the map edge also ends the run.
- Gondolas (K-1, Skyeship) have open cabins.

Visuals
- A low-detail whole-mountain mesh sits under the streamed tiles, so peaks, trail cuts and forest are visible to the horizon. Fog pushed from 190–740 m to 300–3,800 m.
- Rolling hills outside the surveyed area; distant ridgelines lowered and hazed.
- Ski tracks and corduroy follow the bare-earth fall line.
- Trail signs at every pickable trail top (one texture atlas, one draw call). Snowguns on Superstar, Outer Limits and Cascade. K-1 Lodge sits north of the lifts facing the slopes. The Deck crowd sits on the east side of the Bear base, looking up Outer Limits.

Measured (headless Chrome, software renderer, 390×844): ~160 draw calls (was ~206), ~480–550k triangles (was 381k; the whole-mountain mesh and many more trails). Not yet measured on a real phone.

Auto-pilot test of all 50 pickable starts (`tools/test/autopilot.js`): most reach a base. Typical times: Superstar ~1:00, Outer Limits ~1:15, Cascade from the summit ~2:30. The test bot circles at trail-end benches (e.g. bottom of Cascade) that a player skates through. Bot bails at 40+ mph come from landing crests standing tall; players crouch.

Known gaps
- OSM has no trail widths; widths are heuristics plus hand overrides for signature trails.
- DEM at ~45 m spacing smooths small headwalls and rollers.

## Trail-map start screen (Nov 24, 2026, shipped)
- The start card's list is replaced by the mountain itself: the whole-mountain mesh, seen (since Nov 24 evening) from the north-east over Snowshed with K-1 Base in the middle and Killington Peak, Skye Peak and Snowdon behind; first version looked from the south-east, with every named trail draped as a ribbon in its difficulty colour and lifts in red (one merged mesh, ~15k triangles, shown only on the map).
- Pins on the seven peaks (name + elevation of the lift top) and five bases. Overlapping labels collapse to tappable dots; the selected pin always gets its label.
- Tap a peak: the camera flies down its fall line and looks back up at it; the sheet lists its trails, "Pick a trail" (the existing picker) and "Ride up from <base>". Tap a base: the sheet lists its lifts. ✕ or a tap on empty map goes back to the overview.
- Drag orbits (horizontal) and tilts (vertical); pinch or wheel zooms. The sheet scrolls on its own.
- Streamed tiles are hidden on the map (they read as square forest patches from above), so the map costs ~46 draw calls / ~207k triangles headless. Fog and the far plane open up while it's showing.
- The old list and the how-to-play text live behind "All peaks" / "How to play". OSM attribution sits on every sheet. "Back to the trail map" on the finish card.

## Bigger map: Snowshed, Ramshead, Skyeship base (Nov 24, 2026, shipped)
- DEM grid 100 × 60 → 152 × 101: +30 rows north, +52 columns east, +11 rows south. Same spacing. The original cells are untouched; new cells come from the current USGS 3DEP 1/3″ GeoTIFF (read as a cloud-optimised GeoTIFF from the USGS S3 bucket, which the workspace can reach). That surface sits ~5 m off the older OpenTopoData NED, so new cells get a Laplace-blended correction that matches the old grid at the seam and fades out at the edges. Seam curvature is in the normal range.
- Why south too: Pipe Dream, The Jug, Solitude, Gateway and South Ridge Link don't go north — they feed Bear Cub, which dips ~150 m south of the old grid edge on its way to the Bear base. The old bake dropped the outside points and spliced a straight jump across the gap, so those runs drifted off the south edge.
- Bake: a trail that leaves the grid now keeps its longest inside stretch instead of splicing across the gap. 209 trails (was 164), 15 lifts (was 12).
- New lifts: Snowshed Express Quad, Ramshead Express Quad, Skyeship Stage 1 gondola. New bases: Snowshed, Ramshead, Skyeship Base. Ramshead Peak is on the start card. At the Stage 1 top (midstation) the picker also offers the midstation lifts.
- Existing picker lists unchanged except Superstar (Great Eastern in, Nivis Walk out) and South Ridge (+ Solitude).
- Cat tracks weigh 3× in junction blending, so where Bear Cub crosses Devil's Den and Sunrise it keeps its bench instead of climbing their surface (was a 5 m climb that stopped skiers dead).
- Whole-mountain mesh widened to cover the new area (52 m spacing, was 46 m).
- Auto-pilot: 53/55 starts reach a base, none at "Edge of the map" (was 47/54 with 7 edge finishes). Bot now holds its trail at forks and moves on at connector ends; MAXSECS=700 for the long traverses (Great Eastern ~8 min for the bot, Bear Cub routes ~5 min). Left: Ridgeview (bot circles a bench), Blue Heaven (bot drifts onto Solitude's long route).
- Cost: draw calls 160–167 → 162–164; triangles +40–57k (Superstar 528k → 567k, Outer Limits 557k → 613k), mostly from tiles and trees that now exist north and east, plus the new lifts. Feeds item 3.

## Ride up and ski to a sign, junction signs, pause (Nov 24, 2026, shipped)
- Map sheet: "Ride up from <base>" is now the main button for a peak; "Or pick a trail" is second.
- Top of a lift: no picker. The skier steps off a few metres toward the lift's main trail (clear of the top terminal, which otherwise fills the chase camera) and stands still until you steer or tuck. Each trail off that top gets a floating sign where it has split from its neighbours (25–120 m down): name plus difficulty icon in green/blue/black with a white outline, and an arrow under it that turns every frame to point where the trail goes on screen. Signs out of view become stacked arrows on the left/right screen edges. "Trail list" opens the old picker (with a Back button).
- The run commits once you're on exactly one of the top's trails near its sign (or 45 m down, or 15 m down a trail with no sign). The clock, best-time key and route start there.
- Junction signs: a load-time pass walks every trail in 8 m steps to find where other trails leave its surface (forks, crossings, and what it runs into at its end): 358 junctions on 177 trails. During a run the next two junctions within 170 m get signs 12 m down each branch, plus one for the trail you're on. Overlapping labels stack upward; off-screen splits ahead get edge arrows.
- All signs are one billboard mesh (one draw call, ≤12 signs, labels redrawn into a shared 1024² canvas only when the set changes). Labels keep a constant screen size (~6 × 1.5 m at 26 m).
- Pause: "End run" became a pause button under the timer (two CSS bars; the ❚❚ glyph rendered as a square on Android) (also Esc/P). Menu: Continue, Different trail (picker for the run's lift top, Back returns to the menu), Different peak (trail map), End run here (hidden at a lift top).

## Grey slab over carved trails (Nov 24, 2026)
- Kevin saw flat grey areas the skier sank into (Cascade Runout near K-1). The low-detail whole-mountain mesh is a 52 m grid 2.5 m under the raw DEM; trail carving (never-climbing profiles, cat-track benches) puts the snow up to ~3.4 m below the raw ground, and the coarse grid cuts straight across those dips. 54 named trails had stretches where it sat above the snow (Bear Cub 3.0 m, Touch Down 2.8 m, Cascade Runout 2.3 m).
- Fix: the low mesh discards fragments inside 540 m of the tile-streaming centre (tiles cover ~610 m) within the surveyed grid, so near you only the detail tiles draw. The map turns the hole off. Checked at the worst spots on Cascade Runout and Bear Cub.
- Left alone: the 4 m detail grid itself rides up to ~0.4–0.8 m above the true surface at a few sharp bench edges (Field Goal, Touch Down, 1–2% of their length).

## Lift drop-off spots (Nov 24, 2026)
- Lifts dropped you at the end of the unload ramp (then a few metres toward the main trail), which on several lifts was 5–15 m below trail starts you were meant to choose from (Skye Peak east: Skyeburst and Stash Way 14 m up). `topSpot(L)` now picks the drop-off: a 6 m grid within 50 m of the lift top, on a trail or in the cleared area, outside the top terminal (12 × 16 m past the line) with the chase camera clear of it, minimising the climb needed to reach the first 10 m of every trail off that top, then highest, then nearest. It faces the first trail with no terminal in view. ~33 ms per lift, computed in the background after load.
- Before you've picked a trail, the flats around a lift top count as packed snow (no deep-snow drag) and you skate up to ~12 mph.
- New test `tools/test/lift-tops.js`: from each drop-off, ski like a player to each trail's sign. 72/72 reachable (was 50/72); median 11 s, longest 25 s (Ovation from Skye Peak).

## Pause opens the trail map (Nov 24, 2026)
- Replaced the pause card. Pause freezes the run and opens the 3D map from behind and above the skier (1,500 m out, looking 250 m down the fall line) with a blinking red "You" marker. Top bar: "Paused · trail · time" and ✕.
- Sheet: Keep skiing, End run here (not at a lift top). Tapping a peak or base works as on the start screen; choosing a lift or "pick a trail" asks "End this run?" (time and trail; the run won't count) with Cancel. At a lift top before you've picked a trail there's nothing to lose, so no confirm.
- Map zoom now goes in to 700 m (was 2,400) so you can look at nearby splits.

## Corduroy moiré fix (Nov 24, 2026)
- On a phone, groomed patches showed a grainy, pixelated web just behind the skier. Cause: corduroy was a hard-edged ridge every 32 cm, faded only by distance, and fed into the per-pixel bump normals. Close to a low camera the ridges were finer than a pixel, and with dynamic resolution scaling they aliased into moiré.
- Now a cosine ridge, faded out by its screen-space frequency (fwidth). Checked at full and minimum render scale on Alpine Training Venue.
- Follow-up (same evening): Kevin still saw dotted lines all over the snow on Solitude. Cause: the snow bump normals came from dFdx/dFdy, which GPUs evaluate per 2×2 pixel block; on the phone (render ratio 1.0–1.4) that chopped every thin ski track (and corduroy ridge) into dashes. Tracks and corduroy now tilt the normal through an exact per-pixel slope (sCordG: analytic for corduroy, two extra track-texture samples 8 cm over for tracks). Only the slow, wide noise bumps still use derivatives. Tested at render ratios 1.4 and 0.96 with corduroy forced on everywhere.

## Lift network v1 (shipped)
- Data-driven LIFTS (now from OSM): towers auto-placed, terminals, lift sign, cleared lift line
- Ride your own chair: 3rd-person camera, drag to look around, tower clunks, about 24 s compressed ride, Skip
- Tracks session runs, vert and chairs

## Performance + polish pass (Nov 21, 2026, shipped)
Fixed-step physics (1/60 s) with render interpolation; trees cut from 182 to 18/11 tris and merged per tile; shadow map replaced by contact + decal shadows; chairs instanced; snow shader moved to noise-texture fetches; render-resolution scaling on phones; performance overlay toggle on the start card.

## Next up
1. Challenge links + ghost
2. Measure on a real phone; triangles are now ~530–610k headless, so likely trim whole-mountain mesh resolution or far-tile tree density
3. Base-area connectors (skate from the Deck to K-1, or the Skye Peak Quad as the link); Snowshed ↔ K-1 too
