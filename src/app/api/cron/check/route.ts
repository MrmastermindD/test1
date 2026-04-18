// Periodic check invoked by Vercel cron (every 5 min per vercel.json).
// Computes a fresh signal; if `likely` and we're past cooldown, records it
// and pushes a Farcaster notification to every subscriber.

import { NextResponse } from "next/server";
import { fetchHeatmap, hasCoinglassKey } from "@/lib/coinglass";
import { reconstructHeatmap } from "@/lib/reconstruct";
import { fetchKlinesRange, fetchMarkPrice } from "@/lib/binance";
import { detectSignal } from "@/lib/patterns";
import { notifyAll } from "@/lib/notify";
import { cooldownActive, recordSignal, setCooldown } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const cooldownMin = Number(process.env.SIGNAL_COOLDOWN_MINUTES ?? 30);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const hmPromise = hasCoinglassKey()
    ? fetchHeatmap("ETHUSDT", "24h").catch(() => reconstructHeatmap("ETHUSDT"))
    : reconstructHeatmap("ETHUSDT");
  const [hm, klines, mark] = await Promise.all([
    hmPromise,
    fetchKlinesRange("ETHUSDT", "15m", 30),
    fetchMarkPrice("ETHUSDT"),
  ]);
  const signal = detectSignal({ klines, levels: hm.levels, markPrice: mark });

  if (!signal.likely) return NextResponse.json({ ok: true, fired: false, signal });
  if (cooldownActive()) return NextResponse.json({ ok: true, fired: false, reason: "cooldown", signal });

  const lvl = signal.nearestLevel;
  const dir = signal.direction === "up" ? "▲ sweep up" : "▼ sweep down";
  const title = `ETH ${dir} likely`;
  const body = lvl
    ? `$${mark.toFixed(0)} → ${lvl.side} cluster @ $${lvl.price.toFixed(0)} (${lvl.distancePct.toFixed(2)}%) · sim ${(signal.similarity * 100).toFixed(0)}%`
    : `Sim ${(signal.similarity * 100).toFixed(0)}% to ${signal.matchedCount} historical setups`;

  const { sent, failed } = await notifyAll({
    title,
    body,
    targetUrl: appUrl,
    notificationId: `eth-sweep-${Math.floor(Date.now() / 60_000)}`,
  });
  await recordSignal({
    id: `${Date.now()}`,
    at: Date.now(),
    direction: signal.direction!,
    price: mark,
    level: lvl?.price ?? 0,
    similarity: signal.similarity,
    rationale: signal.rationale,
  });
  setCooldown(cooldownMin);

  return NextResponse.json({ ok: true, fired: true, sent, failed, signal });
}
