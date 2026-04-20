// Demo-mode synthetic data. Only used when DEMO_MODE=1.
// Generates a deterministic ETH walk + plausible heat clusters so the UI
// and detector can run without hitting any external API. The shape matches
// the real fetchers so no other code has to branch.

import type { Kline } from "./binance";
import type { HeatCell, HeatLevel, Heatmap } from "./coinglass";

export function demoEnabled(): boolean {
  return process.env.DEMO_MODE === "1";
}

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoKlines(days = 30, intervalMin = 15): Kline[] {
  const count = Math.ceil((days * 1440) / intervalMin);
  const rand = mulberry32(42);
  const nowMs = Date.now();
  const stepMs = intervalMin * 60_000;
  const out: Kline[] = [];
  let price = 3200;
  for (let i = count - 1; i >= 0; i--) {
    const openTime = nowMs - (i + 1) * stepMs;
    const drift = Math.sin((count - i) / 96) * 4;
    const shock = (rand() - 0.5) * 18;
    const open = price;
    const close = Math.max(1500, open + drift + shock);
    const high = Math.max(open, close) + rand() * 12;
    const low = Math.min(open, close) - rand() * 12;
    const volume = 500 + rand() * 4000 + (Math.abs(shock) > 14 ? 8000 : 0);
    out.push({
      openTime,
      open,
      high,
      low,
      close,
      volume,
      closeTime: openTime + stepMs - 1,
      quoteVolume: volume * ((open + close) / 2),
      trades: Math.floor(volume / 5),
    });
    price = close;
  }
  return out;
}

export function demoMarkPrice(): number {
  const k = demoKlines(1, 15);
  return k.at(-1)!.close;
}

export function demoHeatmap(): Heatmap {
  const mark = demoMarkPrice();
  const cells: HeatCell[] = [];
  const levels: HeatLevel[] = [];
  const now = Date.now();
  const rand = mulberry32(7);
  const shortLevels = [1.4, 2.1, 3.2, 4.8].map((pct) => mark * (1 + pct / 100));
  const longLevels = [1.1, 2.4, 3.6, 5.1].map((pct) => mark * (1 - pct / 100));

  for (const p of shortLevels) {
    const intensity = 0.6 + rand() * 0.4;
    levels.push({
      price: Number(p.toFixed(2)),
      intensity,
      side: "short",
      distancePct: ((p - mark) / mark) * 100,
    });
  }
  for (const p of longLevels) {
    const intensity = 0.55 + rand() * 0.4;
    levels.push({
      price: Number(p.toFixed(2)),
      intensity,
      side: "long",
      distancePct: ((p - mark) / mark) * 100,
    });
  }
  for (const l of levels) {
    for (let t = 0; t < 24; t++) {
      cells.push({ t: now - t * 3600_000, price: l.price, intensity: l.intensity * (0.6 + rand() * 0.4) });
    }
  }
  levels.sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct));
  return {
    symbol: "ETHUSDT",
    range: "24h",
    markPrice: mark,
    cells,
    levels,
    fetchedAt: now,
    source: "binance-inferred",
  };
}
