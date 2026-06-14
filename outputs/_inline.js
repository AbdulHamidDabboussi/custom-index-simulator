
/* ============================================================
   S&P 100 universe: ticker, name, sector, approx shares out (billions)
   Share counts are approximate (circa 2024-25), used only for
   market-cap weighting; they are editable in spirit via Custom mode.
   ============================================================ */
const UNIVERSE = [
 ["AAPL","Apple","Information Technology",15.0],
 ["MSFT","Microsoft","Information Technology",7.43],
 ["NVDA","NVIDIA","Information Technology",24.6],
 ["AVGO","Broadcom","Information Technology",4.66],
 ["ORCL","Oracle","Information Technology",2.77],
 ["CRM","Salesforce","Information Technology",0.96],
 ["ADBE","Adobe","Information Technology",0.44],
 ["AMD","Advanced Micro Devices","Information Technology",1.62],
 ["CSCO","Cisco","Information Technology",4.0],
 ["ACN","Accenture","Information Technology",0.63],
 ["INTC","Intel","Information Technology",4.23],
 ["TXN","Texas Instruments","Information Technology",0.91],
 ["QCOM","Qualcomm","Information Technology",1.11],
 ["IBM","IBM","Information Technology",0.92],
 ["INTU","Intuit","Information Technology",0.28],
 ["AMZN","Amazon","Consumer Discretionary",10.5],
 ["TSLA","Tesla","Consumer Discretionary",3.19],
 ["HD","Home Depot","Consumer Discretionary",0.99],
 ["MCD","McDonald's","Consumer Discretionary",0.72],
 ["NKE","Nike","Consumer Discretionary",1.49],
 ["LOW","Lowe's","Consumer Discretionary",0.57],
 ["BKNG","Booking Holdings","Consumer Discretionary",0.033],
 ["SBUX","Starbucks","Consumer Discretionary",1.14],
 ["TGT","Target","Consumer Discretionary",0.46],
 ["GM","General Motors","Consumer Discretionary",1.15],
 ["F","Ford","Consumer Discretionary",3.97],
 ["GOOGL","Alphabet A","Communication Services",5.8],
 ["GOOG","Alphabet C","Communication Services",5.5],
 ["META","Meta Platforms","Communication Services",2.30],
 ["NFLX","Netflix","Communication Services",0.43],
 ["DIS","Walt Disney","Communication Services",1.81],
 ["CMCSA","Comcast","Communication Services",3.8],
 ["T","AT&T","Communication Services",7.16],
 ["VZ","Verizon","Communication Services",4.21],
 ["TMUS","T-Mobile US","Communication Services",1.16],
 ["CHTR","Charter Communications","Communication Services",0.14],
 ["BRK.B","Berkshire Hathaway B","Financials",2.16],
 ["JPM","JPMorgan Chase","Financials",2.86],
 ["V","Visa","Financials",2.0],
 ["MA","Mastercard","Financials",0.93],
 ["BAC","Bank of America","Financials",7.9],
 ["WFC","Wells Fargo","Financials",3.4],
 ["GS","Goldman Sachs","Financials",0.33],
 ["MS","Morgan Stanley","Financials",1.63],
 ["SCHW","Charles Schwab","Financials",1.82],
 ["AXP","American Express","Financials",0.72],
 ["C","Citigroup","Financials",1.91],
 ["BLK","BlackRock","Financials",0.149],
 ["SPG","Simon Property Group","Real Estate",0.33],
 ["BK","Bank of NY Mellon","Financials",0.73],
 ["USB","U.S. Bancorp","Financials",1.56],
 ["COF","Capital One","Financials",0.38],
 ["MET","MetLife","Financials",0.71],
 ["AIG","American Intl Group","Financials",0.65],
 ["LLY","Eli Lilly","Health Care",0.95],
 ["UNH","UnitedHealth","Health Care",0.92],
 ["JNJ","Johnson & Johnson","Health Care",2.41],
 ["ABBV","AbbVie","Health Care",1.77],
 ["MRK","Merck","Health Care",2.53],
 ["TMO","Thermo Fisher","Health Care",0.38],
 ["ABT","Abbott","Health Care",1.74],
 ["DHR","Danaher","Health Care",0.72],
 ["PFE","Pfizer","Health Care",5.68],
 ["AMGN","Amgen","Health Care",0.54],
 ["MDT","Medtronic","Health Care",1.28],
 ["GILD","Gilead Sciences","Health Care",1.25],
 ["BMY","Bristol-Myers Squibb","Health Care",2.03],
 ["CVS","CVS Health","Health Care",1.26],
 ["ISRG","Intuitive Surgical","Health Care",0.357],
 ["XOM","Exxon Mobil","Energy",4.3],
 ["CVX","Chevron","Energy",1.84],
 ["COP","ConocoPhillips","Energy",1.18],
 ["WMT","Walmart","Consumer Staples",8.04],
 ["PG","Procter & Gamble","Consumer Staples",2.36],
 ["COST","Costco","Consumer Staples",0.443],
 ["KO","Coca-Cola","Consumer Staples",4.31],
 ["PEP","PepsiCo","Consumer Staples",1.37],
 ["PM","Philip Morris Intl","Consumer Staples",1.55],
 ["MDLZ","Mondelez","Consumer Staples",1.33],
 ["MO","Altria","Consumer Staples",1.70],
 ["CL","Colgate-Palmolive","Consumer Staples",0.82],
 ["KHC","Kraft Heinz","Consumer Staples",1.20],
 ["GE","GE Aerospace","Industrials",1.08],
 ["CAT","Caterpillar","Industrials",0.49],
 ["HON","Honeywell","Industrials",0.65],
 ["UNP","Union Pacific","Industrials",0.61],
 ["RTX","RTX Corp","Industrials",1.34],
 ["BA","Boeing","Industrials",0.61],
 ["DE","Deere","Industrials",0.275],
 ["LMT","Lockheed Martin","Industrials",0.24],
 ["UPS","United Parcel Service","Industrials",0.86],
 ["GD","General Dynamics","Industrials",0.27],
 ["EMR","Emerson Electric","Industrials",0.57],
 ["MMM","3M","Industrials",0.55],
 ["FDX","FedEx","Industrials",0.24],
 ["LIN","Linde","Materials",0.48],
 ["DOW","Dow Inc","Materials",0.70],
 ["NEE","NextEra Energy","Utilities",2.05],
 ["SO","Southern Co","Utilities",1.09],
 ["DUK","Duke Energy","Utilities",0.77],
 ["AMT","American Tower","Real Estate",0.467],
 ["PYPL","PayPal","Financials",1.0]
];
const BENCH = {SPY:"spy.us", QQQ:"qqq.us"};

