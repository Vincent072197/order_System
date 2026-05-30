"use client";

import { useEffect, useState } from "react";
import type { PublicOrderView } from "@/src/lib/orders";
import { STATUS_BADGE, STATUS_LABEL } from "@/src/app/staff/orders/statusMeta";

const POLL_MS = 5000;

// Customer-facing one-liner per status.
const STATUS_DESC: Record<string, string> = {
  pending: "已送出，等待餐廳確認…",
  confirmed: "餐廳已確認，準備開始製作",
  preparing: "餐點製作中 🍳",
  ready: "餐點完成，即將送達 / 可取餐",
  served: "已送達，請慢用 🙂",
  completed: "訂單已完成，感謝光臨！",
  cancelled: "訂單已取消",
};

// The happy-path step order for the progress bar.
const FLOW = ["pending", "confirmed", "preparing", "ready", "served", "completed"];

export default function OrderStatusView({ initial }: { initial: PublicOrderView }) {
  const [order, setOrder] = useState(initial);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch(`/api/orders/${initial.publicId}`, {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { order: PublicOrderView };
        if (alive) setOrder(data.order);
      } catch {
        /* transient; next tick retries */
      }
    }
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [initial.publicId]);

  const isCancelled = order.status === "cancelled";
  const currentStep = FLOW.indexOf(order.status);

  return (
    <div className="bg-white rounded-2xl shadow p-6 space-y-5">
      <div className="text-center">
        {order.tableLabel && (
          <p className="text-sm text-gray-400">桌號 {order.tableLabel}</p>
        )}
        <span
          className={`inline-block mt-2 text-sm px-3 py-1 rounded-full ${STATUS_BADGE[order.status]}`}
        >
          {STATUS_LABEL[order.status]}
        </span>
        <p className="mt-3 text-gray-700">{STATUS_DESC[order.status]}</p>
      </div>

      {!isCancelled && (
        <div className="flex items-center justify-between">
          {FLOW.slice(0, 5).map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full ${
                  i <= currentStep ? "bg-emerald-500" : "bg-gray-200"
                }`}
              />
              <span className="text-[10px] text-gray-400 mt-1">
                {STATUS_LABEL[FLOW[i] as keyof typeof STATUS_LABEL]}
              </span>
            </div>
          ))}
        </div>
      )}

      <ul className="divide-y border-t pt-3">
        {order.items.map((it, i) => (
          <li key={i} className="py-2 flex justify-between gap-4 text-sm">
            <div>
              <div className="font-medium">
                {it.quantity}x {it.titleSnapshot}
              </div>
              {it.options.length > 0 && (
                <div className="text-gray-400">{it.options.join(", ")}</div>
              )}
            </div>
            <div className="whitespace-nowrap">NT$ {it.lineTotal}</div>
          </li>
        ))}
      </ul>

      <div className="flex justify-between font-semibold border-t pt-3">
        <span>合計</span>
        <span>NT$ {order.total}</span>
      </div>

      <p className="text-center text-xs text-gray-400">此頁會自動更新訂單狀態</p>
    </div>
  );
}
