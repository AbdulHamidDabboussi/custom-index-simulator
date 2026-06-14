/* ============================================================
   App: stock picker, data loading, run/render, and DOM wiring.
   Depends on globals from universe.js (UNIVERSE, BENCH) and
   engine.js (simulate, stats, buildMonthAxis, seriesMap, rebaseToBench).
   Loaded last, after the DOM and the other scripts.
   ============================================================ */
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
// produced server-side by `node src/fetch-data.js` — no browser CORS, no
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
   RUN
   ============================================================ */
function setStatus(msg){ $("#status").textContent=msg; }

function run(){
  const tickers=[...selected.keys()];
  if(tickers.length<1){ setStatus("Pick at least one stock first."); return; }
  if(!Object.keys(bundle()).length && !Object.keys(priceCache).length){
    setStatus("No price data found. Build the bundle with  node src/fetch-data.js  (creates src/data.js), or drop CSVs in manual mode below.");
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
    setStatus(`No bundled data for your picks (${missing.join(", ")}). Rebuild with  node src/fetch-data.js, or add them via manual CSV mode below.`);
    return;
  }
  if(missing.length) setStatus(`Loaded ${need.length-missing.length}/${need.length}. Missing: ${missing.join(", ")} — not in the bundle; rebuild or add manually. Continuing with what loaded.`);
  else setStatus(`Loaded ${need.length} series from the bundle.`);

  // axis = common months across constituents that loaded (+ benchmarks if present)
  const axisSeries=[...haveTickers.map(t=>priceCache[t])];
  const months=buildMonthAxis(axisSeries, years);
  if(months.length<6){ setStatus("Not enough overlapping monthly data across your picks for a meaningful backtest. Try different/longer-history stocks."); return; }

  const sharesOut={}; UNIVERSE.forEach(([t,,,sh])=>sharesOut[t]=sh);
  const customWeights={}; selected.forEach((v,t)=>customWeights[t]=v.customW);
  const {index,weightsAtStart}=simulate(haveTickers, months, weightMode, rebalN, {priceCache, sharesOut, customWeights});

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
  // stat cards  (4th element = tooltip explaining the metric)
  const cards=[
    ["Total return",fmtPct(sIdx.totalRet),sIdx.totalRet>=0?"pos":"neg","Total price-return over the whole period, dividends excluded. +100% means the index doubled."],
    ["CAGR",fmtPct(sIdx.cagr),sIdx.cagr>=0?"pos":"neg","Compound annual growth rate — the steady yearly rate that turns the start value into the end value."],
    ["Annualized vol",(sIdx.vol*100).toFixed(1)+"%","","Annualized volatility — standard deviation of monthly returns × √12. Higher means bigger swings."],
    ["Max drawdown",fmtPct(sIdx.mdd),"neg","Largest peak-to-trough drop over the period — the worst decline you'd have had to sit through."],
    ["Sharpe",fmtNum(sIdx.sharpe),sIdx.sharpe>=0?"pos":"neg","Sharpe ratio — return above the risk-free rate per unit of volatility. Higher is better; above 1 is good."],
    ["Beta vs S&P",sIdx.beta!=null?fmtNum(sIdx.beta):"—","","Sensitivity to the S&P 500: 1 moves with the market, above 1 swings more, below 1 swings less."]
  ];
  $("#statGrid").innerHTML=cards.map(c=>`<div class="card"><div class="lbl" data-tip="${c[3]}">${c[0]}</div><div class="val ${c[2]}">${c[1]}</div></div>`).join("");

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
    `<tr><th>Series</th><th data-tip="Total price-return over the period (dividends excluded).">Total</th><th data-tip="Compound annual growth rate — the annualized return.">CAGR</th><th data-tip="Annualized volatility (monthly σ × √12) — how much returns swing.">Vol</th><th data-tip="Max drawdown — the largest peak-to-trough drop.">Max DD</th><th data-tip="Sharpe ratio — return above the risk-free rate per unit of volatility.">Sharpe</th></tr>`+
    rows.map(([nm,s])=>`<tr><td>${nm}</td>
      <td class="${s.totalRet>=0?'pos':'neg'}">${fmtPct(s.totalRet)}</td>
      <td class="${s.cagr>=0?'pos':'neg'}">${fmtPct(s.cagr)}</td>
      <td>${(s.vol*100).toFixed(1)}%</td>
      <td class="neg">${fmtPct(s.mdd)}</td>
      <td>${fmtNum(s.sharpe)}</td></tr>`).join("");

  // composition table
  const comp=tickers.map(t=>[t,weights[t]]).sort((a,b)=>b[1]-a[1]);
  $("#compTable").innerHTML=
    `<tr><th>Ticker</th><th style="text-align:left">Name</th><th data-tip="Each holding's share of the index at the start — and what it's reset to on each rebalance.">Start weight</th></tr>`+
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
  else setStatus("No data bundle found. Build it once with  node src/fetch-data.js  (creates src/data.js). Manual CSV mode also works.");
})();

/* ============================================================
   TOOLTIPS — one floating bubble for any element with [data-tip].
   position:fixed, so it is never clipped by the scrolling panels.
   ============================================================ */
(function(){
  const tip=document.createElement("div"); tip.id="tip"; document.body.appendChild(tip);
  let cur=null;
  function show(el){
    const t=el.getAttribute("data-tip"); if(!t){hide();return;}
    tip.textContent=t; tip.style.display="block";
    tip.style.left="-9999px"; tip.style.top="0px";                 // render off-screen to measure
    const r=el.getBoundingClientRect(), w=tip.offsetWidth, h=tip.offsetHeight;
    const left=Math.max(8, Math.min(r.left + r.width/2 - w/2, window.innerWidth - w - 8));
    let top=r.bottom + 6; if(top + h > window.innerHeight - 8) top=r.top - h - 6;   // flip above if no room below
    tip.style.left=left+"px"; tip.style.top=top+"px";
  }
  function hide(){ tip.style.display="none"; cur=null; }
  document.addEventListener("pointerover",e=>{ const el=e.target.closest && e.target.closest("[data-tip]"); if(el && el!==cur){ cur=el; show(el); } });
  document.addEventListener("pointerout",e=>{ const el=e.target.closest && e.target.closest("[data-tip]"); if(el && !el.contains(e.relatedTarget)) hide(); });
  document.addEventListener("scroll",hide,true);
})();
