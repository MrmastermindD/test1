import type { Kline } from "./binance";

export type Features = {
  ret1h: number;
  ret4h: number;
  atrPct: number;
  volZ: number;
  rsi: number;
  distUpperPct: number;
  distLowerPct: number;
  bodyRatio: number;
};

export function sma(arr: number[], n: number): number {
  if (arr.length < n) return NaN;
  let s = 0;
  for (let i = arr.length - n; i < arr.length; i++) s += arr[i];
  return s / n;
}

export function stdev(arr: number[], n: number): number {
  if (arr.length < n) return NaN;
  const slice = arr.slice(-n);
  const m = slice.reduce((a, b) => a + b, 0) / n;
  const v = slice.reduce((a, b) => a + (b - m) ** 2, 0) / n;
  return Math.sqrt(v);
}

export function atr(klines: Kline[], n = 14): number {
  if (klines.length < n + 1) return NaN;
  const trs: number[] = [];
  for (let i = klines.length - n; i < klines.length; i++) {
    const k = klines[i];
    const p = klines[i - 1];
    trs.push(Math.max(k.high - k.low, Math.abs(k.high - p.close), Math.abs(k.low - p.close)));
  }
  return trs.reduce((a, b) => a + b, 0) / n;
}

export function rsi(closes: number[], n = 14): number {
  if (closes.length < n + 1) return NaN;
  let gains = 0, losses = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  const rs = losses === 0 ? 100 : gains / losses;
  return 100 - 100 / (1 + rs);
}

export function featuresAt(klines: Kline[], idx: number): Features | null {
  if (idx < 96) return null;
  const window = klines.slice(0, idx + 1);
  const closes = window.map((k) => k.close);
  const vols = window.map((k) => k.volume);
  const close = closes.at(-1)!;
  const ret1h = (close - closes.at(-5)!) / closes.at(-5)!;
  const ret4h = (close - closes.at(-17)!) / closes.at(-17)!;
  const a = atr(window, 14);
  const vMean = sma(vols, 96);
  const vStd = stdev(vols, 96);
  const volZ = vStd > 0 ? (vols.at(-1)! - vMean) / vStd : 0;
  const r = rsi(closes, 14);
  const recent = window.slice(-96);
  const hi = Math.max(...recent.map((k) => k.high));
  const lo = Math.min(...recent.map((k) => k.low));
  const k = window.at(-1)!;
  const body = Math.abs(k.close - k.open);
  const range = Math.max(k.high - k.low, 1e-9);
  return {
    ret1h,
    ret4h,
    atrPct: a / close,
    volZ,
    rsi: r,
    distUpperPct: (hi - close) / close,
    distLowerPct: (close - lo) / close,
    bodyRatio: body / range,
  };
}

export function toVector(f: Features): number[] {
  return [f.ret1h * 50, f.ret4h * 25, f.atrPct * 200, f.volZ, (f.rsi - 50) / 20, f.distUpperPct * 50, f.distLowerPct * 50, f.bodyRatio * 2];
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}
