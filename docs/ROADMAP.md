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

## Arms, poles, lean and a lazier camera (Nov 25, 2026)
From a Bonvo reference clip.
- Arms: upper arms hang close to the ribs (elbows by the hips, ~10° forward), forearms forward at ~100–115°, fists in front of and just outside the hips at belt height. In a carve the hands stay low instead of lifting toward the chest; the arm frame rolls with the torso (0.6 of the lean). `__probe()` now reports `uaFwd`, `elbow`, `handY`, `handZ`.
- Poles: shafts angle back and close to the body (tips behind the boots, not splayed out); they tip over with the body in a turn and swing with a skid. `__poleCfg` gained `sDown`, `roll`, `yaw`.
- Lean: max 0.6 → 0.7 rad, gain 0.85 → 0.95; the upper body folds forward a little more (0.2 → 0.3, +0.16 deeper in a turn) so it's compact rather than sitting back.
- Camera (`__camf`): follows the heading more slowly (yaw rate 3.2 → 1.8/s) and lets the skier drift up to ~1.6 m off the view line (sideways catch-up 30 → 6/s), so in a turn you see the skier's side and they move across the frame. Lower (3.0 → 2.55 m) and looking further down the hill (14 → 21 m ahead, 1 m up), so the horizon sits higher and more of the slope ahead shows.

## Boost button (Nov 25, 2026)
Blue BOOST button above JUMP (keyboard: B or Shift). A small shove of speed, about +9 mph over half a second, on the snow or in the air, with a puff of snow behind. 2.5 s recharge shown as a ring that refills around the button. Tunables: `window.__boost`.

## Snow contrast, powder, hockey-stop skids, compass (Nov 25, 2026)
Kevin's notes from a Bonvo recording: hard to read elevation changes, no powder variety, hard turns look like carves, no sense of direction.
- Contrast: the snow shader takes more of its light from the sun and less from the flat sky fill (same average brightness), with a stronger blue tint on shaded faces. Near tiles shade hollows a little darker and crests a little brighter (from the height grid), and soft shading-only swells a few metres across fade in within ~150 m. Sun swung from SE (~143°) to SSE (~155°) at the same ~30° height, so east-running fall lines get side light. Still late morning, not afternoon.
- Powder: `powderAt()` gives 0..1 depth: off piste 1, outer edges of a trail (patchy), and patches where the bare-earth pitch flattens out (snow collects at the bottom of a pitch). Baked per vertex (`aP`) for the look (no tracks, corduroy or hardpack, brighter, softer swells). Physics: extra drag (μ +0.075 × depth), steering ~28% slower to turn and slower to respond, skier sinks ~11 cm, powder puffs. About 13% of on-trail area is >0.4 deep.
- Hard turns: full steer above ~15 mph builds a skid (`S.sk`). Skis and hips swing up to ~60° across the direction of travel, shoulders counter-rotate to keep facing it, wider skid marks, a cloud of snow off the outside edge (new puff particle pool, +1 draw call), and speed scrubs like a hockey stop (about 55 to 25 mph in ~2 s at full lock). Tunables: `window.__skid`.
- Follow-up (same day): on a phone in clear weather, sun-facing trails (e.g. Gateway) blew out to flat white (~half the snow clipped). Added a soft highlight shoulder (squeezes brightness above .72 toward .93 and cools it), a faint camera-relative cross-light so relief reads even when skiing into the sun, and narrowed the edge-powder band to ≤5 m so narrow trails keep their tracks and corduroy.
- Compass: a heading strip under the speed (top right) scrolls with the camera; N in red, labels every 45°, ticks every 15°.
- Cost: tile builds ~20% slower (curvature + powder), autopilot unchanged (47/55 finish, same times).

## Valley cloud banks + snowier, varied trees (Nov 25, 2026)
- From Kevin's photo off a Killington summit (clear above, cloud rolling through the valleys, heavily rimed spruce): a separate valley-cloud layer in 13-weather.js. 10 big soft camera-facing quads (one mesh, +1 draw call) spawn 400-1,900 m out, floating 110-280 m below the camera over lower ground, drift with the wind and slowly breathe. Driven by its own ~5-minute cycle and strongest when it's clear where you are (fades as local fog thickens); off on the trail map. `__wx.forceBank = 0..1` pins it for tests.
- Trees: size variety (0.7-1.45 base, 12% saplings at 0.55x, 7% big at 1.35x), separate height and width scales per tree, stunted toward the summits (up to -30% above 950-1,200 m). Snow load per tree in the shader from the instance position: a random share plus more with altitude; it widens the snow bands, adds snowy tips and an overall frosting. Same geometry, no new draw calls.

