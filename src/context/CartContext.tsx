"use client";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CartItem = Record<string, any>;

type CartContextType = {
  cart: CartItem[];
  setItem: (idObject: CartItem) => void;
} | null;

const CartContext = createContext<CartContextType>(null);

export default function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  useEffect(() => {
    console.log(cart);
  }, [cart]);
  const setItem = (idObject: CartItem) => {
    const newItem = { ...idObject, uuid: generateUuid() };
    setCart((prev) => [...prev, newItem]);
  };

  const value = {
    cart,
    setItem,
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
