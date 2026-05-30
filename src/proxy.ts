import { NextResponse, type NextRequest } from "next/server";
import { take } from "@/src/lib/rateLimit";
import { extractClientIp } from "@/src/lib/security";
import { assertProductionSecrets, loadEnv } from "@/src/lib/env";
import {
  TABLE_TOKEN_COOKIE,
  TABLE_TOKEN_TTL_MS,
  signTableToken,
} from "@/src/lib/auth/tableToken";

// Cookie / header names duplicated here so proxy.ts has no dependency on
// modules that pull in `pg`. Keep in sync with src/lib/auth/sessions.ts.
// (tableToken.ts is pg-free, so it's safe to import directly above.)
const SESSION_COOKIE_NAME = "staff_session";
const CSRF_COOKIE_NAME = "staff_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

// Matches a customer table landing: /table/<uuid> (no trailing segments).
const TABLE_PATH_RE =
  /^\/table\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

// Next.js 16 renamed `middleware.ts` to `proxy.ts`. Default runtime is Node.js.
// We use Node features (`crypto.randomUUID`, shared in-memory Map for rate
// limiting). Don't add a `runtime` config — Next will throw.

const env = loadEnv();
const isProd = env.NODE_ENV === "production";

// Same-origin allow-list for state-changing requests. Empty list means we
// only allow same-origin (no cross-origin POSTs). For dev we trust localhost.
const ALLOWED = new Set<string>([
  ...env.ALLOWED_ORIGINS,
]);

function buildCsp(nonce: string): string {
  // Strict-ish CSP. We allow 'unsafe-inline' for styles because Tailwind v4
  // injects inline style attributes; everything else is gated by nonce.
  // Tighten further once we audit our inline style usage.
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };
  if (isProd) {
    directives["upgrade-insecure-requests"] = [];
  }
  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}

function applySecurityHeaders(res: NextResponse, nonce: string) {
  res.headers.set("Content-Security-Policy", buildCsp(nonce));
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (isProd) {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
}

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(request: NextRequest) {
  assertProductionSecrets();
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // 1) Same-origin / Origin header check for state-changing API calls.
  if (isApi && STATE_CHANGING.has(request.method)) {
    const origin = request.headers.get("origin");
    const selfOrigin = request.nextUrl.origin;
    const allowed =
      // same-origin (browsers always send Origin on cross-origin POST; same-
      // origin browsers send it too in modern Chrome/Firefox/Safari)
      origin === selfOrigin ||
      (origin && ALLOWED.has(origin));
    if (!allowed) {
      return NextResponse.json(
        { error: "Cross-origin request rejected" },
        { status: 403 },
      );
    }
  }

  // 2) CSRF double-submit check on state-changing /api/staff/* requests when
  //    a session cookie is present. The login endpoint is exempt (no cookie
  //    yet, but it has its own per-IP rate limit below).
  if (
    isApi &&
    STATE_CHANGING.has(request.method) &&
    pathname.startsWith("/api/staff/") &&
    pathname !== "/api/staff/auth/login"
  ) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
      const headerToken = request.headers.get(CSRF_HEADER_NAME);
      if (
        !cookieToken ||
        !headerToken ||
        cookieToken.length !== headerToken.length ||
        cookieToken !== headerToken
      ) {
        return NextResponse.json(
          { error: "CSRF token missing or invalid" },
          { status: 403 },
        );
      }
    }
  }

  // 3) Rate limit on /api/*. Speed-bump only — keyed on best-effort IP.
  if (isApi) {
    const ip = extractClientIp(request) ?? "unknown";
    const isLogin = pathname === "/api/staff/auth/login";
    const isOrders = pathname.startsWith("/api/orders");
    const bucket = isLogin ? "login" : isOrders ? "orders" : "api";
    const key = `${ip}:${bucket}`;
    const limit = isLogin
      ? { refillPerSecond: 0.2, capacity: 5 } // brute-force speed bump
      : isOrders
        ? { refillPerSecond: 0.5, capacity: 5 }
        : { refillPerSecond: 5, capacity: 30 };
    const r = take(key, limit);
    if (!r.ok) {
      const res = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      res.headers.set("Retry-After", String(r.retryAfterSeconds));
      return res;
    }
  }

  // 3) Generate a per-request nonce and pass it down via request header so
  //    server components can read it from headers() and attach it to inline
  //    scripts they intentionally render.
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-csp-nonce", nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(res, nonce);

  // P4b: landing on a table page mints/refreshes a signed table-session token.
  // The order API requires it, so a raw table UUID alone can no longer submit.
  const tableMatch =
    request.method === "GET" ? TABLE_PATH_RE.exec(pathname) : null;
  if (tableMatch) {
    res.cookies.set({
      name: TABLE_TOKEN_COOKIE,
      value: signTableToken(tableMatch[1]),
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(TABLE_TOKEN_TTL_MS / 1000),
    });
  }

  return res;
}

export const config = {
  matcher: [
    // run on everything except next-internal static + image assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
