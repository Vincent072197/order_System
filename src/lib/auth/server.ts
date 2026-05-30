import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, validateSession, type SessionStaff } from "./sessions";

/** Read the current staff from cookies, or null if not authenticated. */
export async function currentStaff(): Promise<SessionStaff | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  const v = await validateSession(sid);
  return v?.staff ?? null;
}

/**
 * For server components / server actions guarding a page. Redirects to
 * /staff/login when not authenticated.
 */
export async function requireStaff(): Promise<SessionStaff> {
  const staff = await currentStaff();
  if (!staff) redirect("/staff/login");
  return staff;
}
