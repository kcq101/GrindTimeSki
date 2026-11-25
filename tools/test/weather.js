/* Weather check: the summit (Superstar top) and low on the mountain (Cascade Runout) at clear / flurries / socked-in,
   from the normal chase camera, plus the trail map while it's foggy. Logs fog distances and draw calls/triangles.
   Usage: node tools/test/weather.js      Output: test-output/weather/ */
const { open, ROOT } = require('./harness'); const path = require('path'), fs = require('fs');
const OUT = path.join(ROOT, 'test-output/weather'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const { browser, page, errors } = await open();
  await page.evaluate(() => { document.getElementById('start').classList.add('hidden'); window.__wx.snap = 1; });
  const spots = [['summit', 'Superstar', 'ss', 60], ['low', 'Cascade Runout', 'k1', 120]];
  for (const [tag, trail, lift, frames] of spots) {
    await page.evaluate(([name, lift]) => { window.__freeze = 0; const k = window.__kr; const L = k.LIFTS.find(l => l.id === lift); const t = k.TRAILS.filter(t => t.name === name).sort((a, b) => b.L - a.L)[0]; k.dropIn(t, L ? L.top : t.name); }, [trail, lift]);
    await page.waitForTimeout(2500);
    await page.evaluate(n => { window.__freeze = 1; const k = window.__kr; k.S.go = true; k.stepVis(n, () => ({})); }, frames);
    for (const c of [0, 0.5, 1]) {
      await page.evaluate(c => window.__wx.force = c, c); await page.waitForTimeout(1500);
      const info = await page.evaluate(() => { const k = window.__kr, i = k.renderer.info.render; return Object.assign(k.weather(), { draws: i.calls, tris: i.triangles }); });
      console.log(tag.padEnd(7), 'cloud', c, JSON.stringify(info));
      await page.screenshot({ path: path.join(OUT, `${tag}-${c}.png`) });
    }
  }
  await page.evaluate(() => { window.__freeze = 0; window.__kr.pauseGame && window.__kr.pauseGame(); });
  await page.waitForTimeout(2500); await page.screenshot({ path: path.join(OUT, 'map-while-foggy.png') });
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
