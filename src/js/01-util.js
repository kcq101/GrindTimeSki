if(!window.THREE){document.getElementById('loading').textContent='Could not load the 3D engine. Check your connection and reload.';return;}

/* ---------- seeded random ---------- */
let seed=1337;
function rnd(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