/* ---------- state ---------- */
const selected = new Map();   // ticker -> {customW}
const priceCache = {};        // ticker -> [{ym, close}]
let chart = null;

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const fmtPct = x => (x>=0?"+":"") + (x*100).toFixed(1) + "%";
const fmtNum = (x,d=2) => x.toFixed(d);
function stooqSym(tkr){ return tkr.replace(".","-").toLowerCase()+".us"; }
function stooqURL(sym){ return `https://stooq.com/q/d/l/?s=${sym}&i=m`; }

/* ============================================================
   STOCK PICKER
   ============================================================ */
function renderPicker(filter=""){
  const box = $("#pickbox"); box.innerHTML="";
  const f = filter.trim().toUpperCase();
  const bySector = {};
  UNIVERSE.forEach(([t,n,s])=>{
    if(f && !(t.includes(f) || n.toUpperCase().includes(f))) return;
    (bySector[s] = bySector[s]||[]).push([t,n]);
  });
  Object.keys(bySector).sort().forEach(sec=>{
    const h=document.createElement("div"); h.className="sector-h"; h.textContent=sec; box.appendChild(h);
    bySector[sec].forEach(([t,n])=>{
      const row=document.createElement("label"); row.className="stk";
      row.innerHTML=`<input type="checkbox" ${selected.has(t)?"checked":""} data-t="${t}">
        <span class="tkr">${t}</span><span class="nm">${n}</span>`;
      row.querySelector("input").addEventListener("change",e=>{
        if(e.target.checked) selected.set(t,{customW:null}); else selected.delete(t);
        renderSelected();
      });
      box.appendChild(row);
    });
  });
}
function renderSelected(){
  const el=$("#selected"); el.innerHTML="";
  const mode = currentWeightMode();
  selected.forEach((v,t)=>{
    const chip=document.createElement("div"); chip.className="selchip";
    let inner=`<b>${t}</b>`;
    if(mode==="custom"){
      inner+=`<input class="w" type="number" min="0" step="1" placeholder="%" value="${v.customW??""}" data-t="${t}">`;
    }
    inner+=`<span class="x" data-t="${t}">×</span>`;
    chip.innerHTML=inner;
    el.appendChild(chip);
  });
  el.querySelectorAll(".x").forEach(x=>x.onclick=()=>{selected.delete(x.dataset.t);renderSelected();renderPicker($("#search").value);});
  el.querySelectorAll("input.w").forEach(inp=>inp.oninput=()=>{
    const o=selected.get(inp.dataset.t); o.customW = inp.value===""?null:parseFloat(inp.value);
  });
  if(mode==="custom") updateCustomSum();
}
function updateCustomSum(){
  let sum=0,n=0; selected.forEach(v=>{ if(v.customW!=null){sum+=v.customW;n++;} });
  $("#weightHint").innerHTML = `Custom weights — current sum: <b style="color:${Math.abs(sum-100)<0.5?'var(--accent2)':'var(--warn)'}">${sum.toFixed(0)}%</b>. Blanks split the remainder equally. (Auto-normalized to 100%.)`;
}
function currentWeightMode(){ return $("#weightSeg .on").dataset.w; }

