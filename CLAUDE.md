@AGENTS.md

## §1. Learning English — Grammar Correction Protocol

Respond with all three of the following blocks:

1. **Error Breakdown** 🔍 — A small table with columns: Original | Issue Type | Fix
2. **Corrected Version** 📝 — Fix the user's sentence, keep their intended meaning and structure.
3. **Native Speaker Version** 🗣️ — Rewrite it the way a fluent native English speaker would naturally say it.

Then continue with the actual response.

---

## §2. Project intent — commercial-grade tableside ordering

This repo is being built up in phases toward a production-ready tableside
ordering system. Stack chosen by the user:

- **Backend**: self-hosted Postgres in Docker, **self-written auth** (no Lucia,
  no Auth.js — argon2id + DB-backed sessions + double-submit CSRF).
- **Frontend / API**: Next.js 16 (App Router) + React 19.
- **Deployment target**: Vercel for the app or self-hosted Docker. Postgres
  is self-hosted for production; the **hosted customer demo runs on Vercel +
  Supabase (managed Postgres, session pooler)** — `src/lib/db.ts` enables TLS
  + caps the pool when `DB_HOST` isn't localhost. **`vercel.json` pins
  functions to `sin1` (Singapore) to match Supabase `ap-southeast-1`** — each
  request makes several sequential DB round trips, so co-locating is the main
  lever against per-click latency.
- **External integrations** (planned, not built): Foodpanda partner API,
  ESC/POS or cloud receipt printer.

The owner is learning. Default to **explaining tradeoffs in chat** rather
than dumping large refactors in one shot. Phase work into reviewable slices.

---

## §3. Architectural invariants — DO NOT regress

These rules are load-bearing. If you find yourself wanting to break one,
stop and surface the conflict to the user before doing it.

1. **Money is recomputed server-side.** The customer cart payload sends
   `menuItemId` (UUID) + `choiceIds` (UUIDs) + `quantity`. The server looks
   up the canonical price from `menu_items.price` and `menu_option_choices.
   price_delta` and computes the line total + order total itself. Never
   trust a `total` or `unit_price` field from the client. See
   `src/lib/orders.ts#placeDineInOrderInTx`.

2. **Public ids are UUIDs, internal ids are BIGINT.** Anything that flows
   through a URL, JSON response, or QR code is `public_id UUID`. The
   `BIGSERIAL` `id` column never leaves the DB layer. This blocks
   enumeration attacks.

3. **Option-group constraints are enforced for every group on the menu
   item, not only groups the client sent picks for.** Required groups must
   reject zero-pick submissions. The bug we fixed in Slice A was: iterating
   `byGroup` of submitted picks misses required groups the client omitted.
   `src/lib/orders.ts` now loads all groups for the items in the order and
   checks `min_choices`/`max_choices`/`selection_kind` on every one.

4. **Migrations are immutable + checksummed.** `scripts/migrate.ts`
   refuses to apply a file whose content changed after it was first
   applied. To change schema, add a new migration file. Never edit an
   already-applied one.

5. **Order source is multi-tenant from day one.** `orders.source` is an
   enum with `dine_in / foodpanda / ubereats / lalamove / web`, plus
   `external_ref` (UNIQUE per source). Foodpanda webhook handlers go here
   when they're built — no schema change required. The CHECK constraint
   forces dine-in to have a `table_id` and external sources to have an
   `external_ref`.

6. **Audit log is append-only.** Every state change a customer or staff
   makes that matters legally/operationally writes to `audit_log` at the
   boundary. Login success/fail/lockout is already wired. Order status
   changes (when added in P2) MUST also log there.

---

## §4. Next.js 16 gotchas (your training data is wrong about these)

- `middleware.ts` was **renamed to `proxy.ts`** in Next 16. The exported
  function is `proxy()` (not `middleware()`). Default runtime is **Node.js**,
  not Edge. Setting a `runtime` config in proxy.ts throws.
- `params` in dynamic routes is a **Promise** — always `await params`.
- `cookies()` and `headers()` from `next/headers` are **async** — always
  `await`.
- `useSearchParams()` in client components must be wrapped in `<Suspense>`
  during static generation, or `next build` fails.
