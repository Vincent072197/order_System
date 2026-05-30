"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicOrderView } from "@/src/lib/orders";
import { getOrderRecords } from "@/src/lib/orderHistoryClient";
import { STATUS_BADGE, STATUS_LABEL } from "@/src/app/staff/orders/statusMeta";

type Row = PublicOrderView & { itemCount: number };

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [backTableId, setBackTableId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const records = getOrderRecords();
      const back = records.find((r) => r.tableId)?.tableId ?? null;
      const results = await Promise.all(
        records.map(async (rec) => {
          try {
            const res = await fetch(`/api/orders/${rec.id}`, {
              credentials: "same-origin",
            });
            if (!res.ok) return null;
            const data = (await res.json()) as { order: PublicOrderView };
            const o = data.order;
            return {
              ...o,
              itemCount: o.items.reduce((n, it) => n + it.quantity, 0),
            } as Row;
          } catch {
            return null;
          }
        }),
      );
      if (!alive) return;
      setBackTableId(back);
      setRows(results.filter((r): r is Row => r !== null));
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">歷史訂單</h1>
          {backTableId && (
            <Link
              href={`/table/${backTableId}`}
              className="text-sm text-blue-600 hover:underline"
            >
              繼續點餐 →
            </Link>
          )}
        </div>

        {rows === null && (
          <div className="space-y-3 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 bg-white rounded-2xl shadow" />
            ))}
          </div>
        )}

        {rows !== null && rows.length === 0 && (
          <p className="text-gray-500 bg-white rounded-2xl shadow p-6 text-center">
            這台裝置還沒有訂單紀錄。
          </p>
        )}

        {rows !== null && rows.length > 0 && (
          <div className="space-y-3">
            {rows.map((o) => (
              <Link
                key={o.publicId}
                href={`/order/${o.publicId}`}
                className="block bg-white rounded-2xl shadow px-4 py-3 hover:shadow-md transition"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${STATUS_BADGE[o.status]}`}
                  >
                    {STATUS_LABEL[o.status]}
                  </span>
                  <span className="font-semibold">NT$ {o.total}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                  <span>
                    {o.tableLabel ? `桌號 ${o.tableLabel}` : ""} · {o.itemCount} 項
                  </span>
                  <span>{formatTime(o.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
