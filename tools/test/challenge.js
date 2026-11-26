/* Challenge links: ski a run, turn it into a link, check the link's size and how closely the decoded line follows the run, then open
   the link in a fresh browser (no saved ghosts), race it a little slower, and check the card, the gold ghost, the gap and the result.
   Also: a cut-off link, and a long run's link size. Output: test-output/challenge-*.png */
const { open, AUTOPILOT, ROOT } = require('./harness'); const path = require('path'), fs = require('fs');
(async () => {
  const OUT = path.join(ROOT, 'test-output'); fs.mkdirSync(OUT, { recursive: true });
  const name = process.argv[2] || 'Superstar', lift = process.argv[3] || 'ss';
  let { browser, page, errors } = await open(); await page.evaluate(AUTOPILOT);
  const drop = (p, nm, lf) => p.evaluate(([nm, lf]) => { const k = window.__kr; const L = k.LIFTS.find(l => l.id === lf); document.getElementById('start').classList.add('hidden');
    k.dropIn(k.TRAILS.filter(t => t.name === nm).sort((a, b) => b.L - a.L)[0], L.top); }, [nm, lf]);
  const ski = (p, secs, drag) => p.evaluate(([secs, drag]) => { const k = window.__kr, S = k.S; for (let i = 0; i < secs * 20 && (S.state === 'ride' || S.state === 'finishing'); i++) { window.__auto(3); if (drag && S.state === 'ride') S.v *= 1 - drag; } k.steerIn = 0; return S.state; }, [secs, drag]);
  await page.evaluate(() => window.__kr.ghost.clear());

  /* 1. the sender's run */
  await drop(page, name, lift); await page.waitForTimeout(2500); await ski(page, 400, 0); await page.waitForTimeout(2500);
  const r1 = await page.evaluate(() => { const k = window.__kr, S = k.S, url = k.chal.encode(S.endBase, S.top * 2.237, k.RUN.top), C = k.chal.fromHash(url.slice(url.indexOf('#'))), G = k.chal.grec();
    let maxE = 0, sumE = 0, maxH = 0, n = Math.min(G.n, C.G.n);
    for (let i = 0; i < n; i++) { const e = Math.hypot(G.X[i] - C.G.X[i], G.Z[i] - C.G.Z[i]); maxE = Math.max(maxE, e); sumE += e; const dh = Math.abs(Math.atan2(Math.sin(G.TH[i] - C.G.TH[i]), Math.cos(G.TH[i] - C.G.TH[i]))); maxH = Math.max(maxH, dh); }
    return { t: S.t.toFixed(2), base: S.endBase && S.endBase.name, shareBtn: !document.getElementById('share').classList.contains('hidden'), url, urlLen: url.length, bytes: C.bytes, hz: 10 / C.p,
      ownSamples: G.n, linkSamples: C.G.n, maxErrM: maxE.toFixed(2), meanErrM: (sumE / n).toFixed(2), maxHeadingDeg: (maxH * 180 / Math.PI).toFixed(0), trail: C.tr.name, top: C.top, t2: C.t, airMax: Math.max(...C.G.A).toFixed(1), airMaxOwn: Math.max(...G.A).toFixed(1) }; });
  const url = r1.url; delete r1.url; console.log('sender run', r1);
  await page.screenshot({ path: path.join(OUT, 'challenge-finish.png') });
  /* share button: headless has no Web Share; the clipboard either works or the link shows in a box */
  await page.evaluate(() => window.__kr.chal.share()); await page.waitForTimeout(400);
  console.log('share button', await page.evaluate(() => ({ label: document.getElementById('share').textContent, box: !document.getElementById('shareBox').classList.contains('hidden') })));
  /* a cut-off link and a long run's link */
  console.log('cut-off link', await page.evaluate(u => window.__kr.chal.fromHash(u.slice(u.indexOf('#'), -40)).err, url));
  await browser.close();

  /* 2. the friend opens the link: fresh browser, no saved ghosts */
  ({ browser, page, errors } = await open({ file: path.join(ROOT, 'dist/index.html') + url.slice(url.indexOf('#')) })); await page.evaluate(AUTOPILOT);
  await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, 'challenge-card.png') });
  console.log('card', await page.evaluate(() => ({ shown: !document.getElementById('chal').classList.contains('hidden'), name: document.getElementById('cName').textContent, route: document.getElementById('cRoute').textContent, time: document.getElementById('cTime').textContent, hashCleared: location.hash === '' })));
  await page.click('#cGo'); await page.waitForTimeout(2500);
  const gaps = [];
  for (const secs of [8, 12, 12]) { await ski(page, secs, 0.0025); await page.waitForTimeout(1800);
    gaps.push(await page.evaluate(() => { const k = window.__kr, S = k.S, gp = k.ghost.group; return { t: S.t.toFixed(1), hud: document.getElementById('gap').textContent, ghostAheadM: Math.hypot(gp.position.x - S.x, gp.position.z - S.z).toFixed(1), gold: gp.userData.mat.color.getHexString() }; })); }
  await page.screenshot({ path: path.join(OUT, 'challenge-race.png') });
  console.log('race', gaps);
  await ski(page, 400, 0.0025); await page.waitForTimeout(2500);
  console.log('result', await page.evaluate(() => ({ t: window.__kr.S.t.toFixed(2), card: document.getElementById('fBest').textContent, ownGhostSaved: !!localStorage.getItem('kr_ghost_' + window.__kr.RUN.name) })));
  /* race it again (same line, no drag) */
  await page.click('#again'); await page.waitForTimeout(2500); await ski(page, 400, 0); await page.waitForTimeout(2500);
  console.log('again', await page.evaluate(() => ({ chal: !!window.__kr.RUN.chal, t: window.__kr.S.t.toFixed(2), card: document.getElementById('fBest').textContent })));
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
