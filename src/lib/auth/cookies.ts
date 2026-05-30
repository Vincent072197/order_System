import type { NextResponse } from "next/server";
import { CSRF_COOKIE, SESSION_COOKIE, SESSION_TTL_HOURS } from "./sessions";
import { loadEnv } from "@/src/lib/env";

const env = loadEnv();
const isProd = env.NODE_ENV === "production";
const MAX_AGE_SECONDS = SESSION_TTL_HOURS * 60 * 60;

export function setAuthCookies(
  res: NextResponse,
  opts: { sessionId: string; csrfToken: string },
) {
  // Session cookie: httpOnly so JS can't read it (defence vs XSS exfil).
  // SameSite=Lax blocks cross-site POST CSRF on its own; we still do an
  // Origin check + CSRF token in proxy for defence-in-depth.
  res.cookies.set({
    name: SESSION_COOKIE,
    value: opts.sessionId,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });

  // CSRF cookie: NOT httpOnly — JS reads it and echoes it back as a header
  // on state-changing requests (double-submit). SameSite=Strict means even
  // top-level navigations from other origins won't carry it.
  res.cookies.set({
    name: CSRF_COOKIE,
    value: opts.csrfToken,
    httpOnly: false,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set({
    name: CSRF_COOKIE,
    value: "",
    httpOnly: false,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
