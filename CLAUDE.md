# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **custom stock-index backtester** that runs entirely in the browser. The user picks constituents from a built-in S&P 100 universe, chooses a weighting scheme (market-cap or custom %) and rebalance frequency, and the tool loads ~10 years of monthly closing prices from a pre-built offline bundle, builds a "growth of 100" index, and charts it against SPY and Nasdaq-100 (QQQ) with summary statistics.

There is **no package.json, framework, dependency install, or build step** — the files the browser loads are the files you edit. `index-simulator.html` pulls in Chart.js (CDN) plus a few sibling files via classic `<script>`/`<link>` tags: `universe.js` (data), `engine.js` (simulation/stats), `app.js` (UI), `styles.css`, and the generated `data.js` price bundle. The only tooling is two plain-Node scripts: `fetch-data.js` (builds the price bundle) and `engine.test.js` (tests). Requires Node 18+ (the fetch script uses global `fetch`).

## Commands

```bash
# Build / refresh the offline price bundle (src/data.js). Fetches server-side in
# Node from Nasdaq (no API key), so there is NO browser CORS and NO rate-limit proxy
# chain. Run once before first use, and again whenever you want fresher prices.
node src/fetch-data.js                 # all S&P 100 + SPY/QQQ, ~10y (Nasdaq caps history)
node src/fetch-data.js --years=8       # request a shorter history window
node src/fetch-data.js --delay=2500    # gentler pacing (ms between tickers) if throttled
node src/fetch-data.js --only=BK,LIN   # refetch just these and MERGE into the existing bundle

# Run the app: open the HTML directly in a browser (no server needed; loads data.js)
open src/index-simulator.html

# Run the engine test suite (plain Node, no test framework)
node src/engine.test.js          # prints PASS/FAIL per assertion, exits non-zero on failure
```

There is no single-test runner — `engine.test.js` is a flat script of `check(...)` assertions grouped into `TEST 1..7` console sections. To run one group, comment out the others.

## Files

All app files live in `src/` and are loaded by the browser as **classic** scripts/styles (no bundler, no ES modules — so it still works over `file://`):

- `src/index-simulator.html` — markup only, plus `<link href="styles.css">` and `<script src>` tags for Chart.js (CDN), `data.js`, `universe.js`, `engine.js`, `app.js` — in that order, with `app.js` last so the DOM and the other globals exist when it runs.
- `src/universe.js` — the `UNIVERSE` (S&P 100 `[ticker, name, sector, sharesOutBillions]`) and `BENCH` (`{SPY,QQQ}`) literals. **Dual-mode**: a browser global *and* a Node `module.exports`, so `fetch-data.js` and the tests `require()` the same list — no second copy.
- `src/engine.js` — the engine: `seriesMap`, `buildMonthAxis`, `simulate`, `rebaseToBench`, `stats`. **Pure functions — no DOM, no app globals.** `simulate(tickers, months, weightMode, rebalN, ctx)` takes its data via `ctx = { priceCache, sharesOut, customWeights }`. Dual-mode (browser global + `module.exports`).
- `src/app.js` — all DOM: stock picker, data loading (bundle + manual CSV), `run()`, results rendering (Chart.js + tables), wiring. Builds `ctx` and calls the engine.
- `src/styles.css` — all styling (CSS variables drive the dark theme; the chart reads them via `getColor`).
- `src/data.js` — **generated** price bundle: `window.PRICE_DATA = {ticker: [{ym, close}], …}` plus `window.PRICE_DATA_META`. Do not hand-edit; regenerate it. Safe to delete — the app still loads and tells you to rebuild.
- `src/fetch-data.js` — **Node data bundler** (see Commands). `require`s `universe.js` for the ticker list.
- `src/engine.test.js` — dependency-free test harness; `require`s `engine.js` directly.

### The engine has a single source of truth

