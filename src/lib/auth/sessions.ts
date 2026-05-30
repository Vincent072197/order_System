import { randomBytes, timingSafeEqual } from "node:crypto";
import pool from "@/src/lib/db";

export const SESSION_COOKIE = "staff_session";
export const CSRF_COOKIE = "staff_csrf";
export const CSRF_HEADER = "x-csrf-token";

export const SESSION_TTL_HOURS = 8;

export type StaffSession = {
  id: string;
  staffId: number;
  csrfToken: string;
  expiresAt: Date;
};

export type SessionStaff = {
  staffId: number;
  publicId: string;
  restaurantId: number;
  email: string;
  displayName: string;
  role: "owner" | "manager" | "cashier" | "kitchen";
};

function tokenB64Url(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export async function createSession(opts: {
  staffId: number;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<StaffSession> {
  const id = tokenB64Url(32);
  const csrfToken = tokenB64Url(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO staff_sessions (id, staff_id, csrf_token, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5::inet, $6)`,
    [
      id,
      opts.staffId,
      csrfToken,
      expiresAt,
      opts.ip ?? null,
      opts.userAgent?.slice(0, 500) ?? null,
    ],
  );
  return { id, staffId: opts.staffId, csrfToken, expiresAt };
}

/** Returns the live session + staff if the token is valid and unexpired. */
export async function validateSession(
  sessionId: string | undefined | null,
): Promise<{ session: StaffSession; staff: SessionStaff } | null> {
  if (!sessionId) return null;
  // Length check first to avoid DB hits on malformed cookies.
  if (sessionId.length < 16 || sessionId.length > 128) return null;

  const res = await pool.query<{
    id: string;
    csrf_token: string;
    expires_at: string;
    staff_id: string;
    public_id: string;
    restaurant_id: string;
    email: string;
    display_name: string;
    role: SessionStaff["role"];
    is_active: boolean;
  }>(
    `SELECT s.id, s.csrf_token, s.expires_at,
            st.id::text          AS staff_id,
            st.public_id, st.restaurant_id::text,
            st.email::text       AS email,
            st.display_name, st.role, st.is_active
       FROM staff_sessions s
       JOIN staff st ON st.id = s.staff_id
      WHERE s.id = $1
        AND s.expires_at > NOW()
      LIMIT 1`,
    [sessionId],
  );
  const row = res.rows[0];
  if (!row || !row.is_active) return null;

  // Touch last_seen_at, but don't await — failing to update isn't fatal.
  pool
    .query(`UPDATE staff_sessions SET last_seen_at = NOW() WHERE id = $1`, [
      sessionId,
    ])
    .catch(() => {});

  return {
    session: {
      id: row.id,
      staffId: Number(row.staff_id),
      csrfToken: row.csrf_token,
      expiresAt: new Date(row.expires_at),
    },
    staff: {
      staffId: Number(row.staff_id),
      publicId: row.public_id,
      restaurantId: Number(row.restaurant_id),
      email: row.email,
      displayName: row.display_name,
      role: row.role,
    },
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await pool.query(`DELETE FROM staff_sessions WHERE id = $1`, [sessionId]);
}

export async function deleteAllSessionsForStaff(staffId: number): Promise<void> {
  await pool.query(`DELETE FROM staff_sessions WHERE staff_id = $1`, [staffId]);
}

/** Constant-time compare for two CSRF tokens of equal expected length. */
export function csrfMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
