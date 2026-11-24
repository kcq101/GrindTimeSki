/* Shared headless-browser setup: loads dist/index.html with three.js served from node_modules (no CDN needed). */
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright')); }
const THREE_DIR = path.join(ROOT, 'node_modules/three');
async function open({ file = path.join(ROOT, 'dist/index.html'), width = 390, height = 844 } = {}) {
  const launch = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
  if (process.env.CHROME) launch.executablePath = process.env.CHROME;
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(path.join(THREE_DIR, 'build/three.min.js')), contentType: 'text/javascript' }));
  await page.route('**/GLTFLoader.js', r => r.fulfill({ body: fs.readFileSync(path.join(THREE_DIR, 'examples/js/loaders/GLTFLoader.js')), contentType: 'text/javascript' }));
  await page.goto('file://' + file);
  await page.waitForSelector('#start:not(.hidden)', { timeout: 180000 });
  return { browser, page, errors, ROOT };
}
/* in-page auto-pilot: steer toward a point 14 m along the nearest trail, stand tall above ~36 mph */
const AUTOPILOT = `window.__auto=(n)=>{const k=window.__kr,S=k.S;for(let s=0;s<n;s+=3){const ti=k.trailInfo(S.x,S.z);let st=0;
  if(ti.tr){const tx=ti.cx+ti.ux*14,tz=ti.cz+ti.uz*14;let d=Math.atan2(tx-S.x,tz-S.z)-S.th;d=Math.atan2(Math.sin(d),Math.cos(d));st=Math.max(-1,Math.min(1,-d*2.5));}
  k.steerIn=st;k.postIn=S.v>16?-0.8:0;const r=k.physicsOnly(3);if(S.crashed){S.crashed=false;S.cool=0.5;S.v=3;}if(r!=='ride'&&r!=='finishing')return r;}return S.state;};`;
module.exports = { open, AUTOPILOT, ROOT };
