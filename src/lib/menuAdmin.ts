import pool from "./db";
import type {
  MenuCategoryCreateInput,
  MenuCategoryUpdateInput,
  MenuItemCreateInput,
  MenuItemUpdateInput,
  OptionChoiceCreateInput,
  OptionChoiceUpdateInput,
  OptionGroupCreateInput,
  OptionGroupUpdateInput,
} from "./validators";

// ---------------------------------------------------------------------------
// Staff menu admin — Slice C1 (items).
//
// Every read/write is scoped by restaurant_id (§5 multi-tenant). Items are
// addressed by public_id UUID, never the BIGINT (§3 rule 2). Prices written
// here are the canonical source the order path recomputes against (§3 rule 1),
// so writes are validated (validators.ts) and audited (§3 rule 6).
// ---------------------------------------------------------------------------

export class MenuAdminError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "CATEGORY_NOT_FOUND"
      | "ITEM_NOT_FOUND"
      | "ITEM_IN_USE"
      | "SLUG_TAKEN"
      | "CATEGORY_IN_USE"
      | "GROUP_NOT_FOUND"
      | "CHOICE_NOT_FOUND",
  ) {
    super(message);
    this.name = "MenuAdminError";
  }
}

export type AdminMenuCategory = {
  slug: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
};

export type AdminOptionChoice = {
  publicId: string;
  label: string;
  priceDelta: number;
  isDefault: boolean;
  sortOrder: number;
};

export type AdminOptionGroup = {
  publicId: string;
  title: string;
  selectionKind: "single" | "multi";
  minChoices: number;
  maxChoices: number;
  sortOrder: number;
  choices: AdminOptionChoice[];
};

export type AdminMenuItem = {
  publicId: string;
  categorySlug: string;
  title: string;
  description: string;
  price: number;
  isAvailable: boolean;
  sortOrder: number;
  options: AdminOptionGroup[];
};

export type AdminMenu = {
  categories: AdminMenuCategory[];
  items: AdminMenuItem[];
};

type Actor = { publicId: string; clientIp?: string | null };

/** Full menu for the admin UI — includes inactive categories + unavailable items. */
export async function loadAdminMenu(restaurantId: number): Promise<AdminMenu> {
  const cats = await pool.query<{
    slug: string;
    title: string;
    sort_order: number;
    is_active: boolean;
  }>(
    `SELECT slug, title, sort_order, is_active
       FROM menu_categories
      WHERE restaurant_id = $1
      ORDER BY sort_order, id`,
    [restaurantId],
  );

  const items = await pool.query<{
    id: string;
    public_id: string;
    category_slug: string;
    title: string;
    description: string;
    price: string;
    is_available: boolean;
    sort_order: number;
  }>(
    `SELECT i.id::text, i.public_id, c.slug AS category_slug, i.title, i.description,
            i.price::text AS price, i.is_available, i.sort_order
       FROM menu_items i
       JOIN menu_categories c ON c.id = i.category_id
      WHERE i.restaurant_id = $1
      ORDER BY c.sort_order, i.sort_order, i.id`,
    [restaurantId],
  );

  const itemDbIds = items.rows.map((i) => Number(i.id));
  const groupsByItem = await loadOptionGroups(itemDbIds);

  return {
    categories: cats.rows.map((c) => ({
      slug: c.slug,
      title: c.title,
      sortOrder: c.sort_order,
      isActive: c.is_active,
    })),
    items: items.rows.map((i) => ({
      publicId: i.public_id,
      categorySlug: i.category_slug,
      title: i.title,
      description: i.description,
      price: Number(i.price),
      isAvailable: i.is_available,
      sortOrder: i.sort_order,
      options: groupsByItem.get(i.id) ?? [],
    })),
  };
}

