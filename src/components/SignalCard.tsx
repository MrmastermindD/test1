"use client";

import type { Signal } from "@/lib/patterns";

export function SignalCard({ signal }: { signal: Signal | null }) {
  if (!signal) return <div className="card muted">Analysing 30d history…</div>;
  const color = signal.likely ? "var(--yellow)" : "var(--muted)";
  const arrow = signal.direction === "up" ? "▲" : signal.direction === "down" ? "▼" : "—";
  return (
    <div className="card col">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color }}>
          {arrow} {signal.likely ? "Sweep likely" : "No strong setup"}
        </div>
        <span className="pill">
          sim {(signal.similarity * 100).toFixed(1)}% · {signal.matchedCount}/{signal.analogueCount}
        </span>
      </div>
      <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>{signal.rationale}</div>
      {signal.nearestLevel && (
        <div style={{ fontSize: 13 }}>
          Nearest {signal.nearestLevel.side} cluster @ ${signal.nearestLevel.price.toFixed(2)} (
          {signal.nearestLevel.distancePct.toFixed(2)}%)
        </div>
      )}
    </div>
  );
}
