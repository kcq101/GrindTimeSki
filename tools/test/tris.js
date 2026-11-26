/* Where the triangles go: skis a run with the auto-pilot and, every few seconds, buckets every triangle three.js would draw
   (frustum-culled the same way) by what it belongs to: near/fine/far terrain tiles, near/far trees, the whole-mountain mesh,
   and everything else by mesh. Also reports renderer.info for the same frame. Usage: node tools/test/tris.js [trail] [liftId] */
const { open, AUTOPILOT } = require('./harness');
(async () => {
  const name = process.argv[2] || 'Superstar', lift = process.argv[3] || 'ss';
  const { browser, page, errors } = await open(); await page.evaluate(AUTOPILOT);
  await page.evaluate(([name, lift]) => { const k = window.__kr; const L = k.LIFTS.find(l => l.id === lift); document.getElementById('start').classList.add('hidden');
    k.dropIn(k.TRAILS.filter(t => t.name === name).sort((a, b) => b.L - a.L)[0], L.top); }, [name, lift]);
  await page.waitForTimeout(3000);
  await page.evaluate(() => { window.__tris = () => {
    const k = window.__kr, cam = k.camera, fr = new THREE.Frustum(), m = new THREE.Matrix4(); cam.updateMatrixWorld(); m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(m);
    const b = {}, add = (key, n) => { b[key] = (b[key] || 0) + n; };
    k.scene.traverseVisible(o => { if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return; if (o.frustumCulled && !fr.intersectsObject(o)) return;
      if (!o.isMesh) return; const g = o.geometry; if (!g) return; let n = (g.index ? g.index.count : g.attributes.position.count);
      if (g.drawRange && g.drawRange.count !== Infinity) n = Math.min(n, g.drawRange.count); n /= 3; if (o.isInstancedMesh) n *= o.count;
      if (Array.isArray(o.material)) { /* multi-material: counted once (groups) */ }
      let key;
      if (o === k.lowMtn) key = 'whole-mountain mesh';
      else if (o.material === k.treeMat && g.userData.lod !== undefined) key = g.userData.lod ? 'trees: far tiles' : 'trees: near tiles';
      else if (g.attributes.aT) { const v = g.attributes.position.count; key = v > 3000 ? 'terrain: fine (2 m)' : v > 600 ? 'terrain: near (4 m)' : 'terrain: far (8 m)'; }
      else { let p = o, nm = o.name; while (!nm && p.parent && p.parent !== k.scene) { p = p.parent; nm = p.name; } key = 'other: ' + (nm || (o.material && o.material.type) + ' ' + g.attributes.position.count + 'v'); }
      add(key, n); });
    const i = k.renderer.info.render; return { b, info: { calls: i.calls, tris: i.triangles }, x: k.S.x, z: k.S.z, t: k.S.t, tiles: [...k.tiles.values()].reduce((a, t) => (a[t.lod ? 'far' : 'near']++, a), { near: 0, far: 0 }) };
  }; });
  const rows = [];
  for (let s = 0; s < 40; s++) {
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => window.__tris()); rows.push(r);
    const st = await page.evaluate(() => { window.__auto(4 * 60); window.__kr.steerIn = 0; return window.__kr.S.state; });
    if (st !== 'ride' && st !== 'finishing') break;
  }
  const keys = {}; rows.forEach(r => Object.entries(r.b).forEach(([k, v]) => keys[k] = (keys[k] || 0) + v));
  const top = Object.entries(keys).sort((a, b) => b[1] - a[1]);
  const avg = v => Math.round(v / rows.length / 100) / 10;
  console.log(`${name}: ${rows.length} samples. renderer.info avg ${avg(rows.reduce((a, r) => a + r.info.tris, 0))}k tris, max ${Math.max(...rows.map(r => r.info.tris)) / 1000 | 0}k, draws avg ${(rows.reduce((a, r) => a + r.info.calls, 0) / rows.length).toFixed(0)}; counted avg ${avg(rows.reduce((a, r) => a + Object.values(r.b).reduce((x, y) => x + y, 0), 0))}k`);
  console.log(`tiles loaded avg: near ${(rows.reduce((a, r) => a + r.tiles.near, 0) / rows.length).toFixed(1)}, far ${(rows.reduce((a, r) => a + r.tiles.far, 0) / rows.length).toFixed(1)}`);
  top.slice(0, 22).forEach(([k, v]) => console.log(`${String(avg(v)).padStart(7)}k  ${k}`));
  if (process.env.ROWS) rows.forEach(r => console.log(r.t.toFixed(0), r.info.tris / 1000 | 0, r.info.calls));
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
