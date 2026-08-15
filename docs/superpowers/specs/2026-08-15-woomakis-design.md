# wooMakis — Design Spec

**Date:** 2026-08-15
**Status:** Approved
**Source system:** WooCommerce at `https://www.mylens.gr/`

---

## 1. Purpose

A Next.js application that mirrors the WooCommerce catalog at `mylens.gr` into Postgres,
gives staff a Greek-language admin to manage products, categories, images and customers
with **bidirectional** sync back to WooCommerce, mirrors all product imagery to BunnyCDN,
and publishes a custom GSAP-driven public storefront in Greek and English.

The storefront is a **catalog showcase**, not a second checkout. Purchases continue on
`mylens.gr`.

---

## 2. Measured facts about the source system

These were verified live against the WooCommerce REST API on 2026-08-15. They are the
basis of several design decisions and should be re-checked if the site changes.

| Fact | Value |
|---|---|
| Products | 408 (369 `simple`, 38 `variable`, 0 grouped, 0 external) |
| Categories | 20 |
| Registered customers | 30 |
| Orders | 1133 |
| Unique images (first 100 products) | 213 → est. 600–900 total |
| Page size that works | `per_page=100` (~900 KB/page with whitelist) |

### 2.1 Blocking defect in the source site — `_fields` whitelist is mandatory

`GET /wp-json/wc/v3/products` returns **HTTP 500** (WordPress critical error, Greek
error page). Bisection isolated it to exactly three fields:

| Field | Result |
|---|---|
| `id`, `name`, `slug`, `sku`, `type`, `status` | 200 |
| `description`, `short_description` | 200 |
| `price`, `regular_price` | 200 |
| **`sale_price`** | **500** |
| **`on_sale`** | **500** |
| **`price_html`** | **500** |
| `categories`, `tags`, `images`, `attributes`, `variations`, `meta_data`, stock, dimensions | 200 |

A WordPress plugin hooking WooCommerce sale-price display is throwing a fatal error.

**Consequence:** every product read **must** pass an explicit `_fields=` whitelist that
omits `sale_price`, `on_sale` and `price_html`. An off-the-shelf WooCommerce client that
requests the default full product object will 500 on every call. Sale state is derived
locally: `onSale = price < regularPrice`.

**Consequence for writes:** because these fields cannot be read, a price write cannot be
verified as round-tripping correctly. This is why the push path defaults to dry-run
(§6.4). Fixing the WordPress-side fatal error is recommended but is outside this
project's scope.

### 2.2 Guest-checkout skew

1133 orders against 30 registered customers means the large majority of buyers exist only
as billing blocks on orders. Customer ingestion therefore reads orders as well as the
`customers` endpoint (§5.2).

### 2.3 Credential scope

The supplied consumer key has read access to `orders` (1133 records) — broader than
product sync alone requires. Acceptable because guest ingestion needs order billing data.

---

## 3. Corrected configuration

Two values supplied at kickoff were wrong and are corrected here. Both were verified
against the live Bunny API.

| Variable | Supplied | Correct | Evidence |
|---|---|---|---|
| `BUNNY_STORAGE_ZONE` | `wooMakis` | **`woomakis`** | `wooMakis` → HTTP 401; `woomakis` → HTTP 200 |
| `BUNNY_PULL_ZONE_URL` | conflicting (`wooMakis-1.b-cdn.net` / `damask-1.b-cdn.net`) | **`https://woomakis.b-cdn.net`** | Confirmed by user; serves 404 for missing keys (correctly wired) |

The storage zone is currently empty (`[]`).

### 3.1 Secret handling

All credentials live only in `.env`, which is gitignored and never committed. The
repository is public.

**Rotation is recommended** for the Woo consumer secret, the Bunny storage password and
the super-admin password: all were transmitted in plaintext chat during kickoff. The
super-admin password supplied at kickoff is weak and shares a substring with the database
password; it is stored bcrypt-hashed and must be changed on first login.

---

## 4. Stack

Ported from the `cloudzeus/damask` reference repository wherever possible, so proven
plumbing is inherited rather than rebuilt.