/* ============================================================
   DATA  (bundled offline data + manual CSV override)
   ============================================================ */
// Primary source: the bundled monthly history in data.js (window.PRICE_DATA),
// produced server-side by `node outputs/fetch-data.js` — no browser CORS, no
// rate limits, instant. Manual CSV upload (below) overrides it per ticker.
function bundle(){ return (typeof window !== "undefined" && window.PRICE_DATA) || {}; }
function bundleMeta(){ return (typeof window !== "undefined" && window.PRICE_DATA_META) || null; }
function loadSeries(tkr){
  if(priceCache[tkr]) return priceCache[tkr];          // manual upload takes precedence
  const b = bundle()[tkr];
  if(b && b.length){ priceCache[tkr] = b; return b; }
  return null;
}
function parseStooqCSV(text){
  // header: Date,Open,High,Low,Close,Volume   (monthly)
  const lines=text.trim().split(/\r?\n/);
  if(!lines.length || !/date/i.test(lines[0])) return null;
  const out=[];
  for(let i=1;i<lines.length;i++){
    const c=lines[i].split(",");
    if(c.length<5) continue;
    const d=c[0], close=parseFloat(c[4]);
    if(!/^\d{4}-\d{2}/.test(d) || !isFinite(close)) continue;
    out.push({ym:d.slice(0,7), close});
  }
  return out.length? out : null;
}

/* manual upload */
function ingestCSVFile(name, text){
  // map filename -> ticker:  aapl_us_m.csv -> AAPL ; spy_us_m -> SPY etc.
  let base = name.replace(/\.csv$/i,"").toLowerCase();
  base = base.replace(/_us(_[dwmqy])?$/,"").replace(/_us$/,"");
  let tkr = base.toUpperCase().replace("-",".");
  // map benchmark symbols
  for(const k in BENCH){ if(BENCH[k].startsWith(base)) tkr=k; }
  const data=parseStooqCSV(text);
  if(data){ priceCache[tkr]=data; return tkr; }
  return null;
}

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

