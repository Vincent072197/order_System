"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StaffOrderSummary } from "@/src/lib/staffOrders";
import { STATUS_BADGE, STATUS_LABEL } from "./statusMeta";

const POLL_MS = 4000;

export default function OrdersBoard({
  initial,
}: {
  initial: StaffOrderSummary[];
}) {
  const [orders, setOrders] = useState(initial);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch("/api/staff/orders", {
          credentials: "same-origin",
        });
        if (!res.ok) {
          if (alive) setStale(true);
          return;
        }
        const data = (await res.json()) as { orders: StaffOrderSummary[] };
        if (alive) {
          setOrders(data.orders);
          setStale(false);
        }
      } catch {
        if (alive) setStale(true);
      }
    }
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (orders.length === 0) {
    return <p className="text-gray-500">目前沒有訂單。</p>;
  }

  return (
    <div className="space-y-3">
      {stale && (
        <p className="text-xs text-amber-600">
          ⚠️ 即時更新中斷，顯示的可能不是最新資料。
        </p>
      )}
      {orders.map((o) => (
        <Link
          key={o.publicId}
          href={`/staff/orders/${o.publicId}`}
          className="flex items-center justify-between bg-white rounded-xl shadow px-4 py-3 hover:shadow-md transition"
        >
          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-2 py-1 rounded-full ${STATUS_BADGE[o.status]}`}
            >
              {STATUS_LABEL[o.status]}
            </span>
            <span className="font-medium">{o.tableLabel ?? o.source}</span>
            <span className="text-sm text-gray-500">{o.itemCount} 項</span>
          </div>
          <div className="text-right">
            <div className="font-semibold">NT$ {o.total}</div>
            <div className="text-xs text-gray-400">{formatTime(o.createdAt)}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
