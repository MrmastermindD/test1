// Binance USDⓈ-M futures public data client.
// No key required — all endpoints used are public.

const FAPI = "https://fapi.binance.com";

export type Kline = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
};

export async function fetchKlines(
  symbol = "ETHUSDT",
  interval: "1m" | "5m" | "15m" | "1h" | "4h" = "15m",
  limit = 1000,
  endTime?: number,
): Promise<Kline[]> {
  const qs = new URLSearchParams({ symbol, interval, limit: String(limit) });
  if (endTime) qs.set("endTime", String(endTime));
  const res = await fetch(`${FAPI}/fapi/v1/klines?${qs}`, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);
  const rows = (await res.json()) as unknown[][];
  return rows.map((r) => ({
    openTime: r[0] as number,
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
    closeTime: r[6] as number,
    quoteVolume: Number(r[7]),
    trades: r[8] as number,
  }));
}

// 30 days of 15m klines = 2880 candles. Binance caps limit at 1500, so we
// page backwards from now until we have the requested window.
export async function fetchKlinesRange(
  symbol: string,
  interval: "15m" | "1h" = "15m",
  days = 30,
): Promise<Kline[]> {
  const perMs = interval === "15m" ? 15 * 60_000 : 60 * 60_000;
  const need = Math.ceil((days * 86_400_000) / perMs);
  const out: Kline[] = [];
  let end: number | undefined = undefined;
  while (out.length < need) {
    const batch = await fetchKlines(symbol, interval, 1500, end);
    if (batch.length === 0) break;
    out.unshift(...batch);
    end = batch[0].openTime - 1;
    if (batch.length < 1500) break;
  }
  return out.slice(-need);
}

export type OpenInterest = { time: number; sumOpenInterest: number; sumOpenInterestValue: number };
export async function fetchOpenInterestHist(
  symbol = "ETHUSDT",
  period: "5m" | "15m" | "1h" = "15m",
  limit = 500,
): Promise<OpenInterest[]> {
  const qs = new URLSearchParams({ symbol, period, limit: String(limit) });
  const res = await fetch(`${FAPI}/futures/data/openInterestHist?${qs}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Binance OI ${res.status}`);
  const rows = (await res.json()) as Array<{ timestamp: number; sumOpenInterest: string; sumOpenInterestValue: string }>;
  return rows.map((r) => ({
    time: r.timestamp,
    sumOpenInterest: Number(r.sumOpenInterest),
    sumOpenInterestValue: Number(r.sumOpenInterestValue),
  }));
}

export type Funding = { time: number; fundingRate: number };
export async function fetchFundingHist(symbol = "ETHUSDT", limit = 500): Promise<Funding[]> {
  const qs = new URLSearchParams({ symbol, limit: String(limit) });
  const res = await fetch(`${FAPI}/fapi/v1/fundingRate?${qs}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Binance funding ${res.status}`);
  const rows = (await res.json()) as Array<{ fundingTime: number; fundingRate: string }>;
  return rows.map((r) => ({ time: r.fundingTime, fundingRate: Number(r.fundingRate) }));
}

export async function fetchMarkPrice(symbol = "ETHUSDT"): Promise<number> {
  const res = await fetch(`${FAPI}/fapi/v1/premiumIndex?symbol=${symbol}`, { next: { revalidate: 5 } });
  if (!res.ok) throw new Error(`Binance mark ${res.status}`);
  const j = (await res.json()) as { markPrice: string };
  return Number(j.markPrice);
}
