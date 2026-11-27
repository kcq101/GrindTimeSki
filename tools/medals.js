/* Bake medal times: ski every start you can pick off a lift twice on the auto-pilot's line: a cruising bot (stands tall above ~36 mph,
   never boosts) and a fast bot (tucked the whole way, boosting whenever it can, flow boosts included).
   bronze = the cruiser's time +3%, gold = the fast bot +8%, silver halfway. Keyed by start trail and the base reached (the same key as best
   times); the fast bot's base wins if they differ. Starts it can't finish get no medals. Writes data/medals.json; rebuild after.
   Usage: node tools/medals.js [trail names…]   (re-run after physics or trail changes) */
const { open, AUTOPILOT, ROOT } = require('./test/harness'); const fs = require('fs'), path = require('path');
(async () => {
  const only = process.argv.slice(2);
  const { browser, page, errors } = await open(); await page.evaluate(AUTOPILOT);
  const rows = await page.evaluate(async (only) => {
    const k = window.__kr, S = k.S, R = [], seen = new Set(), starts = []; window.__autoTuck = true; window.__autoBoost = true;
    k.LIFTS.forEach(L => L.trails.forEach(t => { if (!seen.has(t) && (!only.length || only.includes(t.name))) { seen.add(t); starts.push([t, L.top]); } }));
    const ski = async (tr, top, fast) => { window.__autoTuck = fast; window.__autoBoost = fast;
      document.getElementById('start').classList.add('hidden'); S.state = 'menu'; k.dropIn(tr, top); await new Promise(r => setTimeout(r, 450));
      let steps = 0; while ((S.state === 'ride' || S.state === 'finishing') && steps < 60 * 700) { window.__auto(3); steps += 3; }
      document.getElementById('finish').classList.add('hidden');
      return { base: S.endBase && S.endBase.id, baseName: S.endBase && S.endBase.name, t: +S.t.toFixed(2), crashes: S.crashes, flow: Object.assign({}, k.fun.FLOW.n) }; };
    for (const [tr, top] of starts) { const c = await ski(tr, top, false), f = await ski(tr, top, true); R.push({ name: tr.name, top, c, f }); }
    return R;
  }, only);
  /* a full bake starts a fresh table (so keys for bases the bot no longer reaches go away), but a start the fast bot failed this time keeps
     its old entries; naming trails only updates those */
  const file = path.join(ROOT, 'data/medals.json'); let OLD = {}; try { OLD = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  const M = only.length ? Object.assign({}, OLD) : {};
  if (!only.length) for (const r of rows) if (!r.f.base) for (const k of Object.keys(OLD)) if (k.startsWith(r.name + '>')) M[k] = OLD[k];
  const r1 = x => Math.round(x * 10) / 10;
  for (const r of rows) { const f = r.f, c = r.c; if (!f.base) { console.log(`${r.name} (${r.top}): fast bot reached no base, no medals`); continue; }
    const gold = f.t * 1.08, bronze = (c.base === f.base && c.t > gold * 1.15 ? c.t : gold * 1.4) * 1.03, key = r.name + '>' + f.base;
    M[key] = [r1(gold), r1((gold + bronze) / 2), r1(bronze)];
    console.log(`${r.name} (${r.top}) -> ${f.baseName}: fast ${f.t}s (${f.crashes} crashes, ${JSON.stringify(f.flow)}), cruise ${c.t}s${c.base !== f.base ? ' to ' + c.baseName : ''} | gold ${M[key][0]} silver ${M[key][1]} bronze ${M[key][2]}`); }
  fs.writeFileSync(file, JSON.stringify(M, Object.keys(M).sort(), 0).replace(/\],"/g, '],\n"') + '\n');
  console.log(`\n${Object.keys(M).length} medal sets -> data/medals.json`);
  if (errors.length) console.log(errors.join('\n')); await browser.close();
})();