// Load option groups (with their choices) for a set of menu item db ids,
// keyed by item id (as text). Two queries, assembled in memory.
async function loadOptionGroups(
  itemDbIds: number[],
): Promise<Map<string, AdminOptionGroup[]>> {
  const byItem = new Map<string, AdminOptionGroup[]>();
  if (itemDbIds.length === 0) return byItem;

  const groups = await pool.query<{
    id: string;
    public_id: string;
    menu_item_id: string;
    title: string;
    selection_kind: "single" | "multi";
    min_choices: number;
    max_choices: number;
    sort_order: number;
  }>(
    `SELECT id::text, public_id, menu_item_id::text, title, selection_kind,
            min_choices, max_choices, sort_order
       FROM menu_option_groups
      WHERE menu_item_id = ANY($1::bigint[])
      ORDER BY sort_order, id`,
    [itemDbIds],
  );

  const groupDbIds = groups.rows.map((g) => Number(g.id));
  const choicesByGroup = new Map<string, AdminOptionChoice[]>();
  if (groupDbIds.length > 0) {
    const choices = await pool.query<{
      public_id: string;
      option_group_id: string;
      label: string;
      price_delta: string;
      is_default: boolean;
      sort_order: number;
    }>(
      `SELECT public_id, option_group_id::text, label, price_delta::text,
              is_default, sort_order
         FROM menu_option_choices
        WHERE option_group_id = ANY($1::bigint[])
        ORDER BY sort_order, id`,
      [groupDbIds],
    );
    for (const c of choices.rows) {
      const list = choicesByGroup.get(c.option_group_id) ?? [];
      list.push({
        publicId: c.public_id,
        label: c.label,
        priceDelta: Number(c.price_delta),
        isDefault: c.is_default,
        sortOrder: c.sort_order,
      });
      choicesByGroup.set(c.option_group_id, list);
    }
  }

  for (const g of groups.rows) {
    const list = byItem.get(g.menu_item_id) ?? [];
    list.push({
      publicId: g.public_id,
      title: g.title,
      selectionKind: g.selection_kind,
      minChoices: g.min_choices,
      maxChoices: g.max_choices,
      sortOrder: g.sort_order,
      choices: choicesByGroup.get(g.id) ?? [],
    });
    byItem.set(g.menu_item_id, list);
  }
  return byItem;
}

// Resolve a category slug to its BIGINT id within the restaurant, or throw.
async function resolveCategoryId(
  client: import("pg").PoolClient,
  restaurantId: number,
  slug: string,
): Promise<number> {
  const res = await client.query<{ id: string }>(
    `SELECT id::text FROM menu_categories
      WHERE restaurant_id = $1 AND slug = $2`,
    [restaurantId, slug],
  );
  if (!res.rows[0]) {
    throw new MenuAdminError(`Category "${slug}" not found`, "CATEGORY_NOT_FOUND");
  }
  return Number(res.rows[0].id);
}

