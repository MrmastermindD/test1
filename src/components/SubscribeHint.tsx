"use client";

export function SubscribeHint() {
  return (
    <div className="card col" style={{ gap: 8 }}>
      <div style={{ fontWeight: 600 }}>Get notified</div>
      <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
        Add this mini app to your Farcaster client (Warpcast, Base App) to receive
        a push notification when the detector flags a likely ETH sweep. Your
        client sends a signed webhook to this app with your notification token —
        no wallet signing or trading permissions are requested.
      </div>
    </div>
  );
}
