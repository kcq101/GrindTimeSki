/* Close-up skier shots for animation review: straight, left/right carves, tight fast turn, transitions, tuck, jump + landing, bumps.
   Each scenario is stepped at a true 60 Hz (physics + skier visuals, no rendering), then frozen and shot from behind, the side and the front.
   Logs joint sanity numbers per scenario: boot-to-binding gap (should be ~0), knee angle range, lowest pole tip (must stay above the snow).
   Usage: node tools/test/skier-poses.js [scenarioPrefix]      Output: test-output/poses/ */
const { open, ROOT } = require('./harness'); const path = require('path'), fs = require('fs');
const OUT = path.join(ROOT, 'test-output/poses'); fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const SC = [
  ['straight', 'Superstar', 'ss', 4, '(t)=>({})'],
  ['carve-left', 'Superstar', 'ss', 4, '(t)=>({s:t>2.6?-0.8:0})'],
  ['carve-right', 'Superstar', 'ss', 4, '(t)=>({s:t>2.6?0.8:0})'],
  ['tight-fast', 'Superstar', 'ss', 7, '(t)=>({s:t>6.2?1:0,p:t<5.5?1:0})'],
  ['transition', 'Superstar', 'ss', 4.83, '(t)=>({s:t<2?0:Math.sin((t-2)*2.2)>0?0.9:-0.9})'],
  ['tuck', 'Superstar', 'ss', 4, '(t)=>({p:1})'],
  ['jump', 'Superstar', 'ss', 3.35, '(t)=>({jump:t>3&&t<3.02})'],
  ['prelanding', 'Superstar', 'ss', 4.0, '(t)=>({jump:t>3&&t<3.02})'],
  ['landing', 'Superstar', 'ss', 6, '(t,S)=>{if(t>3.1&&!S.air&&!window.__lt)window.__lt=t;return {jump:t>3&&t<3.02,stop:window.__lt&&t>window.__lt+0.12};}'],
  ['bumps', 'Outer Limits', 'bear', 9, '(t)=>({s:Math.sin(t*2)*0.4})'],
];
(async () => {
  const { browser, page, errors } = await open();
  await page.evaluate(() => {
    document.getElementById('start').classList.add('hidden');
    const st = document.createElement('style'); st.textContent = 'body *{visibility:hidden!important} canvas{visibility:visible!important}'; document.head.appendChild(st);
    window.__view = 'back';
    window.__camHook = (cam, sk, S) => {
      const fx = Math.sin(S.th), fz = Math.cos(S.th), rx = Math.cos(S.th), rz = -Math.sin(S.th), y = sk.position.y;
      const V = { back: [-fx * 4.6, 1.6, -fz * 4.6], side: [rx * 4.6, 0.9, rz * 4.6], front: [fx * 4.8, 1.2, fz * 4.8] }[window.__view];
      const cx = S.x + V[0], cz = S.z + V[2]; cam.position.set(cx, Math.max(y + V[1], window.__kr.H(cx, cz) + 0.5), cz); cam.lookAt(S.x, y + 0.75, S.z); cam.fov = 40; cam.updateProjectionMatrix();
    };
  });
  for (const [tag, trail, lift, secs, fn] of SC) {
    if (only && !tag.startsWith(only)) continue;
    await page.evaluate(() => { window.__freeze = 0; });
    await page.evaluate(([name, lift]) => { const k = window.__kr; const L = k.LIFTS.find(l => l.id === lift); k.dropIn(k.TRAILS.filter(t => t.name === name).sort((a, b) => b.L - a.L)[0], L.top); }, [trail, lift]);
    await page.waitForTimeout(1200);
    const log = await page.evaluate(([secs, fn]) => { window.__freeze = 1; const k = window.__kr; k.S.go = true; const f = eval(fn), log = []; window.__lt = 0;
      k.stepVis(Math.round(secs * 60), (t, S) => Object.assign(f(t, S), { log })); return log.filter(Boolean); }, [secs, fn]);
    const gap = Math.max(...log.map(o => Math.max(...o.gap))), kn = log.flatMap(o => o.knee), tip = Math.min(...log.map(o => Math.min(...o.tipY)));
    console.log(tag.padEnd(12), 'boot gap max', gap.toFixed(3), ' knee', Math.min(...kn) + '-' + Math.max(...kn), ' pole tip min y', tip.toFixed(2), ' end', JSON.stringify(log[log.length - 1]));
    for (const v of ['back', 'side', 'front']) { await page.evaluate(v => window.__view = v, v); await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `${tag}-${v}.png`) }); }
  }
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
