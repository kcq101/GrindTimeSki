/* ---------- medals, flow meter, landing grades ----------
   Medals: bronze / silver / gold times per start trail and base, baked by tools/medals.js from a bot that tucks the whole way and
   boosts whenever it can (gold ≈ that bot +2%, silver +15%, bronze +35%). Best medal per trail is remembered.
   Flow: linked clean carves (on edge at speed, no skid, the edge changes after a real turn), tree threading and clean landings fill
   the meter and cut the boost recharge; events within ~3 s chain (each link worth +15%, up to ×2.2). Skids, tree hits and bails break
   the chain and drain it. Full meter: the next BOOST is a flow boost: star mode for FB.T s (below).
   Landings: any air over 0.6 s (or a trick) gets a grade: PERFECT (square, soft), GREAT, GOOD. Big ones (1.1 s+ or a trick) graded
   GREAT or better freeze the action for ~0.1 s; big ones buzz the phone where the browser allows it. */
const MEDALS=/*@MEDALS*/null||{};
const MEDAL_N=['','gold','silver','bronze'];
function medalFor(key,t){const m=MEDALS[key];if(!m)return 0;return t<=m[0]?1:t<=m[1]?2:t<=m[2]?3:0;}
function medalBest(name){let b=0;try{b=+localStorage.getItem('kr_medalT_'+name)||0;}catch(e){}return b;}
function medalFinish(base){const el=$('fMedal');el.innerHTML='';el.classList.add('hidden');if(!base)return;
  const key=RUN.name+'>'+base.id,m=MEDALS[key],f=FLOW.n;
  const stats=[f.carve?f.carve+' clean carve'+(f.carve>1?'s':''):'',f.thread?f.thread+' tree'+(f.thread>1?'s':'')+' threaded':'',f.perfect?f.perfect+' perfect landing'+(f.perfect>1?'s':''):'',f.boost?f.boost+' flow boost'+(f.boost>1?'s':''):''].filter(Boolean).join(' · ');
  if(!m){if(stats){el.innerHTML='<div class="fstat">'+stats+'</div>';el.classList.remove('hidden');}return;}
  const got=medalFor(key,S.t),prev=medalBest(RUN.name);if(got&&(!prev||got<prev)){try{localStorage.setItem('kr_medalT_'+RUN.name,String(got));}catch(e){}}
  let line=got?MEDAL_N[got].toUpperCase()+'!':'No medal yet';const nx=got===1?0:got?got-1:3;if(nx)line+=' · '+fmtGap(S.t-m[nx-1])+' s to '+MEDAL_N[nx];
  el.innerHTML='<div class="mds">'+[1,2,3].map(i=>'<span class="md '+MEDAL_N[i][0]+(i===got?' on':'')+'"><i></i>'+fmt(m[i-1])+'</span>').join('')+'</div><div class="mline">'+line+'</div>'+(stats?'<div class="fstat">'+stats+'</div>':'');
  el.classList.remove('hidden');}
/* a medal dot next to the trail name in the pickers */
function medalDot(name){const b=medalBest(name);return b?'<i class="mdot '+MEDAL_N[b][0]+'"></i>':'';}

function flowAdd(a,cd,kind){if(S.state!=='ride'||S.pre)return;
  FLOW.chain=S.t-FLOW.lastT<3.2?Math.min(9,FLOW.chain+1):1;FLOW.lastT=S.t;
  if(!(S.fb>0))FLOW.v=Math.min(1,FLOW.v+a*(1+0.15*(FLOW.chain-1)));   /* the meter doesn't refill during a flow boost */S.bcd=Math.max(0,(S.bcd||0)-cd);FLOW.n[kind]=(FLOW.n[kind]||0)+1;
  if(FLOW.v>=1&&!FLOW.ready){FLOW.ready=true;toast('FLOW BOOST READY');}}
function flowBreak(keep){FLOW.chain=0;FLOW.edge=0;FLOW.carveT=0;FLOW.thAcc=0;if(!FLOW.ready)FLOW.v*=keep;}
/* called every physics step: a clean carve is held on one edge for 0.3 s+ through 20°+ of turn, then the edge changes or the turn ends */
function flowCarve(rate,off,dt){
  if(S.air||S.state!=='ride'||S.pre){FLOW.carveT=0;FLOW.thAcc=0;return;}
  const clean=!off&&(S.sk||0)<0.22&&S.v>8&&S.v*Math.abs(rate)>2.6,e=Math.sign(rate);
  const done=()=>{if(FLOW.carveT>=0.3&&Math.abs(FLOW.thAcc)>0.35)flowAdd(0.045+0.035*sstep(12,26,S.v),0.35,'carve');FLOW.carveT=0;FLOW.thAcc=0;};
  if(clean){if(e!==FLOW.edge){done();FLOW.edge=e;}FLOW.carveT+=dt;FLOW.thAcc+=rate*dt;}
  else if(FLOW.carveT>0&&Math.abs(rate)*S.v<1.2){done();FLOW.edge=0;}
  /* a long skid (hockey stop) breaks the chain */
  if((S.sk||0)>0.5){FLOW.skT+=dt;if(FLOW.skT>0.45){flowBreak(0.8);FLOW.skT=-1e9;}}else FLOW.skT=0;
  if(!FLOW.ready&&S.t-FLOW.lastT>4)FLOW.v=Math.max(0,FLOW.v-0.04*dt);}
