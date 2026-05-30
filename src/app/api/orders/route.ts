import { NextResponse, type NextRequest } from "next/server";
import { placeOrderSchema } from "@/src/lib/validators";
import { OrderValidationError, placeDineInOrder } from "@/src/lib/orders";
import { extractClientIp } from "@/src/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Reject anything that isn't JSON. Combined with same-origin enforcement
  // in proxy.ts this gives us a cheap CSRF defence on this endpoint.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = placeOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const result = await placeDineInOrder(parsed.data, {
      clientIp: extractClientIp(request),
    });
    return NextResponse.json(
      {
        orderId: result.publicId,
        status: result.status,
        subtotal: result.subtotal,
        total: result.total,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 422 },
      );
    }
    console.error("[POST /api/orders] failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
