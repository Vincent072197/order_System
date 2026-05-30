import type { DetailType } from "@/src/Entities/menu";

export type ItemDetailsProps = {
  itemDetails: DetailType;
  handleSelectedItem: (item: DetailType | null) => void;
};

export function Item({ itemDetails, handleSelectedItem }: ItemDetailsProps) {
  const { title, price, isAvailable } = itemDetails;
  return (
    <li className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-100 transition-all duration-300 p-4">
      <div className="flex flex-wrap items-center justify-between gap-y-4 gap-x-6">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-800 group-hover:text-orange-600 transition-colors mb-1">
            {title}
          </h3>
          {!isAvailable && (
            <p className="text-xs text-red-500">目前缺貨</p>
          )}
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
          <div className="flex flex-col items-start sm:items-end">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              Price
            </span>
            <span className="text-xl font-black text-gray-900">
              ${price.toFixed(2)}
            </span>
          </div>
          <button
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-100 hover:bg-orange-600 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`Add ${title} to cart`}
            onClick={() => handleSelectedItem(itemDetails)}
            disabled={!isAvailable}
          >
            +
          </button>
        </div>
      </div>
    </li>
  );
}
