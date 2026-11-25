/* Chase camera steadiness: rides quick left-right turns (short turns / moguls) and one long wide turn, stepping physics,
   skier and camera at 60 Hz, with the adaptive camera on and off. Reports how much the camera swings (yaw rate RMS,
   sideways speed RMS) and, for the wide turn, how far the camera's heading lags the skier's.
   Usage: node tools/test/camera.js */
const { open } = require('./harness');
(async () => {
  const { browser, page, errors } = await open();
  await page.evaluate(() => { document.getElementById('start').classList.add('hidden'); });
  const ride = async (off, fn) => { await page.evaluate(() => { window.__freeze = 0; const k = window.__kr; const L = k.LIFTS.find(l => l.id === 'ss'); k.dropIn(k.TRAILS.filter(t => t.name === 'Superstar').sort((a, b) => b.L - a.L)[0], L.top); });
    await page.waitForTimeout(2500); return page.evaluate(([off, fn]) => { const k = window.__kr;
    window.__freeze = 1; window.__camw.off = off; k.S.go = true; const f = eval(fn); const cam = k.camera;
    k.stepVis(300, () => ({})); k.placeCam(true, 1 / 60);
    let py = null, px = null, pz = null, n = 0, yr2 = 0, ls2 = 0, lag = 0, lagN = 0;
    for (let i = 0; i < 360; i++) { const t = i / 60; k.stepVis(1, () => f(t)); k.placeCam(false, 1 / 60);
      const d = new THREE.Vector3(); cam.getWorldDirection(d); const yaw = Math.atan2(d.x, d.z);
      if (py !== null && i > 60) { let dy = yaw - py; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); yr2 += (dy * 60) ** 2;
        const vx = (cam.position.x - px) * 60, vz = (cam.position.z - pz) * 60, lat = vx * Math.cos(yaw) - vz * Math.sin(yaw); ls2 += lat * lat; n++;
        let lg = k.S.th - yaw; lg = Math.atan2(Math.sin(lg), Math.cos(lg)); lag += Math.abs(lg); lagN++; }
      py = yaw; px = cam.position.x; pz = cam.position.z; }
    return { yawRateRMS: +Math.sqrt(yr2 / n).toFixed(3), sidewaysRMS: +Math.sqrt(ls2 / n).toFixed(2), headingLagDeg: +(lag / lagN * 57.3).toFixed(1), wiggle: +window.__camw.w.toFixed(2), mph: Math.round(k.S.v * 2.237) };
  }, [off, fn]); };
  for (const [tag, fn] of [['quick turns', '(t)=>({s:Math.sin(t*2*Math.PI*1.2)>0?0.7:-0.7})'], ['moguls-ish', '(t)=>({s:Math.sin(t*2*Math.PI*0.8)*0.9})'], ['wide turn', '(t)=>({s:t<1?0:0.18})']]) {
    const a = await ride(true, fn), b = await ride(false, fn);
    console.log(tag.padEnd(12), 'before', JSON.stringify(a), '\n'.padEnd(14), 'after ', JSON.stringify(b));
  }
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