| Concern | Choice |
|---|---|
| Framework | Next.js **16.3.1**, App Router, server components for all data fetching |
| ORM / DB | Prisma 7 + `@prisma/adapter-pg` → Postgres (`wooMakis` database) |
| Auth | Auth.js v5 (`next-auth@5` beta) credentials provider + `bcryptjs` |
| UI | shadcn/ui on **`@base-ui/react`** — use `render=`, not `asChild`; `DropdownMenuLabel` requires a `DropdownMenuGroup` wrapper |
| CSS | Tailwind 4 |
| i18n | `next-intl` — `el` (default) + `en` |
| Jobs | **pg-boss** (Postgres-backed; no Redis, no extra service) |
| Tables | TanStack Table v8 |
| Motion | GSAP + `@gsap/react` |
| Icons | `react-icons`, Lucide collection (`react-icons/lu`) |

### 4.1 Route structure

```
src/app/
  (admin)/          # authenticated staff area, Greek UI
  (shop)/[locale]/  # public storefront, el + en
  api/
    auth/           # Auth.js
    webhooks/woo/   # WooCommerce webhook receiver
    media/          # image upload / proxy
```

---

## 5. Data model

### 5.1 Catalog

`Product`, `ProductVariation`, `Category`, `Tag`, `Attribute`, `MediaAsset`.

Every synced entity carries three sync columns:

- `wooId` — remote primary key, unique, nullable (local-only records permitted)
- `wooModifiedAt` — Woo's `date_modified`
- `wooSnapshot` `Json` — **the last state we observed in WooCommerce**

`wooSnapshot` is what makes conflict detection possible (§6.2). It is written on every
successful pull and on every successful push, never by a local edit.

Translatable text lives in separate per-locale tables — `ProductTranslation`,
`CategoryTranslation` — keyed by `(entityId, locale)`. WooCommerce stores a single
language per field; these tables let Greek and English diverge without either being
clobbered on resync.

**Push participation:** `el` is the Woo-authoritative locale. Only `el` translations are
pushed to WooCommerce; `en` is local-only presentation data for the storefront and is
never sent. This is a fixed rule, not a per-field setting.

### 5.2 Customers

The full damask `Trdr` shape is ported, including the SoftOne, ΓΕΜΗ and ΑΑΔΕ columns that
have no WooCommerce counterpart. They remain empty until a SoftOne integration is added.
Rationale: the columns cost nothing now and avoid a migration later.

Added for this project:

- `wooCustomerId Int?` — unique, null for guests and local-only records
- `source` enum — `WOO` | `GUEST` | `LOCAL`

`Contact` is ported for the person-on-a-customer relationship.
`Country` is ported **solely as a translation table** between SoftOne numeric `COUNTRY`
codes and the ISO-2 codes WooCommerce expects in `billing.country`.

**Guest ingestion:** orders are read, billing blocks deduped by lowercased email, and
customer rows created with `source = GUEST`. Guests have no `wooCustomerId` and are never
pushed unless explicitly promoted to a WooCommerce account by an admin.

### 5.3 Staff and access control

`User`, `Role`, `Permission`, `RolePermission` ported wholesale from damask, with its
permission-matrix admin screen.

**Customers do not get logins.** `User` is staff-only. The optional `User.trdrId` column
is retained so a B2B customer portal can be added later as a feature rather than a
migration.

Seeded super admin: `gkozyris@i4ria.com`, role `SUPER_ADMIN`, bcrypt-hashed password.

### 5.4 Sync infrastructure

| Model | Purpose |
|---|---|
| `Setting` (KV) | Per-target sync config: `syncEnabled`, `direction`, `master`, `frequency`, `lastRunAt` |
| `FieldMapping` | Editable local-field ↔ Woo-field matrix, per entity |
| `ProductChange` | Outbox: entity, entityId, field, oldValue, newValue, actor, status, idempotencyKey, attempts, lastError |
| `SyncLog` | Per-run record: target, direction, counts, duration, outcome |
| `WebhookInbox` | Raw verified deliveries awaiting processing + replay protection |

### 5.5 Customer field mapping (default seed)

Editable in the Settings UI; these are the seeded defaults, not hardcoded behaviour.