function simulate(tickers, months, weightMode, rebalN){
  // returns {index:[], weightsAtStart:{}}
  const maps={}; tickers.forEach(t=>maps[t]=seriesMap(priceCache[t]));
  const sharesOut={}; UNIVERSE.forEach(([t,,,sh])=>sharesOut[t]=sh);

  // target weights function at month index k (uses prices at months[k])
  function targetWeights(k){
    const ym=months[k]; const w={};
    if(weightMode==="cap"){
      let tot=0; tickers.forEach(t=>{ const mc=(sharesOut[t]||1)*maps[t][ym]; w[t]=mc; tot+=mc; });
      tickers.forEach(t=>w[t]/=tot);
    } else { // custom
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
    if(doRebal){
      const w=targetWeights(k);
      tickers.forEach(t=>units[t]=(w[t]*V)/maps[t][ym]);
    }
  }
  return {index, weightsAtStart:w0};
}

function rebaseToBench(series, months, fullSeriesMap){
  // build benchmark index rebased to 100 at months[0]
  const base=fullSeriesMap[months[0]];
  return months.map(ym=> 100*fullSeriesMap[ym]/base);
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

/* ============================================================
   RUN
   ============================================================ */
function setStatus(msg){ $("#status").textContent=msg; }

function run(){
  const tickers=[...selected.keys()];
  if(tickers.length<1){ setStatus("Pick at least one stock first."); return; }
  if(!Object.keys(bundle()).length && !Object.keys(priceCache).length){
    setStatus("No price data found. Build the bundle with  node outputs/fetch-data.js  (creates outputs/data.js), or drop CSVs in manual mode below.");
    return;
  }
  const wantSpy=$("#bmSpy").checked, wantQqq=$("#bmQqq").checked;
  const need=[...tickers]; if(wantSpy)need.push("SPY"); if(wantQqq)need.push("QQQ");
  const years=parseInt($("#years").value);
  const weightMode=currentWeightMode();
  const rebalN=$("#rebal").value;
  const rf=parseFloat($("#rf").value)||0;

  const missing=[];
  need.forEach(t=>{ if(!loadSeries(t)) missing.push(t); });

  const haveTickers=tickers.filter(t=>priceCache[t]);
  if(haveTickers.length===0){
    setStatus(`No bundled data for your picks (${missing.join(", ")}). Rebuild with  node outputs/fetch-data.js, or add them via manual CSV mode below.`);
    return;
  }
  if(missing.length) setStatus(`Loaded ${need.length-missing.length}/${need.length}. Missing: ${missing.join(", ")} — not in the bundle; rebuild or add manually. Continuing with what loaded.`);
  else setStatus(`Loaded ${need.length} series from the bundle.`);

  // axis = common months across constituents that loaded (+ benchmarks if present)
  const axisSeries=[...haveTickers.map(t=>priceCache[t])];
  const months=buildMonthAxis(axisSeries, years);
  if(months.length<6){ setStatus("Not enough overlapping monthly data across your picks for a meaningful backtest. Try different/longer-history stocks."); return; }

  const {index,weightsAtStart}=simulate(haveTickers, months, weightMode, rebalN);

  // benchmarks rebased on same axis
  const datasets=[];
  let spyRets=null, spyIdx=null, qqqIdx=null;
  if(wantSpy && priceCache["SPY"]){ spyIdx=rebaseToBench(null,months,seriesMap(priceCache["SPY"])); spyRets=[]; for(let i=1;i<spyIdx.length;i++)spyRets.push(spyIdx[i]/spyIdx[i-1]-1); }
  if(wantQqq && priceCache["QQQ"]){ qqqIdx=rebaseToBench(null,months,seriesMap(priceCache["QQQ"])); }

  renderResults(months,index,spyIdx,qqqIdx,weightsAtStart,haveTickers,rf,spyRets);
}

/* ============================================================
   RENDER RESULTS
   ============================================================ */
function renderResults(months,index,spyIdx,qqqIdx,weights,tickers,rf,spyRets){
  $("#resultsEmpty").style.display="none";
  $("#results").style.display="block";

  const sIdx=stats(index,rf,spyRets);
  // stat cards
  const cards=[
    ["Total return",fmtPct(sIdx.totalRet),sIdx.totalRet>=0?"pos":"neg"],
    ["CAGR",fmtPct(sIdx.cagr),sIdx.cagr>=0?"pos":"neg"],
    ["Annualized vol",(sIdx.vol*100).toFixed(1)+"%",""],
    ["Max drawdown",fmtPct(sIdx.mdd),"neg"],
    ["Sharpe",fmtNum(sIdx.sharpe),sIdx.sharpe>=0?"pos":"neg"],
    ["Beta vs S&P",sIdx.beta!=null?fmtNum(sIdx.beta):"—",""]
  ];
  $("#statGrid").innerHTML=cards.map(c=>`<div class="card"><div class="lbl">${c[0]}</div><div class="val ${c[2]}">${c[1]}</div></div>`).join("");

  // chart
  const labels=months;
  const ds=[{label:"My Index",data:index,borderColor:getColor('--idx'),backgroundColor:"transparent",borderWidth:2.4,pointRadius:0,tension:.15}];
  if(spyIdx) ds.push({label:"S&P 500 (SPY)",data:spyIdx,borderColor:getColor('--spy'),borderWidth:1.6,pointRadius:0,tension:.15,borderDash:[]});
  if(qqqIdx) ds.push({label:"Nasdaq-100 (QQQ)",data:qqqIdx,borderColor:getColor('--qqq'),borderWidth:1.6,pointRadius:0,tension:.15});
  if(chart) chart.destroy();
  chart=new Chart($("#chart"),{
    type:"line",
    data:{labels,datasets:ds},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:"index",intersect:false},
      plugins:{legend:{labels:{color:getColor('--text'),usePointStyle:true,boxWidth:8}},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${c.parsed.y.toFixed(1)} (${fmtPct(c.parsed.y/100-1)})`}}},
      scales:{
        x:{ticks:{color:getColor('--muted'),maxTicksLimit:12},grid:{color:"rgba(255,255,255,.04)"}},
        y:{ticks:{color:getColor('--muted'),callback:v=>v},grid:{color:"rgba(255,255,255,.06)"},title:{display:true,text:"Growth of 100",color:getColor('--muted')}}
      }
    }
  });

  // comparison table
  const rows=[["My Index",sIdx]];
  if(spyIdx) rows.push(["S&P 500 (SPY)",stats(spyIdx,rf,spyRets)]);
  if(qqqIdx) rows.push(["Nasdaq-100 (QQQ)",stats(qqqIdx,rf,spyRets)]);
  $("#statTable").innerHTML=
    `<tr><th>Series</th><th>Total</th><th>CAGR</th><th>Vol</th><th>Max DD</th><th>Sharpe</th></tr>`+
    rows.map(([nm,s])=>`<tr><td>${nm}</td>
      <td class="${s.totalRet>=0?'pos':'neg'}">${fmtPct(s.totalRet)}</td>
      <td class="${s.cagr>=0?'pos':'neg'}">${fmtPct(s.cagr)}</td>
      <td>${(s.vol*100).toFixed(1)}%</td>
      <td class="neg">${fmtPct(s.mdd)}</td>
      <td>${fmtNum(s.sharpe)}</td></tr>`).join("");

  // composition table
  const comp=tickers.map(t=>[t,weights[t]]).sort((a,b)=>b[1]-a[1]);
  $("#compTable").innerHTML=
    `<tr><th>Ticker</th><th>Name</th><th>Start weight</th></tr>`+
    comp.map(([t,w])=>{
      const nm=(UNIVERSE.find(u=>u[0]===t)||[])[1]||"";
      return `<tr><td><b>${t}</b></td><td style="text-align:left;color:var(--muted)">${nm}</td><td>${(w*100).toFixed(1)}%</td></tr>`;
    }).join("");

  $("#results").scrollIntoView({behavior:"smooth",block:"start"});
}
function getColor(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}

/* ============================================================
   WIRING
   ============================================================ */
$("#search").addEventListener("input",e=>renderPicker(e.target.value));
$("#clearSel").onclick=()=>{selected.clear();renderSelected();renderPicker($("#search").value);};
$("#presetTech").onclick=()=>{["AAPL","MSFT","NVDA","AMZN","GOOGL","META","AVGO","TSLA"].forEach(t=>selected.set(t,{customW:null}));renderSelected();renderPicker($("#search").value);};
$("#presetDow").onclick=()=>{["AAPL","MSFT","JPM","UNH","HD","KO","CVX","JNJ","WMT","CAT","XOM","V"].forEach(t=>selected.set(t,{customW:null}));renderSelected();renderPicker($("#search").value);};

$("#weightSeg").addEventListener("click",e=>{
  if(e.target.tagName!=="BUTTON")return;
  $("#weightSeg").querySelectorAll("button").forEach(b=>b.classList.remove("on"));
  e.target.classList.add("on");
  $("#weightHint").innerHTML = e.target.dataset.w==="cap"
    ? "Weighted by company size (shares × price), rebalanced each period — like the S&amp;P 500."
    : "Set each stock's % allocation. Blanks share the remainder; auto-normalized to 100%.";
  renderSelected();
});
$("#run").onclick=run;

$("#genLinks").onclick=()=>{
  const need=[...selected.keys()]; if($("#bmSpy").checked)need.push("SPY"); if($("#bmQqq").checked)need.push("QQQ");
  const ll=$("#linklist"); ll.style.display="block";
  ll.innerHTML=need.map(t=>{const sym=(t in BENCH)?BENCH[t]:stooqSym(t);return `<a href="${stooqURL(sym)}" target="_blank">${t} → ${sym}.csv</a>`;}).join("<br>")
    +`<div class="hint">Open each link (downloads a CSV), then drop all files into the box below.</div>`;
};
const dz=$("#dropzone");
["dragenter","dragover"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add("drag");}));
["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove("drag");}));
dz.addEventListener("drop",async e=>{
  const files=[...e.dataTransfer.files]; let ok=[],bad=[];
  for(const f of files){ const txt=await f.text(); const t=ingestCSVFile(f.name,txt); if(t)ok.push(t); else bad.push(f.name); }
  setStatus(`Imported: ${ok.join(", ")||"none"}${bad.length?"  ·  unparsed: "+bad.join(", "):""}. Now hit “Run backtest”.`);
});

renderPicker();
renderSelected();

/* startup: report bundle freshness (or how to build it) */
(function(){
  const m = bundleMeta();
  if(m) setStatus(`Bundled data: ${m.tickers} tickers · ${m.from} → ${m.through}. Pick stocks and run the backtest.`);
  else setStatus("No data bundle found. Build it once with  node outputs/fetch-data.js  (creates outputs/data.js). Manual CSV mode also works.");
})();