- Read `node_modules/next/dist/docs/` for any feature you're unsure about.
  AGENTS.md exists specifically to remind you of this.

---

## §5. Security model — currently wired up

Future changes must not silently weaken these. If a change requires
loosening one, raise it explicitly with the user.

- **CSP** (proxy.ts) — strict default-src 'self', script-src nonce +
  strict-dynamic, frame-ancestors 'none'. Per-request nonce is generated
  in proxy.ts and passed via `x-csp-nonce` request header. Style-src still
  allows `'unsafe-inline'` for Tailwind v4 — TODO to audit and remove.
- **HSTS** in production only.
- **X-Frame-Options DENY**, X-Content-Type-Options nosniff, COOP/CORP
  same-origin, Permissions-Policy locks down camera/mic/geo.
- **Origin allow-list** for state-changing `/api/*`. Cross-origin POST
  rejected with 403.
- **Rate limit** (in-memory token bucket, single-process):
  - `/api/staff/auth/login`: capacity 5, refill 0.2/s (1 attempt / 5s)
  - `/api/orders`: capacity 5, refill 0.5/s
  - other `/api/*`: capacity 30, refill 5/s
  Replace with Redis (Upstash etc.) before scaling horizontally.
- **Auth**: argon2id (19 MiB / t=2 / p=1), DB-backed sessions
  (`staff_sessions`), 32-byte base64url opaque tokens, 8-hour absolute TTL.
- **CSRF**: double-submit. `staff_session` is httpOnly + sameSite=Lax;
  `staff_csrf` is non-httpOnly + sameSite=Strict. Client echoes csrf
  cookie as `X-CSRF-Token` header on state-changing `/api/staff/*`. Login
  endpoint is exempt (no session yet, but it has the strictest IP rate
  limit).
- **Account lockout**: 5 wrong passwords → 15-minute lock on
  `staff.locked_until`.
- **Timing attack mitigation on login**: if email is unknown, run
  `dummyVerify` against a cached argon2 hash so response time matches the
  wrong-password branch.

---

## §6. Phase status

### P0 — Foundation + safety baseline ✅ DONE
Docker Postgres + Adminer, versioned + checksummed migrations, hardened
schema (`restaurants / tables / menu_categories / menu_items /
menu_option_groups / menu_option_choices / orders / order_items /
audit_log`), Zod input validation, server-side total recompute, CSP/HSTS/
COOP/CORP, IP rate limit, Origin check.

### P1 — Auth + staff login ✅ DONE
Migration `0003_staff_and_sessions.sql` (`staff` + `staff_sessions`),
argon2id, sessions, CSRF, login/logout/me APIs, `/staff/login` form,
`/staff` landing page (server component, `requireStaff()` guard),
account lockout, audit log of login events. Demo credentials below.

### P2 — Staff order dashboard ✅ DONE
Built as committed slices B1–B5:
- B1: pure state machine in `src/lib/orders.ts` (`checkOrderTransition`,
  `allowedNextStatuses`). **Flow was later simplified to 2 staff actions**
  (per owner request): `pending --確認接單--> preparing --訂單完成-->
  completed`, plus cancel (manager/owner). `confirmed/ready/served` remain
  valid enum values (no migration) but are out of the dine-in flow; legacy
  orders in them can still be pushed to completion. Customer sees "製作中"
  the moment staff accepts. Kitchen ticket + new-order alert fire on accept.
- B2: `PATCH /api/staff/orders/[publicId]` — session validation, tenant
  isolation (404 cross-tenant), `SELECT…FOR UPDATE`, transactional
  `UPDATE` + `audit_log`.
- B3: `/staff/orders` list, server-rendered + 4s polling via
  `GET /api/staff/orders`.
- B4: `/staff/orders/[publicId]` detail + role-aware `StatusActions`.
- B5: `PrintQueue` + `ConsolePrinter` in `src/lib/print.ts`; kitchen
  ticket enqueued post-commit on `→ preparing` (the 確認接單 action).

Original spec (kept for reference):
- `/staff/orders` list page. Start with polling every 3–5s; upgrade to SSE
  via Postgres `LISTEN`/`NOTIFY` once the polling cost matters. Don't reach
  for WebSockets unless we actually need bi-directional.
