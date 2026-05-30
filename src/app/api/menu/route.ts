import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPublicMenuByTablePublicId } from "@/src/lib/menu";

export const runtime = "nodejs";
// Menu reflects available items, prices, etc. Don't cache it.
export const dynamic = "force-dynamic";

const querySchema = z.object({ tableId: z.string().uuid() });

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    tableId: request.nextUrl.searchParams.get("tableId"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "tableId is required and must be a UUID" },
      { status: 400 },
    );
  }

  const menu = await getPublicMenuByTablePublicId(parsed.data.tableId);
  if (!menu) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }
  return NextResponse.json(menu);
}
