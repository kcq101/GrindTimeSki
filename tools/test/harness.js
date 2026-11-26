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
  await page.waitForSelector('#map:not(.hidden)', { timeout: 180000 });
  return { browser, page, errors, ROOT };
}
/* in-page auto-pilot: steer toward a point 14 m along the nearest trail, stand tall above ~36 mph */
const AUTOPILOT = `window.__auto=(n)=>{const k=window.__kr,S=k.S;for(let s=0;s<n;s+=3){const ti=k.trailInfo(S.x,S.z);let st=0;
  if(ti.tr){let cx=ti.cx,cz=ti.cz,ux=ti.ux,uz=ti.uz;
    /* at a fork, stay on the trail you're on (a player follows the signs) */
    const cur=S.path[S.path.length-1];if(cur&&ti.tr.name!==cur)for(let q=1;q<k.KT.length&&k.KT[q];q++){const u=k.KT[q],i=k.KI[q];if(u.name!==cur||u.L-u.cs[i]<30||k.KDd[q]>u.w+4)continue;
      const a=u.s[i],b=u.s[Math.min(i+1,u.s.length-1)],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;cx=k.KX[q];cz=k.KZ[q];ux=(b[0]-a[0])/l;uz=(b[1]-a[1])/l;break;}
    /* at a connector's end, follow the next blended trail that still has somewhere to go (players do this by eye) */
    if(ti.tr.L-ti.tr.cs[ti.i]<30)for(let q=1;q<k.KT.length&&k.KT[q];q++){const u=k.KT[q],i=k.KI[q];if(u.L-u.cs[i]<30||k.KDd[q]>u.w+12)continue;
      const a=u.s[i],b=u.s[Math.min(i+1,u.s.length-1)],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;cx=k.KX[q];cz=k.KZ[q];ux=(b[0]-a[0])/l;uz=(b[1]-a[1])/l;break;}
    const tx=cx+ux*14,tz=cz+uz*14;let d=Math.atan2(tx-S.x,tz-S.z)-S.th;d=Math.atan2(Math.sin(d),Math.cos(d));st=Math.max(-1,Math.min(1,-d*2.5));}
  k.steerIn=st;k.postIn=window.__autoTuck?1:(S.v>16?-0.8:0);if(window.__autoBoost&&S.state==='ride'&&!S.air&&!(S.bcd>0)&&S.v>3)k.fun.boost();const r=k.physicsOnly(3);if(S.crashed){S.crashed=false;S.cool=0.5;S.v=3;}if(r!=='ride'&&r!=='finishing')return r;}return S.state;};`;
module.exports = { open, AUTOPILOT, ROOT };
