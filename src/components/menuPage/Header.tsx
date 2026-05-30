"use client";
import { useCartContext } from "@/src/context/CartContext";
import Link from "next/link";

export default function Header() {
  const { cart } = useCartContext();
  const itemCount = cart?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <header className="fixed top-0 left-0 w-full bg-white text-black shadow-md z-50 h-16 flex items-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
        <h1 className="text-xl font-bold">菜單</h1>
        <div className="flex items-center gap-5">
          {/* 歷史訂單 — receipt icon, no cart badge */}
          <Link href="/history" aria-label="歷史訂單" className="text-2xl leading-none">
            🧾
          </Link>
          {/* 購物車 — cart icon with item-count badge */}
          <Link
            href="/Cart"
            aria-label="購物車"
            className="relative text-2xl leading-none"
          >
            🛒
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
