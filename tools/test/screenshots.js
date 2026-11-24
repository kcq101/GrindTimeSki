/* Screenshots of the menu, four runs, a finish card and a lift-top picker, plus draw calls / triangles. Output: test-output/ */
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
  await page.waitForTimeout(3000); await page.evaluate(() => { const k = window.__kr; k.S.ls = k.S.lift.len - 30; }); await page.waitForTimeout(6000); await shot('lift-top-picker');
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
