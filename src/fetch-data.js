#!/usr/bin/env node
/* ============================================================
   fetch-data.js — build the offline price bundle (src/data.js)
   ------------------------------------------------------------
   Runs in Node, so there is NO browser CORS and NO public-proxy
   rate-limit chain. It downloads ~10 years of daily closes for the
   whole S&P 100 universe + the SPY/QQQ benchmarks, downsamples them
   to month-end closes, and writes src/data.js, which
   index-simulator.html loads directly.

   Source: Nasdaq's public historical endpoint
     https://api.nasdaq.com/api/quote/<SYM>/historical?assetclass=<stocks|etf>&fromdate=…&todate=…
   It needs no API key, returns ~10y of daily rows, and (unlike Yahoo,
   which IP-rate-limits hard, and Stooq, which now sits behind a JS
   "verify your browser" bot wall) tolerates a steady paced crawl.
   Closes are split-adjusted / dividend-excluded — i.e. price-return,
   exactly what the simulator models.

   Requests are paced (default 1.5s apart); hammering Nasdaq with no
   delay makes it return empty bodies, so do not lower --delay much.

   Usage:
     node src/fetch-data.js                 # ~10y, all symbols
     node src/fetch-data.js --delay=2500    # gentler pacing (ms)
     node src/fetch-data.js --years=8       # shorter history window
     node src/fetch-data.js --months=120    # cap stored months
   ============================================================ */

const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const OUT_PATH = path.join(HERE, "data.js");

// Ticker universe + benchmark symbols — the single source of truth, shared with the app.
const { UNIVERSE, BENCH } = require("./universe.js");

/* ---------- args ---------- */
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=(.*)$/);
  return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
}));
const HISTORY_YEARS = parseInt(argv.years || 12, 10);          // how far back to request
const MAX_MONTHS    = parseInt(argv.months || 0, 10);          // 0 = keep everything returned
const DELAY_MS      = parseInt(argv.delay || 1500, 10);        // between symbols
const RETRIES       = parseInt(argv.retries || 4, 10);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

if (typeof fetch !== "function") {
  console.error("This script needs Node 18+ (global fetch). Your Node is too old.");
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad2 = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/* ---------- network ---------- */
const HEADERS = { "User-Agent": UA, "Accept": "application/json", "Accept-Language": "en-US,en;q=0.9" };

// Nasdaq historical for one symbol -> raw daily rows (newest first), or throws.
async function fetchHistory(symbol, assetclass, fromdate, todate) {
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical`
            + `?assetclass=${assetclass}&fromdate=${fromdate}&todate=${todate}&limit=9999`;
  const r = await fetch(url, { headers: HEADERS });
  if (r.status === 429) throw new RateLimit("HTTP 429");
  if (!r.ok) throw new Error("HTTP " + r.status);
  const txt = await r.text();
  if (!txt) throw new Error("empty body (throttled?)");
  let j;
  try { j = JSON.parse(txt); } catch { throw new Error("non-JSON body"); }
  const rCode = j.status && j.status.rCode;
  const rows = j.data && j.data.tradesTable && j.data.tradesTable.rows;
  if (!rows || !rows.length) throw new Error("no rows (rCode " + rCode + ")");
  return rows;
}

class RateLimit extends Error {}

// Yahoo fallback (chart endpoint) for symbols Nasdaq can't resolve (e.g. BK). key -> [{ym,close}].
async function fromYahoo(key) {
  const sym = key.replace(".", "-").toUpperCase();
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1mo&range=10y`, { headers: HEADERS });
  if (r.status === 429) throw new RateLimit("yahoo 429");
  if (!r.ok) throw new Error("yahoo HTTP " + r.status);
  const j = JSON.parse(await r.text());
  const res = j && j.chart && j.chart.result && j.chart.result[0];
  const ts = res && res.timestamp;
  const closes = res && res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close;
  if (!ts || !closes) throw new Error("yahoo no data");
  const byMonth = {};
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i]; if (c == null || !isFinite(c)) continue;
    const d = new Date(ts[i] * 1000);
    byMonth[`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`] = +Number(c).toFixed(4);
  }
  const out = Object.keys(byMonth).sort().map(ym => ({ ym, close: byMonth[ym] }));
  if (!out.length) throw new Error("yahoo empty");
  return out;
}

// daily rows -> [{ym, close}] keeping each month's last trading day (month-end close)
function toMonthly(rows) {
  const ordered = rows.slice().reverse(); // Nasdaq returns newest-first; go oldest-first
  const byMonth = {};
  for (const row of ordered) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row.date);
    if (!m) continue;
    const close = parseFloat(String(row.close).replace(/[$,]/g, ""));
    if (!isFinite(close)) continue;
    byMonth[`${m[3]}-${m[1]}`] = +close.toFixed(4); // later (newer) date in the month wins
  }
  const out = Object.keys(byMonth).sort().map(ym => ({ ym, close: byMonth[ym] }));
  return out.length ? out : null;
}

