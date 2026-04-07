"use client";
import { useCartContext } from "@/src/context/CartContext";
import Link from "next/link";
export default function Header() {
  const { cart } = useCartContext();
  const itemCount = cart?.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <header className="fixed top-0 left-0 w-full bg-white text-black shadow-md z-50 h-16 flex items-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <h1 className="text-xl font-bold">My Test App</h1>
      </div>
      <Link href="/Cart" className="relative pr-10">
        <span className="text-2xl">🛒</span>
        {itemCount > 0 && (
          <span
            className="absolute -top-2 right-8 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center 
  justify-center"
          >
            {itemCount}
          </span>
        )}
      </Link>
      <Link href="/history" className="relative pr-10">
        <span className="text-2xl">🛒</span>
        {itemCount > 0 && (
          <span
            className="absolute -top-2 right-8 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center 
  justify-center"
          >
            {itemCount}
          </span>
        )}
      </Link>
    </header>
  );
}
