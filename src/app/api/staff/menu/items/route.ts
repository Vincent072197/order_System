import { NextResponse, type NextRequest } from "next/server";
import { canEditMenu, getApiStaff } from "@/src/lib/auth/api";
import { extractClientIp } from "@/src/lib/security";
import { createMenuItem, MenuAdminError } from "@/src/lib/menuAdmin";
import { menuItemCreateSchema } from "@/src/lib/validators";

export const runtime = "nodejs";

// proxy.ts already enforced Origin + CSRF + rate limit for this state-changing
// /api/staff/* route. Here: validate session, check role, validate body.
export async function POST(request: NextRequest) {
  const staff = await getApiStaff(request);
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canEditMenu(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = menuItemCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { publicId } = await createMenuItem(staff.restaurantId, parsed.data, {
      publicId: staff.publicId,
      clientIp: extractClientIp(request),
    });
    return NextResponse.json({ item: { publicId } }, { status: 201 });
  } catch (err) {
    if (err instanceof MenuAdminError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    console.error("[POST /api/staff/menu/items] failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
