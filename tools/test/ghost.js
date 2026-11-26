/* Ghost racer: ski a run (saves the ghost), ski it again a little slower and check the ghost replays, the HUD gap grows the right
   way and the finish card says who won; screenshots of the ghost ahead of you. Output: test-output/ghost-*.png */
const { open, AUTOPILOT, ROOT } = require('./harness'); const path = require('path'), fs = require('fs');
(async () => {
  const OUT = path.join(ROOT, 'test-output'); fs.mkdirSync(OUT, { recursive: true });
  const name = process.argv[2] || 'Superstar', lift = process.argv[3] || 'ss';
  const { browser, page, errors } = await open(); await page.evaluate(AUTOPILOT);
  const shot = n => page.screenshot({ path: path.join(OUT, 'ghost-' + n + '.png') });
  const drop = () => page.evaluate(([name, lift]) => { const k = window.__kr; const L = k.LIFTS.find(l => l.id === lift); document.getElementById('start').classList.add('hidden');
    k.dropIn(k.TRAILS.filter(t => t.name === name).sort((a, b) => b.L - a.L)[0], L.top); }, [name, lift]);
  /* drag: 0 = the plain auto-pilot; >0 bleeds a little speed every step, so the run is slower than the ghost */
  const ski = (secs, drag) => page.evaluate(([secs, drag]) => { const k = window.__kr, S = k.S; for (let i = 0; i < secs * 20 && (S.state === 'ride' || S.state === 'finishing'); i++) { window.__auto(3); if (drag && S.state === 'ride') S.v *= 1 - drag; } k.steerIn = 0; return S.state; }, [secs, drag]);
  await page.evaluate(() => window.__kr.ghost.clear());

  /* run 1: no ghost yet */
  await drop(); await page.waitForTimeout(2500);
  console.log('run 1 ghost loaded:', await page.evaluate(() => !!window.__kr.ghost.g));
  await ski(400, 0); await page.waitForTimeout(2500);
  const r1 = await page.evaluate(() => { const k = window.__kr, s = localStorage.getItem('kr_ghost_' + k.RUN.name), o = s && JSON.parse(s);
    return { t: k.S.t.toFixed(2), base: k.S.endBase && k.S.endBase.name, card: document.getElementById('fBest').textContent, saved: !!o, savedT: o && o.t, bytes: s && s.length, samples: k.ghost.rec.n }; });
  console.log('run 1', r1);
  const dec = await page.evaluate(() => { const g = window.__kr.ghost.load(window.__kr.RUN.name), k = window.__kr; return g && { n: g.n, dur: g.dur.toFixed(1), endX: g.X[g.n - 1].toFixed(1), endZ: g.Z[g.n - 1].toFixed(1), finX: k.S.x.toFixed(1), finZ: k.S.z.toFixed(1) }; });
  console.log('decoded', dec);

  /* run 2: slower, so the ghost pulls ahead */
  await page.evaluate(() => document.getElementById('finish').classList.add('hidden'));
  await drop(); await page.waitForTimeout(2500);
  console.log('run 2 ghost loaded:', await page.evaluate(() => { const g = window.__kr.ghost.g; return g && { t: g.t, n: g.n }; }));
  const gaps = [];
  for (const [secs, tag] of [[6, 'early'], [12, 'mid'], [12, 'late']]) {
    await ski(secs, 0.0025); await page.waitForTimeout(1800); await shot(tag);
    gaps.push(await page.evaluate(() => { const k = window.__kr, S = k.S, gp = k.ghost.group, i = k.renderer.info.render;
      return { t: S.t.toFixed(1), hud: document.getElementById('gap').textContent, gapNow: (k.ghost.gap() || 0).toFixed(2), ghostVisible: gp.visible, ghostAheadM: Math.hypot(gp.position.x - S.x, gp.position.z - S.z).toFixed(1), drawCalls: i.calls, tris: i.triangles }; }));
  }
  console.log('run 2 gaps', gaps);
  await ski(400, 0.0025); await page.waitForTimeout(2500); await shot('finish');
  console.log('run 2 finish', await page.evaluate(() => ({ t: window.__kr.S.t.toFixed(2), card: document.getElementById('fBest').textContent, ghostT: JSON.parse(localStorage.getItem('kr_ghost_' + window.__kr.RUN.name)).t })));

  /* run 3: the plain auto-pilot again (same line as the ghost): a dead heat or close to it */
  await page.evaluate(() => document.getElementById('finish').classList.add('hidden'));
  await drop(); await page.waitForTimeout(2500); await ski(400, 0); await page.waitForTimeout(2500);
  console.log('run 3 finish', await page.evaluate(() => ({ t: window.__kr.S.t.toFixed(2), card: document.getElementById('fBest').textContent })));
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
