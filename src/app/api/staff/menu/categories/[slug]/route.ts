import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canEditMenu, getApiStaff } from "@/src/lib/auth/api";
import { extractClientIp } from "@/src/lib/security";
import {
  deleteMenuCategory,
  MenuAdminError,
  updateMenuCategory,
} from "@/src/lib/menuAdmin";
import { menuCategoryUpdateSchema } from "@/src/lib/validators";

export const runtime = "nodejs";

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

async function authorize(request: NextRequest) {
  const staff = await getApiStaff(request);
  if (!staff) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canEditMenu(staff.role)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { staff };
}

function mapError(err: unknown, where: string): NextResponse {
  if (err instanceof MenuAdminError) {
    const status = err.code === "CATEGORY_NOT_FOUND" ? 404 : 422;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  console.error(`[${where}] failed:`, err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;

  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success) {
    return NextResponse.json({ error: "Invalid category slug" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = menuCategoryUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await updateMenuCategory(auth.staff.restaurantId, slug, parsed.data, {
      publicId: auth.staff.publicId,
      clientIp: extractClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapError(err, "PATCH /api/staff/menu/categories/[slug]");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;

  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success) {
    return NextResponse.json({ error: "Invalid category slug" }, { status: 400 });
  }

  try {
    const result = await deleteMenuCategory(auth.staff.restaurantId, slug, {
      publicId: auth.staff.publicId,
      clientIp: extractClientIp(request),
    });
    return NextResponse.json({ ok: true, softDeleted: result.softDeleted });
  } catch (err) {
    return mapError(err, "DELETE /api/staff/menu/categories/[slug]");
  }
}