| Local (`Trdr`) | WooCommerce `customer` | Note |
|---|---|---|
| `EMAIL` | `email`, `billing.email` | natural key for dedupe |
| `NAME` | `first_name` + `last_name` | split on last space; `billing.company` when `SODTYPE` indicates a company |
| `PHONE01` | `billing.phone` | |
| `ADDRESS` | `billing.address_1` | |
| `ZIP` | `billing.postcode` | |
| `CITY` | `billing.city` | |
| `DISTRICT` | `billing.state` | |
| `COUNTRY` (numeric) | `billing.country` (ISO-2) | via `Country` translation table |
| `AFM` | `meta_data._billing_vat` | no native Woo field; meta key configurable |
| `IRSDATA` (ΔΟΥ) | `meta_data._billing_irsdata` | configurable |
| `JOBTYPETRD` | `meta_data._billing_jobtype` | configurable |
| `CODE` | `meta_data._customer_code` | configurable |
| `SODTYPE`, `TRDPGROUP`, `SOCURRENCY`, `PRSN`, ΓΕΜΗ/ΑΑΔΕ block | — | app-only, never pushed |

---

## 6. Sync engine

### 6.1 Pull

WooCommerce → Postgres. Always safe, never blocked.

Reads with the mandatory `_fields` whitelist (§2.1) at `per_page=100`. Upserts by `wooId`.
Writes `wooSnapshot` and `wooModifiedAt`. Enqueues image-mirror jobs for any image whose
source URL is not yet mirrored. Records a `SyncLog` row.

### 6.2 Push — snapshot + outbox + conflict detection

Local edits do **not** call WooCommerce. They update the local row and append rows to the
`ProductChange` outbox.

A pg-boss worker drains the outbox. For each change, before sending:

1. Re-fetch the entity from WooCommerce (whitelisted fields).
2. Compare the remote value of the changed field against `wooSnapshot`.
3. If it differs, someone changed it in WP-Admin since our last pull → **conflict**. The
   change is marked `CONFLICT`, never sent, and surfaced in the admin UI for the user to
   resolve (keep local, take remote, or merge).
4. Otherwise `PUT` the change with an idempotency key of
   `<entity>-<id>-<field>-<version>`, then refresh `wooSnapshot` from the response.

Failures retry with exponential backoff. Every attempt is recorded with its error.

### 6.3 Write scope

All fields are pushable **including price and stock**, per explicit decision. `sale_price`
and `on_sale` cannot be pushed reliably while §2.1 remains unfixed and are excluded until
then; only `regular_price` and `price` participate.

Customer writes use the identical outbox pipeline. Changing a customer's email in
WooCommerce changes their login identity, so the same guardrails apply.

### 6.4 Write safety

Three independent gates, all required:

1. **`WOO_ALLOW_WRITES=false` by default.** Mutations throw unless explicitly enabled.
2. **Dry-run default on the push path.** Payloads are rendered for inspection against real
   products; nothing leaves the application until dry-run is switched off.
3. **Diff preview + confirmation for price and stock.** A rendered before/after diff must
   be confirmed per session. Because `WOO_ENVIRONMENT=production`, the literal
   confirmation phrase is required per the project's WooCommerce operating rules.

No write of any kind is executed against the production store without explicit user
approval at the time of execution.

### 6.5 Triggers

| Trigger | Behaviour |
|---|---|
| Manual | "Sync now" button, live progress, per-target |
| Scheduled | Nightly full reconcile via pg-boss cron |
| Webhook | `product.created/updated/deleted`, `customer.*`, `order.created` |

**Webhook receiver contract:** capture `await request.text()` **first**; verify
HMAC-SHA256 over the raw bytes using the **delivery secret** (not the consumer secret),
base64, timing-safe compare; only then `JSON.parse`. Persist to `WebhookInbox` and return
200 in under 500 ms. A separate worker drains the inbox. Replays (by
`X-WC-Webhook-Delivery-Id`, 24 h TTL) are dropped with 200; bad signatures with 401.

---

## 7. Image pipeline

1. Fetch the original from `mylens.gr`.
2. SHA-256 the bytes → content hash.
3. Store at `products/<hash>/original.<ext>` in Bunny zone `woomakis` via the raw Storage
   HTTP API (`PUT` with `AccessKey` header).
4. Generate WebP and AVIF derivatives at fixed widths; store alongside.
5. Serve from `https://woomakis.b-cdn.net`.

Content-hashing makes re-sync idempotent (same bytes → same key → no re-upload) and
dedupes images shared across products. The original WooCommerce URL is retained on
`MediaAsset` as a fallback if Bunny is unreachable.

At ~600–900 images the initial mirror is a single queued job with visible progress.

---

## 8. Admin application

Greek UI throughout. Design system inherited from damask's **Steel & Frost** (v3):
frosted glass surfaces, navy `#16323F` primary, coral `#E4574D` reserved for data
highlights and alerts, Comfortaa headings + Manrope body/numerals, pill buttons, GSAP
entrance stagger at 60 ms.

