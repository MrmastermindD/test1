import { NextResponse } from "next/server";
import { fetchHeatmap, hasCoinglassKey } from "@/lib/coinglass";
import { reconstructHeatmap } from "@/lib/reconstruct";
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
    const hmPromise = hasCoinglassKey()
      ? fetchHeatmap("ETHUSDT", "24h").catch(() => reconstructHeatmap("ETHUSDT"))
      : reconstructHeatmap("ETHUSDT");
    const [hm, klines, mark] = await Promise.all([
      hmPromise,
      fetchKlinesRange("ETHUSDT", "15m", 30),
      fetchMarkPrice("ETHUSDT"),
    ]);
    const signal = detectSignal({ klines, levels: hm.levels, markPrice: mark });
    return NextResponse.json({ markPrice: mark, heatmap: hm, signal });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
