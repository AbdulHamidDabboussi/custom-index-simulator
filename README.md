# 📊 Custom Index Simulator

Build your own stock index from the S&P 100, weight it however you like, and backtest it against the S&P 500 and Nasdaq-100 over ~10 years — all in a single HTML file that runs entirely in your browser.

Pick constituents, choose **market-cap** or **custom %** weighting and a rebalance frequency, and the tool builds a "growth of 100" index and charts it against **SPY**, **QQQ**, and the Sharia-screened **SPUS** with a full set of summary statistics.

> Example: a market-cap-weighted "Big Tech" basket (AAPL, MSFT, NVDA, AMZN, GOOGL, META, AVGO, TSLA), quarterly rebalanced, returned **+1132%** over 2016–2026 vs **+254%** for the S&P 500 and **+571%** for the Nasdaq-100.

## Quick start

No build, no server, no install — the price data is committed in the repo, so:

```bash
open src/index-simulator.html      # macOS
# or just double-click src/index-simulator.html in any browser
```

That's it. Pick a few stocks (or hit a preset), choose your weighting and rebalance, and click **Run backtest**.

## Features

- **Stock picker** over the full S&P 100 universe, grouped by sector, with search and one-click presets (Big Tech, Mega-cap mix).
- **Two weighting schemes** — market-cap (size-weighted, like the real index) or custom % allocations (blanks split the remainder; auto-normalized to 100%).
- **Rebalancing** — buy & hold, annual, quarterly, or monthly.
- **Lookback windows** — 3 / 5 (default) / 10 years, max available, or a custom number of years.
- **Benchmarks** — compare against SPY (S&P 500), QQQ (Nasdaq-100), and SPUS (the Sharia-screened S&P 500), rebased to the same start. SPUS launched Dec 2019, so it's automatically disabled for lookbacks longer than its history (available at 3y/5y, disabled at 10y / Max available).
- **Statistics** — total return, CAGR, annualized volatility, Sharpe ratio (with a configurable risk-free rate), max drawdown, and beta vs the S&P 500.
- **Interactive chart** (Chart.js) plus performance-comparison and index-composition tables.

## How it works

The app reads prices from a **pre-built offline bundle** (`src/data.js`), so at runtime there's no network call, no CORS, and no rate limits — it loads instantly and works offline.

That bundle is produced ahead of time by `src/fetch-data.js`, a plain-Node script that runs **server-side** (where browser CORS doesn't apply). It pulls ~10 years of daily closes for the whole universe from **Nasdaq's public historical API** (no API key needed), downsamples them to month-end closes, and writes `data.js`. Yahoo Finance is used as a per-ticker fallback.

> Why a bundle instead of live fetching? Browsers block cross-origin requests to these data hosts, Stooq's CSV endpoint (the original source) now sits behind a "verify your browser" bot wall, and public CORS proxies are unreliable and rate-limited. Fetching once, server-side, and bundling the result side-steps all of that.

The backtest itself: each holding is a fixed quantity of "units"; the index value is `Σ units × price`, starting at 100. On each rebalance month the target weights are recomputed and units reset to hit them. The month axis is the **intersection** of months available across your selected stocks, so picking a short-history name shrinks the window.

## Refreshing the price data

The committed bundle covers **2016-06 → 2026-06**. To rebuild it with fresher prices (requires **Node 18+**):

```bash
node src/fetch-data.js                 # rebuild the whole bundle (~3 min, paced)
node src/fetch-data.js --years=8       # request a shorter history window
node src/fetch-data.js --delay=2500    # gentler pacing if a source throttles you
node src/fetch-data.js --only=BK,LIN   # refetch only these tickers, merged into the bundle
```

You can also drag Stooq CSV files into the app's manual-import dropzone to override or add a ticker for the current session.

## Data & modeling notes

- **Price-return** — prices exclude dividends, applied consistently to the index and all benchmarks. This is a relative-performance tool, not a total-return calculator.
- **Market-cap weights use fixed (approximate, ~2024–25) share counts**, so they ignore buybacks/issuance over the backtest window.
- **Coverage** — the current bundle has 104 of 105 symbols. Notes:
  - `SPUS` (Sharia-screened S&P 500 benchmark) launched Dec 2019, so it's auto-disabled for lookbacks longer than its ~6.5-year history (e.g. 10y / Max available).
  - `BK` (Bank of NY Mellon) — missing; not carried by Nasdaq's quote service (only Yahoo has it).
  - `LIN` (Linde) — history only from 2023-03, because Nasdaq resets it at Linde's 2023 corporate reorganization.
  - `DOW` (Dow Inc.) — history from 2019-03, which is correct: it spun off from DowDuPont then.

  Backfill `BK`/`LIN` from Yahoo with `node src/fetch-data.js --only=BK,LIN`.

## Project layout

No build step — the browser loads these files directly via classic `<script>`/`<link>` tags (so it also works over `file://`):

```
src/
  index-simulator.html   # markup + <link>/<script> tags (no logic of its own)
  styles.css             # all styling (dark theme via CSS variables)
  universe.js            # S&P 100 ticker list + benchmarks (shared with the Node tooling)
  engine.js              # the index simulation + statistics — pure functions, the one copy
  app.js                 # stock picker, data loading, run/render, DOM wiring
  data.js                # generated price bundle (window.PRICE_DATA)
  fetch-data.js          # Node script that builds the price bundle
  engine.test.js         # tests — imports engine.js directly
```

## Tests

The core engine (index simulation + statistics) has a dependency-free test suite:

```bash
node src/engine.test.js     # prints PASS/FAIL per assertion; exits non-zero on failure
```

## Disclaimer

This is a modeling and educational tool, **not investment advice**. Past performance does not predict future results.