async function withRetries(fn, label) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (attempt >= RETRIES) break;
      const wait = e instanceof RateLimit ? Math.min(60000, 15000 * attempt) : DELAY_MS * attempt;
      await sleep(wait);
    }
  }
  throw lastErr;
}

function trimMonths(series) {
  return MAX_MONTHS > 0 && series.length > MAX_MONTHS ? series.slice(series.length - MAX_MONTHS) : series;
}

/* ---------- main ---------- */
(async function main() {
  const today = new Date();
  const todate = ymd(today);
  const from = new Date(today); from.setFullYear(from.getFullYear() - HISTORY_YEARS);
  const fromdate = ymd(from);

  // work list: constituents are "stocks", benchmarks are "etf"
  const allKeys = [...UNIVERSE.map(([t]) => t), ...Object.keys(BENCH)];
  let tasks = [
    ...UNIVERSE.map(([t]) => ({ key: t, symbol: t, assetclass: "stocks" })),
    ...Object.keys(BENCH).map(b => ({ key: b, symbol: b, assetclass: "etf" })),
  ];

  // --only=A,B  : fetch just those tickers and MERGE into the existing bundle
  // (handy for backfilling a straggler like BK without a full 3-minute rebuild)
  const only = argv.only ? String(argv.only).toUpperCase().split(",").map(s => s.trim()).filter(Boolean) : null;
  const data = {};
  if (only) {
    tasks = tasks.filter(t => only.includes(t.key.toUpperCase()));
    if (!tasks.length) { console.error(`--only matched no known tickers: ${only.join(", ")}`); process.exit(1); }
    try {
      const window = {}; eval(fs.readFileSync(OUT_PATH, "utf8")); // load existing bundle to merge into
      if (window.PRICE_DATA) Object.assign(data, window.PRICE_DATA);
      console.log(`Merge mode: keeping ${Object.keys(data).length} existing tickers, refetching ${tasks.map(t => t.key).join(", ")}.`);
    } catch { console.log("No existing data.js to merge into — writing fresh."); }
  }

  console.log(`Fetching ${tasks.length} symbols (Nasdaq, Yahoo fallback) ${fromdate} → ${todate}, ${DELAY_MS}ms apart…\n`);

  for (let i = 0; i < tasks.length; i++) {
    const { key, symbol, assetclass } = tasks[i];
    process.stdout.write(`[${String(i + 1).padStart(3)}/${tasks.length}] ${key} … `);
    try {
      let series, src;
      try {
        series = trimMonths(toMonthly(await withRetries(() => fetchHistory(symbol, assetclass, fromdate, todate), key)));
        src = "nasdaq";
      } catch (eNasdaq) {
        series = trimMonths(await withRetries(() => fromYahoo(key), key + " (yahoo)")); // fallback
        src = "yahoo";
      }
      data[key] = series;
      console.log(`ok  ${series.length}mo  ${series[0].ym}→${series[series.length - 1].ym}${src === "yahoo" ? "  (via yahoo)" : ""}`);
    } catch (e) {
      console.log(`FAILED (${e.message})`);
    }
    if (i < tasks.length - 1) await sleep(DELAY_MS);
  }

  const have = Object.keys(data);
  if (!have.length) {
    console.error("\nNo data fetched. Nasdaq may be throttling — wait a minute and re-run with --delay=3000.");
    process.exit(1);
  }

  // bundle-wide coverage window
  let cFrom = "9999-99", cThrough = "0000-00";
  have.forEach(k => {
    const s = data[k];
    if (s[0].ym < cFrom) cFrom = s[0].ym;
    if (s[s.length - 1].ym > cThrough) cThrough = s[s.length - 1].ym;
  });

  const failed = allKeys.filter(k => !data[k]);
  const meta = {
    generated: new Date().toISOString(),
    tickers: have.length,
    from: cFrom, through: cThrough,
    source: "nasdaq (+yahoo fallback)",
    failed,
  };

  const body = have.sort().map(k => `${JSON.stringify(k)}:${JSON.stringify(data[k])}`).join(",\n");
  const out =
    `/* AUTO-GENERATED by src/fetch-data.js — do not edit by hand.\n` +
    `   Regenerate with:  node src/fetch-data.js\n` +
    `   Generated ${meta.generated} · ${meta.tickers} tickers · ${meta.from} → ${meta.through} */\n` +
    `window.PRICE_DATA_META = ${JSON.stringify(meta, null, 2)};\n` +
    `window.PRICE_DATA = {\n${body}\n};\n`;

  fs.writeFileSync(OUT_PATH, out);

  console.log(`\nWrote ${path.relative(process.cwd(), OUT_PATH)} — ${meta.tickers} tickers, ${meta.from} → ${meta.through}.`);
  if (failed.length) console.log(`Missing (${failed.length}): ${failed.join(", ")} — re-run to retry, or add via manual CSV mode in the app.`);
})().catch(e => { console.error(e); process.exit(1); });
