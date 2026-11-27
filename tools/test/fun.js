/* Medals, flow meter, landing grades, star mode: (1) Superstar with the cruising auto-pilot and with the fast bot (tuck + boost): medal on the
   finish card; (2) Ovation with the fast bot: flow events, flow boosts, the meter; (3) a double-boost jump: landing grade, hit-stop,
   vibration; (4) a skid breaks the chain; (5) a flow boost's star mode. Output: test-output/fun-*.png */
const { open, AUTOPILOT, ROOT } = require('./harness'); const path = require('path'), fs = require('fs');
(async () => {
  const OUT = path.join(ROOT, 'test-output'); fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, errors } = await open(); await page.evaluate(AUTOPILOT);
  const shot = n => page.screenshot({ path: path.join(OUT, 'fun-' + n + '.png') });
  await page.evaluate(() => { window.__buzz = []; navigator.vibrate = p => { window.__buzz.push(p); return true; }; localStorage.clear(); });
  const drop = name => page.evaluate(name => { const k = window.__kr; const L = k.LIFTS.find(L => L.trails.some(t => t.name === name)); document.getElementById('start').classList.add('hidden'); document.getElementById('finish').classList.add('hidden'); k.dropIn(L.trails.find(t => t.name === name), L.top); }, name);
  const ski = (fast, secs) => page.evaluate(([fast, secs]) => { window.__autoTuck = fast; window.__autoBoost = fast; const S = window.__kr.S; for (let i = 0; i < secs * 20 && (S.state === 'ride' || S.state === 'finishing'); i++) window.__auto(3); window.__kr.steerIn = 0; return S.state; }, [fast, secs]);
  const card = () => page.evaluate(() => ({ t: window.__kr.S.t.toFixed(1), medal: document.getElementById('fMedal').innerText.replace(/\n+/g, ' | '), medals: window.__kr.fun.MEDALS['Superstar>k1'] }));
  /* 1. medals */
  await drop('Superstar'); await page.waitForTimeout(2000); await ski(false, 400); await page.waitForTimeout(1500);
  console.log('cruise', await card());
  await drop('Superstar'); await page.waitForTimeout(2000); await ski(true, 400); await page.waitForTimeout(1500);
  console.log('fast  ', await card()); await shot('medal');
  console.log('picker dot', await page.evaluate(() => { const k = window.__kr; k.showPicker(k.LIFTS.find(l => l.id === 'ss'), true); const b = [...document.querySelectorAll('#pickList .lift')].find(b => b.textContent.includes('Superstar')); const d = b && b.querySelector('.mdot'); const r = d && d.className; document.getElementById('pick').classList.add('hidden'); return r; }));
  /* 2. flow on Ovation (moguls, airs) with the fast bot: sample the meter as it goes */
  await drop('Ovation'); await page.waitForTimeout(2000); const fl = [];
  for (let i = 0; i < 8; i++) { await ski(true, 4); await page.waitForTimeout(500);
    fl.push(await page.evaluate(() => { const F = window.__kr.fun.FLOW, b = document.getElementById('boostBtn'); return { t: window.__kr.S.t.toFixed(0), v: F.v.toFixed(2), chain: F.chain, ready: F.ready, n: JSON.stringify(F.n), btn: b.textContent, ring: b.style.getPropertyValue('--flow') }; }));
    if (fl[fl.length - 1].ready && !fs.existsSync(path.join(OUT, 'fun-flow-ready.png'))) await shot('flow-ready'); }
  console.log('flow', fl);
  /* 3. a big jump: jump + two boosts, tucked through, level landing */
  await drop('Superstar'); await page.waitForTimeout(2000); await ski(false, 4);
  const land = await page.evaluate(async () => { const k = window.__kr, S = k.S, out = [];
    for (const [boosts, crouch] of [[0, 0], [1, 1], [1, 0]]) { window.__buzz = []; k.fun.FLOW.last = null; S.crashed = false; S.cool = 0; S.v = Math.max(S.v, 14); k.postIn = 0; k.steerIn = 0; k.jump();
      for (let b = 0; b < boosts; b++) { k.physicsOnly(18); k.jump(); }
      let n = 0; while (S.air && n < 600) { if (crouch && S.vy < 0) k.postIn = 1; k.physicsOnly(1); n++; } k.postIn = 0;
      out.push({ boosts, crouch, last: k.fun.FLOW.last, grade: document.getElementById('grade').textContent, buzz: JSON.stringify(window.__buzz), toast: document.getElementById('toast').textContent, flow: k.fun.FLOW.v.toFixed(2) });
      k.physicsOnly(90); }
    return out; });
  console.log('landing', land); await page.waitForTimeout(150); await shot('grade');
  /* 4. chain breakers */
  const brk = await page.evaluate(() => { const k = window.__kr, F = k.fun.FLOW; k.fun.flowAdd(0.1, 0, 'carve'); k.fun.flowAdd(0.1, 0, 'carve'); const before = { v: F.v.toFixed(2), chain: F.chain };
    k.S.v = Math.max(k.S.v, 18); k.steerIn = 1; for (let i = 0; i < 70; i++) k.physicsOnly(1); k.steerIn = 0; const afterSkid = { v: F.v.toFixed(2), chain: F.chain, sk: k.S.sk.toFixed(2) }; return { before, afterSkid }; });
  console.log('skid breaks the chain', brk);
  /* 5. star mode: a flow boost lasts FB.T s, lifts the speed cap, saves a slam and a bail, warms the grade, then everything goes back */
  await drop('Superstar'); await page.waitForTimeout(2000); await ski(false, 6);
  await page.evaluate(() => { const k = window.__kr; k.fun.FLOW.ready = true; k.fun.boost(); }); await page.waitForTimeout(1000); await shot('star');
  const star = await page.evaluate(() => { const k = window.__kr, S = k.S, c0 = S.crashes, r = { fb: +S.fb.toFixed(1), T: k.fun.FB.T, vig: document.getElementById('vig').className, btn: document.getElementById('boostBtn').className };
    S.air = true; S.y = k.H(S.x, S.z) + 0.5; S.vy = -40; S.airT = 1.5; k.physicsOnly(6); r.slamSaved = !S.crashed && S.crashes === c0;
    S.air = true; S.y = k.H(S.x, S.z) + 0.3; S.vy = -3; S.flip = 2.4; S.airT = 1; k.physicsOnly(6); r.bailSaved = !S.crashed && S.crashes === c0;
    let vmax = 0; for (let i = 0; i < 8 * 60; i++) { k.postIn = 1; k.physicsOnly(1); vmax = Math.max(vmax, S.v); } r.topMph = Math.round(vmax * 2.237); r.fbLeft = +S.fb.toFixed(1); return r; });
  star.gradeChanged = await page.evaluate(() => Array.from(window.__kr.light.GRADE).join(',') !== Array.from(window.__kr.light.GBASE).join(','));
  await page.evaluate(() => { window.__kr.physicsOnly(5 * 60); }); await page.waitForTimeout(5000);
  /* headless frames are slow, so wait for the look to finish easing out, then it should be exactly the preset's grade again */
  await page.waitForFunction(() => window.__kr.light.STAR.a === 0, null, { timeout: 30000 }).catch(() => {});
  star.after = await page.evaluate(() => ({ fb: window.__kr.S.fb, starA: window.__kr.light.STAR.a, gradeBack: Array.from(window.__kr.light.GRADE).join(',') === Array.from(window.__kr.light.GBASE).join(','), vig: document.getElementById('vig').className }));
  console.log('star mode', star);
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
