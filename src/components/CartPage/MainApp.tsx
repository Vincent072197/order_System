"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCartContext } from "@/src/context/CartContext";
import { useToast } from "@/src/components/ui/Toast";

export function CartPage() {
  const router = useRouter();
  const { cart, tableId, removeItem, updateQuantity, reset } = useCartContext();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (!cart.length) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center space-y-4">
        <p className="text-gray-500 text-lg">購物車是空的</p>
        <button
          onClick={() => router.back()}
          className="bg-black text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 transition"
        >
          回菜單
        </button>
      </div>
    );
  }

  const total = cart.reduce(
    (sum, item) => sum + item.unitPriceDisplay * item.quantity,
    0,
  );

  async function handleSubmit() {
    if (!tableId) {
      toast("請從桌邊 QR 碼進入再點餐。", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        tableId,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          quantity: c.quantity,
          choiceIds: c.choices.map((ch) => ch.choiceId),
          note: c.note,
        })),
        customerNote: "",
      };
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        orderId?: string;
        total?: number;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      toast("訂單已送出 🎉", "success");
      reset();
      router.push(`/checkout?orderId=${body.orderId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "下單失敗", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6 flex flex-col min-h-screen">
      <h1 className="text-2xl font-bold mb-6">購物車</h1>
      <div className="flex-1 space-y-4">
        {cart.map((item) => (
          <div
            key={item.uuid}
            className="border rounded-xl p-4 flex justify-between items-start"
          >
            <div className="flex-1">
              <p className="font-semibold">{item.title}</p>
              {item.choices.length > 0 && (
                <ul className="text-xs text-gray-400 mt-1">
                  {item.choices.map((c) => (
                    <li key={c.choiceId}>
                      {c.groupTitle}: {c.label}
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => removeItem(item.uuid)}
                className="text-xs text-red-400 hover:text-red-600 mt-2"
              >
                移除
              </button>
            </div>
            <div className="flex flex-col items-end gap-2 ml-4">
              <p className="font-bold">
                ${(item.unitPriceDisplay * item.quantity).toFixed(2)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.uuid, -1)}
                  className="w-7 h-7 rounded-full border flex items-center justify-center text-lg hover:bg-gray-100"
                >
                  −
                </button>
                <span className="w-4 text-center font-medium">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.uuid, +1)}
                  className="w-7 h-7 rounded-full border flex items-center justify-center text-lg hover:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 flex justify-between font-bold text-lg mt-6">
        <span>顯示金額</span>
        <span>${total.toFixed(2)}</span>
      </div>
      <p className="text-xs text-gray-400 mt-1">
        實際金額以送出後伺服器計算為準。
      </p>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => router.back()}
          className="flex-1 border-2 border-black text-black px-4 py-3 rounded-xl font-semibold hover:bg-gray-100 transition"
          disabled={submitting}
        >
          繼續
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 bg-black text-white px-4 py-3 rounded-xl font-semibold hover:bg-gray-800 transition disabled:opacity-50"
        >
          {submitting ? "送出中…" : "送出"}
        </button>
      </div>
    </div>
  );
}
