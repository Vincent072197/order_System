import { type ReactNode } from "react";
import type { ExtendTitleType } from "../../Entities/menu";

type NavBarProps = {
  currentSection: ExtendTitleType;
  children: ReactNode;
};

export default function NavBar({ currentSection, children }: NavBarProps) {
  return (
    <nav className="fixed top-16 left-0 w-full bg-white shadow-sm border-b border-gray-200 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ul className="flex flex-row justify-start items-center h-16 w-full overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {children}
        </ul>
      </div>
    </nav>
  );
}
