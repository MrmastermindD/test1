# ETH Liq Radar — Base Mini App

A Farcaster/Base Mini App that:

1. **Reads the ETH liquidation heatmap** (CoinGlass v4 API) and extracts the
   top-intensity "yellow line" price rows over a 24h window, split into
   long-liquidation clusters (below mark) and short-liquidation clusters
   (above mark).
2. **Ingests 30d of Binance USDⓈ-M klines** and scans for historical
   "sweep" setups — bars whose following ~2h produced a >1.2×ATR move that
   pierced a 24h swing high/low (a proxy for the moves that swept historical
   liquidation clusters).
3. **Notifies the user** via Farcaster Mini App push when the current
   feature vector cosine-matches historical pre-sweep states AND mark
   price is within a configurable distance of a live CoinGlass cluster AND
   the implied direction aligns with the cluster's side.
4. **Does not execute trades.** Per product decision, this version is
   signal-only. A `TradingAdapter` interface can be added later once the
   target exchange API is documented.

## Why not scrape Binance directly?

Binance itself does not publish the yellow-line liquidation-heatmap as a
public endpoint — that visualization is produced by third parties
(CoinGlass, Hyblock). We use CoinGlass for the heatmap and Binance's own
futures API (`fapi.binance.com`) for historical klines, open interest,
funding, and mark price.

## Stack

- Next.js 14 App Router
- Coinbase OnchainKit (Base chain)
- Farcaster Mini App manifest + notification webhook
- Vercel Cron (every 5 min) → `/api/cron/check`

## Environment

Copy `.env.example` → `.env.local`:

```
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NEXT_PUBLIC_APP_NAME="ETH Liq Radar"
NEXT_PUBLIC_ONCHAINKIT_API_KEY=...
COINGLASS_API_KEY=...              # required — paid CoinGlass v4 key
CRON_SECRET=change-me               # gate for /api/cron/check
SIGNAL_SIMILARITY_THRESHOLD=0.82    # top-K cosine similarity to fire
SIGNAL_COOLDOWN_MINUTES=30          # debounce per signal
# optional persistent store (Vercel KV / Upstash Redis REST)
KV_REST_API_URL=
KV_REST_API_TOKEN=
# optional signed manifest for Farcaster distribution
FARCASTER_MANIFEST_HEADER=
FARCASTER_MANIFEST_PAYLOAD=
FARCASTER_MANIFEST_SIGNATURE=
```

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Main UI — live signal + heatmap |
| `/api/heatmap` | CoinGlass heatmap + extracted yellow levels |
| `/api/klines` | Binance 30d klines (debug) |
| `/api/signals` | Combined payload (heatmap + detector) |
| `/api/signals?mode=history` | Recent signals fired |
| `/api/webhook` | Farcaster `frame_added` / `notifications_*` events |
| `/api/cron/check` | Periodic detector + notifier (cron + auth) |
| `/.well-known/farcaster.json` | Mini App manifest |

## Detector

See `src/lib/patterns.ts`. Cosine similarity over an 8-dim feature vector
(returns, ATR%, volume-z, RSI, distance-to-recent-extremes, body ratio)
against every pre-sweep snapshot in the last 30 days. Fires only when
similarity ≥ threshold AND mark is inside the CoinGlass cluster gate AND
direction is aligned.

## Deployment

```
pnpm install
pnpm dev            # http://localhost:3000
pnpm build && pnpm start
```

On Vercel, set env vars + ensure the cron entry in `vercel.json` is
enabled. For prod notifications, configure Vercel KV so subscribers
survive cold starts.

## Not financial advice

Past analogues do not guarantee future moves. Notifications are
statistical alerts, not buy/sell instructions.