### 8.1 The DataTable

Built **once**, first consumer Products, then Categories, Customers, Media. Provides
declaratively: sorting (multi-sort with Shift), column resize, column show/hide picker,
page-size selector, expandable detail rows, per-row action menu filtered by permissions,
inline edit (double-click, Enter saves, Esc cancels, validate on blur), row selection with
bulk actions, search, filter chips, Excel export honouring active filters, and per-user
persisted view state.

### 8.2 Screens

Products, Categories, Media library, Customers, Sync (per-target config, run history,
conflict queue), Field mapping, Users, Roles & permissions, Settings.

### 8.3 Interaction rules

One primary action per screen, top-right, always labelled. Confirmation before every
destructive action. Errors in Greek stating cause and remedy, below the field, focus on
the first error. Status badges always combine icon + word + colour. Every background job
appears in the topbar notification centre with real progress — never an indefinite
spinner. All motion respects `prefers-reduced-motion`.

---

## 9. Storefront

Public, unauthenticated, `el` and `en`. Its own art direction — **not** Steel & Frost —
suited to an eyewear and contact-lens brand.

Home, category listing, product detail, search. GSAP-driven scroll and entrance motion.
Images served from Bunny with explicit `width`/`height` for zero CLS, `object-cover`,
lazy below the fold.

"Buy" links through to the corresponding `mylens.gr` product page. **No cart, no checkout,
no payment handling, no PCI scope.**

---

## 10. Phasing

| Phase | Scope |
|---|---|
| 1 | Repo, Prisma schema, Auth.js, RBAC, seeded super admin, Steel & Frost shell |
| 2 | Pull sync + Bunny image mirror + DataTable + product/category admin |
| 3 | Customers: `Trdr` port, guest ingestion, field-mapping settings UI |
| 4 | Push sync: outbox, conflict UI, diff preview, webhooks — dry-run until approved live |
| 5 | Storefront: custom design, GSAP, i18n |

Each phase gets its own implementation plan.

---

## 11. Environment variables

```
DATABASE_URL=postgres://giannis:<password>@100.70.50.43:5432/wooMakis?schema=public

AUTH_SECRET=
AUTH_URL=http://localhost:3000

WOO_BASE_URL=https://www.mylens.gr
WOO_CONSUMER_KEY=ck_...
WOO_CONSUMER_SECRET=cs_...
WOO_WEBHOOK_SECRET=                 # delivery secret, NOT the consumer secret
WOO_ENVIRONMENT=production
WOO_ALLOW_WRITES=false
WOO_DRY_RUN=true
WOO_TIMEOUT_MS=15000
WOO_MAX_RETRIES=3
WOO_MAX_PAGES=50
WOO_MAX_ITEMS=500

BUNNY_STORAGE_ZONE=woomakis
BUNNY_STORAGE_PASSWORD=
BUNNY_STORAGE_API=https://storage.bunnycdn.com
BUNNY_S3_ENDPOINT=https://de-s3.storage.bunnycdn.com
BUNNY_PULL_ZONE_URL=https://woomakis.b-cdn.net
```

`WOO_WEBHOOK_SECRET` is **not yet supplied** — it is the value of the "Secret" field in
WP-Admin → WooCommerce → Settings → Advanced → Webhooks, and is required before phase 4
webhooks can be verified.

---

## 12. Testing

- **Unit:** field mapping, name-splitting, country-code translation, sale-state derivation,
  conflict detection against fixture snapshots, webhook signature verification (valid,
  tampered, replayed).
- **Integration:** pull against recorded WooCommerce fixtures including the 500-triggering
  field set, to prove the whitelist holds; outbox drain with a mocked remote covering
  success, conflict, and retry-then-success.
- **E2E (Playwright):** login, product edit → outbox row created → dry-run diff rendered
  and nothing sent; conflict surfaced and resolvable.

No test writes to the production WooCommerce store.

---

## 13. Open items

1. `WOO_WEBHOOK_SECRET` not yet supplied — blocks phase 4 webhook verification only.
2. The `sale_price` / `on_sale` / `price_html` fatal error on `mylens.gr` is unfixed.
   Sale-price sync stays out of scope until it is resolved on the WordPress side.
3. Deployment target assumed Docker (damask ships a Dockerfile); not yet confirmed.
4. Storefront art direction not yet designed — its own step at the start of phase 5.
