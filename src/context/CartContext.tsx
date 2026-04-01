"use client";
import { Selected } from "@/src/components/menuPage/ItemDetail";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type CartItem = {
  title: string;
  price: number;
  quantity: number;
  customize: Selected;
  uuid?: string;
};

type CartContextType = {
  cart: CartItem[];
  setItem: (idObject: CartItem) => void;
  removeItem: (uuid: string) => void;
  updateQuantity: (uuid: string, delta: number) => void;
  reset: () => void;
} | null;

const CartContext = createContext<CartContextType>(null);

export default function CartProvider({ children }: { children: ReactNode }) {
  /** no useEffect need, pass a function to useState instead */
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("LeeStore");
    return saved ? JSON.parse(saved) : [];
  });

  const setItem = (idObject: CartItem) => {
    const newItem = { ...idObject, uuid: generateUuid() };
    setCart((prev) => [...prev, newItem]);
  };
  const removeItem = (uuid: string) => {
    setCart((prev) => prev.filter((item) => item.uuid !== uuid));
  };
  const updateQuantity = (uuid: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.uuid === uuid
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };
  const reset = () => {
    setCart([]);
  };
  const value = {
    cart,
    setItem,
    removeItem,
    updateQuantity,
    reset,
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCartContext must be used within Cart");
  return context;
}

const UUID_PATTERN = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";

function generateUuid() {
  return UUID_PATTERN.replace(/x/g, function () {
    return Math.floor(Math.random() * 16).toString(16);
  });
}
