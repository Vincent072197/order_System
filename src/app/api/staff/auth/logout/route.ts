import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, deleteSession } from "@/src/lib/auth/sessions";
import { clearAuthCookies } from "@/src/lib/auth/cookies";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // CSRF check is enforced upstream in proxy.ts. We only get here if
  // session_cookie + X-CSRF-Token already matched.
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    try {
      await deleteSession(sessionId);
    } catch (e) {
      console.error("[POST /api/staff/auth/logout] delete failed:", e);
    }
  }
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}
