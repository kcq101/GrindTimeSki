/* Ski every trail you can pick off a lift with the auto-pilot; report where each run ends, time, top speed and crashes.
   "STUCK" = no progress for 30 s. The bot circles at flat trail-end benches a player skates through, and bails at 40+ mph
   landings that a player absorbs by crouching, so read crashes as "where the terrain is sharpest", not as bugs. */
const { open, AUTOPILOT } = require('./harness');
(async () => {
  const only = process.argv.slice(2);
  const { browser, page, errors } = await open(); await page.evaluate(AUTOPILOT);
  const rows = await page.evaluate(async (only) => {
    const k = window.__kr, S = k.S, R = [], seen = new Set(), starts = [];
    k.LIFTS.forEach(L => L.trails.forEach(t => { if (!seen.has(t) && (!only.length || only.includes(t.name))) { seen.add(t); starts.push([t, L.top]); } }));
    for (const [tr, top] of starts) {
      document.getElementById('start').classList.add('hidden'); S.state = 'menu'; k.dropIn(tr, top); await new Promise(r => setTimeout(r, 450));
      let steps = 0, stuck = 0, lx = S.x, lz = S.z, vmax = 0, crashes = [];
      while ((S.state === 'ride' || S.state === 'finishing') && steps < 60 * 300) {
        const c0 = S.crashes; window.__auto(6); steps += 6; vmax = Math.max(vmax, S.v);
        if (S.crashes > c0) crashes.push(document.getElementById('toast').textContent + '@' + Math.round(S.x) + ',' + Math.round(S.z));
        if (steps % 600 === 0) { stuck = Math.hypot(S.x - lx, S.z - lz) < 3 ? stuck + 1 : 0; lx = S.x; lz = S.z; if (stuck >= 3) break; }
      }
      R.push([tr.name, top, S.state === 'done' ? document.getElementById('fRoute').textContent : 'ended at ' + Math.round(S.x) + ',' + Math.round(S.z) + (stuck >= 3 ? ' STUCK' : ' (timeout)'),
        S.t.toFixed(0) + 's', Math.round(vmax * 2.237) + ' mph', crashes.length + ' crashes ' + crashes.slice(0, 3).join(' ')]);
      document.getElementById('finish').classList.add('hidden');
    }
    return R;
  }, only);
  rows.forEach(r => console.log(r.join(' | ')));
  console.log(`\n${rows.filter(r => !r[2].startsWith('ended')).length}/${rows.length} runs reached a finish`);
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
