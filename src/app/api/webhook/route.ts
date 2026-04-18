// Farcaster Mini App lifecycle webhook.
//
// Receives events from the user's Farcaster client when they add/remove
// the mini app or toggle notifications. Events we care about:
//   - frame_added           → store { token, url } so we can push
//   - frame_removed         → drop subscriber
//   - notifications_enabled → re-enable + update token
//   - notifications_disabled → mark disabled
//
// The payload is a JFS-signed envelope; for this starter we accept the
// decoded shape. Add signature verification via @farcaster/frame-node
// before going to production.

import { NextResponse } from "next/server";
import { upsertSubscriber, removeSubscriber } from "@/lib/store";

export const dynamic = "force-dynamic";

type Event =
  | { event: "frame_added"; notificationDetails?: { token: string; url: string } }
  | { event: "frame_removed" }
  | { event: "notifications_enabled"; notificationDetails: { token: string; url: string } }
  | { event: "notifications_disabled" };

type Envelope = {
  header?: string;
  payload?: string;
  signature?: string;
  fid?: number;
  event?: Event["event"];
  notificationDetails?: { token: string; url: string };
};

function decode(env: Envelope): { fid: number; evt: Event } | null {
  if (env.fid && env.event) {
    return { fid: env.fid, evt: { event: env.event, notificationDetails: env.notificationDetails } as Event };
  }
  try {
    if (!env.header || !env.payload) return null;
    const header = JSON.parse(Buffer.from(env.header, "base64url").toString()) as { fid: number };
    const payload = JSON.parse(Buffer.from(env.payload, "base64url").toString()) as Event;
    return { fid: header.fid, evt: payload };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as Envelope;
  const decoded = decode(body);
  if (!decoded) return NextResponse.json({ ok: false, error: "invalid envelope" }, { status: 400 });
  const { fid, evt } = decoded;

  switch (evt.event) {
    case "frame_added":
    case "notifications_enabled": {
      const d = evt.notificationDetails;
      if (!d) return NextResponse.json({ ok: true, note: "no notification details" });
      await upsertSubscriber({ fid, token: d.token, url: d.url, enabled: true, addedAt: Date.now() });
      return NextResponse.json({ ok: true });
    }
    case "frame_removed": {
      await removeSubscriber(fid);
      return NextResponse.json({ ok: true });
    }
    case "notifications_disabled": {
      await upsertSubscriber({ fid, token: "", url: "", enabled: false, addedAt: Date.now() });
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ ok: false, error: "unknown event" }, { status: 400 });
}
