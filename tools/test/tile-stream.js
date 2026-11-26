/* Terrain streaming cost while skiing: how long the tile work takes each frame (the stutter a player feels) and whether the
   tiles keep up (no missing or low-detail ground near the skier). Skis a few long runs with the auto-pilot, one streaming
   call per 1/60 s of game time, exactly as the frame loop does.
   CPU times are this machine's; a mid-range phone is roughly 2-4x slower. Read the spread, not the absolute numbers. */
const { open, AUTOPILOT } = require('./harness');
(async () => {
  const runs = process.argv.slice(2).length ? process.argv.slice(2) : ['Great Eastern', 'Superstar', 'Outer Limits', 'Cascade'];
  const { browser, page, errors } = await open(); await page.evaluate(AUTOPILOT);
  const res = await page.evaluate(async (runs) => {
    const k = window.__kr, S = k.S, out = [];
    /* one tile build of each kind, timed on its own */
    const bt = { near: [], far: [] };
    if (k.buildTileSync) for (let i = 0; i < 12; i++) {
      const ti = Math.floor((-400 + i * 150) / 128), tj = Math.floor((-600 + (i % 5) * 200) / 128);
      for (const lod of [0, 1]) { const t0 = performance.now(); const t = k.buildTileSync(ti, tj, lod); (lod ? bt.far : bt.near).push(performance.now() - t0); k.dropTile(t); }
    }
    for (const name of runs) {
      const L = k.LIFTS.find(L => L.trails.some(t => t.name === name)); if (!L) { out.push({ name, err: 'no lift top' }); continue; }
      const tr = L.trails.find(t => t.name === name);
      document.getElementById('start').classList.add('hidden'); S.state = 'menu'; k.dropIn(tr, L.top); await new Promise(r => setTimeout(r, 450));
      const ms = []; let frames = 0, under = 0, lowUnder = 0, holes = 0;
      while ((S.state === 'ride' || S.state === 'finishing') && frames < 60 * 300) {
        window.__auto(1); frames++;   /* __auto steps in 3s, so this is 3 physics steps; stream 3 times to keep 60 Hz */
        for (let q = 0; q < 3; q++) { const t0 = performance.now(); k.streamTiles(); ms.push(performance.now() - t0); }
        if (frames % 10 === 0) {
          const ti = Math.floor(S.x / 128), tj = Math.floor(S.z / 128), t = k.tiles.get(ti + ',' + tj);
          if (!t) under++; else if (t.lod) lowUnder++;
          /* ground within 450 m ahead that should be drawn but has no tile (the low mountain mesh is cut away there: you'd see sky) */
          for (let d = 100; d <= 450; d += 50) { const x = S.x + Math.sin(S.th) * d, z = S.z + Math.cos(S.th) * d;
            if (x < k.XMIN || x > k.XMAX || z < k.ZMIN || z > k.ZMAX) continue;
            if (!k.tiles.get(Math.floor(x / 128) + ',' + Math.floor(z / 128))) holes++; }
        }
      }
      ms.sort((a, b) => a - b);
      const q = p => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))];
      out.push({ name, secs: (frames / 20).toFixed(0), calls: ms.length, mean: (ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2), p95: q(0.95).toFixed(2), p99: q(0.99).toFixed(2), max: ms[ms.length - 1].toFixed(1), over8: ms.filter(x => x > 8).length, over16: ms.filter(x => x > 16).length, noTileUnder: under, farTileUnder: lowUnder, holesAhead: holes });
      document.getElementById('finish').classList.add('hidden');
    }
    const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-';
    return { out, near: avg(bt.near), nearMax: bt.near.length ? Math.max(...bt.near).toFixed(1) : '-', far: avg(bt.far) };
  }, runs);
  console.log(`one tile build: near ${res.near} ms (max ${res.nearMax}), far ${res.far} ms`);
  console.log('run | game s | stream calls | mean ms | p95 | p99 | max | >8 ms | >16 ms | no tile under skier | far tile under skier | holes ahead');
  res.out.forEach(r => console.log(r.err ? r.name + ' ' + r.err : [r.name, r.secs, r.calls, r.mean, r.p95, r.p99, r.max, r.over8, r.over16, r.noTileUnder, r.farTileUnder, r.holesAhead].join(' | ')));
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
