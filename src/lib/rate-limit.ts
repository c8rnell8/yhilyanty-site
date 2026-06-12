import { NextResponse } from "next/server";

/** Sliding-window limiter, in memory. One next-server process serves the
 *  whole site, so this is enough to stop abuse even when nginx isn't in
 *  front (local runs, future hosts). State resets on restart - fine. */

const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

export function rateLimit(
  req: Request,
  bucket: string,
  max: number,
  windowSec: number,
): NextResponse | null {
  const now = Date.now();
  const key = `${bucket}:${clientIp(req)}`;
  const cutoff = now - windowSec * 1000;

  let times = hits.get(key);
  if (!times) {
    times = [];
    hits.set(key, times);
  }
  while (times.length && times[0] < cutoff) times.shift();

  if (times.length >= max) {
    const retryAfter = Math.ceil((times[0] + windowSec * 1000 - now) / 1000);
    return NextResponse.json(
      { error: "Забагато запитів, спробуй трохи пізніше." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfter)) } },
    );
  }
  times.push(now);

  // Don't let the map grow without bound under a flood of spoofed IPs.
  if (hits.size > 10000) {
    for (const [k, v] of hits) {
      if (!v.length || v[v.length - 1] < cutoff) hits.delete(k);
      if (hits.size <= 5000) break;
    }
  }
  return null;
}
