import { Selected } from "@/src/components/menuPage/ItemDetail";
import { ItemOptions } from "@/src/Entities/menu";
import { SetStateAction, useState } from "react";

export type OptionCardProps = ItemOptions & {
  selected: Selected;
  setSelected: React.Dispatch<SetStateAction<Selected>>;
};
export function OptionCard({
  optionTitle,
  subOptions,
  required,
  selected,
  setSelected,
}: OptionCardProps) {
  if (!subOptions?.length) return <></>;
  let title = <h3>{optionTitle}</h3>;
  if (required) {
    title = <h3 className="text-orange-500">*{optionTitle} 必選</h3>;
  }
  function handleSelected(subTitle: ItemOptions["subOptions"][number] | null) {
    setSelected((prev) => {
      const nextSelected = prev ?? {};
      return {
        ...nextSelected,
        [optionTitle]: subTitle,
      };
    });
  }
  return (
    <li className="bg-white p-4 rounded-xl shadow-md border border-gray-100 mb-4">
      {title}
      <ol>
        {subOptions.map((subTitle, idx) => {
          const isSelected = selected?.[optionTitle] === subTitle;
          return (
            <li key={`${subTitle}-${idx}`} className="block w-full">
              <label
                className={`flex items-center justify-between w-full px-2 py-3 rounded-lg cursor-pointer ${isSelected ? "bg-amber-300" : ""}`}
              >
                {subTitle}
                <input
                  type="radio"
                  name={optionTitle}
                  checked={isSelected}
                  onChange={() => {}}
                  onClick={() => handleSelected(isSelected ? null : subTitle)}
                />
              </label>
            </li>
          );
        })}
      </ol>
    </li>
  );
}