## Lift terminals with operator huts (Nov 25, 2026)
- Kevin: lift tops looked like Monopoly buildings. Each end is now an open terminal: a long round-nosed bullwheel housing (white, lift-colour band, dark roof cap) on two centre-line columns and a footing, with the bullwheel and hub visible underneath, so chairs pass through either side. Beside the ramp, a small operator hut: plinth, cream lower walls, lift-colour window posts, a glazed band all round (one shared transparent mesh, +1 draw call), roof overhang, desk, console, back door, and an operator in a red jacket and beanie at the console facing the line.
- The cable now ends at the bullwheels ~5.2 m up (was a full-height 11 m tower 6 m from a 7 m box), stepping up over an 8 m tower 16 m out, so chairs come in at about head height. The "ft to top" readout follows. The drop-off search keeps clear of the hut. Lift tops still 72/72 reachable; +~25k triangles.

## Type: Barlow Condensed + Barlow (Nov 25, 2026)
- Kevin wanted the menus and cards to look less like a default system UI, ideally echoing killington.com. Its fonts couldn't be read from here (the page fetch returns text only; Chrome wasn't connected), so he picked from rendered options: "trail sign" Barlow Condensed (600/700) for headings, labels, buttons, the HUD, floating trail labels and the physical trail signs (uppercase), Barlow (400/600) for running text. Alternatives shown: Oswald + Source Sans, Archivo.
- Fonts are SIL OFL (`assets/fonts/OFL.txt`), from the @fontsource npm packages, inlined by tools/build.py as woff2 data URLs in a `<!--@FONTS-->` head tag (+96 KB, page 3.44 MB), so the page stays self-contained. The physical sign atlas is redrawn once the font finishes loading.

