"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  );
}

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("orderId");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">訂單已送出</h1>
        {orderId ? (
          <p className="text-center text-sm text-gray-500">
            訂單編號：<span className="font-mono">{orderId}</span>
          </p>
        ) : (
          <p className="text-center text-sm text-gray-500">
            找不到訂單資料。
          </p>
        )}
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 text-center text-yellow-800 font-medium">
          請於用餐後至櫃台結帳，謝謝！
        </div>
        {orderId && (
          <button
            onClick={() => router.push(`/order/${orderId}`)}
            className="w-full py-3 bg-blue-600 rounded-xl text-white font-medium hover:bg-blue-700 transition"
          >
            查看訂單狀態
          </button>
        )}
        <button
          onClick={() => router.push("/")}
          className="w-full py-3 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200 transition"
        >
          回到首頁
        </button>
      </div>
    </div>
  );
}
