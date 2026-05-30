import pool from "./db";
import type { OrderStatus } from "./orders";

// ---------------------------------------------------------------------------
// P2 / Slices B3-B4 — read models for the staff order dashboard.
//
// All queries are scoped by restaurant_id (§5: multi-tenant from day one) and
// only ever expose public_id UUIDs, never the BIGINT id (§3 rule 2).
// ---------------------------------------------------------------------------

export type StaffOrderSummary = {
  publicId: string;
  status: OrderStatus;
  source: string;
  tableLabel: string | null;
  externalRef: string | null;
  total: number;
  itemCount: number; // total dishes (sum of quantities)
  createdAt: string; // ISO string
};

// Shape of each element in order_items.options_snapshot (written by
// placeDineInOrderInTx in orders.ts).
type OptionSnapshot = { groupTitle: string; label: string; priceDelta: number };

export type StaffOrderItem = {
  titleSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  options: OptionSnapshot[];
};

export type StaffOrderDetail = StaffOrderSummary & {
  subtotal: number;
  tax: number;
  serviceFee: number;
  customerNote: string;
  updatedAt: string;
  items: StaffOrderItem[];
};

const LIST_LIMIT = 100;

/** Most recent orders for one restaurant, newest first. */
export async function listOrdersForRestaurant(
  restaurantId: number,
): Promise<StaffOrderSummary[]> {
  const res = await pool.query<{
    public_id: string;
    status: OrderStatus;
    source: string;
    external_ref: string | null;
    total: string;
    item_count: string;
    created_at: string;
    table_label: string | null;
  }>(
    `SELECT o.public_id, o.status, o.source, o.external_ref,
            o.total::text                       AS total,
            COALESCE(SUM(oi.quantity), 0)::text AS item_count,
            o.created_at,
            t.label                             AS table_label
       FROM orders o
       LEFT JOIN tables t      ON t.id = o.table_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.restaurant_id = $1
      GROUP BY o.id, t.label
      ORDER BY o.created_at DESC
      LIMIT ${LIST_LIMIT}`,
    [restaurantId],
  );
  return res.rows.map(rowToSummary);
}

/** One order with its line items, scoped to the restaurant. null if absent. */
export async function getOrderDetailForStaff(
  restaurantId: number,
  publicId: string,
): Promise<StaffOrderDetail | null> {
  const head = await pool.query<{
    id: string;
    public_id: string;
    status: OrderStatus;
    source: string;
    external_ref: string | null;
    subtotal: string;
    tax: string;
    service_fee: string;
    total: string;
    customer_note: string;
    created_at: string;
    updated_at: string;
    table_label: string | null;
  }>(
    `SELECT o.id::text, o.public_id, o.status, o.source, o.external_ref,
            o.subtotal::text, o.tax::text, o.service_fee::text, o.total::text,
            o.customer_note, o.created_at, o.updated_at,
            t.label AS table_label
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
      WHERE o.restaurant_id = $1 AND o.public_id = $2
      LIMIT 1`,
    [restaurantId, publicId],
  );
  const o = head.rows[0];
  if (!o) return null;

  const itemsRes = await pool.query<{
    title_snapshot: string;
    unit_price: string;
    quantity: number;
    line_total: string;
    options_snapshot: OptionSnapshot[];
  }>(
    `SELECT title_snapshot, unit_price::text, quantity, line_total::text,
            options_snapshot
       FROM order_items
      WHERE order_id = $1
      ORDER BY id`,
    [Number(o.id)],
  );

  return {
    publicId: o.public_id,
    status: o.status,
    source: o.source,
    tableLabel: o.table_label,
    externalRef: o.external_ref,
    total: Number(o.total),
    itemCount: itemsRes.rows.reduce((n, r) => n + r.quantity, 0),
    createdAt: o.created_at,
    subtotal: Number(o.subtotal),
    tax: Number(o.tax),
    serviceFee: Number(o.service_fee),
    customerNote: o.customer_note,
    updatedAt: o.updated_at,
    items: itemsRes.rows.map((r) => ({
      titleSnapshot: r.title_snapshot,
      unitPrice: Number(r.unit_price),
      quantity: r.quantity,
      lineTotal: Number(r.line_total),
      options: r.options_snapshot ?? [],
    })),
  };
}

function rowToSummary(r: {
  public_id: string;
  status: OrderStatus;
  source: string;
  external_ref: string | null;
  total: string;
  item_count: string;
  created_at: string;
  table_label: string | null;
}): StaffOrderSummary {
  return {
    publicId: r.public_id,
    status: r.status,
    source: r.source,
    tableLabel: r.table_label,
    externalRef: r.external_ref,
    total: Number(r.total),
    itemCount: Number(r.item_count),
    createdAt: r.created_at,
  };
}
