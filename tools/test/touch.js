/* Touch steering vs the JUMP / BOOST buttons. Nov 27: the steering thumb sliding over to the bottom-left buttons read as a hard left turn
   and the steer then eased back for ~0.4 s ("leans left after a jump or flow boost"). Fix: steering stops once the thumb reaches a button,
   letting go there presses it, and the steer snaps to centre. The slide itself still steers until it reaches the button.
   Timed scenarios dispatch pointer events from inside the page with real gaps between them (headless touch emulation delivers ~1 per
   second, far slower than a thumb); one scenario goes through Chrome's real touch pipeline to prove the button press still lands.
   Reported per scenario: the steer input after each move, the most-left value of the smoothed steer the physics uses, and whether the
   button fired. Run with BEFORE=1 against an old build for comparison (no steer getter there, so only the button result). */
const { open, AUTOPILOT } = require('./harness');
(async () => {
  const { browser, page, errors } = await open(); await page.evaluate(AUTOPILOT);
  const fresh = async () => { await page.evaluate(() => { const k = window.__kr; document.getElementById('map').classList.add('hidden'); document.getElementById('finish').classList.add('hidden');
    k.dropIn(k.TRAILS.filter(t => t.name === 'Superstar').sort((a, b) => b.L - a.L)[0], 'Skye Peak'); }); await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__auto(3 * 60); const k = window.__kr; k.steerIn = 0; k.S.bcd = 0; k.S.bst = 0; }); };
  /* path: [[x,y,msAfterPrevious],...]; first point = pointerdown, last = pointerup. Runs synchronously with busy-wait gaps; the physics
     steer is stepped alongside at 1/60 s per 16.7 ms so its easing is measured too. */
  const run = (path, id) => page.evaluate(([path, id]) => { const k = window.__kr, c = document.querySelector('canvas'), out = { steerIn: [], minSteer: 0 };
    const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true, bubbles: true }));
    const spin = ms => { const t = performance.now() + ms; while (performance.now() < t) { } };
    const air0 = k.S.air, bst0 = k.S.bcd; out.startedInAir = air0;
    path.forEach(([x, y, ms], i) => { if (ms) { const n = Math.round(ms / 16.7); for (let j = 0; j < n; j++) { spin(16.7); k.physicsOnly(1); out.minSteer = Math.min(out.minSteer, k.steer); } }
      ev(i === 0 ? 'pointerdown' : i === path.length - 1 ? 'pointerup' : 'pointermove', x, y); if (i && i < path.length - 1) out.steerIn.push(+k.steerIn.toFixed(2)); });
    for (let j = 0; j < 30; j++) { k.physicsOnly(1); out.minSteer = Math.min(out.minSteer, k.steer); }
    out.minSteer = +out.minSteer.toFixed(2); out.jumped = air0 ? k.S.boosts > 0 : k.S.air; out.boosted = k.S.bcd > bst0; return out; }, [path, id]);
  await fresh();   /* the buttons only have a size once the HUD is showing */
  const B = await page.evaluate(() => { const r = document.getElementById('boostBtn').getBoundingClientRect(), j = document.getElementById('jumpBtn').getBoundingClientRect(); return { bx: r.x + r.width / 2, by: r.y + r.height / 2, jx: j.x + j.width / 2, jy: j.y + j.height / 2 }; });
  const line = (x, y, tx, ty, n, ms) => Array.from({ length: n }, (_, i) => [x + (tx - x) * (i + 1) / n, y + (ty - y) * (i + 1) / n, ms]);
  const R = {};
  /* a relaxed thumb: steer a little right, then over to JUMP in ~200 ms (1.2-1.5 px/ms), let go on it */
  await fresh(); R.slideToJump = await run([[300, 650], ...line(300, 650, 335, 650, 3, 40), ...line(335, 650, B.jx, B.jy, 12, 17), [B.jx, B.jy, 30]], 11);
  await fresh(); R.slideToBoost = await run([[290, 700], ...line(290, 700, B.bx, B.by, 12, 17), [B.bx, B.by, 30]], 12);
  /* a slow, deliberate slide to JUMP (0.5 px/ms): reads as steering until it reaches the button, then snaps back to centre */
  await fresh(); R.slowSlideToJump = await run([[300, 650], ...line(300, 650, B.jx, B.jy, 30, 17), [B.jx, B.jy, 30]], 13);
  /* real steering still works */
  await fresh(); R.leftTurn60px = await run([[300, 650], ...line(300, 650, 240, 652, 10, 30), [240, 652, 400]], 14);
  await fresh(); R.flickRightAndHold = await run([[300, 650], [370, 650, 17], [370, 651, 120], [370, 651, 30]], 15);
  await fresh(); R.restingWobble = await run([[300, 650], [302, 650, 60], [297, 651, 60], [303, 650, 60], [299, 649, 60], [299, 649, 30]], 16);
  /* through Chrome's real touch pipeline: steer, slide onto JUMP, let go -> it jumps */
  await fresh(); const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([id, x, y]) => ({ id, x, y })) });
  await T('touchStart', [[1, 300, 650]]); for (let i = 1; i <= 6; i++) await T('touchMove', [[1, 300 - (300 - B.jx) * i / 6, 650 + (B.jy - 650) * i / 6]]);
  await T('touchEnd', [[1, B.jx, B.jy]]); await page.waitForTimeout(1500); R.realTouchSlideToJump = { jumped: await page.evaluate(() => window.__kr.S.air || window.__kr.S.airT > 0) };
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(22), JSON.stringify(v));
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
