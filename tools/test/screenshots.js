/* Screenshots of the menu, four runs, a finish card, the lift-top signs, junction signs and the pause menu, plus draw calls / triangles. Output: test-output/ */
const { open, AUTOPILOT, ROOT } = require('./harness'); const path = require('path'), fs = require('fs');
(async () => {
  const OUT = path.join(ROOT, 'test-output'); fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, errors } = await open(); await page.evaluate(AUTOPILOT);
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  await page.evaluate(() => document.getElementById('start').classList.add('hidden')); await page.waitForTimeout(3000); await shot('menu');
  const mapInfo = () => page.evaluate(() => { const i = window.__kr.renderer.info.render; return { drawCalls: i.calls, triangles: i.triangles }; });
  console.log('map', await mapInfo());
  await page.evaluate(() => window.__map.select('k1')); await page.waitForTimeout(2500); await shot('map-peak');
  await page.evaluate(() => window.__map.select('b-shs')); await page.waitForTimeout(2500); await shot('map-base');
  await page.evaluate(() => window.__map.select(null)); await page.waitForTimeout(500);
  for (const [name, lift, secs, tag] of [['Superstar', 'ss', 12, 'superstar'], ['Outer Limits', 'bear', 14, 'outer-limits'], ['Cascade - Headwall', 'k1', 6, 'cascade'], ['Great Northern', 'k1', 30, 'great-northern']]) {
    await page.evaluate(([name, lift]) => { const k = window.__kr; const L = k.LIFTS.find(l => l.id === lift); k.dropIn(k.TRAILS.filter(t => t.name === name).sort((a, b) => b.L - a.L)[0], L.top); }, [name, lift]);
    await page.waitForTimeout(3000); await page.evaluate(n => window.__auto(n), secs * 60); await page.evaluate(() => window.__kr.steerIn = 0);
    await page.waitForTimeout(5000); await shot(tag);
    console.log(tag, await page.evaluate(() => { const i = window.__kr.renderer.info.render; return { drawCalls: i.calls, triangles: i.triangles }; }));
  }
  await page.evaluate(() => window.__auto(200 * 60)); await page.waitForTimeout(1500); await shot('finish-card');
  await page.evaluate(() => { const k = window.__kr; document.getElementById('finish').classList.add('hidden'); k.startLift(k.LIFTS.find(l => l.id === 'ss')); });
  await page.waitForTimeout(3000); await page.evaluate(() => { const k = window.__kr; k.S.ls = k.S.lift.len - 30; }); await page.waitForTimeout(6000); await shot('lift-top-signs');
  console.log('lift-top', await page.evaluate(() => { const k = window.__kr, i = k.renderer.info.render; return { state: k.S.state, signs: k.sgList.map(e => e.tr.name), drawCalls: i.calls, triangles: i.triangles }; }));
  /* turn to look back up the hill: the signs behind you become arrows on the screen edge */
  await page.evaluate(() => { const k = window.__kr; k.S.th += Math.PI; }); await page.waitForTimeout(2500); await shot('lift-top-edges');
  await page.evaluate(() => { const k = window.__kr; k.S.th -= Math.PI; k.S.go = true; }); await page.evaluate(() => window.__auto(8 * 60)); await page.evaluate(() => window.__kr.steerIn = 0);
  console.log('after push-off', await page.evaluate(() => { const k = window.__kr; return { pre: !!k.S.pre, run: k.RUN.name, t: k.S.t.toFixed(1) }; }));
  /* junction signs: Superstar, coming up on the Launch Pad split */
  await page.evaluate(() => { const k = window.__kr; k.dropIn(k.TRAILS.filter(t => t.name === 'Superstar').sort((a, b) => b.L - a.L)[0], 'Skye Peak'); });
  await page.waitForTimeout(2000); await page.evaluate(() => window.__auto(3 * 60)); await page.evaluate(() => window.__kr.steerIn = 0); await page.waitForTimeout(2500); await shot('junction-signs');
  console.log('junction', await page.evaluate(() => window.__kr.sgList.map(e => e.tr.name)));
  await page.evaluate(() => window.__kr.pauseGame()); await page.waitForTimeout(800); await shot('pause');
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
