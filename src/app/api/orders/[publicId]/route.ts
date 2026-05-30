import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPublicOrderStatus } from "@/src/lib/orders";

export const runtime = "nodejs";

const uuidSchema = z.string().uuid();

// Public, read-only: a customer polls this with the order UUID they were given
// after checkout. No auth — the unguessable UUID is the capability. GET isn't
// state-changing, so proxy.ts skips CSRF; it's still rate-limited.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  if (!uuidSchema.safeParse(publicId).success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }
  const order = await getPublicOrderStatus(publicId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json({ order });
}
