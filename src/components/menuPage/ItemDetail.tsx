"use client";
import { useEffect, useRef, useState, type RefCallback } from "react";
import { Item, ItemDetailsProps } from "@/src/components/menuPage/DishItem";
import { OptionCard } from "@/src/components/menuPage/OptionCard";
import { ItemOptions } from "@/src/Entities/menu";
import { useCartContext } from "@/src/context/CartContext";

export type Selected = Record<
  ItemOptions["optionTitle"],
  ItemOptions["subOptions"][number] | null
> | null;

export default function ItemDetail({
  itemDetails,
  handleSelectedItem,
}: ItemDetailsProps) {
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Selected>(null);
  const { setItem, cart } = useCartContext();
  const { title, price, options } = itemDetails;
  const handleClose = () => {
    handleSelectedItem(null);
  };

  return (
    <div
      className="fixed inset-0 z-1000 flex items-end bg-gray-900/40 backdrop-blur-sm p-0 "
      onClick={handleClose}
    >
      <div
        className="relative flex inset-0 flex-col w-full h-full bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-md z-10 sticky top-0">
          <h2 className="text-xl font-extrabold text-gray-900 line-clamp-1">
            {title}
          </h2>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Placeholder for Item Image (圖片佔位) */}
          <div className="w-full h-48 rounded-2xl bg-linear-to-br from-orange-100 to-red-50 flex items-center justify-center border border-orange-50">
            <span className="text-orange-300 font-medium">
              Image Placeholder
            </span>
          </div>
          {/* options */}
          <ol className="flex flex-col gap-4">
            {options?.map((option, index) => (
              <OptionCard
                key={`subOption-${index}`}
                {...option}
                selected={selected}
                setSelected={setSelected}
              />
            ))}
          </ol>
        </div>
        {/** -----------sticky area-------- */}
        <div className="p-4 sm:p-6 bg-white shadow-[0_-8px_10px_-6px_#fca5a5] sticky bottom-0 z-10 flex">
          <div className="flex items-center gap-4 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
            <button
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 hover:text-orange-600 disabled:opacity-30 transition-colors"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
            >
              —
            </button>
            <span className="w-6 text-center font-bold text-gray-900">
              {quantity}
            </span>
            <button
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 hover:text-orange-600 transition-colors"
              onClick={() => setQuantity((q) => q + 1)}
            >
              +
            </button>
          </div>
          <button
            className=" w-full flex items-center justify-center gap-2 py-4  bg-orange-500 text-white font-bold text-lg shadow-lg shadow-orange-200/50 hover:bg-orange-600 hover:shadow-orange-300/50 active:scale-[0.98] transition-all"
            onClick={() => {
              const hasEmptyRequiredField = options?.some(
                (option: ItemOptions) => {
                  return option.required && !selected?.[option.optionTitle];
                },
              );
              if (hasEmptyRequiredField) return alert("有必填項目未填");
              /** format of cart data
               *  {title:title,quantity:quantity,customize:Selected}
               */
              setItem({ title, quantity, customize: selected });
              handleClose();
            }}
          >
            加入購物車
          </button>
        </div>
      </div>
    </div>
  );
}
