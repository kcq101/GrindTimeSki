/* Landing forgiveness: from spots spread over every pickable trail, jump (no boost, one boost, two boosts right away, two at the
   apex) holding no input, tucked from before takeoff (should NOT flip), pushing up only after takeoff (a deliberate front flip,
   partial so it bails), or pulling back a little; count clean landings vs bails. A player who lands with skis level
   should almost never bail. */
const { open } = require('./harness');
(async () => {
  const { browser, page, errors } = await open();
  const r = await page.evaluate(() => {
    const k = window.__kr, S = k.S, seen = new Set(), trails = [];
    k.LIFTS.forEach(L => L.trails.forEach(t => { if (!seen.has(t)) { seen.add(t); trails.push(t); } }));
    const plans = { none: [], one: [0.1], twoNow: [0.1, 0.2], twoApex: [0.5, 1.0] }, holds = { level: 0, tuckThrough: 0.8, flipPush: 0.8, pullBack: -0.3 }, res = {};
    for (const [pn, boosts] of Object.entries(plans)) for (const [hn, post] of Object.entries(holds)) {
      let ok = 0, slam = 0, bail = 0, n = 0;
      for (const tr of trails) for (const f of [0.25, 0.5, 0.75]) {
        k.dropIn(tr, 'x'); k.runFromTrail(tr, 'x'); const i = Math.floor(tr.s.length * f), p = tr.s[i], q = tr.s[Math.min(i + 1, tr.s.length - 1)];
        S.state = 'ride'; S.crashed = false; S.air = false; S.x = p[0]; S.z = p[1]; S.th = Math.atan2(q[0] - p[0], q[1] - p[1]); S.v = 15; S.crashes = 0; S.gyp = undefined; S.gvp = undefined;
        k.steerIn = 0; k.postIn = hn === 'tuckThrough' ? post : 0; k.physicsOnly(30); k.jump(); let t = 0, bi = 0;
        while (S.air && t < 6) { if (bi < boosts.length && t >= boosts[bi]) { k.jump(); bi++; } k.postIn = post; k.physicsOnly(1); t += 1 / 60; }
        k.postIn = 0; n++; if (S.crashes === 0) ok++; else if (document.getElementById('toast').textContent.startsWith('SLAM')) slam++; else bail++;
      }
      res[pn + ' / ' + hn] = Math.round(100 * ok / n) + '% clean (' + slam + ' slammed, ' + bail + ' bailed of ' + n + ')';
    }
    S.state = 'menu'; return res; });
  Object.entries(r).forEach(([k, v]) => console.log(k.padEnd(22), v));
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
