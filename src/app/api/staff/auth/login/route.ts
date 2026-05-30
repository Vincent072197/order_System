import { NextResponse, type NextRequest } from "next/server";
import pool from "@/src/lib/db";
import { staffLoginSchema } from "@/src/lib/validators";
import { extractClientIp } from "@/src/lib/security";
import {
  dummyVerify,
  verifyPassword,
} from "@/src/lib/auth/password";
import {
  findStaffByEmail,
  isLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/src/lib/auth/staff";
import { createSession } from "@/src/lib/auth/sessions";
import { setAuthCookies } from "@/src/lib/auth/cookies";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = staffLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const ip = extractClientIp(request);
  const ua = request.headers.get("user-agent");

  const staff = await findStaffByEmail(email);

  if (!staff) {
    // Run a dummy verify to keep timing roughly equal to the wrong-password
    // branch — without this, an attacker can enumerate emails by latency.
    await dummyVerify(password);
    await audit({
      action: "staff.login.failed",
      reason: "unknown_email",
      email,
      ip,
    });
    return genericInvalid();
  }

  if (!staff.isActive) {
    await audit({
      action: "staff.login.failed",
      reason: "inactive",
      staffId: staff.publicId,
      ip,
    });
    return genericInvalid();
  }

  if (isLocked(staff)) {
    await audit({
      action: "staff.login.failed",
      reason: "locked",
      staffId: staff.publicId,
      ip,
    });
    // 423 Locked communicates the state to the client without leaking
    // which accounts exist — but we already failed earlier branches with
    // the same generic 401, so an attacker observing a 423 has effectively
    // confirmed the email exists. We accept that trade-off because not
    // telling a legitimate user "your account is locked" is worse UX.
    return NextResponse.json(
      { error: "Account temporarily locked. Try again later." },
      { status: 423 },
    );
  }

  const ok = await verifyPassword(staff.passwordHash, password);
  if (!ok) {
    await recordFailedLogin(staff.id);
    await audit({
      action: "staff.login.failed",
      reason: "wrong_password",
      staffId: staff.publicId,
      ip,
    });
    return genericInvalid();
  }

  await recordSuccessfulLogin(staff.id);
  const session = await createSession({
    staffId: staff.id,
    ip,
    userAgent: ua,
  });

  await audit({
    action: "staff.login.success",
    staffId: staff.publicId,
    ip,
  });

  const res = NextResponse.json(
    {
      staff: {
        publicId: staff.publicId,
        email: staff.email,
        displayName: staff.displayName,
        role: staff.role,
      },
      // Echo the CSRF token in the body so the client can store it (e.g. in
      // memory) for the very first state-changing request after login,
      // before reading the cookie. Subsequent requests can read the cookie
      // directly.
      csrfToken: session.csrfToken,
    },
    { status: 200 },
  );
  setAuthCookies(res, {
    sessionId: session.id,
    csrfToken: session.csrfToken,
  });
  return res;
}

function genericInvalid() {
  return NextResponse.json(
    { error: "Invalid email or password" },
    { status: 401 },
  );
}

async function audit(payload: {
  action: string;
  reason?: string;
  email?: string;
  staffId?: string;
  ip: string | null;
}) {
  try {
    await pool.query(
      `INSERT INTO audit_log
         (actor_kind, actor_id, action, entity_kind, entity_id, client_ip, payload)
       VALUES ('staff', $1, $2, 'staff', $1, $3::inet, $4::jsonb)`,
      [
        payload.staffId ?? null,
        payload.action,
        payload.ip ?? null,
        JSON.stringify({
          reason: payload.reason ?? null,
          email: payload.email ?? null,
        }),
      ],
    );
  } catch (e) {
    console.error("[audit] failed:", e);
  }
}
