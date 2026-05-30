import type { PoolClient } from "pg";
import pool from "./db";
import type { PlaceOrderInput } from "./validators";

export class OrderValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "TABLE_NOT_FOUND"
      | "ITEM_NOT_FOUND"
      | "ITEM_UNAVAILABLE"
      | "CHOICE_NOT_FOUND"
      | "CHOICE_NOT_FOR_ITEM"
      | "CHOICE_GROUP_VIOLATION",
  ) {
    super(message);
    this.name = "OrderValidationError";
  }
}

type LineComputation = {
  menuItemDbId: number;
  titleSnapshot: string;
  unitPrice: number;
  quantity: number;
  optionsSnapshot: { groupTitle: string; label: string; priceDelta: number }[];
  lineTotal: number;
};

export type CreatedOrder = {
  publicId: string;
  status: string;
  subtotal: number;
  total: number;
};

// ---------------------------------------------------------------------------
// P2 / Slice B1 — order status state machine (pure, no DB)
//
// Source of truth for "which status change is legal, and who may make it".
// The DB CHECK on orders.status guards the *set* of valid statuses; this
// guards the *edges* between them and the role allowed to walk each edge.
// Keep this pure so it can be unit-tested and reused by both the API
// (PATCH handler) and any future KDS UI without pulling in a DB connection.
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Mirrors the union already used in src/lib/auth/sessions.ts + staff.ts.
export type StaffRole = "owner" | "manager" | "cashier" | "kitchen";

// from -> to -> roles permitted to make that exact transition.
// A (from, to) pair absent from the map is simply not a legal transition.
// Encodes §6 of CLAUDE.md:
//   - kitchen may only do confirmed->preparing and preparing->ready
//   - cashier/manager/owner may do any forward transition
//   - cancellation is manager/owner only, and only from pending|confirmed
const ORDER_TRANSITIONS: Record<
  OrderStatus,
  Partial<Record<OrderStatus, readonly StaffRole[]>>
> = {
  pending: {
    confirmed: ["owner", "manager", "cashier"],
    cancelled: ["owner", "manager"],
  },
  confirmed: {
    preparing: ["owner", "manager", "cashier", "kitchen"],
    cancelled: ["owner", "manager"],
  },
  preparing: { ready: ["owner", "manager", "cashier", "kitchen"] },
  ready: { served: ["owner", "manager", "cashier"] },
  served: { completed: ["owner", "manager", "cashier"] },
  completed: {},
  cancelled: {},
};

export type TransitionCheck =
  | { ok: true }
  | {
      ok: false;
      // INVALID_TRANSITION -> 409/422 in the API; ROLE_FORBIDDEN -> 403.
      code: "INVALID_TRANSITION" | "ROLE_FORBIDDEN";
      reason: string;
    };

/**
 * Decide whether `role` may move an order from `from` to `to`.
 * Pure: no I/O, no throwing. The caller turns the result into an HTTP status.
 */
export function checkOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: StaffRole,
): TransitionCheck {
  const allowedRoles = ORDER_TRANSITIONS[from]?.[to];
  if (!allowedRoles) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      reason: `Cannot move an order from "${from}" to "${to}".`,
    };
  }
  if (!allowedRoles.includes(role)) {
    return {
      ok: false,
      code: "ROLE_FORBIDDEN",
      reason: `Role "${role}" is not permitted to perform ${from} → ${to}.`,
    };
  }
  return { ok: true };
}

/**
 * The set of statuses `role` may move an order to, given its current status.
 * Lets the UI render exactly the buttons a transition would accept without
 * duplicating ORDER_TRANSITIONS on the client. Pure.
 */
export function allowedNextStatuses(
  from: OrderStatus,
  role: StaffRole,
): OrderStatus[] {
  const edges = ORDER_TRANSITIONS[from];
  return (Object.keys(edges) as OrderStatus[]).filter((to) =>
    edges[to]!.includes(role),
  );
}

