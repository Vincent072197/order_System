import pool from "./db";

// ---------------------------------------------------------------------------
// P5 — sales dashboard read model (owner/manager).
//
// All "today" windows are bucketed in Asia/Taipei (Vercel runs in UTC, the
// shop thinks in local time). Revenue counts every non-cancelled order.
// "Top items" group by title_snapshot so deleted menu items still aggregate
// (menu_item_id can be NULL after a delete — see migration 0005).
// Average prep time is derived from audit_log: 確認接單 (→preparing) until
// 訂單完成 (→completed).
// ---------------------------------------------------------------------------

const TZ = "Asia/Taipei";

export type HourBucket = { hour: number; revenue: number; count: number };
export type TopItem = { title: string; qty: number; revenue: number };
export type DashboardStats = {
  todayRevenue: number;
  todayOrders: number;
  avgPrepMinutes: number | null;
  byHour: HourBucket[];
  topItems: TopItem[];
};

export async function getDashboardStats(
  restaurantId: number,
): Promise<DashboardStats> {
  const today = `(o.created_at AT TIME ZONE '${TZ}')::date = (now() AT TIME ZONE '${TZ}')::date`;

  const summary = await pool.query<{ revenue: string; orders: string }>(
    `SELECT COALESCE(SUM(o.total), 0)::text AS revenue,
            COUNT(*)::text                   AS orders
       FROM orders o
      WHERE o.restaurant_id = $1
        AND o.status <> 'cancelled'
        AND ${today}`,
    [restaurantId],
  );

  const byHour = await pool.query<{ hour: number; revenue: string; cnt: number }>(
    `SELECT EXTRACT(HOUR FROM (o.created_at AT TIME ZONE '${TZ}'))::int AS hour,
            SUM(o.total)::text AS revenue,
            COUNT(*)::int      AS cnt
       FROM orders o
      WHERE o.restaurant_id = $1
        AND o.status <> 'cancelled'
        AND ${today}
      GROUP BY 1
      ORDER BY 1`,
    [restaurantId],
  );

  const topItems = await pool.query<{ title: string; qty: number; revenue: string }>(
    `SELECT oi.title_snapshot AS title,
            SUM(oi.quantity)::int    AS qty,
            SUM(oi.line_total)::text AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id = $1
        AND o.status <> 'cancelled'
        AND ${today}
      GROUP BY oi.title_snapshot
      ORDER BY qty DESC, revenue DESC
      LIMIT 10`,
    [restaurantId],
  );

  // Prep time: first →preparing to first →completed per order, today, this shop.
  const prep = await pool.query<{ avg_min: string | null }>(
    `WITH prep AS (
        SELECT entity_id, MIN(occurred_at) AS t
          FROM audit_log
         WHERE action = 'order.status_change'
           AND payload->>'to_status' = 'preparing'
         GROUP BY entity_id
      ),
      done AS (
        SELECT entity_id, MIN(occurred_at) AS t
          FROM audit_log
         WHERE action = 'order.status_change'
           AND payload->>'to_status' = 'completed'
         GROUP BY entity_id
      )
      SELECT AVG(EXTRACT(EPOCH FROM (done.t - prep.t)) / 60.0)::text AS avg_min
        FROM prep
        JOIN done USING (entity_id)
        JOIN orders o ON o.public_id::text = prep.entity_id
       WHERE o.restaurant_id = $1
         AND done.t > prep.t
         AND (prep.t AT TIME ZONE '${TZ}')::date = (now() AT TIME ZONE '${TZ}')::date`,
    [restaurantId],
  );

  const avgMin = prep.rows[0]?.avg_min;

  return {
    todayRevenue: Number(summary.rows[0].revenue),
    todayOrders: Number(summary.rows[0].orders),
    avgPrepMinutes: avgMin == null ? null : Math.round(Number(avgMin) * 10) / 10,
    byHour: byHour.rows.map((r) => ({
      hour: r.hour,
      revenue: Number(r.revenue),
      count: r.cnt,
    })),
    topItems: topItems.rows.map((r) => ({
      title: r.title,
      qty: r.qty,
      revenue: Number(r.revenue),
    })),
  };
}
