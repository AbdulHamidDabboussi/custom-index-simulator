/* ============================================================
   Index simulation + statistics — pure functions, no DOM, no globals.
   The single source of truth for the engine: the app, the tests, and
   any tooling all import THESE (browser: globals; Node: module.exports).

   simulate(tickers, months, weightMode, rebalN, ctx) where
     ctx = { priceCache:{tkr:[{ym,close}]}, sharesOut:{tkr:n}, customWeights:{tkr:pct|null} }
   ============================================================ */
/* ============================================================
   INDEX ENGINE
   ============================================================ */
function buildMonthAxis(seriesList, years){
  // common months = those present in ALL series; restrict to last `years`
  let common=null;
  seriesList.forEach(s=>{
    const set=new Set(s.map(p=>p.ym));
    common = common? new Set([...common].filter(x=>set.has(x))) : set;
  });
  let months=[...common].sort();
  if(years>0 && months.length> years*12+1) months=months.slice(months.length-(years*12+1));
  return months;
}
function seriesMap(s){ const m={}; s.forEach(p=>m[p.ym]=p.close); return m; }

function simulate(tickers, months, weightMode, rebalN, ctx){
  // returns {index:[], weightsAtStart:{}}
  const { priceCache, sharesOut = {}, customWeights = {} } = ctx;
  const maps={}; tickers.forEach(t=>maps[t]=seriesMap(priceCache[t]));

  // target weights function at month index k (uses prices at months[k])
  function targetWeights(k){
    const ym=months[k]; const w={};
    if(weightMode==="cap"){
      let tot=0; tickers.forEach(t=>{ const mc=(sharesOut[t]||1)*maps[t][ym]; w[t]=mc; tot+=mc; });
      tickers.forEach(t=>w[t]/=tot);
    } else { // custom
      let given=0, blanks=[];
      tickers.forEach(t=>{ const cw=customWeights[t]; if(cw!=null){w[t]=cw;given+=cw;} else blanks.push(t); });
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
    if(doRebal){
      const w=targetWeights(k);
      tickers.forEach(t=>units[t]=(w[t]*V)/maps[t][ym]);
    }
  }
  return {index, weightsAtStart:w0};
}

function rebaseToBench(series, months, fullSeriesMap){
  // Rebase to 100 at the benchmark's FIRST month present in the axis; months before
  // that (e.g. a benchmark that launched mid-window, like SPUS) are null so the line
  // simply starts at inception instead of producing NaN.
  const firstYm = months.find(ym => fullSeriesMap[ym] != null);
  if(firstYm == null) return months.map(() => null);
  const base = fullSeriesMap[firstYm];
  return months.map(ym => fullSeriesMap[ym] != null ? 100*fullSeriesMap[ym]/base : null);
}

/* ---------- statistics ---------- */
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
  // max drawdown
  let peak=idx[0],mdd=0;
  idx.forEach(v=>{ if(v>peak)peak=v; const dd=v/peak-1; if(dd<mdd)mdd=dd; });
  // beta vs spy
  let beta=null;
  if(spyReturns && spyReturns.length===rets.length){
    const sm=spyReturns.reduce((a,b)=>a+b,0)/spyReturns.length;
    let cov=0,vS=0;
    for(let i=0;i<rets.length;i++){cov+=(rets[i]-mean)*(spyReturns[i]-sm);vS+=(spyReturns[i]-sm)**2;}
    beta=cov/(vS||1e-9);
  }
  return {totalRet,cagr,vol,sharpe,mdd,beta,rets};
}

if (typeof module !== "undefined" && module.exports)
  module.exports = { seriesMap, buildMonthAxis, simulate, rebaseToBench, stats };
