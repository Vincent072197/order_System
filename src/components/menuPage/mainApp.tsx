"use client";
import { useEffect, useRef, useState } from "react";
import Header from "./Header";
import NavBar from "./NavBar";
import FoodSection from "./FoodSection";
import { Tab } from "./tab";
import { useScrollSpy } from "../../hooks/useScrollSpy";
import { menu } from "../../Entities/menu";

function App() {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { setsectionRef, setTabRef, currentSection, handleTabClick } =
    useScrollSpy({
      scrollContainerRef,
      menu,
    });
  return (
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
              section={data}
              key={`section_${id}`}
            />
          );
        })}
        <div className=" w-full h-50"></div>
      </main>
    </div>
  );
}

export default App;
