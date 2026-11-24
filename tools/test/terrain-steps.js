/* Walk every named trail centreline in 1 m steps and list the sharpest height changes (second difference, m).
   Paired +/- values at one spot = a step in the surface. Values ~1 on Outer Limits / Devil's Fiddle / Ovation are moguls. */
const { open } = require('./harness');
(async () => {
  const { browser, page } = await open();
  const r = await page.evaluate(() => { const k = window.__kr, sp = [];
    k.TRAILS.forEach(tr => { if (!tr.name) return; let prev = null, pp = null;
      for (let i = 0; i < tr.s.length - 1; i++) { const a = tr.s[i], b = tr.s[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let u = 0; u < L; u += 1) { const x = a[0] + (b[0] - a[0]) * u / L, z = a[1] + (b[1] - a[1]) * u / L, h = k.H(x, z);
          if (pp !== null) { const c = h - 2 * prev + pp; if (Math.abs(c) > 0.5) sp.push([+c.toFixed(2), tr.name, Math.round(x), Math.round(z)]); } pp = prev; prev = h; } } });
    return sp.sort((a, b) => Math.abs(b[0]) - Math.abs(a[0])).slice(0, 30); });
  r.forEach(x => console.log(x.join('  '))); await browser.close();
})();
