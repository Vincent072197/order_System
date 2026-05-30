// Client-only: remembers the order IDs this device has placed, so the customer
// can see their order history without any login (same trust model as the table
// QR). Stored in localStorage; capped so it can't grow unbounded.

const KEY = "ordersys.orders.v1";
const MAX = 50;

export type OrderRecord = { id: string; tableId: string | null; at: number };

export function recordOrder(id: string, tableId: string | null, at: number): void {
  if (typeof window === "undefined") return;
  const list = getOrderRecords().filter((r) => r.id !== id);
  list.unshift({ id, tableId, at });
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage full / disabled — history is best-effort */
  }
}

export function getOrderRecords(): OrderRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is OrderRecord =>
        !!r && typeof (r as OrderRecord).id === "string",
    );
  } catch {
    return [];
  }
}
