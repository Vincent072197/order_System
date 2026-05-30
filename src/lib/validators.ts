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
