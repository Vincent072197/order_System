import type { NextRequest } from "next/server";

// Pull a best-effort client IP. In real prod you'd terminate TLS at a known
// reverse proxy (Cloudflare / nginx) and trust ONLY that proxy's header.
// Trusting an X-Forwarded-For value sent by an arbitrary client is an
// IP-spoof for free, so this is an honest best-effort, not a security claim.
export function extractClientIp(request: NextRequest): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    // Left-most is the original client per the convention; rightmost is the
    // immediate peer. Both are attacker-controlled if you don't trust the
    // upstream chain.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return null;
}
