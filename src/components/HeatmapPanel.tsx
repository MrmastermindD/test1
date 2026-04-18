"use client";

import type { Heatmap, HeatLevel } from "@/lib/coinglass";

export function HeatmapPanel({ data }: { data: Heatmap | null }) {
  if (!data) return <div className="card muted">Loading heatmap…</div>;
  const longs = data.levels.filter((l) => l.side === "long");
  const shorts = data.levels.filter((l) => l.side === "short");
  const maxI = Math.max(1, ...data.levels.map((l) => l.intensity));

  return (
    <div className="card col">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>ETH liquidation heat · 24h</div>
          <div className="muted" style={{ fontSize: 12 }}>
            mark ${data.markPrice.toFixed(2)} · {data.levels.length} hot rows
          </div>
        </div>
        <span className="pill">CoinGlass</span>
      </div>
      <div className="grid">
        <LevelList title="Short cluster (above)" side="short" levels={shorts} maxI={maxI} />
        <LevelList title="Long cluster (below)" side="long" levels={longs} maxI={maxI} />
      </div>
    </div>
  );
}

function LevelList({
  title, side, levels, maxI,
}: { title: string; side: "long" | "short"; levels: HeatLevel[]; maxI: number }) {
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="muted" style={{ fontSize: 12 }}>{title}</div>
      {levels.length === 0 && <div className="muted" style={{ fontSize: 12 }}>no hot rows in range</div>}
      {levels.map((l) => {
        const w = Math.max(6, (l.intensity / maxI) * 100);
        return (
          <div key={l.price} style={{ position: "relative", padding: "6px 8px", borderRadius: 6, background: "var(--panel-2)", overflow: "hidden" }}>
            <div style={{
              position: "absolute", inset: 0, width: `${w}%`,
              background: "linear-gradient(90deg, rgba(255,213,74,0.35), rgba(255,213,74,0.08))",
            }} />
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 8, fontVariantNumeric: "tabular-nums" }}>
              <span>${l.price.toFixed(2)}</span>
              <span className={`pill ${side}`}>{l.distancePct >= 0 ? "+" : ""}{l.distancePct.toFixed(2)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
