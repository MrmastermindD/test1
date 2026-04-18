// Farcaster Mini App manifest.
// https://miniapps.farcaster.xyz/docs/specification#farcaster-manifest
//
// The `accountAssociation` block must be signed by the owning Farcaster
// account to verify domain ownership before distribution. Generate via
// the Farcaster Dev Tools; for now we serve an unsigned manifest that
// still works in local preview and staging.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "ETH Liq Radar";
  return NextResponse.json({
    accountAssociation: {
      header: process.env.FARCASTER_MANIFEST_HEADER ?? "",
      payload: process.env.FARCASTER_MANIFEST_PAYLOAD ?? "",
      signature: process.env.FARCASTER_MANIFEST_SIGNATURE ?? "",
    },
    frame: {
      version: "1",
      name: APP_NAME,
      iconUrl: `${APP_URL}/icon.png`,
      homeUrl: APP_URL,
      imageUrl: `${APP_URL}/og.png`,
      splashImageUrl: `${APP_URL}/splash.png`,
      splashBackgroundColor: "#0b0f17",
      webhookUrl: `${APP_URL}/api/webhook`,
      subtitle: "ETH liquidation radar",
      description:
        "Read the Binance/CoinGlass ETH liquidation heatmap, compare current price action to 30 days of sweep analogues, and get notified when a move is likely.",
      primaryCategory: "finance",
      tags: ["eth", "trading", "liquidations", "base"],
    },
  });
}
