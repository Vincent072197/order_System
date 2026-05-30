import type { NextRequest } from "next/server";
import { SESSION_COOKIE, validateSession, type SessionStaff } from "./sessions";

// API-route counterpart to requireStaff() (which redirects, only valid in a
// server component). Returns the staff or null; the route decides the 401.
export async function getApiStaff(
  request: NextRequest,
): Promise<SessionStaff | null> {
  const sid = request.cookies.get(SESSION_COOKIE)?.value;
  const v = await validateSession(sid);
  return v?.staff ?? null;
}

// Roles allowed to edit the menu. Only owner/manager touch prices + items;
// kitchen/cashier are read-only here. Keep in sync with the page-level guard.
export const MENU_EDIT_ROLES: readonly SessionStaff["role"][] = [
  "owner",
  "manager",
];

export function canEditMenu(role: SessionStaff["role"]): boolean {
  return MENU_EDIT_ROLES.includes(role);
}
