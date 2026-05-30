import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, validateSession } from "@/src/lib/auth/sessions";
import { listOrdersForRestaurant } from "@/src/lib/staffOrders";

export const runtime = "nodejs";

// GET is not state-changing, so proxy.ts doesn't require CSRF here. It is still
// rate-limited under the "api" bucket (30 cap / 5 per s) — fine for the 4s poll
// the dashboard does. We still validate the session ourselves.
export async function GET(request: NextRequest) {
  const sid = request.cookies.get(SESSION_COOKIE)?.value;
  const v = await validateSession(sid);
  if (!v) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orders = await listOrdersForRestaurant(v.staff.restaurantId);
  return NextResponse.json({ orders });
}
