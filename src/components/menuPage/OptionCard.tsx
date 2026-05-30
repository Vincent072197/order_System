import type { Dispatch, SetStateAction } from "react";
import type { ItemOptions } from "@/src/Entities/menu";

// Map of option group title -> set of selected choice ids.
export type SelectedChoices = Record<string, Set<string>>;

export type OptionCardProps = {
  group: ItemOptions;
  selected: SelectedChoices;
  setSelected: Dispatch<SetStateAction<SelectedChoices>>;
};

export function OptionCard({ group, selected, setSelected }: OptionCardProps) {
  const required = group.minChoices > 0;
  const isMulti = group.selectionKind === "multi";
  const picked = selected[group.title] ?? new Set<string>();

  function toggle(choiceId: string) {
    setSelected((prev) => {
      const next: SelectedChoices = { ...prev };
      const set = new Set(next[group.title] ?? []);
      if (isMulti) {
        if (set.has(choiceId)) set.delete(choiceId);
        else if (set.size < group.maxChoices) set.add(choiceId);
      } else {
        if (set.has(choiceId)) set.clear();
        else {
          set.clear();
          set.add(choiceId);
        }
      }
      next[group.title] = set;
      return next;
    });
  }

  if (!group.choices.length) return null;

  return (
    <li className="bg-white p-4 rounded-xl shadow-md border border-gray-100 mb-4">
      <h3 className={required ? "text-orange-500" : ""}>
        {required ? "*" : ""}
        {group.title}
        {isMulti
          ? ` (最多 ${group.maxChoices} 項)`
          : required
            ? " 必選"
            : ""}
      </h3>
      <ol>
        {group.choices.map((c) => {
          const isSelected = picked.has(c.id);
          return (
            <li key={c.id} className="block w-full">
              <label
                className={`flex items-center justify-between w-full px-2 py-3 rounded-lg cursor-pointer ${
                  isSelected ? "bg-amber-300" : ""
                }`}
              >
                <span>
                  {c.label}
                  {c.priceDelta !== 0 ? ` (+${c.priceDelta.toFixed(2)})` : ""}
                </span>
                <input
                  type={isMulti ? "checkbox" : "radio"}
                  name={group.title}
                  checked={isSelected}
                  onChange={() => toggle(c.id)}
                />
              </label>
            </li>
          );
        })}
      </ol>
    </li>
  );
}
