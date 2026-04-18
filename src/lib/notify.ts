// Farcaster Mini App notifications.
//
// When a user adds the mini app, the client POSTs `frame_added` to our
// webhook with `notificationDetails: { token, url }`. To push a notification,
// we POST to that `url`:
//   { notificationId, title, body, targetUrl, tokens: [token, ...] }
// The client returns { result: { successfulTokens, invalidTokens, rateLimitedTokens } }.
// Reference: https://miniapps.farcaster.xyz/docs/sdk/context#notifications
//
// We batch per notification URL because the spec supports up to 100 tokens
// per call per URL.

import { listSubscribers, type Subscriber } from "./store";

export type NotifyArgs = {
  title: string;
  body: string;
  targetUrl: string;
  notificationId?: string;
};

export async function notifyAll(args: NotifyArgs): Promise<{ sent: number; failed: number }> {
  const subs = await listSubscribers();
  if (subs.length === 0) return { sent: 0, failed: 0 };
  const byUrl = new Map<string, Subscriber[]>();
  for (const s of subs) {
    if (!byUrl.has(s.url)) byUrl.set(s.url, []);
    byUrl.get(s.url)!.push(s);
  }
  let sent = 0, failed = 0;
  for (const [url, group] of byUrl) {
    for (let i = 0; i < group.length; i += 100) {
      const chunk = group.slice(i, i + 100);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            notificationId: args.notificationId ?? `sig-${Date.now()}`,
            title: args.title.slice(0, 32),
            body: args.body.slice(0, 128),
            targetUrl: args.targetUrl,
            tokens: chunk.map((s) => s.token),
          }),
        });
        if (res.ok) sent += chunk.length; else failed += chunk.length;
      } catch {
        failed += chunk.length;
      }
    }
  }
  return { sent, failed };
}