- `/staff/orders/[publicId]` detail (items, snapshots, source, table).
- `PATCH /api/staff/orders/[publicId]` for status transitions. Use a real
  state machine: `pending → confirmed → preparing → ready → served →
  completed`, plus `cancelled` from `pending|confirmed`. Reject any
  transition not in the table.
- Role-based authorization on transitions. Suggested mapping:
  - `kitchen`: `confirmed → preparing → ready`
  - `cashier`/`manager`/`owner`: any forward transition
  - `cancelled`: `manager`/`owner` only
- Mock printer: `PrintQueue` interface + `ConsolePrinter` implementation.
  When an order moves to `confirmed`, enqueue a print job. Replace the
  adapter when the user picks real hardware (Epson TM ESC/POS over LAN,
  SUNMI cloud, etc.). Don't bake hardware specifics into the call site.
- Every state change writes `audit_log` with `actor_kind='staff'` and the
  staff's public_id, plus `from_status` / `to_status` in the payload.

### P2.5 — Staff menu admin CRUD ✅ DONE
`/staff/menu` (owner/manager only — guarded by `canEditMenu` in
`src/lib/auth/api.ts`, both at the page and in every API route). Logic in
`src/lib/menuAdmin.ts`, all writes audited, Zod bounds mirror DB CHECKs.
- Items: POST `/api/staff/menu/items`, PATCH/DELETE `/[publicId]`.
- Categories: POST `/api/staff/menu/categories`, PATCH/DELETE `/[slug]`
  (slug immutable after create).
- Option groups + choices: POST/PATCH/DELETE under
  `/api/staff/menu/option-groups` and `/option-choices`.
- **Delete = hard delete.** Items always hard-delete: `order_items` now
  snapshots everything and its FK is `ON DELETE SET NULL` (migration 0005),
  so deleting an ordered item nulls the link but leaves history intact.
  Option groups/choices hard-delete too (orders snapshot them, no FK).
  Categories hard-delete only when empty — a category with items is rejected
  (`CATEGORY_IN_USE` → 409); the operator must empty it first.
- **"Out of stock" is `menu_items.is_available`**, a one-click toggle on each
  item row — separate from deletion.
- Migrations: **`0004`** added `public_id` to `menu_option_groups` (§3 rule
  2); **`0005_order_items_item_set_null.sql`** made `order_items.menu_item_id`
  nullable + `ON DELETE SET NULL`. NOTE: P5 "top items" reporting can't group
  by `menu_item_id` for deleted items — group by `title_snapshot` instead.

### P3 — Foodpanda webhook ⏳ BLOCKED on partner credentials
Schema is ready (`orders.source = 'foodpanda'`, unique `external_ref`).
Don't write this until the user has Foodpanda partner API docs + sandbox
keys in hand. Do not scrape; do not use unofficial endpoints.

### P4 — Customer-side polish ✅ DONE
- ✅ **P4a — Order status page**: `/order/[publicId]` (read-only by UUID) +
  `GET /api/orders/[publicId]`, polls every 5s. Linked from checkout.
- ✅ **Order history** (`/history`): this device's placed orders, kept in
  localStorage (`src/lib/orderHistoryClient.ts`, recorded on checkout),
  each fetched via the public status API. Header has a 🧾 link to it
  (distinct from the 🛒 cart link).
- ✅ **P4b — HMAC-signed table tokens**: `src/lib/auth/tableToken.ts`
  (`signTableToken`/`verifyTableToken`, 6h TTL, pg-free so proxy.ts imports
  it). proxy.ts mints a `table_token` httpOnly cookie when a customer hits
  `/table/<uuid>` (QR stays static); `POST /api/orders` now rejects (403
  `TABLE_TOKEN_INVALID`) unless a valid, unexpired token matches the order's
  tableId. Revoke everything by rotating `TABLE_TOKEN_SECRET`.
- ✅ **P4c — Front-of-house UX**: global toast system
  (`src/components/ui/Toast.tsx`, `ToastProvider` mounted in layout +
  `useToast()`); success toast on add-to-cart, error toast on order failure
  (surfaces the P4b 403 nicely) + success on submit; `MenuSkeleton` while the
  menu loads; metadata title fixed ("線上點餐"). Add-to-cart was already
  instant (cart is local state + localStorage).

