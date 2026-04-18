import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "ETH Liq Radar";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Base mini app that reads ETH liquidation heatmaps, matches current price action to 30d historical sweep analogues, and pushes notifications when a move is likely.",
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: `${APP_URL}/og.png`,
      button: {
        title: "Open Radar",
        action: {
          type: "launch_frame",
          name: APP_NAME,
          url: APP_URL,
          splashImageUrl: `${APP_URL}/splash.png`,
          splashBackgroundColor: "#0b0f17",
        },
      },
    }),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