async function writeAudit(
  client: import("pg").PoolClient,
  actor: Actor,
  action: string,
  itemPublicId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_log
       (actor_kind, actor_id, action, entity_kind, entity_id, client_ip, payload)
     VALUES ('staff', $1, $2, 'menu_item', $3, $4::inet, $5::jsonb)`,
    [actor.publicId, action, itemPublicId, actor.clientIp ?? null, JSON.stringify(payload)],
  );
}

export async function createMenuItem(
  restaurantId: number,
  input: MenuItemCreateInput,
  actor: Actor,
): Promise<{ publicId: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const categoryId = await resolveCategoryId(client, restaurantId, input.categorySlug);
    const res = await client.query<{ public_id: string }>(
      `INSERT INTO menu_items
         (restaurant_id, category_id, title, description, price, is_available, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING public_id`,
      [
        restaurantId,
        categoryId,
        input.title,
        input.description,
        input.price,
        input.isAvailable,
        input.sortOrder,
      ],
    );
    const publicId = res.rows[0].public_id;
    await writeAudit(client, actor, "menu_item.create", publicId, {
      title: input.title,
      price: input.price,
      categorySlug: input.categorySlug,
    });
    await client.query("COMMIT");
    return { publicId };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function updateMenuItem(
  restaurantId: number,
  publicId: string,
  input: MenuItemUpdateInput,
  actor: Actor,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query<{ id: string }>(
      `SELECT id::text FROM menu_items
        WHERE restaurant_id = $1 AND public_id = $2
        FOR UPDATE`,
      [restaurantId, publicId],
    );
    if (!cur.rows[0]) {
      throw new MenuAdminError("Menu item not found", "ITEM_NOT_FOUND");
    }
    const id = Number(cur.rows[0].id);

    // Build a dynamic SET clause from only the provided fields.
    const sets: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    if (input.categorySlug !== undefined) {
      const categoryId = await resolveCategoryId(client, restaurantId, input.categorySlug);
      sets.push(`category_id = $${p++}`);
      params.push(categoryId);
    }
    if (input.title !== undefined) { sets.push(`title = $${p++}`); params.push(input.title); }
    if (input.description !== undefined) { sets.push(`description = $${p++}`); params.push(input.description); }
    if (input.price !== undefined) { sets.push(`price = $${p++}`); params.push(input.price); }
    if (input.isAvailable !== undefined) { sets.push(`is_available = $${p++}`); params.push(input.isAvailable); }
    if (input.sortOrder !== undefined) { sets.push(`sort_order = $${p++}`); params.push(input.sortOrder); }

    if (sets.length > 0) {
      params.push(id);
      await client.query(
        `UPDATE menu_items SET ${sets.join(", ")} WHERE id = $${p}`,
        params,
      );
    }
    await writeAudit(client, actor, "menu_item.update", publicId, { changed: input });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Hard-delete an item. Safe because order_items snapshots everything and its
 * FK is ON DELETE SET NULL (migration 0005) — history is untouched, the link
 * is just nulled. "Temporarily out of stock" is a separate toggle
 * (is_available), not a delete.
 */
export async function deleteMenuItem(
  restaurantId: number,
  publicId: string,
  actor: Actor,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query<{ id: string }>(
      `SELECT id::text FROM menu_items
        WHERE restaurant_id = $1 AND public_id = $2
        FOR UPDATE`,
      [restaurantId, publicId],
    );
    if (!cur.rows[0]) {
      throw new MenuAdminError("Menu item not found", "ITEM_NOT_FOUND");
    }
    await client.query(`DELETE FROM menu_items WHERE id = $1`, [Number(cur.rows[0].id)]);
    await writeAudit(client, actor, "menu_item.delete", publicId, {});
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// --- Categories (Slice C2) -------------------------------------------------

// Generic audit writer for any menu entity (entity_id is TEXT, so a slug or a
// UUID both fit). writeAudit() above stays for the item-specific path.
async function writeAuditFor(
  client: import("pg").PoolClient,
  actor: Actor,
  action: string,
  entityKind: string,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_log
       (actor_kind, actor_id, action, entity_kind, entity_id, client_ip, payload)
     VALUES ('staff', $1, $2, $3, $4, $5::inet, $6::jsonb)`,
    [actor.publicId, action, entityKind, entityId, actor.clientIp ?? null, JSON.stringify(payload)],
  );
}

