import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import pool from "@/src/lib/db";
import { SESSION_COOKIE, validateSession } from "@/src/lib/auth/sessions";
import { extractClientIp } from "@/src/lib/security";
import {
  checkOrderTransition,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/src/lib/orders";
import { getPrintQueue } from "@/src/lib/print";

export const runtime = "nodejs";

// proxy.ts has already enforced Origin allow-list + CSRF double-submit +
// rate limit for state-changing /api/staff/* requests. It does NOT verify
// that the session is real/active, and it knows nothing about roles or the
// status state machine — that's all this handler's job.

const patchBodySchema = z.object({
  // The status we want to move the order TO. The legal "from" is whatever
  // the DB currently holds; we never trust a client-supplied "from".
  toStatus: z.enum(ORDER_STATUSES),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }, // Next 16: params is a Promise
) {
  // 1) Authenticate. proxy.ts checked the CSRF token matches the cookie, but
  //    a forged/expired session cookie still reaches us — validate it here.
  const sid = request.cookies.get(SESSION_COOKIE)?.value;
  const v = await validateSession(sid);
  if (!v) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const staff = v.staff;

  // 2) Validate the public id (UUID, never the BIGINT) and the body.
  const { publicId } = await params;
  if (!z.string().uuid().safeParse(publicId).success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = patchBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const toStatus = parsed.data.toStatus;
  const clientIp = extractClientIp(request);

  // 3) Read-check-write-audit in one transaction. SELECT ... FOR UPDATE locks
  //    the row so two staff can't race the same transition (e.g. both moving
  //    pending -> confirmed and enqueuing two print jobs in B5).
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cur = await client.query<{
      id: string;
      status: OrderStatus;
      restaurant_id: string;
      source: string;
      total: string;
      table_label: string | null;
    }>(
      `SELECT o.id::text, o.status, o.restaurant_id::text AS restaurant_id,
              o.source, o.total::text AS total, t.label AS table_label
         FROM orders o
         LEFT JOIN tables t ON t.id = o.table_id
        WHERE o.public_id = $1
        FOR UPDATE OF o`,
      [publicId],
    );
    const order = cur.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Tenant isolation (§5: multi-tenant from day one). Return 404 rather than
    // 403 so we don't confirm that an order with this id exists in some other
    // restaurant — same anti-enumeration posture as the UUID public ids.
    if (Number(order.restaurant_id) !== staff.restaurantId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const fromStatus = order.status;
    const check = checkOrderTransition(fromStatus, toStatus, staff.role);
    if (!check.ok) {
      await client.query("ROLLBACK");
      // INVALID_TRANSITION -> 409 (conflicts with current state),
      // ROLE_FORBIDDEN    -> 403 (authenticated but not allowed).
      const httpStatus = check.code === "ROLE_FORBIDDEN" ? 403 : 409;
      return NextResponse.json(
        { error: check.reason, code: check.code },
        { status: httpStatus },
      );
    }

    // updated_at is bumped automatically by trg_orders_updated.
    await client.query(`UPDATE orders SET status = $1 WHERE id = $2`, [
      toStatus,
      order.id,
    ]);

    // §3 rule 6 + §6: every staff status change is appended to audit_log,
    // inside the same transaction so the log can't drift from the order.
    await client.query(
      `INSERT INTO audit_log
         (actor_kind, actor_id, action, entity_kind, entity_id, client_ip, payload)
       VALUES ('staff', $1, 'order.status_change', 'order', $2, $3::inet, $4::jsonb)`,
      [
        staff.publicId,
        publicId,
        clientIp,
        JSON.stringify({ from_status: fromStatus, to_status: toStatus }),
      ],
    );

    await client.query("COMMIT");

    // B5: "確認接單" (→ preparing) fires the kitchen ticket. Do it AFTER commit
    // so we never print a ticket for an order that didn't persist, and never
    // block the status change on a printer fault — log and move on.
    if (toStatus === "preparing") {
      try {
        const items = await client.query<{
          title_snapshot: string;
          quantity: number;
          options_snapshot: { groupTitle: string; label: string }[];
        }>(
          `SELECT title_snapshot, quantity, options_snapshot
             FROM order_items
            WHERE order_id = $1
            ORDER BY id`,
          [order.id],
        );
        await getPrintQueue().enqueue({
          orderPublicId: publicId,
          tableLabel: order.table_label,
          source: order.source,
          total: Number(order.total),
          lines: items.rows.map((r) => ({
            name: r.title_snapshot,
            quantity: r.quantity,
            options: (r.options_snapshot ?? []).map((o) => o.label),
          })),
        });
      } catch (printErr) {
        console.error(`[print] ticket enqueue failed for ${publicId}:`, printErr);
      }
    }

    return NextResponse.json({
      order: { publicId, status: toStatus, previousStatus: fromStatus },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`[PATCH /api/staff/orders/${publicId}] failed:`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  } finally {
    client.release();
  }
}
