"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export type CartChoice = {
  groupTitle: string;
  choiceId: string;
  label: string;
  priceDelta: number;
};

export type CartItem = {
  // Stable client-side id for list keys / removal. Not sent to server.
  uuid: string;
  // Canonical UUID of the menu item (server uses this to resolve price).
  menuItemId: string;
  // Display-only fields. Server recomputes prices using menuItemId + choiceIds.
  title: string;
  unitPriceDisplay: number;
  quantity: number;
  choices: CartChoice[];
  note: string;
};

type CartContextType = {
  cart: CartItem[];
  tableId: string | null;
  setTableId: (id: string) => void;
  addItem: (item: Omit<CartItem, "uuid">) => void;
  removeItem: (uuid: string) => void;
  updateQuantity: (uuid: string, delta: number) => void;
  reset: () => void;
};

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = "ordersys.cart.v1";

export default function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  const [tableId, setTableId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      /* quota / private mode */
    }
  }, [cart]);

  const addItem: CartContextType["addItem"] = (item) => {
    setCart((prev) => [...prev, { ...item, uuid: randomId() }]);
  };
  const removeItem: CartContextType["removeItem"] = (uuid) => {
    setCart((prev) => prev.filter((i) => i.uuid !== uuid));
  };
  const updateQuantity: CartContextType["updateQuantity"] = (uuid, delta) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.uuid === uuid ? { ...i, quantity: i.quantity + delta } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };
  const reset = () => setCart([]);

  return (
    <CartContext.Provider
      value={{
        cart,
        tableId,
        setTableId,
        addItem,
        removeItem,
        updateQuantity,
        reset,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCartContext() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCartContext must be used within CartProvider");
  return ctx;
}

function randomId(): string {
  // crypto.randomUUID is supported in modern browsers and Node 19+.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
