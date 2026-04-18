"use client";

import { useEffect, useState } from "react";
import { HeatmapPanel } from "@/components/HeatmapPanel";
import { SignalCard } from "@/components/SignalCard";
import { SubscribeHint } from "@/components/SubscribeHint";
import type { Heatmap } from "@/lib/coinglass";
import type { Signal } from "@/lib/patterns";

type Payload = { markPrice: number; heatmap: Heatmap; signal: Signal };

export default function Page() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/signals", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (json.error) setErr(json.error); else { setErr(null); setData(json); }
      } catch (e) { if (alive) setErr((e as Error).message); }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>ETH Liq Radar</div>
        <div className="muted" style={{ fontSize: 13 }}>
          CoinGlass yellow-line clusters · Binance 30d analogue matcher · Farcaster push
        </div>
      </header>

      {err && (
        <div className="card" style={{ borderColor: "var(--red)", marginBottom: 12 }}>
          <div style={{ color: "var(--red)", fontWeight: 600, marginBottom: 4 }}>Data error</div>
          <div className="muted" style={{ fontSize: 12 }}>{err}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Set <code>COINGLASS_API_KEY</code> in your env and redeploy.
          </div>
        </div>
      )}

      <div className="col">
        <SignalCard signal={data?.signal ?? null} />
        <HeatmapPanel data={data?.heatmap ?? null} />
        <SubscribeHint />
      </div>

      <footer className="muted" style={{ fontSize: 11, marginTop: 24, lineHeight: 1.6 }}>
        Informational only — no order execution. This app surfaces statistical
        analogues to past liquidation sweeps; it is not financial advice and
        past analogues do not guarantee future moves.
      </footer>
    </main>
  );
}
