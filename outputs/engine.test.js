// Standalone reproduction of the simulator's engine for verification.
// Mirrors simulate() and stats() from index-simulator.html.

let UNIVERSE, selected, priceCache;
function seriesMap(s){ const m={}; s.forEach(p=>m[p.ym]=p.close); return m; }
function buildMonthAxis(seriesList, years){
  let common=null;
  seriesList.forEach(s=>{ const set=new Set(s.map(p=>p.ym));
    common = common? new Set([...common].filter(x=>set.has(x))) : set; });
  let months=[...common].sort();
  if(years>0 && months.length> years*12+1) months=months.slice(months.length-(years*12+1));
  return months;
}
function simulate(tickers, months, weightMode, rebalN){
  const maps={}; tickers.forEach(t=>maps[t]=seriesMap(priceCache[t]));
  const sharesOut={}; UNIVERSE.forEach(([t,,,sh])=>sharesOut[t]=sh);
  function targetWeights(k){
    const ym=months[k]; const w={};
    if(weightMode==="cap"){
      let tot=0; tickers.forEach(t=>{ const mc=(sharesOut[t]||1)*maps[t][ym]; w[t]=mc; tot+=mc; });
      tickers.forEach(t=>w[t]/=tot);
    } else {
      let given=0, blanks=[];
      tickers.forEach(t=>{ const cw=selected.get(t)?.customW; if(cw!=null){w[t]=cw;given+=cw;} else blanks.push(t); });
      const rem=Math.max(0,100-given);
      blanks.forEach(t=>w[t]=blanks.length?rem/blanks.length:0);
      let tot=0; tickers.forEach(t=>tot+=w[t]); tickers.forEach(t=>w[t]= tot>0? w[t]/tot : 1/tickers.length);
    }
    return w;
  }
  let V=100, units={};
  const w0=targetWeights(0);
  tickers.forEach(t=>units[t]=(w0[t]*V)/maps[t][months[0]]);
  const index=[100];
  for(let k=1;k<months.length;k++){
    const ym=months[k];
    V=0; tickers.forEach(t=>V+=units[t]*maps[t][ym]);
    index.push(V);
    const doRebal = rebalN!=="none" && (k % parseInt(rebalN)===0) && k<months.length-1;
    if(doRebal){ const w=targetWeights(k); tickers.forEach(t=>units[t]=(w[t]*V)/maps[t][ym]); }
  }
  return {index, weightsAtStart:w0};
}
function stats(idx, rf, spyReturns){
  const n=idx.length;
  const totalRet=idx[n-1]/idx[0]-1;
  const yrs=(n-1)/12;
  const cagr=Math.pow(idx[n-1]/idx[0],1/yrs)-1;
  const rets=[]; for(let i=1;i<n;i++) rets.push(idx[i]/idx[i-1]-1);
  const mean=rets.reduce((a,b)=>a+b,0)/rets.length;
  const variance=rets.reduce((a,b)=>a+(b-mean)**2,0)/rets.length;
  const vol=Math.sqrt(variance)*Math.sqrt(12);
  const sharpe=(mean*12 - rf/100)/(vol||1e-9);
  let peak=idx[0],mdd=0;
  idx.forEach(v=>{ if(v>peak)peak=v; const dd=v/peak-1; if(dd<mdd)mdd=dd; });
  let beta=null;
  if(spyReturns && spyReturns.length===rets.length){
    const sm=spyReturns.reduce((a,b)=>a+b,0)/spyReturns.length;
    let cov=0,vS=0;
    for(let i=0;i<rets.length;i++){cov+=(rets[i]-mean)*(spyReturns[i]-sm);vS+=(spyReturns[i]-sm)**2;}
    beta=cov/(vS||1e-9);
  }
  return {totalRet,cagr,vol,sharpe,mdd,beta,rets};
}

// ---- test harness ----
let pass=0, fail=0;
function approx(a,b,eps=1e-6){return Math.abs(a-b)<eps;}
function check(name,cond,extra=""){ if(cond){pass++;console.log("  PASS",name);} else {fail++;console.log("  FAIL",name,extra);} }
function mk(arr,start="2020-01"){ // arr of closes -> [{ym,close}]
  return arr.map((c,i)=>{const m=(0+i)%12, y=2020+Math.floor(i/12); return {ym:`${y}-${String(m+1).padStart(2,'0')}`, close:c};});
}

console.log("TEST 1: single stock buy&hold, custom 100%");
UNIVERSE=[["A","A","x",1]];
selected=new Map([["A",{customW:100}]]);
priceCache={A:mk([100,110,121])};
{ const m=buildMonthAxis([priceCache.A],0); const {index}=simulate(["A"],m,"custom","none");
  check("index tracks price", approx(index[0],100)&&approx(index[1],110)&&approx(index[2],121), JSON.stringify(index));
  const s=stats(index,0,null);
  check("total return 21%", approx(s.totalRet,0.21,1e-9), s.totalRet);
}