export async function createMenuCategory(
  restaurantId: number,
  input: MenuCategoryCreateInput,
  actor: Actor,
): Promise<{ slug: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const dup = await client.query(
      `SELECT 1 FROM menu_categories WHERE restaurant_id = $1 AND slug = $2`,
      [restaurantId, input.slug],
    );
    if ((dup.rowCount ?? 0) > 0) {
      throw new MenuAdminError(`Slug "${input.slug}" already exists`, "SLUG_TAKEN");
    }
    await client.query(
      `INSERT INTO menu_categories (restaurant_id, slug, title, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      [restaurantId, input.slug, input.title, input.sortOrder, input.isActive],
    );
    await writeAuditFor(client, actor, "menu_category.create", "menu_category", input.slug, {
      title: input.title,
    });
    await client.query("COMMIT");
    return { slug: input.slug };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function updateMenuCategory(
  restaurantId: number,
  slug: string,
  input: MenuCategoryUpdateInput,
  actor: Actor,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query<{ id: string }>(
      `SELECT id::text FROM menu_categories
        WHERE restaurant_id = $1 AND slug = $2 FOR UPDATE`,
      [restaurantId, slug],
    );
    if (!cur.rows[0]) {
      throw new MenuAdminError(`Category "${slug}" not found`, "CATEGORY_NOT_FOUND");
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    if (input.title !== undefined) { sets.push(`title = $${p++}`); params.push(input.title); }
    if (input.sortOrder !== undefined) { sets.push(`sort_order = $${p++}`); params.push(input.sortOrder); }
    if (input.isActive !== undefined) { sets.push(`is_active = $${p++}`); params.push(input.isActive); }
    if (sets.length > 0) {
      params.push(Number(cur.rows[0].id));
      await client.query(`UPDATE menu_categories SET ${sets.join(", ")} WHERE id = $${p}`, params);
    }
    await writeAuditFor(client, actor, "menu_category.update", "menu_category", slug, { changed: input });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Delete a category. A category isn't snapshotted anywhere and menu_items.
 * category_id is NOT NULL, so a category with items can't be safely removed —
 * we block it (caller must empty it first). An empty category is hard-deleted.
 */
export async function deleteMenuCategory(
  restaurantId: number,
  slug: string,
  actor: Actor,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query<{ id: string }>(
      `SELECT id::text FROM menu_categories
        WHERE restaurant_id = $1 AND slug = $2 FOR UPDATE`,
      [restaurantId, slug],
    );
    if (!cur.rows[0]) {
      throw new MenuAdminError(`Category "${slug}" not found`, "CATEGORY_NOT_FOUND");
    }
    const id = Number(cur.rows[0].id);
    const used = await client.query(
      `SELECT 1 FROM menu_items WHERE category_id = $1 LIMIT 1`,
      [id],
    );
    if ((used.rowCount ?? 0) > 0) {
      throw new MenuAdminError(
        `Category "${slug}" still has items`,
        "CATEGORY_IN_USE",
      );
    }
    await client.query(`DELETE FROM menu_categories WHERE id = $1`, [id]);
    await writeAuditFor(client, actor, "menu_category.delete", "menu_category", slug, {});
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// --- Option groups + choices (Slice C3) ------------------------------------
// Both are reached only via their parent item's restaurant, so every resolve
// joins up to menu_items and checks restaurant_id (tenant isolation). Option
// groups/choices have no FK from orders (orders snapshot label+price into
// order_items.options_snapshot), so they can be hard-deleted safely.

async function resolveItemId(
  client: import("pg").PoolClient,
  restaurantId: number,
  itemPublicId: string,
): Promise<number> {
  const r = await client.query<{ id: string }>(
    `SELECT id::text FROM menu_items WHERE restaurant_id = $1 AND public_id = $2`,
    [restaurantId, itemPublicId],
  );
  if (!r.rows[0]) throw new MenuAdminError("Menu item not found", "ITEM_NOT_FOUND");
  return Number(r.rows[0].id);
}

async function resolveGroupId(
  client: import("pg").PoolClient,
  restaurantId: number,
  groupPublicId: string,
): Promise<number> {
  const r = await client.query<{ id: string }>(
    `SELECT g.id::text
       FROM menu_option_groups g
       JOIN menu_items i ON i.id = g.menu_item_id
      WHERE i.restaurant_id = $1 AND g.public_id = $2
      FOR UPDATE OF g`,
    [restaurantId, groupPublicId],
  );
  if (!r.rows[0]) throw new MenuAdminError("Option group not found", "GROUP_NOT_FOUND");
  return Number(r.rows[0].id);
}

export async function createOptionGroup(
  restaurantId: number,
  input: OptionGroupCreateInput,
  actor: Actor,
): Promise<{ publicId: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const itemId = await resolveItemId(client, restaurantId, input.itemPublicId);
    const res = await client.query<{ public_id: string }>(
      `INSERT INTO menu_option_groups
         (menu_item_id, title, selection_kind, min_choices, max_choices, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING public_id`,
      [itemId, input.title, input.selectionKind, input.minChoices, input.maxChoices, input.sortOrder],
    );
    const publicId = res.rows[0].public_id;
    await writeAuditFor(client, actor, "option_group.create", "menu_option_group", publicId, {
      itemPublicId: input.itemPublicId,
      title: input.title,
    });
    await client.query("COMMIT");
    return { publicId };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function updateOptionGroup(
  restaurantId: number,
  publicId: string,
  input: OptionGroupUpdateInput,
  actor: Actor,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = await resolveGroupId(client, restaurantId, publicId);
    const sets: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    if (input.title !== undefined) { sets.push(`title = $${p++}`); params.push(input.title); }
    if (input.selectionKind !== undefined) { sets.push(`selection_kind = $${p++}`); params.push(input.selectionKind); }
    if (input.minChoices !== undefined) { sets.push(`min_choices = $${p++}`); params.push(input.minChoices); }
    if (input.maxChoices !== undefined) { sets.push(`max_choices = $${p++}`); params.push(input.maxChoices); }
    if (input.sortOrder !== undefined) { sets.push(`sort_order = $${p++}`); params.push(input.sortOrder); }
    if (sets.length > 0) {
      params.push(id);
      await client.query(`UPDATE menu_option_groups SET ${sets.join(", ")} WHERE id = $${p}`, params);
    }
    await writeAuditFor(client, actor, "option_group.update", "menu_option_group", publicId, { changed: input });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteOptionGroup(
  restaurantId: number,
  publicId: string,
  actor: Actor,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = await resolveGroupId(client, restaurantId, publicId);
    // ON DELETE CASCADE removes the group's choices too.
    await client.query(`DELETE FROM menu_option_groups WHERE id = $1`, [id]);
    await writeAuditFor(client, actor, "option_group.delete", "menu_option_group", publicId, {});
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function createOptionChoice(
  restaurantId: number,
  input: OptionChoiceCreateInput,
  actor: Actor,
): Promise<{ publicId: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const groupId = await resolveGroupId(client, restaurantId, input.groupPublicId);
    const res = await client.query<{ public_id: string }>(
      `INSERT INTO menu_option_choices
         (option_group_id, label, price_delta, is_default, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING public_id`,
      [groupId, input.label, input.priceDelta, input.isDefault, input.sortOrder],
    );
    const publicId = res.rows[0].public_id;
    await writeAuditFor(client, actor, "option_choice.create", "menu_option_choice", publicId, {
      groupPublicId: input.groupPublicId,
      label: input.label,
      priceDelta: input.priceDelta,
    });
    await client.query("COMMIT");
    return { publicId };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function resolveChoiceId(
  client: import("pg").PoolClient,
  restaurantId: number,
  choicePublicId: string,
): Promise<number> {
  const r = await client.query<{ id: string }>(
    `SELECT ch.id::text
       FROM menu_option_choices ch
       JOIN menu_option_groups g ON g.id = ch.option_group_id
       JOIN menu_items i ON i.id = g.menu_item_id
      WHERE i.restaurant_id = $1 AND ch.public_id = $2
      FOR UPDATE OF ch`,
    [restaurantId, choicePublicId],
  );
  if (!r.rows[0]) throw new MenuAdminError("Option choice not found", "CHOICE_NOT_FOUND");
  return Number(r.rows[0].id);
}

export async function updateOptionChoice(
  restaurantId: number,
  publicId: string,
  input: OptionChoiceUpdateInput,
  actor: Actor,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = await resolveChoiceId(client, restaurantId, publicId);
    const sets: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    if (input.label !== undefined) { sets.push(`label = $${p++}`); params.push(input.label); }
    if (input.priceDelta !== undefined) { sets.push(`price_delta = $${p++}`); params.push(input.priceDelta); }
    if (input.isDefault !== undefined) { sets.push(`is_default = $${p++}`); params.push(input.isDefault); }
    if (input.sortOrder !== undefined) { sets.push(`sort_order = $${p++}`); params.push(input.sortOrder); }
    if (sets.length > 0) {
      params.push(id);
      await client.query(`UPDATE menu_option_choices SET ${sets.join(", ")} WHERE id = $${p}`, params);
    }
    await writeAuditFor(client, actor, "option_choice.update", "menu_option_choice", publicId, { changed: input });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteOptionChoice(
  restaurantId: number,
  publicId: string,
  actor: Actor,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = await resolveChoiceId(client, restaurantId, publicId);
    await client.query(`DELETE FROM menu_option_choices WHERE id = $1`, [id]);
    await writeAuditFor(client, actor, "option_choice.delete", "menu_option_choice", publicId, {});
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
