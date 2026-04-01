"use client";
import { useCartContext } from "@/src/context/CartContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
export default function Checkout() {
  const { cart, reset } = useCartContext();
  const router = useRouter();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  useEffect(() => {
    reset();
  }, []);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">Your Order</h1>

        {cart.map((item) => (
          <div key={item.uuid} className="flex justify-between border-b pb-3">
            <div>
              <p className="font-semibold">{item.title}</p>
              {item.customize &&
                Object.entries(item.customize).map(([key, value]) => (
                  <p key={key} className="text-sm text-gray-500">
                    {key}: {value}
                  </p>
                ))}
              <p className="text-sm text-gray-400">x{item.quantity}</p>
            </div>
            <p className="font-medium">
              ${(item.price * item.quantity).toFixed(2)}
            </p>
          </div>
        ))}

        <div className="flex justify-between text-lg font-bold pt-2">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>

        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 text-center text-yellow-800 font-medium">
          Please pay at the counter after your meal. Thank you!
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full py-3 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200 transition"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}
