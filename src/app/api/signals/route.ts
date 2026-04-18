import { NextResponse } from "next/server";
import { fetchHeatmap } from "@/lib/coinglass";
import { fetchKlinesRange, fetchMarkPrice } from "@/lib/binance";
import { detectSignal } from "@/lib/patterns";
import { listSignals } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  if (mode === "history") {
    return NextResponse.json({ signals: await listSignals() });
  }
  try {
    const [hm, klines, mark] = await Promise.all([
      fetchHeatmap("ETHUSDT", "24h").catch((e) => ({ error: (e as Error).message, levels: [], cells: [], markPrice: 0, fetchedAt: Date.now(), symbol: "ETHUSDT", range: "24h" as const })),
      fetchKlinesRange("ETHUSDT", "15m", 30),
      fetchMarkPrice("ETHUSDT"),
    ]);
    const levels = "levels" in hm ? hm.levels : [];
    const signal = detectSignal({ klines, levels, markPrice: mark });
    return NextResponse.json({ markPrice: mark, heatmap: hm, signal });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
