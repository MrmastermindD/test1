// Historical analogue matching.
//
// Strategy:
//   1. Scan 30d of 15m klines for "sweep" setups — bars whose *next 8* bars
//      (~2h) produce a move >= 1.2 * ATR(14) that pierces a local
//      swing high/low formed in the preceding 24h. These are proxies for the
//      moves that swept historic liquidation clusters.
//   2. For each setup, snapshot the feature vector 30min (2 bars) BEFORE the
//      move — that is the "pre-sweep state".
//   3. To decide if a sweep is likely now, compute the current feature vector
//      and score it against every historical pre-sweep vector (cosine sim).
//   4. If the top-K mean similarity exceeds SIGNAL_SIMILARITY_THRESHOLD AND
//      mark price is within gateDistancePct of a live CoinGlass heat level
//      AND the implied direction matches the analogues' historical direction,
//      emit a signal.

import type { Kline } from "./binance";
import type { HeatLevel } from "./coinglass";
import { atr, cosine, featuresAt, toVector, type Features } from "./features";

export type Setup = {
  t: number;
  direction: "up" | "down";
  magnitude: number;
  vector: number[];
  features: Features;
};

export type SignalInput = {
  klines: Kline[];
  levels: HeatLevel[];
  markPrice: number;
  threshold?: number;
  gateDistancePct?: number;
  topK?: number;
};

export type Signal = {
  likely: boolean;
  direction: "up" | "down" | null;
  similarity: number;
  nearestLevel: HeatLevel | null;
  matchedCount: number;
  analogueCount: number;
  rationale: string;
  features: Features | null;
  at: number;
};

export function scanSetups(klines: Kline[]): Setup[] {
  const out: Setup[] = [];
  const lookahead = 8;
  const swingBars = 96;
  for (let i = swingBars; i < klines.length - lookahead; i++) {
    const k = klines[i];
    const a = atr(klines.slice(0, i + 1), 14);
    if (!isFinite(a) || a <= 0) continue;
    const swing = klines.slice(i - swingBars, i);
    const hi = Math.max(...swing.map((x) => x.high));
    const lo = Math.min(...swing.map((x) => x.low));
    const fwd = klines.slice(i + 1, i + 1 + lookahead);
    const fwdHi = Math.max(...fwd.map((x) => x.high));
    const fwdLo = Math.min(...fwd.map((x) => x.low));
    const threshold = 1.2 * a;
    let direction: "up" | "down" | null = null;
    let magnitude = 0;
    if (fwdHi - k.close >= threshold && fwdHi > hi) { direction = "up"; magnitude = (fwdHi - k.close) / k.close; }
    else if (k.close - fwdLo >= threshold && fwdLo < lo) { direction = "down"; magnitude = (k.close - fwdLo) / k.close; }
    if (!direction) continue;
    const preIdx = i - 2;
    const f = featuresAt(klines, preIdx);
    if (!f) continue;
    out.push({ t: klines[preIdx].openTime, direction, magnitude, vector: toVector(f), features: f });
  }
  return out;
}

export function detectSignal(input: SignalInput): Signal {
  const threshold = input.threshold ?? Number(process.env.SIGNAL_SIMILARITY_THRESHOLD ?? 0.82);
  const gateDistancePct = input.gateDistancePct ?? 1.5;
  const topK = input.topK ?? 8;

  const now = featuresAt(input.klines, input.klines.length - 1);
  const setups = scanSetups(input.klines);
  const nearest = nearestLevel(input.levels, input.markPrice);
  const base: Signal = {
    likely: false,
    direction: null,
    similarity: 0,
    nearestLevel: nearest,
    matchedCount: 0,
    analogueCount: setups.length,
    rationale: "",
    features: now,
    at: Date.now(),
  };
  if (!now || setups.length === 0) return { ...base, rationale: "insufficient history" };

  const nv = toVector(now);
  const scored = setups.map((s) => ({ s, sim: cosine(nv, s.vector) })).sort((a, b) => b.sim - a.sim);
  const top = scored.slice(0, topK);
  const avg = top.reduce((a, b) => a + b.sim, 0) / top.length;
  const upVotes = top.filter((x) => x.s.direction === "up").length;
  const downVotes = top.length - upVotes;
  const direction: "up" | "down" = upVotes >= downVotes ? "up" : "down";

  const gated = nearest && Math.abs(nearest.distancePct) <= gateDistancePct;
  const aligned =
    !nearest ||
    (direction === "up" && nearest.side === "short") ||
    (direction === "down" && nearest.side === "long");

  const likely = avg >= threshold && !!gated && aligned;
  const rationale = [
    `top-${topK} avg similarity ${(avg * 100).toFixed(1)}% vs threshold ${(threshold * 100).toFixed(0)}%`,
    nearest ? `nearest ${nearest.side} cluster ${nearest.price.toFixed(2)} (${nearest.distancePct.toFixed(2)}%)` : "no live cluster within range",
    `analogues: ${upVotes} up / ${downVotes} down`,
    gated ? "within cluster gate" : `outside ${gateDistancePct}% gate`,
    aligned ? "direction aligned with cluster side" : "direction not aligned",
  ].join(" · ");

  return { ...base, likely, direction, similarity: avg, matchedCount: top.length, rationale };
}

export function nearestLevel(levels: HeatLevel[], mark: number): HeatLevel | null {
  if (levels.length === 0) return null;
  return [...levels].sort((a, b) => Math.abs(a.price - mark) - Math.abs(b.price - mark))[0];
}
