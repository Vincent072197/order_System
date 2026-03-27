"use client";
import { useEffect, useRef, useState } from "react";
import Header from "./Header";
import NavBar from "./NavBar";
import FoodSection from "./FoodSection";
import { Tab } from "./tab";
import { useScrollSpy } from "../../hooks/useScrollSpy";
import { DetailType, menu } from "../../Entities/menu";
import CartProvider from "@/src/context/CartContext";
import ItemDetail from "@/src/components/menuPage/ItemDetail";

function App() {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { setsectionRef, setTabRef, currentSection, handleTabClick } =
    useScrollSpy({
      scrollContainerRef,
      menu,
    });
  const [selectedItem, setSelectedItem] = useState<DetailType | null>(null);
  function handleSelectedItem(item: DetailType | null) {
    setSelectedItem(item);
  }
  return (
    <CartProvider>
      <div className="pt-32 min-h-screen">
        <Header />
        <NavBar currentSection={currentSection}>
          {menu.map((data, idx) => {
            const { id, title } = data;
            return (
              <Tab
                key={id}
                ref={(node: HTMLElement | null) => {
                  setTabRef(id, node);
                }}
                title={title}
                isActive={currentSection === id}
                onClick={() => handleTabClick(id)}
              />
            );
          })}
        </NavBar>
        <main
          ref={scrollContainerRef}
          className="fixed top-32 w-full overflow-y-auto h-[calc(100vh-8rem)]"
        >
          {menu.map((data, index) => {
            const { id } = data;
            return (
              <FoodSection
                ref={(node) => {
                  setsectionRef(id, node);
                }}
                handleSelectedItem={handleSelectedItem}
                section={data}
                key={`section_${id}`}
              />
            );
          })}
          <div className=" w-full h-50"></div>
        </main>
      </div>
      {selectedItem && (
        <ItemDetail
          itemDetails={selectedItem}
          handleSelectedItem={handleSelectedItem}
        />
      )}
    </CartProvider>
  );
}

export default App;
