"use client";

import { useMemo, useState } from "react";
import type { ItemDetailsProps } from "@/src/components/menuPage/DishItem";
import {
  OptionCard,
  type SelectedChoices,
} from "@/src/components/menuPage/OptionCard";
import type { ItemOptions } from "@/src/Entities/menu";
import { useCartContext } from "@/src/context/CartContext";
import { useToast } from "@/src/components/ui/Toast";

export default function ItemDetail({
  itemDetails,
  handleSelectedItem,
}: ItemDetailsProps) {
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<SelectedChoices>(() =>
    initialSelection(itemDetails.options),
  );
  const { addItem } = useCartContext();
  const toast = useToast();
  const { id, title, price, options } = itemDetails;
  const handleClose = () => handleSelectedItem(null);

  const livePrice = useMemo(() => {
    let p = price;
    for (const g of options) {
      const set = selected[g.title];
      if (!set) continue;
      for (const c of g.choices) if (set.has(c.id)) p += c.priceDelta;
    }
    return p;
  }, [options, selected, price]);

  function handleAdd() {
    for (const g of options) {
      const set = selected[g.title] ?? new Set<string>();
      if (set.size < g.minChoices) {
        alert(`「${g.title}」至少需選 ${g.minChoices} 項`);
        return;
      }
      if (set.size > g.maxChoices) {
        alert(`「${g.title}」最多 ${g.maxChoices} 項`);
        return;
      }
    }
    const choices = options.flatMap((g) => {
      const set = selected[g.title] ?? new Set<string>();
      return g.choices
        .filter((c) => set.has(c.id))
        .map((c) => ({
          groupTitle: g.title,
          choiceId: c.id,
          label: c.label,
          priceDelta: c.priceDelta,
        }));
    });
    addItem({
      menuItemId: id,
      title,
      unitPriceDisplay: livePrice,
      quantity,
      choices,
      note: "",
    });
    toast(`已加入購物車：${title} ×${quantity}`, "success");
    handleClose();
  }

  return (
    <div
      className="fixed inset-0 z-1000 flex items-end bg-gray-900/40 backdrop-blur-sm p-0"
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
          <div className="w-full h-48 rounded-2xl bg-linear-to-br from-orange-100 to-red-50 flex items-center justify-center border border-orange-50">
            <span className="text-orange-300 font-medium">
              Image Placeholder
            </span>
          </div>
          <ol className="flex flex-col gap-4">
            {options.map((group) => (
              <OptionCard
                key={group.title}
                group={group}
                selected={selected}
                setSelected={setSelected}
              />
            ))}
          </ol>
        </div>
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
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            >
              +
            </button>
          </div>
          <button
            className="w-full flex items-center justify-center gap-2 py-4 bg-orange-500 text-white font-bold text-lg shadow-lg shadow-orange-200/50 hover:bg-orange-600 hover:shadow-orange-300/50 active:scale-[0.98] transition-all"
            onClick={handleAdd}
          >
            加入購物車 ${(livePrice * quantity).toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}

function initialSelection(options: ItemOptions[]): SelectedChoices {
  const out: SelectedChoices = {};
  for (const g of options) {
    const defaults = new Set(
      g.choices.filter((c) => c.isDefault).map((c) => c.id),
    );
    out[g.title] = defaults;
  }
  return out;
}
