/* Sound check: decodes the inlined recordings, checks loop points, then drives the skier through straight runs, carves,
   powder, a jump + landing, a fall and a tree hit and logs what the glide/edge layers do. No ears needed for regressions:
   glide pitch/level should rise with speed, edge level/pitch with lean, both silent in the air, crashed, paused or on a lift.
   Usage: node tools/test/sfx.js */
const { open } = require('./harness');
(async () => {
  const { browser, page, errors } = await open();
  await page.evaluate(() => { document.getElementById('start').classList.add('hidden'); const k = window.__kr; const L = k.LIFTS.find(l => l.id === 'ss'); k.dropIn(k.TRAILS.filter(t => t.name === 'Superstar').sort((a, b) => b.L - a.L)[0], L.top); });
  await page.waitForFunction(() => window.__sfx && window.__sfx.on, null, { timeout: 30000 });
  console.log('decoded', JSON.stringify(await page.evaluate(() => window.__kr.sfxState().loops)));
  const run = async (tag, n, fn) => {
    await page.evaluate(([n, fn]) => { window.__freeze = 1; const k = window.__kr; k.S.go = true; const f = eval(fn); k.stepVis(n, (t, S) => f(t, S)); }, [n, fn]);
    await page.waitForTimeout(1200);
    const st = await page.evaluate(() => { const k = window.__kr, s = k.sfxState(); return Object.assign({ mph: Math.round(k.S.v * 2.237), air: k.S.air, crashed: k.S.crashed }, s, { loops: undefined }); });
    console.log(tag.padEnd(14), JSON.stringify(st));
  };
  await run('slow', 30, '()=>({})');
  await run('straight-fast', 400, '()=>({p:1})');
  await run('carve', 80, '()=>({s:0.9})');
  await run('carve-other', 80, '()=>({s:-0.9})');
  await run('air', 15, '(t)=>({jump:t<0.02})');
  await run('landed', 120, '()=>({})');
  await page.evaluate(() => { window.__freeze = 0; window.__kr.pauseGame(); }); await page.waitForTimeout(1200);
  console.log('paused        ', JSON.stringify(await page.evaluate(() => { const s = window.__kr.sfxState(); return { glide: s.glide, edge: s.edge }; })));
  console.log('one-shots', await page.evaluate(() => { const t = window.__kr.sfxTest(); return 'scheduled at ' + t.toFixed(2) + 's'; }));
  await page.waitForTimeout(2500);
  if (errors.length) console.log(errors.join('\n')); else console.log('no page errors');
  await browser.close();
})();
