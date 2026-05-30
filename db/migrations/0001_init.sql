-- Initial commercial-grade schema for tableside ordering system.
-- Money is NUMERIC(12,2). All ids are BIGSERIAL surrogates. External-facing
-- ids that may appear in URLs use UUID to avoid enumeration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Restaurants (multi-tenant ready, even if we only run one for now).
CREATE TABLE restaurants (
  id          BIGSERIAL PRIMARY KEY,
  public_id   UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  timezone    TEXT        NOT NULL DEFAULT 'Asia/Taipei',
  currency    TEXT        NOT NULL DEFAULT 'TWD' CHECK (currency ~ '^[A-Z]{3}$'),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tables in a restaurant. The "label" is what diners see (e.g. "A3"); the
-- "public_id" is what gets baked into the QR code so guessing one table
-- doesn't reveal a sequential ID space.
CREATE TABLE tables (
  id            BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT      NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  public_id     UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  label         TEXT        NOT NULL CHECK (length(label) BETWEEN 1 AND 32),
  seats         INT         NOT NULL DEFAULT 4 CHECK (seats > 0),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, label)
);

-- Menu hierarchy: category -> item -> options group -> option choices.
CREATE TABLE menu_categories (
  id            BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT      NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  slug          TEXT        NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  title         TEXT        NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  sort_order    INT         NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, slug)
);

CREATE TABLE menu_items (
  id            BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT         NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id   BIGINT         NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
  public_id     UUID           NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  title         TEXT           NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description   TEXT           NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  -- Prices stored in minor units would be ideal but NUMERIC(12,2) avoids
  -- mistakes when other code reads the column directly.
  price         NUMERIC(12, 2) NOT NULL CHECK (price >= 0 AND price < 1000000),
  is_available  BOOLEAN        NOT NULL DEFAULT TRUE,
  sort_order    INT            NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Option groups (e.g. "Sweetness", "Ice Level"). selection_kind = 'single'
-- means radio, 'multi' means checkbox. min/max constrain valid order payloads.
CREATE TABLE menu_option_groups (
  id              BIGSERIAL PRIMARY KEY,
  menu_item_id    BIGINT      NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  selection_kind  TEXT        NOT NULL CHECK (selection_kind IN ('single', 'multi')),
  min_choices     INT         NOT NULL DEFAULT 0 CHECK (min_choices >= 0),
  max_choices     INT         NOT NULL DEFAULT 1 CHECK (max_choices >= 1),
  sort_order      INT         NOT NULL DEFAULT 0,
  CHECK (min_choices <= max_choices)
);

CREATE TABLE menu_option_choices (
  id              BIGSERIAL PRIMARY KEY,
  option_group_id BIGINT         NOT NULL REFERENCES menu_option_groups(id) ON DELETE CASCADE,
  public_id       UUID           NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  label           TEXT           NOT NULL CHECK (length(label) BETWEEN 1 AND 100),
  price_delta     NUMERIC(12, 2) NOT NULL DEFAULT 0
                  CHECK (price_delta > -1000000 AND price_delta < 1000000),
  is_default      BOOLEAN        NOT NULL DEFAULT FALSE,
  sort_order      INT            NOT NULL DEFAULT 0
);

-- Orders. "source" lets us unify dine-in with delivery integrations later
-- (Foodpanda, UberEats) without a schema migration.
CREATE TABLE orders (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID          NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  restaurant_id   BIGINT        NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  table_id        BIGINT                REFERENCES tables(id) ON DELETE RESTRICT,
  source          TEXT          NOT NULL DEFAULT 'dine_in'
                  CHECK (source IN ('dine_in', 'foodpanda', 'ubereats', 'lalamove', 'web')),
  external_ref    TEXT,         -- platform's own order id (foodpanda etc.)
  status          TEXT          NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
                    'pending', 'confirmed', 'preparing',
                    'ready', 'served', 'completed', 'cancelled'
                  )),
  subtotal        NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  tax             NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  service_fee     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
  total           NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  customer_note   TEXT          NOT NULL DEFAULT '' CHECK (length(customer_note) <= 1000),
  client_ip       INET,         -- for abuse tracking; not for personalization
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- A dine-in order needs a table; an external one needs an external_ref.
  CHECK (
    (source = 'dine_in' AND table_id IS NOT NULL)
    OR
    (source <> 'dine_in' AND external_ref IS NOT NULL)
  ),
  UNIQUE (source, external_ref)
);

CREATE TABLE order_items (
  id              BIGSERIAL PRIMARY KEY,
  order_id        BIGINT         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id    BIGINT         NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  -- snapshot at time of order so later menu edits don't rewrite history.
  title_snapshot  TEXT           NOT NULL,
  unit_price      NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  quantity        INT            NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  options_snapshot JSONB         NOT NULL DEFAULT '[]'::jsonb,
  line_total      NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0)
);

-- Append-only audit log. Reads / writes that change state should write here.
-- Triggers can be added later; for now we'll write from app code at the
-- boundary so we control what payload gets recorded.
CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_kind    TEXT        NOT NULL CHECK (actor_kind IN ('system', 'staff', 'customer', 'webhook')),
  actor_id      TEXT,
  action        TEXT        NOT NULL,
  entity_kind   TEXT        NOT NULL,
  entity_id     TEXT,
  client_ip     INET,
  payload       JSONB       NOT NULL DEFAULT '{}'::jsonb
);

-- updated_at maintenance.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_restaurants_updated BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
