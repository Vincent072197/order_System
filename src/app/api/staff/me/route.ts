import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, validateSession } from "@/src/lib/auth/sessions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sid = request.cookies.get(SESSION_COOKIE)?.value;
  const v = await validateSession(sid);
  if (!v) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    staff: {
      publicId: v.staff.publicId,
      email: v.staff.email,
      displayName: v.staff.displayName,
      role: v.staff.role,
    },
  });
}
