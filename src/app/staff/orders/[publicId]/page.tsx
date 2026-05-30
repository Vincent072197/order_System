import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/src/lib/auth/server";
import { getOrderDetailForStaff } from "@/src/lib/staffOrders";
import { allowedNextStatuses } from "@/src/lib/orders";
import { STATUS_BADGE, STATUS_LABEL } from "../statusMeta";
import StatusActions from "./StatusActions";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>; // Next 16: params is a Promise
}) {
  const staff = await requireStaff();
  const { publicId } = await params;

  // Guard before hitting the DB: a non-UUID would make the uuid column query
  // throw rather than cleanly 404.
  if (!UUID_RE.test(publicId)) notFound();

  const order = await getOrderDetailForStaff(staff.restaurantId, publicId);
  if (!order) notFound();

  // Single source of truth (orders.ts) decides which buttons this role gets.
  const nextStatuses = allowedNextStatuses(order.status, staff.role);

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {order.tableLabel ? `桌號 ${order.tableLabel}` : order.source}
        </h1>
        <Link
          href="/staff/orders"
          className="text-sm text-blue-600 hover:underline"
        >
          ← 訂單列表
        </Link>
      </div>

      <section className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span
            className={`text-sm px-3 py-1 rounded-full ${STATUS_BADGE[order.status]}`}
          >
            {STATUS_LABEL[order.status]}
          </span>
          <span className="text-xs text-gray-400">來源：{order.source}</span>
        </div>

        <ul className="divide-y">
          {order.items.map((it, i) => (
            <li key={i} className="py-3 flex justify-between gap-4">
              <div>
                <div className="font-medium">
                  {it.quantity}x {it.titleSnapshot}
                </div>
                {it.options.length > 0 && (
                  <div className="text-sm text-gray-500">
                    {it.options.map((o) => o.label).join(", ")}
                  </div>
                )}
              </div>
              <div className="text-right whitespace-nowrap">NT$ {it.lineTotal}</div>
            </li>
          ))}
        </ul>

        {order.customerNote && (
          <p className="text-sm bg-amber-50 text-amber-800 rounded-lg p-3">
            備註：{order.customerNote}
          </p>
        )}

        <div className="flex justify-between border-t pt-4 font-semibold">
          <span>合計</span>
          <span>NT$ {order.total}</span>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">狀態變更</h2>
        <StatusActions
          publicId={order.publicId}
          current={order.status}
          allowed={nextStatuses}
        />
      </section>
    </main>
  );
}
