"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/src/lib/orders";
import { STATUS_LABEL, TRANSITION_ACTION_LABEL } from "../statusMeta";

export default function StatusActions({
  publicId,
  current,
  allowed,
}: {
  publicId: string;
  current: OrderStatus;
  allowed: OrderStatus[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function transition(to: OrderStatus) {
    setBusy(to);
    setError(null);
    try {
      // Double-submit CSRF: echo the non-httpOnly cookie back as a header.
      const csrf = readCookie("staff_csrf");
      const res = await fetch(`/api/staff/orders/${publicId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(csrf ? { "x-csrf-token": csrf } : {}),
        },
        credentials: "same-origin",
        body: JSON.stringify({ toStatus: to }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `更新失敗 (${res.status})`);
        return;
      }
      // Server component re-renders with the new status + new allowed buttons.
      router.refresh();
    } catch {
      setError("網路錯誤，請重試。");
    } finally {
      setBusy(null);
    }
  }

  if (allowed.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        此訂單（{STATUS_LABEL[current]}）沒有可執行的狀態變更。
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {allowed.map((to) => (
          <button
            key={to}
            onClick={() => transition(to)}
            disabled={busy !== null}
            className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 ${
              to === "cancelled"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {busy === to
              ? "處理中…"
              : (TRANSITION_ACTION_LABEL[to] ?? `→ ${STATUS_LABEL[to]}`)}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix))
      return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}
