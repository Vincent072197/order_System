import { NextResponse, type NextRequest } from "next/server";
import { canEditMenu, getApiStaff } from "@/src/lib/auth/api";
import { extractClientIp } from "@/src/lib/security";
import { createOptionGroup, MenuAdminError } from "@/src/lib/menuAdmin";
import { optionGroupCreateSchema } from "@/src/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const staff = await getApiStaff(request);
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditMenu(staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = optionGroupCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { publicId } = await createOptionGroup(staff.restaurantId, parsed.data, {
      publicId: staff.publicId,
      clientIp: extractClientIp(request),
    });
    return NextResponse.json({ group: { publicId } }, { status: 201 });
  } catch (err) {
    if (err instanceof MenuAdminError) {
      const status = err.code === "ITEM_NOT_FOUND" ? 404 : 422;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("[POST /api/staff/menu/option-groups] failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
