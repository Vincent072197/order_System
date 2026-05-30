-- Staff accounts and DB-backed sessions.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE staff (
  id                    BIGSERIAL PRIMARY KEY,
  public_id             UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  restaurant_id         BIGINT      NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  -- citext keeps comparisons case-insensitive without forcing us to lowercase
  -- before every query.
  email                 CITEXT      NOT NULL CHECK (length(email) BETWEEN 3 AND 255),
  password_hash         TEXT        NOT NULL,
  display_name          TEXT        NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
  role                  TEXT        NOT NULL CHECK (role IN ('owner','manager','cashier','kitchen')),
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  failed_login_attempts INT         NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  locked_until          TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, email)
);

CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Sessions are opaque, server-side. The cookie carries the random `id`.
-- Storing the CSRF token alongside lets us do a constant-time double-submit
-- check on state-changing requests.
CREATE TABLE staff_sessions (
  id           TEXT        PRIMARY KEY,            -- 32 bytes base64url
  staff_id     BIGINT      NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  csrf_token   TEXT        NOT NULL,               -- 32 bytes base64url
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip           INET,
  user_agent   TEXT
);

CREATE INDEX idx_staff_sessions_staff   ON staff_sessions (staff_id);
CREATE INDEX idx_staff_sessions_expires ON staff_sessions (expires_at);
