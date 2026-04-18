import { NextResponse } from "next/server";
import { fetchKlinesRange } from "@/lib/binance";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "ETHUSDT";
  const interval = (url.searchParams.get("interval") ?? "15m") as "15m" | "1h";
  const days = Math.min(Number(url.searchParams.get("days") ?? 30), 60);
  try {
    const k = await fetchKlinesRange(symbol, interval, days);
    return NextResponse.json({ symbol, interval, days, count: k.length, klines: k });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
