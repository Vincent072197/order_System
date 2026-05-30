-- order_items already snapshots title/unit_price/options, so the menu_items
-- link is only useful while the item exists. Allow truly deleting a menu item
-- without destroying order history: null the reference on delete instead of
-- blocking it (was ON DELETE RESTRICT). After this, the staff menu admin can
-- hard-delete any item; "temporarily out of stock" is a separate concern
-- handled by menu_items.is_available.

ALTER TABLE order_items ALTER COLUMN menu_item_id DROP NOT NULL;

ALTER TABLE order_items DROP CONSTRAINT order_items_menu_item_id_fkey;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_menu_item_id_fkey
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL;
