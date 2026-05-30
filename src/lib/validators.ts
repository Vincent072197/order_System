import { z } from "zod";

// UUID v4-ish — pgcrypto's gen_random_uuid emits v4. We accept any valid uuid.
export const uuid = z.string().uuid();

export const placeOrderItemSchema = z.object({
  // Public id of the menu item the diner picked.
  menuItemId: uuid,
  quantity: z.number().int().min(1).max(99),
  // Public ids of chosen option choices. Server validates that the chosen
  // choices belong to the menu item and that group min/max constraints hold.
  choiceIds: z.array(uuid).max(20).default([]),
  // Free-text per-item note (e.g. "less ice"). Length capped to avoid DB blowup.
  note: z.string().max(200).default(""),
});

export const placeOrderSchema = z.object({
  // Public id of the table the diner is at.
  tableId: uuid,
  items: z.array(placeOrderItemSchema).min(1).max(100),
  customerNote: z.string().max(1000).default(""),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type PlaceOrderItemInput = z.infer<typeof placeOrderItemSchema>;

export const staffLoginSchema = z.object({
  email: z.string().email().max(255),
  // Don't enforce a max length here — callers should keep it reasonable but
  // a longer-than-expected password is just a verify failure, not malicious.
  password: z.string().min(1).max(1024),
});
export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

// --- Staff menu admin (Slice C1: items) -----------------------------------
// Bounds mirror the DB CHECK constraints in 0001_init.sql so a bad payload is
// rejected with a 400 before it ever reaches Postgres. price < 1_000_000 and
// title length 1..200 match menu_items exactly.
const categorySlug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "Invalid category slug");

export const menuItemCreateSchema = z.object({
  categorySlug,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  // NUMERIC(12,2), CHECK price >= 0 AND price < 1000000.
  price: z.number().min(0).max(999999.99),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100000).default(0),
});
export type MenuItemCreateInput = z.infer<typeof menuItemCreateSchema>;

// Update is a partial: only the fields the client sends are changed.
export const menuItemUpdateSchema = menuItemCreateSchema
  .partial()
  .refine((o) => Object.keys(o).length > 0, "No fields to update");
export type MenuItemUpdateInput = z.infer<typeof menuItemUpdateSchema>;