/* Flow boost = star mode, FB.T seconds: a big shove off the line, then a steady push with less drag and top speed 41 → 45 m/s (92 → 100 mph);
   you can't crash (trees burst into snow and you carry on, slams, bails, ejections and sketchy landings are saved); and the world goes a
   little gold: the grade warms and pulses, the speed streaks turn gold and stay on, a gold edge glow, the skier glows, the view widens.
   The last 2 s pulse faster, like a star running out. The look is applied per frame in 16-look.js (starFrame). */
const FB={T:11,acc:2.4,vmax:45};
function vmax(){return S.fb>0?FB.vmax:41;}
function flowBoost(){FLOW.ready=false;FLOW.v=0;FLOW.n.boost=(FLOW.n.boost||0)+1;S.go=true;S.fb=FB.T;S.bst=BOOST.push*3;S.bcd=Math.min(S.bcd||0,BOOST.cd*0.5);sfxSkate();sfxStar(true);toast('FLOW BOOST!');buzz([30,30,30,30,60]);
  for(let i=0;i<40;i++)emitPuff(S.x-Math.sin(S.th)*(0.6+rnd()*0.9),(S.air?S.y:H(S.x,S.z))+0.15,S.z-Math.cos(S.th)*(0.6+rnd()*0.9),(rnd()-0.5)*4-Math.sin(S.th)*3,0.5+rnd()*2,(rnd()-0.5)*4-Math.cos(S.th)*3,0.9);}
function flowBoostEnd(){S.fb=0;sfxStar(false);}
/* a crash that star mode turns into a save */
function flowSave(){S.shake=Math.max(S.shake,0.2);S.cool=0.4;FLOW.n.save=(FLOW.n.save||0)+1;toast('FLOW SAVE!');buzz(30);}
/* a short rising chime (and a falling one when it runs out): our own four notes, sine + a little triangle */
function sfxStar(up){if(!SFX.on||!actx||!SFX.master)return;const t0=actx.currentTime,notes=up?[659,880,1109,1319,1760]:[1319,988,740];
  notes.forEach((f,i)=>{const t=t0+i*(up?0.055:0.08);['sine','triangle'].forEach((ty,j)=>{const o=actx.createOscillator(),g=actx.createGain();o.type=ty;o.frequency.value=f*(j?2:1);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(j?0.03:0.09,t+0.01);g.gain.exponentialRampToValueAtTime(0.0008,t+(up?0.32:0.25));o.connect(g);g.connect(SFX.master);o.start(t);o.stop(t+0.4);});});}
let _flS=-1,_flC=-1,_flR=null;const flowX=document.getElementById('flowX');
function updFlowHud(){const star=S.fb>0,v=Math.round((star?S.fb/FB.T:FLOW.v)*40)/40;if(v!==_flS){_flS=v;boostBtn.style.setProperty('--flow',v);}   /* during star mode the gold ring counts down */
  const st=FLOW.ready?'ready':star?'star':'';if(st!==_flR){_flR=st;boostBtn.classList.toggle('flow',st==='ready');boostBtn.classList.toggle('star',st==='star');boostBtn.textContent=st==='ready'?'FLOW':'BOOST';}
  const c=S.t-FLOW.lastT<3.2?FLOW.chain:0;if(c!==_flC){_flC=c;flowX.textContent='×'+c;flowX.classList.toggle('hidden',c<2);}}

function buzz(p){try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}}
const gradeEl=document.getElementById('grade');
function showGrade(txt,g){gradeEl.textContent=txt;gradeEl.className='';void gradeEl.offsetWidth;gradeEl.className='g'+g;}
function landGrade(err,nf,ns){const trick=!!(nf||ns);if(S.airT<0.6&&!trick)return;
  if(err>0.55){flowBreak(0.7);return;}   /* sketchy: already toasted, costs speed */
  const vr=S.lvr||0,g=err<0.12&&vr>-12?3:err<0.3&&vr>-16?2:1;
  showGrade(['','GOOD','GREAT','PERFECT'][g],g);if(g===3)FLOW.n.perfect=(FLOW.n.perfect||0)+1;
  flowAdd([0,.07,.12,.18][g]+(trick?0.08*(Math.abs(nf)+ns):0),[0,.5,.9,1.3][g]+(trick?0.5:0),'land');
  const big=S.airT>=1.1||trick;if(big){if(g>=2)hitStop=Math.max(hitStop,g===3?0.11:0.08);buzz(g===3?[35,40,55]:g===2?45:20);}
  FLOW.last={g,big,airT:+S.airT.toFixed(2),vr:+vr.toFixed(1),hs:big&&g>=2?(g===3?0.11:0.08):0};}
window.__kr.fun={FLOW,FB,flowBoost,MEDALS,medalFor,landGrade,flowAdd,get hitStop(){return hitStop},boost:()=>boost()};