## Lift-top plateaus + skating (Nov 24, 2026)
- Trees: Kevin had two within arm's length of a drop-off (Skye Peak area). No trees now within the whole lift-top plateau (32 m of its centre) or 24 m of each drop-off spot; tiles already streamed in around a spot are rebuilt when it's worked out. Measured: nearest tree to every drop-off ≥ 24 m.
- Kevin: the ground right around lift drop-offs had ridges, drops and big height changes, an awkward start. Each unload area (centred 10 m past the top station) is now a least-squares plane through the ground within 30 m, tilted at most 3.5% the way the terrain falls, blended back into the real slope between 26 and 62 m (`PLAT` in 02-mountain/04-lifts; `H()` wraps the old height as `H0()`, so towers, terminals, tiles, physics and the drop-off search all sit on it). Within 30 m of every drop-off the ground now varies ~1.7–2.6 m. Lift-top reachability still 72/72, no new terrain steps, autopilot 47/55 (was 46).
- Skating (revised after Kevin: lean forward, push down and back rather than sideways): body pitches 0.2 rad forward and the chest folds 0.18 rad over each push, hips sink 7 cm, the pushing ski goes 34 cm back and only 11 cm out at 17°.
- Skating: a quick flick up (< 0.28 s, mostly vertical; E on a keyboard) is one stroke, alternating skis. Each pushes for 0.28 s (5.5 m/s², fading out between ~7 and ~22 mph, so it gets you across flats but doesn't add top speed); a flick mid-stroke queues the next, so rapid flicks become a steady rhythm. Animation through the per-ski groups and leg IK: the pushing ski splays ~23°, edges, drives out 24 cm and back, then lifts and returns while the weight rides the other ski; a short edge scrape sound per stroke. Holding up is still the tuck. Listed in How to play.

## Steadier camera in quick turns (Nov 24, 2026)
- Kevin: in quick left-right turns (steeper pitches, moguls) the chase camera felt jumpy. It followed the heading with a fixed ~0.3 s lag and tracked every sideways hip swing.
- Now adaptive: a "wiggle" measure (mean |yaw rate| minus |mean yaw rate| over ~0.7 s) is ~0 in a sustained turn and high when the heading swings back and forth. With wiggle the heading follow slows (rate 3.2 → 1.1 /s) and the camera anchor only drifts sideways with the skier (rate 30 → 3 /s); along the view it stays exact. Off in the air.
- `tools/test/camera.js`: quick turns: yaw swing −34%, sideways sway −38%; mogul-style turns −32% / −18%; a wide turn is unchanged (same 5° heading lag).

## Weather follow-up (Nov 24, 2026)
- Kevin: bright and clear stepping off the lift, then fog slamming in once he picked a trail. Cause: the lift and lift tops ran the weather on the wall clock, runs on run time seeded by trail name, so choosing a trail could jump from clear to socked in. Now one continuous clock everywhere (gives up per-trail identical weather for best times), fog eases in over ~3 s instead of ~1 s, and while you're at a lift top choosing a trail it's capped at moderate (visibility ≥ ~1.2 km in the worst cloud vs ~200 m on the trail) so you can see the signs and where the trails go.

## Sound effects from real recordings (Nov 24, 2026)
- Kevin asked for ski-on-snow sound that changes pitch with speed and the skier's angle, plus falls and collisions; realistic, cheap, and no simple synth sounds. Everything is now built from CC0 field recordings and foley (`assets/sfx/SOURCES.md`): two snowboard-slide takes (Nox_Sound), car-window wind above 500 Hz (FunWithSound), snow footsteps (Ryding), wood chops (Sheyvan), metal clanks (Ogrebane). The workspace can only download from GitHub and package registries, so the sources came via GitHub mirrors (minetest_game, the Winter Sled Valheim mod).
- `tools/sfx/build_sfx.py` rebuilds each loop as a 6 s texture of 1/8 s grains from random places in the recording (equal loudness, power-complementary windows, wrapped so it loops seamlessly): the real tone and crackle, none of the swells you'd hear repeat. One-shots are trimmed and normalised. 12 mono MP3s, 138 KB, inlined by `tools/build.py` as one JSON tag (page 3.12 → 3.31 MB). Loop points are set from the true sample count, so it loops cleanly whether or not the browser strips the MP3 encoder delay (Chrome does).
- `src/js/14-sfx.js`: two looping layers shaped every other frame from the controller. Glide: pitch 0.72→1.22×, brightness 1.3→6.5 kHz and level rise with speed; in powder it's lower, duller and a bit louder. Edge: comes in with the lean (the edge angle from the skier pose), pitch up to +45 % and highpass 0.7→3 kHz as the edge bites, scaled by speed. Both go silent in the air, crashed, paused or on a lift.
- One-shots: landing (crunch + low body crunch + short skid, scaled by impact speed), takeoff pop, mogul/bump jolts, fall (heavy crunch, tumble slide, a ski knocking, two rolling crunches), tree hit (low wood chop + crunch + snow sifting off branches), a light snow poke on each pole plant, and real metal clanks for lift towers (replacing the oscillator thump). The wind is now the real recording too (filtered noise until it decodes).
- Fixed: every drop-in / lift start used to add another wind chain on top of the last.
- Retune after Kevin's phone recording (30–60% of the energy under 300 Hz, the glide roaring over the carve as speed built): the glide is now a soft, higher hiss (high-passed 500→1,100 Hz with speed, pitched 1.0→1.35×, level about a third of before at top speed) and the edge/carve layer is mostly lean-driven so left/right carving stands out at any speed. Powder treatment softened (Killington is packed powder and groomed, not West Coast fluff). A 180 Hz high-pass on the whole mix; landing/fall 'weight' layers less boomy. Wind 25% under the carve.
- Steadier: Kevin heard a pulse at the top of runs (his recording: ~0.7 Hz, his turn rhythm). The carve layer went from silent at each edge change to full mid-turn; now it has a floor (40%), eases over ~0.2 s, and the glide dips less while carving.
- Chairlift wind: the real wind loop gusts (three slow sines) and gets stronger the higher the chair is above the ground, the higher up the mountain, and in cloud; its brightness moves with the gusts. The lift code no longer pins the wind to a flat level.
- New test `tools/test/sfx.js` (`npm run test:sfx`): decodes, checks loop points, rides slow/fast/carves/air and logs the layer levels and pitches, fires every one-shot, checks for page errors.

## Weather: altitude fog, falling snow, summit cloud wisps (Nov 24, 2026)
- New `src/js/13-weather.js`. One slow cloudiness cycle (two sines, ≈82 s and ≈190 s) drives everything: about half the time clear, the rest flurries building to thick cloud. During a run it runs on run time with a phase seeded by the trail name, so a trail always gets the same weather (fair best times); on lifts and menus it runs on the clock.
- Altitude scales it between 780 m and 1,180 m. Socked in at the summit, fog is 6–200 m (never under ~200 m, so signs and the next pitch stay readable at 40 mph); at the same moment mid-mountain (~900 m) it's 150–2,150 m. Fog colour shifts to an overcast grey, the sky dome and distant ridgelines wash out to match (new `uFogC/uFogK` uniforms), and the sun dims up to 35%.
- Falling snow: 4,000 points in a 22 m box that wraps around the camera, all motion in the vertex shader (no per-frame CPU), density = weather. Skipped when clear.
- Cloud wisps: 18 camera-facing soft quads in one mesh, spawned 70–320 m out over ground above ~760 m, drifting with the wind, fading out near the camera (no screen-filling) and into the fog. Skipped when clear.
- The trail map/pause view turns all of it off and restores clear fog.
- Cost: +2 draw calls only while snowing / cloudy (Superstar 168, Outer Limits 165), +~40 triangles; no physics changes. New test `tools/test/weather.js` (`npm run test:weather`): summit and mid-mountain at clear / 0.5 / 1, plus the map while foggy. `__wx.force = 0..1` pins the weather for testing.
- Not done: fog pooling in low ground (needs terrain shader work); flakes don't streak at speed.

## Skier biomechanics pass (Nov 24, 2026)
- Before: the whole body (legs included) rolled as one block by `steer*0.4` while the skis stayed flat, so legs never split into inside/outside, knees didn't track the skis, elbows winged out with hands near the shoulders, poles shrank to stay out of the snow and stuck out sideways in a tuck.
- Architecture kept: the air_squat clip scrubbed by `crouch` sets base flex; everything below is procedural in `updModel` (07-skier.js), driven by the existing controller (`steer`, `postS`, `S.v`, `S.air`, `S.land`). No new clips, meshes, physics bodies or per-frame allocations.
- Inclination: the body rolls by the controller's real lateral acceleration (atan(v·yaw rate / g), same rate formula as physics), max 0.6 rad, through a critically damped spring, faded out below ~7 m/s. The roll pivots about the outside boot.
- Skis are now one group per ski (`skiG`), placed under the boots, tipped on edge with the lean; the inside ski leads ~7 cm.
- Two-bone leg IK pins each boot to its binding (boot keeps its rest orientation to the ski), knee aimed along the ski and pushed slightly into the turn. Outside leg ends up long, inside leg folded; hips sink if the outside leg can't reach. Knee fold limited to 42% of leg length.
- Angulation: the lower spine bends back 40% against the lean; the neck levels the head 30%. Existing counter-rotation toward the fall line kept. A 0.2 rad forward fold from the waist gives the athletic stance.
- Arms: elbows lower and closer (out 0.22 → 0.14), hands forward and lower (forearm aim −0.08 → −0.3), arm frame rolls halfway with the torso so the outside arm clears the jacket; inside hand leads, outside elbow a touch wider in a carve.
- Poles: held at the fist (not the wrist), fixed length (if the tip would dig in, it swings back instead of shortening), slight swing lag, racer tuck with shafts under the arms (no more sideways wings), tips kick back in the air. Existing pole plant on turn changes unchanged.
- Terrain: a spring on the ground's vertical acceleration (`S.gAcc`, written by the fixed-step physics, no effect on motion) flexes the knees over bumps; landings kick it by impact speed; legs reach for the snow just before touchdown; more flex mid-turn so you rise through transitions. The post-landing crouch was 0.85, now 0.6 (absorption does the rest).
- New test `tools/test/skier-poses.js` (`npm run test:poses`): 10 scenarios stepped at true 60 Hz through a new `__kr.stepVis` hook, shot from behind/side/front, logging boot-to-binding gap (0.000 in all), knee range and lowest pole tip (≥ 0.05 m above snow). Autopilot unchanged at 46/55 (same as before). Animation + physics cost ~0.36 ms/frame headless.
- Known limits: the clip's pelvis is slightly asymmetric, so straight-running knees differ a little (112° vs 146°); no hand IK on the pole during a plant (tip stays above the snow rather than staying fixed in it); arms aren't collision-checked against the torso beyond the roll compensation; the fall/arise clips still play without skis or IK.

## Forgiving landings (Nov 24, 2026)
- Kevin bailed on most big jumps even landing level. The impact limit (vertical speed into the slope) was 13 m/s (18 crouched, 11 standing tall), but one boost already lands at ~15 m/s on flat ground and a double boost at ~19. tools/test/landings.js (jumps from 3 spots on each of 55 trails): level landings were 85% clean without a boost and 1–12% with boosts.
- Now 26 m/s level, 30 crouched, 20 standing tall; hard landings (>10 m/s) still cost speed and shake. Rotation tolerance 1.0 → 1.25 rad (bail) and 0.5 → 0.55 (sketchy, now −40% speed instead of −50%); with no input the skier levels out at 7 rad/s (was 5).
- Flips need a fresh push after takeoff: tucking (push up) into a jump or over a crest no longer starts a front flip until you let go.
- Result: level and tucked-through landings 91–100% clean for every jump type (the misses are double boosts off big drops); the autopilot's crashes went from 36 to 0.

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
