import { NextResponse } from "next/server";
import { fetchHeatmap, hasCoinglassKey } from "@/lib/coinglass";
import { reconstructHeatmap } from "@/lib/reconstruct";
import { demoEnabled, demoHeatmap } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "ETHUSDT";
  const range = (url.searchParams.get("range") ?? "24h") as "12h" | "24h" | "1w" | "1M";
  if (demoEnabled()) return NextResponse.json(demoHeatmap());
  try {
    const hm = hasCoinglassKey()
      ? await fetchHeatmap(symbol, range)
      : await reconstructHeatmap(symbol);
    return NextResponse.json(hm);
  } catch (e) {
    if (hasCoinglassKey()) {
      try {
        return NextResponse.json(await reconstructHeatmap(symbol));
      } catch (e2) {
        return NextResponse.json({ error: (e2 as Error).message }, { status: 502 });
      }
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
