import { useEffect, useRef, type RefCallback } from "react";
import type {
  DetailType,
  ExtendTitleType,
  MenuType,
} from "../../Entities/menu";
import { Item } from "@/src/components/menuPage/DishItem";

type FoodSectionProps = {
  ref: RefCallback<HTMLDivElement>;
  section: MenuType;
  handleSelectedItem: (item: DetailType | null) => void;
};

export default function FoodSection({
  section,
  ref,
  handleSelectedItem,
}: FoodSectionProps) {
  const { title, details } = section;
  return (
    <>
      <section
        ref={ref}
        id={title}
        className={`scroll-mt-2 w-full mx-auto mt-2 bg-gray-50  p-2 rounded-lg shadow-sm border border-gray-100`}
      >
        <h2 className="text-2xl font-bold mb-4">Testing</h2>
        <ol className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {details.map((detail) => {
            return (
              <Item
                key={`Item-${detail.title}`}
                itemDetails={detail}
                handleSelectedItem={handleSelectedItem}
              />
            );
          })}
        </ol>
      </section>
    </>
  );
}
