"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCartContext } from "@/src/context/CartContext";

// "/" has no table context. If this device already scanned a table this
// session, send them back to that menu (so "回首頁" isn't a dead-end that
// forces a re-scan); otherwise prompt to scan. Ordering still only happens
// via /table/<uuid> (CLAUDE.md §7) — this just routes there.
export default function HomeGate() {
  const { tableId } = useCartContext();
  const router = useRouter();

  useEffect(() => {
    if (tableId) router.replace(`/table/${tableId}`);
  }, [tableId, router]);

  if (tableId) return null; // redirecting

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center text-gray-600">
      <h1 className="text-2xl font-bold mb-2">請掃描桌邊 QR 碼</h1>
      <p>掃描桌上的 QR code 即可開始點餐。</p>
    </main>
  );
}