export async function placeDineInOrder(
  input: PlaceOrderInput,
  ctx: { clientIp?: string | null },
): Promise<CreatedOrder> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = await placeDineInOrderInTx(client, input, ctx);
    await client.query("COMMIT");
    return order;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function placeDineInOrderInTx(
  client: PoolClient,
  input: PlaceOrderInput,
  ctx: { clientIp?: string | null },
): Promise<CreatedOrder> {
  // 1) Resolve table.
  const tableRes = await client.query<{
    id: string;
    restaurant_id: string;
    is_active: boolean;
  }>(
    `SELECT id::text, restaurant_id::text, is_active
       FROM tables WHERE public_id = $1 LIMIT 1`,
    [input.tableId],
  );
  const table = tableRes.rows[0];
  if (!table || !table.is_active) {
    throw new OrderValidationError("Table not found", "TABLE_NOT_FOUND");
  }
  const restaurantDbId = Number(table.restaurant_id);
  const tableDbId = Number(table.id);

  // 2) Resolve menu items in one query.
  const itemPublicIds = Array.from(new Set(input.items.map((i) => i.menuItemId)));
  const itemsRes = await client.query<{
    public_id: string;
    id: string;
    title: string;
    price: string;
    is_available: boolean;
    restaurant_id: string;
  }>(
    `SELECT public_id, id::text, title, price::text, is_available, restaurant_id::text
       FROM menu_items WHERE public_id = ANY($1::uuid[])`,
    [itemPublicIds],
  );
  const itemsByPublicId = new Map(itemsRes.rows.map((r) => [r.public_id, r]));
  for (const ii of input.items) {
    const row = itemsByPublicId.get(ii.menuItemId);
    if (!row || Number(row.restaurant_id) !== restaurantDbId) {
      throw new OrderValidationError(
        `Menu item ${ii.menuItemId} not found`,
        "ITEM_NOT_FOUND",
      );
    }
    if (!row.is_available) {
      throw new OrderValidationError(
        `Menu item ${row.title} is unavailable`,
        "ITEM_UNAVAILABLE",
      );
    }
  }

  // 3) Resolve all chosen option choices in one query, with their group + item.
  const allChoiceIds = Array.from(
    new Set(input.items.flatMap((i) => i.choiceIds)),
  );
  type ChoiceRow = {
    public_id: string;
    id: string;
    label: string;
    price_delta: string;
    group_id: string;
    group_title: string;
    selection_kind: "single" | "multi";
    min_choices: number;
    max_choices: number;
    menu_item_id: string;
  };
  const choicesRes =
    allChoiceIds.length === 0
      ? { rows: [] as ChoiceRow[] }
      : await client.query<ChoiceRow>(
          `SELECT c.public_id, c.id::text, c.label, c.price_delta::text,
                  g.id::text  AS group_id, g.title AS group_title,
                  g.selection_kind, g.min_choices, g.max_choices,
                  g.menu_item_id::text AS menu_item_id
             FROM menu_option_choices c
             JOIN menu_option_groups  g ON g.id = c.option_group_id
            WHERE c.public_id = ANY($1::uuid[])`,
          [allChoiceIds],
        );
  const choiceByPublicId = new Map(choicesRes.rows.map((r) => [r.public_id, r]));

  // 3b) Load every option group that belongs to the items in the order so
  //     we can enforce required-group constraints even when the customer
  //     submits zero choices for a required group.
  const allItemDbIds = Array.from(
    new Set(itemsRes.rows.map((r) => Number(r.id))),
  );
  type GroupRow = {
    id: string;
    menu_item_id: string;
    title: string;
    selection_kind: "single" | "multi";
    min_choices: number;
    max_choices: number;
  };
  const groupsRes =
    allItemDbIds.length === 0
      ? { rows: [] as GroupRow[] }
      : await client.query<GroupRow>(
          `SELECT id::text, menu_item_id::text, title,
                  selection_kind, min_choices, max_choices
             FROM menu_option_groups
            WHERE menu_item_id = ANY($1::bigint[])`,
          [allItemDbIds],
        );
  const groupsByItemDb = new Map<string, GroupRow[]>();
  for (const g of groupsRes.rows) {
    const list = groupsByItemDb.get(g.menu_item_id) ?? [];
    list.push(g);
    groupsByItemDb.set(g.menu_item_id, list);
  }

  // 4) Build line snapshots and validate group constraints.
  const lines: LineComputation[] = input.items.map((line) => {
    const item = itemsByPublicId.get(line.menuItemId)!;
    const itemDbId = Number(item.id);

    const choices = line.choiceIds.map((cid) => {
      const c = choiceByPublicId.get(cid);
      if (!c) {
        throw new OrderValidationError(
          `Option choice ${cid} not found`,
          "CHOICE_NOT_FOUND",
        );
      }
      if (Number(c.menu_item_id) !== itemDbId) {
        throw new OrderValidationError(
          `Option choice ${cid} does not belong to its menu item`,
          "CHOICE_NOT_FOR_ITEM",
        );
      }
      return c;
    });

    // Bucket selected choices by their group id.
    const picksByGroup = new Map<string, ChoiceRow[]>();
    for (const c of choices) {
      const list = picksByGroup.get(c.group_id) ?? [];
      list.push(c);
      picksByGroup.set(c.group_id, list);
    }

    // Validate every group on this menu item, including ones with zero picks.
    const allGroups = groupsByItemDb.get(String(itemDbId)) ?? [];
    for (const g of allGroups) {
      const picks = picksByGroup.get(g.id) ?? [];
      if (picks.length < g.min_choices || picks.length > g.max_choices) {
        throw new OrderValidationError(
          `Option group "${g.title}" requires ${g.min_choices}-${g.max_choices} choices`,
          "CHOICE_GROUP_VIOLATION",
        );
      }
      if (g.selection_kind === "single" && picks.length > 1) {
        throw new OrderValidationError(
          `Option group "${g.title}" only allows one choice`,
          "CHOICE_GROUP_VIOLATION",
        );
      }
    }

    const unitPrice =
      Number(item.price) +
      choices.reduce((s, c) => s + Number(c.price_delta), 0);
    const lineTotal = round2(unitPrice * line.quantity);

    return {
      menuItemDbId: itemDbId,
      titleSnapshot: item.title,
      unitPrice: round2(unitPrice),
      quantity: line.quantity,
      optionsSnapshot: choices.map((c) => ({
        groupTitle: c.group_title,
        label: c.label,
        priceDelta: Number(c.price_delta),
      })),
      lineTotal,
    };
  });

  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const tax = 0; // wire to restaurant config later
  const serviceFee = 0;
  const total = round2(subtotal + tax + serviceFee);

  // 5) Insert.
  const orderRes = await client.query<{ public_id: string; status: string }>(
    `INSERT INTO orders
       (restaurant_id, table_id, source, status,
        subtotal, tax, service_fee, total,
        customer_note, client_ip)
     VALUES ($1, $2, 'dine_in', 'pending',
             $3, $4, $5, $6,
             $7, $8::inet)
     RETURNING public_id, status`,
    [
      restaurantDbId,
      tableDbId,
      subtotal,
      tax,
      serviceFee,
      total,
      input.customerNote,
      ctx.clientIp ?? null,
    ],
  );
  const orderPublicId = orderRes.rows[0].public_id;

  for (const line of lines) {
    await client.query(
      `INSERT INTO order_items
         (order_id, menu_item_id, title_snapshot,
          unit_price, quantity, options_snapshot, line_total)
       VALUES (
         (SELECT id FROM orders WHERE public_id = $1),
         $2, $3, $4, $5, $6::jsonb, $7
       )`,
      [
        orderPublicId,
        line.menuItemDbId,
        line.titleSnapshot,
        line.unitPrice,
        line.quantity,
        JSON.stringify(line.optionsSnapshot),
        line.lineTotal,
      ],
    );
  }

  await client.query(
    `INSERT INTO audit_log (actor_kind, action, entity_kind, entity_id, client_ip, payload)
     VALUES ('customer', 'order.created', 'order', $1, $2::inet, $3::jsonb)`,
    [
      orderPublicId,
      ctx.clientIp ?? null,
      JSON.stringify({
        tableId: input.tableId,
        itemCount: input.items.length,
        total,
      }),
    ],
  );

  return {
    publicId: orderPublicId,
    status: orderRes.rows[0].status,
    subtotal,
    total,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
