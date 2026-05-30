"use client";

import { useEffect, useRef, useState } from "react";
import Header from "./Header";
import NavBar from "./NavBar";
import FoodSection from "./FoodSection";
import { Tab } from "./tab";
import { useScrollSpy } from "../../hooks/useScrollSpy";
import {
  adaptApiMenu,
  type ApiMenu,
  type DetailType,
  type MenuUI,
} from "../../Entities/menu";
import ItemDetail from "@/src/components/menuPage/ItemDetail";
import MenuSkeleton from "@/src/components/menuPage/MenuSkeleton";
import { useCartContext } from "@/src/context/CartContext";

type Props = { tableId?: string };

function App({ tableId }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState<MenuUI | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<DetailType | null>(null);
  const { setTableId } = useCartContext();

  useEffect(() => {
    if (!tableId) return;
    setTableId(tableId);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/menu?tableId=${encodeURIComponent(tableId)}`, {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        const data = (await res.json()) as ApiMenu;
        if (!cancelled) setMenu(adaptApiMenu(data));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tableId, setTableId]);

  const categories = menu?.categories ?? [];
  const { setsectionRef, setTabRef, currentSection, handleTabClick } =
    useScrollSpy({ scrollContainerRef, menu: categories });

  if (!tableId) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center text-gray-600">
        <h1 className="text-2xl font-bold mb-2">請掃描桌面 QR 碼</h1>
        <p>無桌號無法點餐。</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center text-red-600">
        <h1 className="text-2xl font-bold mb-2">無法載入菜單</h1>
        <p>{error}</p>
      </main>
    );
  }
  if (!menu) {
    return <MenuSkeleton />;
  }

  return (
    <>
      <div className="pt-32 min-h-screen">
        <Header />
        <NavBar currentSection={currentSection}>
          {categories.map(({ id, title }) => (
            <Tab
              key={id}
              ref={(node) => setTabRef(id, node)}
              title={title}
              isActive={currentSection === id}
              onClick={() => handleTabClick(id)}
            />
          ))}
        </NavBar>
        <main
          ref={scrollContainerRef}
          className="fixed top-32 w-full overflow-y-auto h-[calc(100vh-8rem)]"
        >
          {categories.map((cat) => (
            <FoodSection
              ref={(node) => setsectionRef(cat.id, node)}
              handleSelectedItem={setSelectedItem}
              section={cat}
              key={`section_${cat.id}`}
            />
          ))}
          <div className="w-full h-50" />
        </main>
      </div>
      {selectedItem && (
        <ItemDetail
          itemDetails={selectedItem}
          handleSelectedItem={setSelectedItem}
        />
      )}
    </>
  );
}

export default App;
