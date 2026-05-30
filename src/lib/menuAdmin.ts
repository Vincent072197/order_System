import pool from "./db";
import type { MenuItemCreateInput, MenuItemUpdateInput } from "./validators";

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
      | "ITEM_IN_USE",
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

export type AdminMenuItem = {
  publicId: string;
  categorySlug: string;
  title: string;
  description: string;
  price: number;
  isAvailable: boolean;
  sortOrder: number;
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
    public_id: string;
    category_slug: string;
    title: string;
    description: string;
    price: string;
    is_available: boolean;
    sort_order: number;
  }>(
    `SELECT i.public_id, c.slug AS category_slug, i.title, i.description,
            i.price::text AS price, i.is_available, i.sort_order
       FROM menu_items i
       JOIN menu_categories c ON c.id = i.category_id
      WHERE i.restaurant_id = $1
      ORDER BY c.sort_order, i.sort_order, i.id`,
    [restaurantId],
  );

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
    })),
  };
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
 * Delete an item. order_items references menu_items ON DELETE RESTRICT, so an
 * item that has ever been ordered can't be hard-deleted — we soft-delete it
 * (is_available = false) instead so order history stays intact. A never-ordered
 * item is removed for real. Returns which path was taken.
 */
export async function deleteMenuItem(
  restaurantId: number,
  publicId: string,
  actor: Actor,
): Promise<{ softDeleted: boolean }> {
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

    const used = await client.query(
      `SELECT 1 FROM order_items WHERE menu_item_id = $1 LIMIT 1`,
      [id],
    );
    const softDeleted = (used.rowCount ?? 0) > 0;

    if (softDeleted) {
      await client.query(`UPDATE menu_items SET is_available = FALSE WHERE id = $1`, [id]);
    } else {
      await client.query(`DELETE FROM menu_items WHERE id = $1`, [id]);
    }
    await writeAudit(client, actor, "menu_item.delete", publicId, { softDeleted });
    await client.query("COMMIT");
    return { softDeleted };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
