import { useEffect, useRef, useState } from "react";
import type { ExtendTitleType, MenuType } from "../Entities/menu";

export function useScrollSpy<T extends MenuType>({
  scrollContainerRef,
  menu,
}: {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  menu: readonly T[];
}) {
  const [currentSection, setCurrentSection] = useState<ExtendTitleType>(
    menu[0].title,
  );
  const sectionRefs = useRef<Map<string, HTMLElement>>(
    new Map<string, HTMLElement>(),
  );
  const tabsRef = useRef<Map<string, HTMLElement>>(
    new Map<string, HTMLElement>(),
  );
  const isByClickRef = useRef(false);
  const clickTimeoutRef = useRef<any>(null);
  function handleTabClick(currentTab: ExtendTitleType) {
    isByClickRef.current = true;
    setCurrentSection(currentTab);
    handleSectionScroll(currentTab);
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      isByClickRef.current = false;
    }, 1000);
  }
  function handleSectionScroll(currentTab: ExtendTitleType) {
    const sectionEl = sectionRefs.current.get(currentTab);
    sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    const containerHeight = scrollContainer.clientHeight;
    let bottomRootMargin = Math.round(containerHeight - 300);
    if (bottomRootMargin > 0) {
      bottomRootMargin = -bottomRootMargin;
    }
    const options = {
      root: scrollContainer,
      rootMargin: `0px 0px ${bottomRootMargin}px 0px`,
      threshold: 0,
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isByClickRef.current) {
          const target = entry.target.id as ExtendTitleType;
          setCurrentSection(target);
        }
      });
    }, options);
    sectionRefs.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [scrollContainerRef]);
  useEffect(() => {
    const currentTabEl = tabsRef.current.get(currentSection);
    currentTabEl?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "smooth",
    });
  }, [currentSection]);

  function setsectionRef(section: string, node: HTMLElement | null) {
    if (node) sectionRefs.current.set(section, node);
    else sectionRefs.current.delete(section);
  }

  function setTabRef(tab: string, node: HTMLElement | null) {
    if (node) tabsRef.current.set(tab, node);
    else tabsRef.current.delete(tab);
  }
  return {
    setsectionRef,
    setTabRef,
    currentSection,
    handleTabClick,
  };
}