console.log("TEST 2: two stocks 50/50 buy&hold");
UNIVERSE=[["A","A","x",1],["B","B","x",1]];
selected=new Map([["A",{customW:50}],["B",{customW:50}]]);
priceCache={A:mk([100,200]), B:mk([100,100])};
{ const m=buildMonthAxis([priceCache.A,priceCache.B],0); const {index,weightsAtStart}=simulate(["A","B"],m,"custom","none");
  check("start weights 50/50", approx(weightsAtStart.A,0.5)&&approx(weightsAtStart.B,0.5));
  check("month1 value=150", approx(index[1],150), index);
}

console.log("TEST 3: cap weighting reflects size, flat prices -> flat index");
UNIVERSE=[["A","A","x",2],["B","B","x",1]];
selected=new Map([["A",{customW:null}],["B",{customW:null}]]);
priceCache={A:mk([100,100,100]), B:mk([100,100,100])};
{ const m=buildMonthAxis([priceCache.A,priceCache.B],0); const {index,weightsAtStart}=simulate(["A","B"],m,"cap","3");
  check("cap weight A=2/3", approx(weightsAtStart.A,2/3,1e-9), weightsAtStart.A);
  check("cap weight B=1/3", approx(weightsAtStart.B,1/3,1e-9), weightsAtStart.B);
  check("flat prices -> index 100", approx(index[2],100), index);
}

console.log("TEST 4: cap weight, only A rises -> index between equal & A-only");
UNIVERSE=[["A","A","x",1],["B","B","x",1]];
selected=new Map([["A",{customW:null}],["B",{customW:null}]]);
priceCache={A:mk([100,200]), B:mk([100,100])};
{ const m=buildMonthAxis([priceCache.A,priceCache.B],0); const {index}=simulate(["A","B"],m,"cap","none");
  // equal cap at t0 (50/50), buy&hold -> 0.5*200+0.5*100=150
  check("cap buy&hold month1=150", approx(index[1],150), index);
}

console.log("TEST 5: rebalancing changes outcome vs buy&hold");
// A doubles then halves; B flat. Monthly rebalance should differ from buy&hold.
UNIVERSE=[["A","A","x",1],["B","B","x",1]];
selected=new Map([["A",{customW:50}],["B",{customW:50}]]);
priceCache={A:mk([100,200,100]), B:mk([100,100,100])};
{ const m=buildMonthAxis([priceCache.A,priceCache.B],0);
  const bh=simulate(["A","B"],m,"custom","none").index;
  const rb=simulate(["A","B"],m,"custom","1").index;
  // buy&hold: units A=0.5,B=0.5 -> t1=150, t2=0.5*100+0.5*100=100
  check("buy&hold ends 100", approx(bh[2],100), bh);
  // monthly rebal: at t1 V=150, reset 50/50 -> A units=75/200=0.375, B=75/100=0.75
  // t2: 0.375*100 + 0.75*100 = 112.5
  check("rebalanced ends 112.5", approx(rb[2],112.5), rb);
  check("rebalance beat buy&hold here", rb[2]>bh[2]);
}

console.log("TEST 6: stats - vol, drawdown, CAGR sanity");
{ // index that drops 50% then recovers
  const idx=[100,50,100];
  const s=stats(idx,0,null);
  check("max drawdown -50%", approx(s.mdd,-0.5), s.mdd);
  check("total return 0", approx(s.totalRet,0), s.totalRet);
  // returns: -0.5, +1.0 ; mean=0.25 ; var=((-0.75)^2+(0.75)^2)/2=0.5625 ; sd=0.75 ; vol=0.75*sqrt12
  check("annualized vol", approx(s.vol,0.75*Math.sqrt(12),1e-9), s.vol);
}

console.log("TEST 7: custom weights with blanks normalize");
UNIVERSE=[["A","A","x",1],["B","B","x",1],["C","C","x",1]];
selected=new Map([["A",{customW:60}],["B",{customW:null}],["C",{customW:null}]]);
priceCache={A:mk([100,100]),B:mk([100,100]),C:mk([100,100])};
{ const m=buildMonthAxis([priceCache.A,priceCache.B,priceCache.C],0);
  const {weightsAtStart:w}=simulate(["A","B","C"],m,"custom","none");
  check("A=0.6", approx(w.A,0.6,1e-9), w.A);
  check("B=0.2 (remainder split)", approx(w.B,0.2,1e-9), w.B);
  check("weights sum to 1", approx(w.A+w.B+w.C,1,1e-9));
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail?1:0);
