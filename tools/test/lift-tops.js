/* From every lift top's starting spot, steer straight for each trail's sign and check the skier gets there (within 15 m, in 40 s).
   A miss means that trail is uphill or walled off from where the lift drops you. */
const { open } = require('./harness');
(async () => {
  const { browser, page, errors } = await open();
  const rows = await page.evaluate(() => {
    const k = window.__kr, S = k.S, out = [];
    for (const L of k.LIFTS) { if (!L.trails.length) continue;
      for (const e of k.liftSigns(L)) {
        k.topStart(L); S.go = true; let ok = false, t = 0, best = 1e9, onIt = false;
        for (; t < 40 * 60 && S.state === 'ride'; t += 3) {
          /* like a player: head for the trail's first 10 m, then follow it down to the sign */
          let gx, gz;
          if (!onIt) { const i = Math.min(e.tr.s.length - 1, e.tr.cs.findIndex(c => c >= Math.min(10, e.tr.L * 0.3))); gx = e.tr.s[i][0]; gz = e.tr.s[i][1]; if (Math.hypot(gx - S.x, gz - S.z) < 8) onIt = true; }
          if (onIt) { let bi = 0, bd = 1e9; e.tr.s.forEach((p, i) => { const d = Math.hypot(p[0] - S.x, p[1] - S.z); if (d < bd) { bd = d; bi = i; } });
            const a = e.tr.s[Math.min(bi + 2, e.tr.s.length - 1)]; gx = a[0]; gz = a[1]; }
          let d = Math.atan2(gx - S.x, gz - S.z) - S.th; d = Math.atan2(Math.sin(d), Math.cos(d));
          k.steerIn = Math.max(-1, Math.min(1, -d * 2.5)); k.postIn = 0; k.physicsOnly(3);
          if (S.crashed) { S.crashed = false; S.v = 2; }
          const dist = Math.hypot(e.x - S.x, e.z - S.z); best = Math.min(best, dist); if (dist < 15) { ok = true; break; } }
        out.push([L.top + ' (' + L.id + ')', e.tr.name, ok ? 'ok ' + (t / 60).toFixed(0) + 's' : 'MISS closest ' + best.toFixed(0) + ' m']);
      } }
    k.steerIn = 0; S.state = 'menu'; return out; });
  rows.forEach(r => console.log(r.join(' | ')));
  console.log(`\n${rows.filter(r => r[2].startsWith('ok')).length}/${rows.length} trails reachable from their lift top`);
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
