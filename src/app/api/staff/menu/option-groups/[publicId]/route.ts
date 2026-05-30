import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canEditMenu, getApiStaff } from "@/src/lib/auth/api";
import { extractClientIp } from "@/src/lib/security";
import {
  deleteOptionGroup,
  MenuAdminError,
  updateOptionGroup,
} from "@/src/lib/menuAdmin";
import { optionGroupUpdateSchema } from "@/src/lib/validators";

export const runtime = "nodejs";

const uuidSchema = z.string().uuid();

async function authorize(request: NextRequest) {
  const staff = await getApiStaff(request);
  if (!staff) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canEditMenu(staff.role)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { staff };
}

function mapError(err: unknown, where: string): NextResponse {
  if (err instanceof MenuAdminError) {
    const status = err.code === "GROUP_NOT_FOUND" ? 404 : 422;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  console.error(`[${where}] failed:`, err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;

  const { publicId } = await params;
  if (!uuidSchema.safeParse(publicId).success) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = optionGroupUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await updateOptionGroup(auth.staff.restaurantId, publicId, parsed.data, {
      publicId: auth.staff.publicId,
      clientIp: extractClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapError(err, "PATCH /api/staff/menu/option-groups/[publicId]");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;

  const { publicId } = await params;
  if (!uuidSchema.safeParse(publicId).success) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }

  try {
    await deleteOptionGroup(auth.staff.restaurantId, publicId, {
      publicId: auth.staff.publicId,
      clientIp: extractClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapError(err, "DELETE /api/staff/menu/option-groups/[publicId]");
  }
}
