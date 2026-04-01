"use client";
import { useCartContext } from "@/src/context/CartContext";
import { useRouter } from "next/navigation";
export function CartPage() {
  const router = useRouter();
  const { cart, removeItem, updateQuantity, reset } = useCartContext();
  if (!cart?.length)
    return (
      <div className="max-w-lg mx-auto p-6 text-center space-y-4">
        <p className="text-gray-500 text-lg">Your cart is empty.</p>
        <button
          onClick={() => router.push("/")}
          className="bg-black text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 transition"
        >
          Order More
        </button>
      </div>
    );
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <div className="max-w-lg mx-auto p-6 flex flex-col min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Your Cart</h1>

      <div className="flex-1 space-y-4">
        {cart.map((item) => (
          <div
            key={item.uuid}
            className="border rounded-xl p-4 flex justify-between items-start"
          >
            <div className="flex-1">
              <p className="font-semibold">{item.title}</p>
              {item.customize && (
                <ul className="text-xs text-gray-400 mt-1">
                  {Object.entries(item.customize).map(([key, val]) => (
                    <li key={key}>
                      {key}: {String(val)}
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => removeItem(item.uuid!)}
                className="text-xs text-red-400 hover:text-red-600 mt-2"
              >
                Remove
              </button>
            </div>

            <div className="flex flex-col items-end gap-2 ml-4">
              <p className="font-bold">
                ${(item.price * item.quantity).toFixed(2)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.uuid!, -1)}
                  className="w-7 h-7 rounded-full border flex items-center justify-center text-lg hover:bg-gray-100"
                >
                  −
                </button>
                <span className="w-4 text-center font-medium">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.uuid!, +1)}
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
        <span>Total</span>
        <span>${total.toFixed(2)}</span>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => router.push("/")}
          className="flex-1 border-2 border-black text-black px-4 py-3 rounded-xl font-semibold hover:bg-gray-100 transition"
        >
          繼續
        </button>
        <button
          onClick={() => {
            router.push("/checkout");
          }}
          className="flex-1 bg-black text-white px-4 py-3 rounded-xl font-semibold hover:bg-gray-800 transition"
        >
          送出
        </button>
      </div>
    </div>
  );
}
