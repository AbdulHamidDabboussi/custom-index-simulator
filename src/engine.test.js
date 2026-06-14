// Tests for the simulation/statistics engine.
// Imports the REAL engine (engine.js) — no re-implementation to keep in sync.
// simulate() takes deps explicitly: ctx = { priceCache, sharesOut, customWeights }.

const { seriesMap, buildMonthAxis, simulate, stats } = require("./engine.js");

// ---- test harness ----
let pass = 0, fail = 0;
function approx(a, b, eps = 1e-6) { return Math.abs(a - b) < eps; }
function check(name, cond, extra = "") { if (cond) { pass++; console.log("  PASS", name); } else { fail++; console.log("  FAIL", name, extra); } }
function mk(arr) { // arr of closes -> [{ym,close}] starting 2020-01
  return arr.map((c, i) => { const m = i % 12, y = 2020 + Math.floor(i / 12); return { ym: `${y}-${String(m + 1).padStart(2, "0")}`, close: c }; });
}

console.log("TEST 1: single stock buy&hold, custom 100%");
{ const priceCache = { A: mk([100, 110, 121]) };
  const m = buildMonthAxis([priceCache.A], 0);
  const { index } = simulate(["A"], m, "custom", "none", { priceCache, sharesOut: { A: 1 }, customWeights: { A: 100 } });
  check("index tracks price", approx(index[0], 100) && approx(index[1], 110) && approx(index[2], 121), JSON.stringify(index));
  const s = stats(index, 0, null);
  check("total return 21%", approx(s.totalRet, 0.21, 1e-9), s.totalRet);
}

console.log("TEST 2: two stocks 50/50 buy&hold");
{ const priceCache = { A: mk([100, 200]), B: mk([100, 100]) };
  const m = buildMonthAxis([priceCache.A, priceCache.B], 0);
  const { index, weightsAtStart } = simulate(["A", "B"], m, "custom", "none", { priceCache, sharesOut: { A: 1, B: 1 }, customWeights: { A: 50, B: 50 } });
  check("start weights 50/50", approx(weightsAtStart.A, 0.5) && approx(weightsAtStart.B, 0.5));
  check("month1 value=150", approx(index[1], 150), index);
}

console.log("TEST 3: cap weighting reflects size, flat prices -> flat index");
{ const priceCache = { A: mk([100, 100, 100]), B: mk([100, 100, 100]) };
  const m = buildMonthAxis([priceCache.A, priceCache.B], 0);
  const { index, weightsAtStart } = simulate(["A", "B"], m, "cap", "3", { priceCache, sharesOut: { A: 2, B: 1 }, customWeights: {} });
  check("cap weight A=2/3", approx(weightsAtStart.A, 2 / 3, 1e-9), weightsAtStart.A);
  check("cap weight B=1/3", approx(weightsAtStart.B, 1 / 3, 1e-9), weightsAtStart.B);
  check("flat prices -> index 100", approx(index[2], 100), index);
}

console.log("TEST 4: cap weight, only A rises -> index between equal & A-only");
{ const priceCache = { A: mk([100, 200]), B: mk([100, 100]) };
  const m = buildMonthAxis([priceCache.A, priceCache.B], 0);
  const { index } = simulate(["A", "B"], m, "cap", "none", { priceCache, sharesOut: { A: 1, B: 1 }, customWeights: {} });
  // equal cap at t0 (50/50), buy&hold -> 0.5*200+0.5*100=150
  check("cap buy&hold month1=150", approx(index[1], 150), index);
}

console.log("TEST 5: rebalancing changes outcome vs buy&hold");
// A doubles then halves; B flat. Monthly rebalance should differ from buy&hold.
{ const priceCache = { A: mk([100, 200, 100]), B: mk([100, 100, 100]) };
  const m = buildMonthAxis([priceCache.A, priceCache.B], 0);
  const ctx = { priceCache, sharesOut: { A: 1, B: 1 }, customWeights: { A: 50, B: 50 } };
  const bh = simulate(["A", "B"], m, "custom", "none", ctx).index;
  const rb = simulate(["A", "B"], m, "custom", "1", ctx).index;
  // buy&hold: units A=0.5,B=0.5 -> t1=150, t2=0.5*100+0.5*100=100
  check("buy&hold ends 100", approx(bh[2], 100), bh);
  // monthly rebal: at t1 V=150, reset 50/50 -> A units=75/200=0.375, B=75/100=0.75
  // t2: 0.375*100 + 0.75*100 = 112.5
  check("rebalanced ends 112.5", approx(rb[2], 112.5), rb);
  check("rebalance beat buy&hold here", rb[2] > bh[2]);
}

console.log("TEST 6: stats - vol, drawdown, CAGR sanity");
{ // index that drops 50% then recovers
  const idx = [100, 50, 100];
  const s = stats(idx, 0, null);
  check("max drawdown -50%", approx(s.mdd, -0.5), s.mdd);
  check("total return 0", approx(s.totalRet, 0), s.totalRet);
  // returns: -0.5, +1.0 ; mean=0.25 ; var=((-0.75)^2+(0.75)^2)/2=0.5625 ; sd=0.75 ; vol=0.75*sqrt12
  check("annualized vol", approx(s.vol, 0.75 * Math.sqrt(12), 1e-9), s.vol);
}

console.log("TEST 7: custom weights with blanks normalize");
{ const priceCache = { A: mk([100, 100]), B: mk([100, 100]), C: mk([100, 100]) };
  const m = buildMonthAxis([priceCache.A, priceCache.B, priceCache.C], 0);
  const { weightsAtStart: w } = simulate(["A", "B", "C"], m, "custom", "none", { priceCache, sharesOut: {}, customWeights: { A: 60, B: null, C: null } });
  check("A=0.6", approx(w.A, 0.6, 1e-9), w.A);
  check("B=0.2 (remainder split)", approx(w.B, 0.2, 1e-9), w.B);
  check("weights sum to 1", approx(w.A + w.B + w.C, 1, 1e-9));
}

console.log("TEST 8: equal weighting ignores size and custom inputs");
{ const priceCache = { A: mk([100, 100]), B: mk([100, 100]), C: mk([100, 100]) };
  const m = buildMonthAxis([priceCache.A, priceCache.B, priceCache.C], 0);
  // lopsided sharesOut + customWeights are passed in; equal mode must ignore both
  const { index, weightsAtStart: w } = simulate(["A", "B", "C"], m, "equal", "none", { priceCache, sharesOut: { A: 99, B: 1, C: 1 }, customWeights: { A: 90 } });
  check("equal A=1/3", approx(w.A, 1 / 3, 1e-9), w.A);
  check("equal B=1/3", approx(w.B, 1 / 3, 1e-9), w.B);
  check("equal weights sum to 1", approx(w.A + w.B + w.C, 1, 1e-9));
  check("flat prices -> index 100", approx(index[1], 100), index);
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