`simulate()`, `stats()`, `buildMonthAxis()`, `seriesMap()`, and `rebaseToBench()` live **only** in `engine.js`. The browser uses them as globals (classic script); `engine.test.js` and `fetch-data.js`-style tooling `require()` the same file. There's nothing to keep in sync — change the logic once. *(This replaced an older design where the engine was copy-pasted into the HTML, an extracted `_inline.js`, and the test file.)*

## Architecture (data flow)

The pipeline spans `universe.js` (data) → `engine.js` (math) → `app.js` (UI/glue):

1. **`UNIVERSE`** — hardcoded array of `[ticker, name, sector, sharesOutBillions]` for the S&P 100. Share counts are approximate (circa 2024–25) and used *only* for market-cap weighting.
2. **Stock picker** (`renderPicker`/`renderSelected`) — writes into a `selected` Map (`ticker -> {customW}`). Custom mode exposes a per-ticker `%` input.
3. **Data** — prices come from the **bundled `data.js`** (`window.PRICE_DATA`), built ahead of time by `fetch-data.js`. At runtime `loadSeries(tkr)` just copies the series into `priceCache` (`ticker -> [{ym, close}]`) — synchronous, instant, no network. The build script fetches **server-side** (Node has no CORS): **primary source is Nasdaq's** `api.nasdaq.com/api/quote/<SYM>/historical` (no API key, ~10y of daily rows downsampled to month-end closes; constituents use `assetclass=stocks`, SPY/QQQ use `etf`), with **Yahoo** `chart` as a per-ticker fallback. Requests are **paced ~1.5s apart** — hammering Nasdaq returns empty bodies, and Yahoo hard-rate-limits a too-eager IP with 429s. *Why this design: Stooq's CSV endpoint (the original source) now sits behind a JS "verify your browser" bot wall, and the old in-browser public-CORS-proxy chain is dead — so all fetching moved server-side into this script.* **Known gaps / short histories** (current bundle is 103/104 tickers, 2016-06 → 2026-06): `BK` is missing entirely — it isn't in Nasdaq's quote service, so it only comes from Yahoo. `LIN` only goes back to 2023-03 because Nasdaq resets its history at Linde's 2023 corporate reorganization (full history is on Yahoo). `DOW` legitimately starts 2019-03 (spun off from DowDuPont — not a bug). Backfill BK/LIN from Yahoo with `node src/fetch-data.js --only=BK,LIN` from a network Yahoo isn't throttling. Because `buildMonthAxis` intersects, selecting a short-history ticker shrinks the whole backtest window. **Manual override:** `ingestCSVFile` / the dropzone still let you drag in Stooq CSVs (filenames like `aapl_us_m.csv` auto-map); a manually loaded ticker takes precedence over the bundle for that session.
4. **`buildMonthAxis`** — the backtest axis is the **intersection of months present in every loaded series** (so a constituent with short history shrinks the window), trimmed to the selected lookback.
5. **`simulate`** (pure; `app.js` passes it `ctx = {priceCache, sharesOut, customWeights}`) — holds a fixed quantity of "units" per stock; index value `V = Σ units·price`, starting at 100. On each rebalance month (`k % rebalN === 0`) it recomputes target weights and resets units to hit them at the current `V`. Weighting:
   - **cap**: `weight ∝ sharesOut · price`, normalized.
   - **custom**: user `%` values; blank tickers split the remaining `%` equally; the whole vector is auto-normalized to 1.
6. **`stats`** — total return, CAGR, annualized vol (monthly σ × √12), Sharpe (using the risk-free input), max drawdown, and beta vs SPY.
7. **`rebaseToBench`** + **`renderResults`** — benchmarks are rebased to 100 on the same month axis; results render as stat cards, a Chart.js line chart, and comparison/composition tables.

### Modeling caveats baked in (don't "fix" without intent)
- Prices are **price-return** (dividends excluded), applied consistently to the index and both benchmarks.
- Market-cap weights use **fixed** share counts, so they ignore buybacks/issuance over the backtest window.
