// Binance-only inferred liquidation levels.
//
// When COINGLASS_API_KEY is not set, we still produce plausible "cluster"
// price rows by combining three cheap heuristics over the last 24h of 1m
// Binance klines:
//
//   1. Wick-reversal clusters — price points where the 1m high/low wicked
//      aggressively and reversed. These mark where stops/liquidations
//      actually triggered in the recent past, so they tend to be the same
//      magnets the real heatmap highlights.
//   2. High-volume nodes — quote-volume-weighted price bins (0.1% wide)
//      near mark. Big volume nodes are where positions stack up.
//   3. Round-number magnets — $50 / $100 increments near mark, small weight.
//
// The three scores are normalised and summed, then the top-quantile bins
// become the "yellow lines". This is an approximation, not the real
// CoinGlass heatmap, and the UI labels it as such.

import type { Kline } from "./binance";
import type { HeatCell, HeatLevel, Heatmap } from "./coinglass";
import { fetchKlines, fetchMarkPrice } from "./binance";

const BIN_PCT = 0.001;

function bin(price: number, mark: number): number {
  const pct = Math.round(((price - mark) / mark) / BIN_PCT) * BIN_PCT;
  return Number((mark * (1 + pct)).toFixed(2));
}

function wickScores(klines: Kline[], mark: number): Map<number, number> {
  const m = new Map<number, number>();
  for (const k of klines) {
    const body = Math.abs(k.close - k.open);
    const upper = k.high - Math.max(k.close, k.open);
    const lower = Math.min(k.close, k.open) - k.low;
    const range = Math.max(k.high - k.low, 1e-9);
    if (upper > body * 1.5 && upper / range > 0.55) {
      const p = bin(k.high, mark);
      m.set(p, (m.get(p) ?? 0) + (upper / range) * k.quoteVolume);
    }
    if (lower > body * 1.5 && lower / range > 0.55) {
      const p = bin(k.low, mark);
      m.set(p, (m.get(p) ?? 0) + (lower / range) * k.quoteVolume);
    }
  }
  return m;
}

function volumeNodes(klines: Kline[], mark: number): Map<number, number> {
  const m = new Map<number, number>();
  for (const k of klines) {
    const mid = (k.high + k.low) / 2;
    const p = bin(mid, mark);
    m.set(p, (m.get(p) ?? 0) + k.quoteVolume);
  }
  return m;
}

function roundMagnets(mark: number, range = 0.05): Map<number, number> {
  const m = new Map<number, number>();
  const lo = mark * (1 - range);
  const hi = mark * (1 + range);
  for (const step of [100, 50]) {
    const start = Math.ceil(lo / step) * step;
    for (let p = start; p <= hi; p += step) {
      const b = bin(p, mark);
      const weight = step === 100 ? 1 : 0.5;
      m.set(b, (m.get(b) ?? 0) + weight);
    }
  }
  return m;
}

function normalise(m: Map<number, number>): Map<number, number> {
  const max = Math.max(1e-9, ...m.values());
  return new Map([...m].map(([k, v]) => [k, v / max]));
}

export async function reconstructHeatmap(symbol = "ETHUSDT"): Promise<Heatmap> {
  const [klines, markPrice] = await Promise.all([
    fetchKlines(symbol, "1m", 1440),
    fetchMarkPrice(symbol),
  ]);
  const wicks = normalise(wickScores(klines, markPrice));
  const vols = normalise(volumeNodes(klines, markPrice));
  const rounds = normalise(roundMagnets(markPrice));

  const combined = new Map<number, number>();
  const addAll = (src: Map<number, number>, w: number) => {
    for (const [k, v] of src) combined.set(k, (combined.get(k) ?? 0) + v * w);
  };
  addAll(wicks, 0.55);
  addAll(vols, 0.35);
  addAll(rounds, 0.10);

  const cells: HeatCell[] = [...combined].map(([price, intensity]) => ({
    t: Date.now(),
    price,
    intensity,
  }));

  const sorted = [...combined.values()].sort((a, b) => a - b);
  const cutoff = sorted[Math.floor(sorted.length * 0.85)] ?? 0;
  const hot = [...combined.entries()].filter(([, v]) => v >= cutoff && v > 0);

  const above = hot.filter(([p]) => p > markPrice).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const below = hot.filter(([p]) => p < markPrice).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const toLevel = (p: number, intensity: number, side: "long" | "short"): HeatLevel => ({
    price: p,
    intensity,
    side,
    distancePct: ((p - markPrice) / markPrice) * 100,
  });

  const levels = [
    ...above.map(([p, v]) => toLevel(p, v, "short")),
    ...below.map(([p, v]) => toLevel(p, v, "long")),
  ].sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct));

  return {
    symbol,
    range: "24h",
    markPrice,
    cells,
    levels,
    fetchedAt: Date.now(),
  };
}
