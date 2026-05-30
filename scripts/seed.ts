import { Pool, PoolClient } from "pg";
import { loadEnv } from "../src/lib/env.js";
import { hashPassword } from "../src/lib/auth/password.js";

const env = loadEnv();

const DEMO_STAFF_EMAIL = "owner@demo.local";
const DEMO_STAFF_PASSWORD = "DemoStaff!123";

async function seed() {
  // Managed Postgres (Supabase/Neon) requires TLS; local Docker doesn't run it.
  const isLocalDb = env.DB_HOST === "localhost" || env.DB_HOST === "127.0.0.1";
  const pool = new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existing } = await client.query<{ id: string }>(
      `SELECT id::text FROM restaurants WHERE name = $1 LIMIT 1`,
      ["示範餐廳"],
    );
    let restaurantIdForStaff: number;
    if (existing.length > 0) {
      console.log("[seed] menu already seeded; skipping menu inserts");
      restaurantIdForStaff = Number(existing[0].id);
      await seedDemoStaff(client, restaurantIdForStaff);
      await client.query("COMMIT");
      return;
    }

    const restaurant = await client.query<{ id: string; public_id: string }>(
      `INSERT INTO restaurants (name) VALUES ($1) RETURNING id::text, public_id`,
      ["示範餐廳"],
    );
    const restaurantId = Number(restaurant.rows[0].id);

    const tableRows = [];
    for (const label of ["A1", "A2", "A3", "B1"]) {
      const t = await client.query<{ public_id: string; label: string }>(
        `INSERT INTO tables (restaurant_id, label) VALUES ($1, $2)
         RETURNING public_id, label`,
        [restaurantId, label],
      );
      tableRows.push(t.rows[0]);
    }

    const cats: Array<{ id: number; slug: string; title: string }> = [];
    for (const [i, c] of [
      { slug: "drinks", title: "飲料" },
      { slug: "mains", title: "主餐" },
      { slug: "sides", title: "小菜" },
    ].entries()) {
      const r = await client.query<{ id: string }>(
        `INSERT INTO menu_categories (restaurant_id, slug, title, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING id::text`,
        [restaurantId, c.slug, c.title, i],
      );
      cats.push({ id: Number(r.rows[0].id), slug: c.slug, title: c.title });
    }

    const items = [
      { cat: "drinks", title: "珍珠奶茶", price: 65, opts: drinkOptions() },
      { cat: "drinks", title: "美式咖啡", price: 80, opts: [] },
      { cat: "drinks", title: "鮮榨柳橙汁", price: 90, opts: [] },
      { cat: "mains", title: "招牌牛肉麵", price: 220, opts: noodleOptions() },
      { cat: "mains", title: "蔥油雞飯", price: 180, opts: [] },
      { cat: "mains", title: "蝦仁炒飯", price: 160, opts: [] },
      { cat: "sides", title: "滷蛋", price: 20, opts: [] },
      { cat: "sides", title: "燙青菜", price: 50, opts: [] },
    ];

    for (const [i, it] of items.entries()) {
      const cat = cats.find((c) => c.slug === it.cat)!;
      const r = await client.query<{ id: string }>(
        `INSERT INTO menu_items (restaurant_id, category_id, title, price, sort_order)
         VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
        [restaurantId, cat.id, it.title, it.price, i],
      );
      const itemId = Number(r.rows[0].id);
      for (const [gi, group] of it.opts.entries()) {
        const gr = await client.query<{ id: string }>(
          `INSERT INTO menu_option_groups
             (menu_item_id, title, selection_kind, min_choices, max_choices, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text`,
          [
            itemId,
            group.title,
            group.kind,
            group.min,
            group.max,
            gi,
          ],
        );
        const groupId = Number(gr.rows[0].id);
        for (const [ci, choice] of group.choices.entries()) {
          await client.query(
            `INSERT INTO menu_option_choices
               (option_group_id, label, price_delta, is_default, sort_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [groupId, choice.label, choice.delta, choice.isDefault ?? false, ci],
          );
        }
      }
    }

    await seedDemoStaff(client, restaurantId);

    await client.query("COMMIT");
    console.log("[seed] done. Tables:");
    for (const t of tableRows) {
      console.log(`  ${t.label}: /table/${t.public_id}`);
    }
    console.log(
      `[seed] demo staff: ${DEMO_STAFF_EMAIL} / ${DEMO_STAFF_PASSWORD} (change immediately)`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

type OptionGroupSeed = {
  title: string;
  kind: "single" | "multi";
  min: number;
  max: number;
  choices: Array<{ label: string; delta: number; isDefault?: boolean }>;
};

function drinkOptions(): OptionGroupSeed[] {
  return [
    {
      title: "甜度",
      kind: "single",
      min: 1,
      max: 1,
      choices: [
        { label: "正常", delta: 0, isDefault: true },
        { label: "少糖", delta: 0 },
        { label: "半糖", delta: 0 },
        { label: "微糖", delta: 0 },
        { label: "無糖", delta: 0 },
      ],
    },
    {
      title: "冰量",
      kind: "single",
      min: 1,
      max: 1,
      choices: [
        { label: "正常冰", delta: 0, isDefault: true },
        { label: "少冰", delta: 0 },
        { label: "去冰", delta: 0 },
        { label: "熱", delta: 0 },
      ],
    },
    {
      title: "加料",
      kind: "multi",
      min: 0,
      max: 2,
      choices: [
        { label: "加珍珠", delta: 10 },
        { label: "加椰果", delta: 10 },
      ],
    },
  ];
}

function noodleOptions(): OptionGroupSeed[] {
  return [
    {
      title: "辣度",
      kind: "single",
      min: 1,
      max: 1,
      choices: [
        { label: "不辣", delta: 0, isDefault: true },
        { label: "小辣", delta: 0 },
        { label: "中辣", delta: 0 },
        { label: "大辣", delta: 0 },
      ],
    },
    {
      title: "麵量",
      kind: "single",
      min: 1,
      max: 1,
      choices: [
        { label: "正常", delta: 0, isDefault: true },
        { label: "加麵", delta: 30 },
      ],
    },
  ];
}

async function seedDemoStaff(client: PoolClient, restaurantId: number) {
  const existing = await client.query(
    `SELECT 1 FROM staff WHERE email = $1 LIMIT 1`,
    [DEMO_STAFF_EMAIL],
  );
  if (existing.rowCount && existing.rowCount > 0) {
    console.log("[seed] demo staff already exists; skipping");
    return;
  }
  const hash = await hashPassword(DEMO_STAFF_PASSWORD);
  await client.query(
    `INSERT INTO staff (restaurant_id, email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4, 'owner')`,
    [restaurantId, DEMO_STAFF_EMAIL, hash, "Demo Owner"],
  );
  console.log("[seed] inserted demo staff");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
