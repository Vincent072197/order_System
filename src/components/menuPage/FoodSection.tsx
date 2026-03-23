import { useEffect, useRef, type RefCallback } from "react";
import type { ExtendTitleType, MenuType } from "../../Entities/menu";

type FoodSectionProps = {
  ref: RefCallback<HTMLDivElement>;
  section: MenuType;
};

export default function FoodSection({ section, ref }: FoodSectionProps) {
  const { title, details } = section;
  return (
    <>
      <div
        ref={ref}
        id={title}
        className={`scroll-mt-4 w-[90vw] mx-auto mt-8 bg-gray-50 min-h-[50vh] p-4 rounded-lg shadow-sm border border-gray-100`}
      >
        <h2 className="text-2xl font-bold mb-4">Testing</h2>
        <ol>
          {details.map((detail) => {
            return <li key={detail.title}>{detail.title}</li>;
          })}
        </ol>
      </div>
    </>
  );
}
