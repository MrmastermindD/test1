import { NextResponse } from "next/server";
import { fetchHeatmap } from "@/lib/coinglass";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "ETHUSDT";
  const range = (url.searchParams.get("range") ?? "24h") as "12h" | "24h" | "1w" | "1M";
  try {
    const hm = await fetchHeatmap(symbol, range);
    return NextResponse.json(hm);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
