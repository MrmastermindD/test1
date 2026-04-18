// Subscriber + signal-history store.
//
// Dev/serverless-ephemeral default: an in-memory map. For production,
// set KV_REST_API_URL + KV_REST_API_TOKEN (Vercel KV / Upstash Redis)
// and the adapter below will persist. Keep the read/write API stable so
// the rest of the app doesn't care which backend is active.

export type Subscriber = {
  fid: number;
  token: string;
  url: string;
  enabled: boolean;
  addedAt: number;
};

export type SignalRecord = {
  id: string;
  at: number;
  direction: "up" | "down";
  price: number;
  level: number;
  similarity: number;
  rationale: string;
};

const mem = {
  subs: new Map<number, Subscriber>(),
  signals: [] as SignalRecord[],
  cooldownUntil: 0,
};

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kv<T>(cmd: string[], fallback: T): Promise<T> {
  if (!KV_URL || !KV_TOKEN) return fallback;
  const res = await fetch(`${KV_URL}/${cmd.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) return fallback;
  const j = (await res.json()) as { result: T };
  return j.result;
}

export async function upsertSubscriber(s: Subscriber): Promise<void> {
  mem.subs.set(s.fid, s);
  if (KV_URL && KV_TOKEN) await kv(["set", `sub:${s.fid}`, JSON.stringify(s)], null);
}

export async function removeSubscriber(fid: number): Promise<void> {
  mem.subs.delete(fid);
  if (KV_URL && KV_TOKEN) await kv(["del", `sub:${fid}`], null);
}

export async function listSubscribers(): Promise<Subscriber[]> {
  if (!KV_URL || !KV_TOKEN) return [...mem.subs.values()].filter((s) => s.enabled);
  const keys = await kv<string[]>(["keys", "sub:*"], []);
  const out: Subscriber[] = [];
  for (const key of keys) {
    const v = await kv<string | null>(["get", key], null);
    if (v) {
      try { const s = JSON.parse(v) as Subscriber; if (s.enabled) out.push(s); } catch {}
    }
  }
  return out;
}

export async function recordSignal(r: SignalRecord): Promise<void> {
  mem.signals.unshift(r);
  mem.signals = mem.signals.slice(0, 200);
}

export async function listSignals(): Promise<SignalRecord[]> {
  return mem.signals;
}

export function cooldownActive(): boolean {
  return Date.now() < mem.cooldownUntil;
}

export function setCooldown(minutes: number): void {
  mem.cooldownUntil = Date.now() + minutes * 60_000;
}
