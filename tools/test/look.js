/* Light presets, colour grade, speed streaks, camera roll: the same spots under each preset (and once with no grade), the trail map
   under each, streaks at speed, and the roll in a hard turn. Output: test-output/look/*.png */
const { open, AUTOPILOT, ROOT } = require('./harness'); const path = require('path'), fs = require('fs');
(async () => {
  const OUT = path.join(ROOT, 'test-output/look'); fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, errors } = await open(); await page.evaluate(AUTOPILOT);
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  const info = () => page.evaluate(() => { const i = window.__kr.renderer.info.render; return i.calls + ' draws, ' + (i.triangles / 1000 | 0) + 'k tris'; });
  await page.evaluate(() => { window.__wx.snap = true; });
  for (const id of ['changing', 'bluebird', 'golden', 'flat']) {
    await page.evaluate(id => { window.__kr.light.apply(id); window.__wx.force = id === 'flat' ? null : 0; }, id); await page.waitForTimeout(1500); await shot('map-' + id);
  }
  /* the same spot on Superstar, ~12 s in, under each preset; 'none' = Changing light with the grade off */
  await page.evaluate(() => { const k = window.__kr; document.getElementById('map').classList.add('hidden'); k.dropIn(k.TRAILS.filter(t => t.name === 'Superstar').sort((a, b) => b.L - a.L)[0], 'Skye Peak'); });
  await page.waitForTimeout(2500); await page.evaluate(() => { window.__auto(12 * 60); window.__kr.steerIn = 0; });
  const st = await page.evaluate(() => { const S = window.__kr.S; return { x: S.x, z: S.z, th: S.th, v: S.v }; });
  for (const id of (process.env.ONLY || 'none,changing,bluebird,golden,flat').split(',')) {
    await page.evaluate(([id, st]) => { const k = window.__kr, S = k.S; k.light.apply(id === 'none' ? 'changing' : id); if (id === 'none') k.light.GRADE.fill(0);
      window.__wx.force = id === 'flat' ? 0.6 : 0; window.__streak.force = 0; Object.assign(S, st); S.v = 0.01; }, [id, st]);
    await page.waitForTimeout(2200); await shot('run-' + id); console.log(id, await info());
  }
  /* speed streaks at ~60 mph */
  await page.evaluate(() => { window.__kr.light.apply('bluebird'); window.__wx.force = 0; window.__streak.force = null; });
  await page.evaluate(() => { window.__auto(6 * 60); }); await page.evaluate(() => { const S = window.__kr.S; S.v = 27; });
  for (let i = 0; i < 12; i++) { await page.evaluate(() => { window.__auto(6); window.__kr.S.v = Math.max(window.__kr.S.v, 27); }); await page.waitForTimeout(120); }
  await shot('streaks'); console.log('streaks', await page.evaluate(() => ({ amt: window.__streak.amt.toFixed(2), visible: window.__kr.light.streaks.visible, mph: Math.round(window.__kr.S.v * 2.237) })), await info());
  /* roll: hold a hard right turn at speed */
  await page.evaluate(() => { window.__streak.force = 0; });
  for (let i = 0; i < 14; i++) { await page.evaluate(() => { const k = window.__kr; k.steerIn = 1; k.physicsOnly(6); k.S.v = Math.max(k.S.v, 24); }); await page.waitForTimeout(110); }
  await shot('roll-turn');
  /* into the turn = the camera's inside ear goes down: turning left (heading increasing), its right vector points up */
  console.log('roll', await page.evaluate(async () => { const k = window.__kr, S = k.S, out = [];
    for (const st of [1, -1]) { let th0 = S.th; for (let i = 0; i < 16; i++) { th0 = S.th; k.steerIn = st; k.physicsOnly(4); S.v = Math.max(S.v, 24); await new Promise(r => setTimeout(r, 90)); }
      const R = new THREE.Vector3(1, 0, 0).applyQuaternion(k.camera.quaternion); let d = S.th - th0; d = Math.atan2(Math.sin(d), Math.cos(d));
      out.push({ steer: st, turning: d > 0 ? 'left' : 'right', rollDeg: +(window.__camr.r * 180 / Math.PI).toFixed(2), camRightY: +R.y.toFixed(3) }); }
    k.steerIn = 0; return out; }));
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
