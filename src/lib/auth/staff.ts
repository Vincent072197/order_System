import pool from "@/src/lib/db";

export type StaffRow = {
  id: number;
  publicId: string;
  restaurantId: number;
  email: string;
  passwordHash: string;
  displayName: string;
  role: "owner" | "manager" | "cashier" | "kitchen";
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
};

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export async function findStaffByEmail(
  email: string,
): Promise<StaffRow | null> {
  const res = await pool.query<{
    id: string;
    public_id: string;
    restaurant_id: string;
    email: string;
    password_hash: string;
    display_name: string;
    role: StaffRow["role"];
    is_active: boolean;
    failed_login_attempts: number;
    locked_until: string | null;
  }>(
    `SELECT id::text, public_id, restaurant_id::text,
            email::text AS email, password_hash, display_name, role,
            is_active, failed_login_attempts, locked_until
       FROM staff
      WHERE email = $1
      LIMIT 1`,
    [email],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    publicId: r.public_id,
    restaurantId: Number(r.restaurant_id),
    email: r.email,
    passwordHash: r.password_hash,
    displayName: r.display_name,
    role: r.role,
    isActive: r.is_active,
    failedLoginAttempts: r.failed_login_attempts,
    lockedUntil: r.locked_until ? new Date(r.locked_until) : null,
  };
}

export function isLocked(s: StaffRow): boolean {
  return !!s.lockedUntil && s.lockedUntil.getTime() > Date.now();
}

export async function recordFailedLogin(staffId: number): Promise<void> {
  await pool.query(
    `UPDATE staff
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE
              WHEN failed_login_attempts + 1 >= $2
              THEN NOW() + ($3 || ' minutes')::interval
              ELSE locked_until
            END
      WHERE id = $1`,
    [staffId, MAX_FAILED_LOGINS, LOCKOUT_MINUTES],
  );
}

export async function recordSuccessfulLogin(staffId: number): Promise<void> {
  await pool.query(
    `UPDATE staff
        SET failed_login_attempts = 0,
            locked_until = NULL,
            last_login_at = NOW()
      WHERE id = $1`,
    [staffId],
  );
}
