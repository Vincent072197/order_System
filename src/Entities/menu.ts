// Client-side menu types. Shape matches the API response in
// `src/lib/menu.ts#PublicMenu`. The legacy MenuType / DetailType / ItemOptions
// names are kept so existing components don't need to be renamed.

export type ChoiceUI = {
  id: string;
  label: string;
  priceDelta: number;
  isDefault: boolean;
};

export type ItemOptions = {
  title: string;
  selectionKind: "single" | "multi";
  minChoices: number;
  maxChoices: number;
  choices: ChoiceUI[];
};

export type DetailType = {
  id: string;
  title: string;
  description: string;
  price: number;
  isAvailable: boolean;
  options: ItemOptions[];
};

// `id` is the category slug (used for scroll-spy ids and URLs).
export type MenuType = {
  id: string;
  title: string;
  details: DetailType[];
};

export type ExtendTitleType = string;

export type RestaurantUI = {
  id: string;
  name: string;
  currency: string;
};

export type MenuUI = {
  restaurant: RestaurantUI;
  categories: MenuType[];
};

// Wire-format coming back from /api/menu. Keep in sync with
// `src/lib/menu.ts`.
type ApiOptionGroup = {
  title: string;
  selectionKind: "single" | "multi";
  minChoices: number;
  maxChoices: number;
  choices: ChoiceUI[];
};
type ApiMenuItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  isAvailable: boolean;
  options: ApiOptionGroup[];
};
type ApiCategory = { slug: string; title: string; items: ApiMenuItem[] };
export type ApiMenu = { restaurant: RestaurantUI; categories: ApiCategory[] };

export function adaptApiMenu(api: ApiMenu): MenuUI {
  return {
    restaurant: api.restaurant,
    categories: api.categories.map((c) => ({
      id: c.slug,
      title: c.title,
      details: c.items.map((it) => ({
        id: it.id,
        title: it.title,
        description: it.description,
        price: it.price,
        isAvailable: it.isAvailable,
        options: it.options,
      })),
    })),
  };
}
