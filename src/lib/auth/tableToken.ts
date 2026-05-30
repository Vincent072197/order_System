import { createHmac, timingSafeEqual } from "node:crypto";
import { loadEnv } from "@/src/lib/env";

// ---------------------------------------------------------------------------
// P4b — HMAC-signed table session token.
//
// The printed QR stays static (`/table/<uuid>`). When a customer lands on that
// page, proxy.ts mints one of these tokens into an httpOnly cookie; the order
// API then requires a valid, unexpired token whose tableId matches the order.
// This file has NO `pg`/DB dependency so proxy.ts can import it.
//
// Token format (compact, URL/cookie-safe):  <tableId>.<expEpochMs>.<hmacB64url>
// hmac = HMAC-SHA256("<tableId>.<expEpochMs>", TABLE_TOKEN_SECRET)
// ---------------------------------------------------------------------------

export const TABLE_TOKEN_COOKIE = "table_token";

// A dining session — long enough to cover a meal without re-minting, short
// enough that a leaked token doesn't live forever. Re-minted on every page load.
export const TABLE_TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function secret(): string {
  return loadEnv().TABLE_TOKEN_SECRET;
}

export function signTableToken(
  tablePublicId: string,
  now: number = Date.now(),
): string {
  const exp = now + TABLE_TOKEN_TTL_MS;
  const payload = `${tablePublicId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** Returns the table public id if the token is well-formed, unexpired and the
 *  signature verifies; otherwise null. Constant-time signature comparison. */
export function verifyTableToken(
  token: string | undefined | null,
  now: number = Date.now(),
): { tableId: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [tableId, expStr, sig] = parts;
  if (!tableId || !expStr || !sig) return null;

  const expected = createHmac("sha256", secret())
    .update(`${tableId}.${expStr}`)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return null;

  return { tableId };
}
