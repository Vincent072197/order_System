import pool from "./db";

export type PublicOptionChoice = {
  id: string;
  label: string;
  priceDelta: number;
  isDefault: boolean;
};

export type PublicOptionGroup = {
  title: string;
  selectionKind: "single" | "multi";
  minChoices: number;
  maxChoices: number;
  choices: PublicOptionChoice[];
};

export type PublicMenuItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  isAvailable: boolean;
  options: PublicOptionGroup[];
};

export type PublicMenuCategory = {
  slug: string;
  title: string;
  items: PublicMenuItem[];
};

export type PublicMenu = {
  restaurant: { id: string; name: string; currency: string };
  categories: PublicMenuCategory[];
};

export async function getPublicMenuByTablePublicId(
  tablePublicId: string,
): Promise<PublicMenu | null> {
  const tableRes = await pool.query<{
    restaurant_db_id: string;
    public_id: string;
    name: string;
    currency: string;
  }>(
    `SELECT r.id::text AS restaurant_db_id, r.public_id, r.name, r.currency
       FROM tables t
       JOIN restaurants r ON r.id = t.restaurant_id
      WHERE t.public_id = $1 AND t.is_active AND r.is_active`,
    [tablePublicId],
  );
  const r = tableRes.rows[0];
  if (!r) return null;

  return loadMenu({
    restaurantDbId: Number(r.restaurant_db_id),
    restaurantPublicId: r.public_id,
    name: r.name,
    currency: r.currency,
  });
}

async function loadMenu(opts: {
  restaurantDbId: number;
  restaurantPublicId: string;
  name: string;
  currency: string;
}): Promise<PublicMenu> {
  const cats = await pool.query<{
    id: string;
    slug: string;
    title: string;
  }>(
    `SELECT id::text, slug, title
       FROM menu_categories
      WHERE restaurant_id = $1 AND is_active
      ORDER BY sort_order, id`,
    [opts.restaurantDbId],
  );

  const items = await pool.query<{
    id: string;
    public_id: string;
    category_id: string;
    title: string;
    description: string;
    price: string;
    is_available: boolean;
  }>(
    `SELECT id::text, public_id, category_id::text, title, description, price::text, is_available
       FROM menu_items
      WHERE restaurant_id = $1
      ORDER BY sort_order, id`,
    [opts.restaurantDbId],
  );

  const itemDbIds = items.rows.map((i) => Number(i.id));
  const groups =
    itemDbIds.length === 0
      ? { rows: [] as Array<{
            id: string;
            menu_item_id: string;
            title: string;
            selection_kind: "single" | "multi";
            min_choices: number;
            max_choices: number;
          }> }
      : await pool.query<{
          id: string;
          menu_item_id: string;
          title: string;
          selection_kind: "single" | "multi";
          min_choices: number;
          max_choices: number;
        }>(
          `SELECT id::text, menu_item_id::text, title, selection_kind, min_choices, max_choices
             FROM menu_option_groups
            WHERE menu_item_id = ANY($1::bigint[])
            ORDER BY sort_order, id`,
          [itemDbIds],
        );

  const groupDbIds = groups.rows.map((g) => Number(g.id));
  const choices =
    groupDbIds.length === 0
      ? { rows: [] as Array<{
            public_id: string;
            option_group_id: string;
            label: string;
            price_delta: string;
            is_default: boolean;
          }> }
      : await pool.query<{
          public_id: string;
          option_group_id: string;
          label: string;
          price_delta: string;
          is_default: boolean;
        }>(
          `SELECT public_id, option_group_id::text, label, price_delta::text, is_default
             FROM menu_option_choices
            WHERE option_group_id = ANY($1::bigint[])
            ORDER BY sort_order, id`,
          [groupDbIds],
        );

  const choicesByGroup = new Map<string, PublicOptionChoice[]>();
  for (const c of choices.rows) {
    const list = choicesByGroup.get(c.option_group_id) ?? [];
    list.push({
      id: c.public_id,
      label: c.label,
      priceDelta: Number(c.price_delta),
      isDefault: c.is_default,
    });
    choicesByGroup.set(c.option_group_id, list);
  }

  const groupsByItem = new Map<string, PublicOptionGroup[]>();
  for (const g of groups.rows) {
    const list = groupsByItem.get(g.menu_item_id) ?? [];
    list.push({
      title: g.title,
      selectionKind: g.selection_kind,
      minChoices: g.min_choices,
      maxChoices: g.max_choices,
      choices: choicesByGroup.get(g.id) ?? [],
    });
    groupsByItem.set(g.menu_item_id, list);
  }

  const itemsByCat = new Map<string, PublicMenuItem[]>();
  for (const i of items.rows) {
    if (!i.is_available) continue;
    const list = itemsByCat.get(i.category_id) ?? [];
    list.push({
      id: i.public_id,
      title: i.title,
      description: i.description,
      price: Number(i.price),
      isAvailable: i.is_available,
      options: groupsByItem.get(i.id) ?? [],
    });
    itemsByCat.set(i.category_id, list);
  }

  return {
    restaurant: {
      id: opts.restaurantPublicId,
      name: opts.name,
      currency: opts.currency,
    },
    categories: cats.rows.map((c) => ({
      slug: c.slug,
      title: c.title,
      items: itemsByCat.get(c.id) ?? [],
    })),
  };
}
