// CoinGlass liquidation heatmap client.
//
// The "yellow lines" on the CoinGlass ETH heatmap correspond to price rows
// whose aggregate projected-liquidation intensity is in the top quantile.
// CoinGlass exposes this via their v4 API (paid key required). Endpoint path
// and field names match the public docs at https://docs.coinglass.com as of
// 2026-04; adjust SYMBOL/RANGE if your tier uses different params.

const CG_BASE = "https://open-api-v4.coinglass.com";
const HEATMAP_PATH = "/api/futures/liquidation/heatmap/model2";

export type HeatCell = { t: number; price: number; intensity: number };
export type HeatLevel = {
  price: number;
  intensity: number;
  side: "long" | "short";
  distancePct: number;
};
export type Heatmap = {
  symbol: string;
  range: string;
  markPrice: number;
  cells: HeatCell[];
  levels: HeatLevel[];
  fetchedAt: number;
};

type CgResp = {
  code?: string | number;
  msg?: string;
  data?: {
    prices?: number[];
    y?: number[];
    x?: number[];
    times?: number[];
    liq?: Array<[number, number, number]>;
    data?: Array<[number, number, number]>;
    markPrice?: number;
    price?: number;
  };
};

function apiKey(): string {
  const k = process.env.COINGLASS_API_KEY;
  if (!k) throw new Error("COINGLASS_API_KEY is not set");
  return k;
}

export async function fetchHeatmap(
  symbol = "ETHUSDT",
  range: "12h" | "24h" | "1w" | "1M" = "24h",
): Promise<Heatmap> {
  const url = `${CG_BASE}${HEATMAP_PATH}?symbol=${symbol}&range=${range}`;
  const res = await fetch(url, {
    headers: { accept: "application/json", "CG-API-KEY": apiKey() },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`CoinGlass ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as CgResp;
  if (!json.data) throw new Error(`CoinGlass empty: ${json.msg ?? "unknown"}`);

  const prices = json.data.prices ?? json.data.y ?? [];
  const times = json.data.times ?? json.data.x ?? [];
  const raw = json.data.liq ?? json.data.data ?? [];
  const markPrice = json.data.markPrice ?? json.data.price ?? prices[Math.floor(prices.length / 2)] ?? 0;

  const cells: HeatCell[] = raw
    .map(([xi, yi, v]) => ({
      t: times[xi] ?? xi,
      price: prices[yi] ?? yi,
      intensity: Number(v) || 0,
    }))
    .filter((c) => c.price > 0 && c.intensity > 0);

  return {
    symbol,
    range,
    markPrice,
    cells,
    levels: extractYellowLevels(cells, markPrice),
    fetchedAt: Date.now(),
  };
}

// Collapse the time axis and pick the top-quantile price rows — the
// "yellow heat lines". Above mark = short liquidations, below = long.
export function extractYellowLevels(
  cells: HeatCell[],
  markPrice: number,
  quantile = 0.9,
  maxPerSide = 6,
): HeatLevel[] {
  if (cells.length === 0 || markPrice <= 0) return [];
  const byPrice = new Map<number, number>();
  for (const c of cells) byPrice.set(c.price, (byPrice.get(c.price) ?? 0) + c.intensity);
  const rows = [...byPrice.entries()].map(([price, intensity]) => ({ price, intensity }));
  if (rows.length === 0) return [];

  const sorted = [...rows].sort((a, b) => a.intensity - b.intensity);
  const cutoff = sorted[Math.floor(sorted.length * quantile)]?.intensity ?? 0;
  const hot = rows.filter((r) => r.intensity >= cutoff);

  const above = hot.filter((r) => r.price > markPrice).sort((a, b) => b.intensity - a.intensity).slice(0, maxPerSide);
  const below = hot.filter((r) => r.price < markPrice).sort((a, b) => b.intensity - a.intensity).slice(0, maxPerSide);

  const toLevel = (r: { price: number; intensity: number }, side: "long" | "short"): HeatLevel => ({
    price: r.price,
    intensity: r.intensity,
    side,
    distancePct: ((r.price - markPrice) / markPrice) * 100,
  });

  return [...above.map((r) => toLevel(r, "short")), ...below.map((r) => toLevel(r, "long"))].sort(
    (a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct),
  );
}