### P5 — Real-time + dashboard ⏳ IN PROGRESS
- ✅ **Sales dashboard**: `/staff/dashboard` (owner/manager) + read model
  `src/lib/dashboard.ts` (`getDashboardStats`). Today's revenue + order count,
  revenue-by-hour bars, top items (grouped by `title_snapshot` so deleted
  items still count), and average prep time derived from `audit_log`
  (→preparing until →completed). All "today" windows bucketed in Asia/Taipei.
- ⏳ Real-time: Postgres `LISTEN`/`NOTIFY` → SSE is a poor fit on Vercel
  serverless; use Supabase Realtime if true push is needed. Today: 4s polling
  + sound/visual alert (good enough for now).
- ⏳ Staff management UI (CRUD on `staff` table) + password reset flow.
- ⏳ 2FA (TOTP) for owner/manager roles before going live.

### P6 — Production deployment + ops ⏳ NOT STARTED
- Vercel deploy or self-hosted Docker (Next standalone build).
- Migrate rate-limit + audit-log tail to Redis / Upstash.
- Secrets management: replace `.env.local` placeholders, set
  `TABLE_TOKEN_SECRET` to `openssl rand -base64 48`. The
  `assertProductionSecrets()` guard in `src/lib/env.ts` will refuse to
  serve if the dev placeholder leaks into prod.
- Sentry (or equivalent) for errors + performance.
- Postgres backup strategy (pgBackRest or managed snapshots).
- Pen test before flipping the customer-facing DNS.

---

## §7. Known gaps to remember

These are intentional and tracked — don't quietly paper over them in a
later PR without surfacing.

- **CSP allows `'unsafe-inline'` for styles** because Tailwind v4 emits
  inline styles. Remove after auditing.
- **Rate limiter is per-process.** Multi-instance deploy needs a shared
  store.
- ~~**Table public UUIDs are not signed.**~~ ✅ Fixed in P4b: ordering now
  requires an HMAC-signed `table_token` cookie (6h TTL) minted on the table
  page. A leaked URL still lets someone *load* the page (and get a fresh
  token), so this is defence-in-depth + revocability, not per-customer auth.
- **No staff CRUD UI / no password reset.** Adding/removing staff is a
  DB operation. P5 fixes this.
- **Session TTL is absolute (8h), no sliding renewal.** Decide in P5
  whether to add sliding.
- **`Math.round(n*100)/100` is good enough for TWD** but fails for
  rounding-sensitive currencies. If multi-currency arrives, switch to
  integer minor units throughout.
- **`/` (`HomeGate`) redirects to the remembered table** (`tableId` is now
  persisted in localStorage, key `ordersys.tableId.v1`) or shows a "scan QR"
  prompt if none. Ordering still only happens via `/table/[uuid]` — don't add
  a "place order" button to `/` (the dine-in CHECK needs a `table_id`).
  Checkout's CTA is **「繼續點餐」→ `/table/[tableId]`** so customers can add
  more rounds; each submit is a separate order. This is why the flow no
  longer dead-ends after one order / forces a re-scan.

---

## §8. Demo / dev credentials

These ship in `scripts/seed.ts`. Replace before any non-local environment.

```
Demo restaurant: 示範餐廳
Demo staff:      owner@demo.local / DemoStaff!123  (role: owner)
Tables seeded:   A1, A2, A3, B1  (run `npm run db:seed` to print URLs)
```

Useful commands:

```
npm run db:up        # docker compose: postgres + adminer (Adminer at :8080)
npm run db:migrate   # apply pending migrations
npm run db:seed      # idempotent: seeds menu + demo staff if missing
npm run db:reset     # nuke volume, migrate, seed (for local only)
npm run dev          # Next.js dev server
```

---

## §9. Working style with the user

- The user is learning. Prefer to **explain in chat first**, only apply
  files when explicitly told ("apply", "做下去", "繼續", "可以").
- When applying, work in small reviewable slices and end with a written
  summary of (a) what changed, (b) what was verified end-to-end, (c)
  what's intentionally not done yet.
- Respond in Traditional Chinese when the user writes Chinese; technical
  identifiers stay in English.
- §1 grammar correction at the top of every reply where the user wrote
  English with mistakes — this is non-negotiable per global CLAUDE.md.
