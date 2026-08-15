# wooMakis Phase 2A — Catalog Pull Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull the WooCommerce catalog from `mylens.gr` into Postgres — correctly collapsing Polylang translation pairs into single logical products — and mirror every product image onto BunnyCDN, so Phase 2B has real data to build screens against.

**Architecture:** A read-only Woo REST client that hard-enforces a `_fields` whitelist (the source site 500s otherwise), a grouping layer that turns Polylang post pairs into translation groups, idempotent upsert-by-`wooId` sync engines for categories and products, and a pg-boss queue that mirrors images to Bunny by content hash. No writes to WooCommerce anywhere in this phase.

**Tech Stack:** Prisma 7 + Postgres, pg-boss (Postgres-backed queue), sharp (image derivatives), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-15-woomakis-design.md` — read §2 (measured facts), §2.0 (Polylang), §5.1 (data model), §6.1 (pull), §7 (images).

**Out of scope (deliberate):** Any write to WooCommerce — phase 4. DataTable and admin screens — phase 2B. Customers — phase 3.

---

## Preconditions

Phase 1 is complete and on branch `phase-1-foundation`:

- Next.js 16.3.1, Prisma 7 client singleton at `src/lib/prisma.ts`, `prisma.config.ts`
- `User`/`Role`/`Permission`/`RolePermission` migrated and seeded (17 permissions, 3 roles, 1 super admin)
- Auth.js v5 working; `src/proxy.ts` gates protected routes
- `src/lib/permissions.ts`, `src/lib/rbac.ts`, `src/lib/rbac-server.ts`
- `.secretscan.sh` — **must print `scan: clean` before every commit**
- 18 tests passing

`.env` already contains `WOO_BASE_URL`, `WOO_CONSUMER_KEY`, `WOO_CONSUMER_SECRET`,
`WOO_ENVIRONMENT=production`, `WOO_ALLOW_WRITES=false`, `WOO_DRY_RUN=true`, and all five
`BUNNY_*` variables. **Never open `.env`; read via `process.env`.**

---

## Non-negotiable constraints

1. **The `_fields` whitelist is mandatory.** `GET /products` without it returns HTTP 500 —
   a plugin on the source site throws a PHP fatal error on `sale_price`, `on_sale` and
   `price_html`. Any code path that can request those fields is a defect.
2. **This phase never writes to WooCommerce.** No `POST`, `PUT`, or `DELETE` against the
   Woo REST API, not even behind a flag. The client must not expose a mutation method.
3. **Bunny storage zone is `woomakis`** (lowercase — `wooMakis` returns 401). Pull zone is
   `https://woomakis.b-cdn.net`.
4. Do not run `prisma migrate reset` or drop anything. The database server is shared.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/woo/fields.ts` | The `_fields` whitelists. Single source of truth |
| `src/lib/woo/client.ts` | Authenticated, paginated, read-only Woo REST client |
| `src/lib/woo/types.ts` | Response shapes for products, categories, variations |
| `src/lib/woo/translation-groups.ts` | Pure: collapse Polylang posts into groups |
| `src/lib/bunny.ts` | Bunny Storage upload/exists/delete via raw HTTP API |
| `src/lib/images.ts` | Content hashing, derivative generation, storage keys |
| `src/lib/queue.ts` | pg-boss singleton |
| `src/lib/sync/categories.ts` | Category pull engine |
| `src/lib/sync/products.ts` | Product pull engine |
| `src/lib/sync/run.ts` | Orchestration + `SyncLog` |
| `src/jobs/mirror-image.ts` | Queue worker: fetch → hash → derive → upload |
| `scripts/sync.ts` | CLI entry point for a manual run |

`fields.ts` is separate from `client.ts` so the whitelist can be asserted in tests without
constructing a client or touching the network.

---

## Task 1: Catalog schema

**Files:** Modify `prisma/schema.prisma`.

- [ ] **Step 1: Append the models**

The parent `Product` holds language-neutral data and has **no `wooId`** — no single
WooCommerce post represents it. `wooGroupKey` is the lowest post id in the translation
group, giving a stable identity that survives either language being edited.

```prisma
enum SyncDirection {
  PULL
  PUSH
}

enum SyncOutcome {
  SUCCESS
  PARTIAL
  FAILED
}

model Category {
  id           String   @id @default(cuid())
  wooGroupKey  Int      @unique
  parentGroupKey Int?
  menuOrder    Int      @default(0)
  count        Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  translations CategoryTranslation[]
  products     ProductCategory[]

  @@index([parentGroupKey])
}

model CategoryTranslation {
  categoryId    String
  locale        String
  wooId         Int       @unique
  wooModifiedAt DateTime?
  wooSnapshot   Json?
  name          String
  slug          String
  description   String?

  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([categoryId, locale])
  @@index([slug])
}

model Product {
  id          String   @id @default(cuid())
  wooGroupKey Int      @unique
  sku         String?
  type        String
  status      String
  featured    Boolean  @default(false)
  price       Decimal? @db.Decimal(12, 2)
  regularPrice Decimal? @db.Decimal(12, 2)
  /// Derived locally: Woo's sale_price and on_sale fields cannot be read (see spec §2.1).
  onSale      Boolean  @default(false)
  manageStock Boolean  @default(false)
  stockQuantity Int?
  stockStatus String   @default("instock")
  menuOrder   Int      @default(0)
  totalSales  Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  translations ProductTranslation[]
  variations   ProductVariation[]
  categories   ProductCategory[]
  images       ProductImage[]

  @@index([type])
  @@index([status])
  @@index([sku])
}

model ProductTranslation {
  productId        String
  locale           String
  wooId            Int       @unique
  wooModifiedAt    DateTime?
  wooSnapshot      Json?
  name             String
  slug             String
  description      String?
  shortDescription String?
  permalink        String?

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@id([productId, locale])
  @@index([slug])
}

model ProductVariation {
  id           String   @id @default(cuid())
  productId    String
  wooId        Int      @unique
  sku          String?
  price        Decimal? @db.Decimal(12, 2)
  regularPrice Decimal? @db.Decimal(12, 2)
  stockQuantity Int?
  stockStatus  String   @default("instock")
  menuOrder    Int      @default(0)
  attributes   Json
  imageId      String?

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
}

model ProductCategory {
  productId  String
  categoryId String

  product  Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([productId, categoryId])
  @@index([categoryId])
}

model MediaAsset {
  id          String   @id @default(cuid())
  /// SHA-256 of the original bytes — the dedupe and idempotency key.
  contentHash String   @unique
  sourceUrl   String
  storageKey  String
  cdnUrl      String
  mimeType    String
  bytes       Int
  width       Int?
  height      Int?
  /// Generated derivative widths, e.g. [320, 640, 1280]
  derivatives Json?
  mirroredAt  DateTime?
  createdAt   DateTime @default(now())

  products ProductImage[]

  @@index([sourceUrl])
}

model ProductImage {
  productId String
  assetId   String
  position  Int    @default(0)
  alt       String?

  product Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
  asset   MediaAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@id([productId, assetId])
  @@index([assetId])
}

model SyncLog {
  id         String        @id @default(cuid())
  target     String
  direction  SyncDirection
  outcome    SyncOutcome
  startedAt  DateTime
  finishedAt DateTime?
  created    Int           @default(0)
  updated    Int           @default(0)
  skipped    Int           @default(0)
  failed     Int           @default(0)
  error      String?

  @@index([target, startedAt])
}
```

- [ ] **Step 2: Migrate**

Run: `npx prisma migrate dev --name catalog_schema`
Expected: migration created and applied.

- [ ] **Step 3: Verify tables exist**

Write a throwaway `tsx` script in the repo root (module resolution requires it), run it,
then delete it. Confirm `Product`, `ProductTranslation`, `ProductVariation`, `Category`,
`CategoryTranslation`, `ProductCategory`, `MediaAsset`, `ProductImage`, `SyncLog` all
exist and are empty.

- [ ] **Step 4: Commit** (after `./.secretscan.sh` → `scan: clean`)

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add catalog schema with Polylang translation groups"
```

---

## Task 2: The field whitelist

This is the single most important file in the phase. It is what stops the source site
returning 500.

**Files:** Create `src/lib/woo/fields.ts`. Test: `tests/woo-fields.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/woo-fields.test.ts
import { describe, it, expect } from 'vitest'
import { PRODUCT_FIELDS, CATEGORY_FIELDS, VARIATION_FIELDS, FORBIDDEN_FIELDS } from '@/lib/woo/fields'

describe('woo field whitelists', () => {
  it('never requests the fields that crash the source site', () => {
    for (const list of [PRODUCT_FIELDS, CATEGORY_FIELDS, VARIATION_FIELDS]) {
      for (const forbidden of FORBIDDEN_FIELDS) {
        expect(list, `${forbidden} must never be requested`).not.toContain(forbidden)
      }
    }
  })

  it('names exactly the three fields known to 500', () => {
    expect([...FORBIDDEN_FIELDS].sort()).toEqual(['on_sale', 'price_html', 'sale_price'])
  })

  it('requests the fields the sync engine depends on', () => {
    for (const f of ['id', 'lang', 'translations', 'name', 'slug', 'price', 'regular_price',
                     'categories', 'images', 'date_modified', 'type', 'status']) {
      expect(PRODUCT_FIELDS).toContain(f)
    }
  })

  it('requests lang and translations on categories so groups can be built', () => {
    expect(CATEGORY_FIELDS).toContain('lang')
    expect(CATEGORY_FIELDS).toContain('translations')
  })

  it('has no duplicate entries', () => {
    for (const list of [PRODUCT_FIELDS, CATEGORY_FIELDS, VARIATION_FIELDS]) {
      expect(new Set(list).size).toBe(list.length)
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/woo-fields.test.ts`
Expected: FAIL — cannot resolve `@/lib/woo/fields`

- [ ] **Step 3: Implement**

```ts
// src/lib/woo/fields.ts

/**
 * mylens.gr throws a PHP fatal error (HTTP 500) when any of these are requested.
 * Verified by bisection on 2026-08-15. A plugin hooking WooCommerce sale-price
 * display is the cause; it is unfixed on the WordPress side.
 *
 * Sale state is derived locally instead: onSale = price < regularPrice.
 */
export const FORBIDDEN_FIELDS = ['sale_price', 'on_sale', 'price_html'] as const

export const PRODUCT_FIELDS = [
  'id', 'lang', 'translations',
  'name', 'slug', 'permalink', 'sku', 'type', 'status', 'featured',
  'description', 'short_description',
  'price', 'regular_price',
  'manage_stock', 'stock_quantity', 'stock_status',
  'categories', 'tags', 'images', 'attributes', 'variations',
  'menu_order', 'total_sales',
  'date_created', 'date_modified',
] as const

export const CATEGORY_FIELDS = [
  'id', 'lang', 'translations',
  'name', 'slug', 'parent', 'description', 'menu_order', 'count',
] as const

export const VARIATION_FIELDS = [
  'id', 'sku', 'price', 'regular_price',
  'stock_quantity', 'stock_status', 'attributes', 'image', 'menu_order',
] as const

/** Comma-joined for the `_fields` query parameter. */
export function fieldParam(list: readonly string[]): string {
  return list.join(',')
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/woo-fields.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit** (after `./.secretscan.sh`)

```bash
git add src/lib/woo/fields.ts tests/woo-fields.test.ts
git commit -m "feat: add Woo field whitelist excluding the fields that 500"
```

---

## Task 3: Read-only Woo client

**Files:** Create `src/lib/woo/types.ts`, `src/lib/woo/client.ts`. Test: `tests/woo-client.test.ts`.

- [ ] **Step 1: Write the types**

```ts
// src/lib/woo/types.ts
export type WooTranslations = Record<string, number>

export type WooImage = {
  id: number
  src: string
  name?: string
  alt?: string
}

export type WooTermRef = { id: number; name: string; slug: string }

export type WooCategory = {
  id: number
  lang: string
  translations: WooTranslations
  name: string
  slug: string
  parent: number
  description: string
  menu_order: number
  count: number
}

export type WooProduct = {
  id: number
  lang: string
  translations: WooTranslations
  name: string
  slug: string
  permalink: string
  sku: string
  type: string
  status: string
  featured: boolean
  description: string
  short_description: string
  price: string
  regular_price: string
  manage_stock: boolean
  stock_quantity: number | null
  stock_status: string
  categories: WooTermRef[]
  tags: WooTermRef[]
  images: WooImage[]
  attributes: unknown[]
  variations: number[]
  menu_order: number
  total_sales: number
  date_created: string
  date_modified: string
}

export type WooVariation = {
  id: number
  sku: string
  price: string
  regular_price: string
  stock_quantity: number | null
  stock_status: string
  attributes: unknown[]
  image: WooImage | null
  menu_order: number
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/woo-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FORBIDDEN_FIELDS } from '@/lib/woo/fields'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubEnv('WOO_BASE_URL', 'https://example.test')
  vi.stubEnv('WOO_CONSUMER_KEY', 'ck_test')
  vi.stubEnv('WOO_CONSUMER_SECRET', 'cs_test')
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllEnvs())

function page(body: unknown, total = '1', totalPages = '1') {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'x-wp-total': total, 'x-wp-totalpages': totalPages }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

describe('woo client', () => {
  it('always sends a _fields parameter that excludes the crashing fields', async () => {
    const { listCategories } = await import('@/lib/woo/client')
    fetchMock.mockResolvedValue(page([]))
    await listCategories()
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    const fields = url.searchParams.get('_fields')
    expect(fields).toBeTruthy()
    for (const f of FORBIDDEN_FIELDS) expect(fields!.split(',')).not.toContain(f)
  })

  it('sends basic auth built from the env credentials', async () => {
    const { listCategories } = await import('@/lib/woo/client')
    fetchMock.mockResolvedValue(page([]))
    await listCategories()
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const auth = new Headers(init.headers).get('authorization')
    expect(auth).toBe(`Basic ${Buffer.from('ck_test:cs_test').toString('base64')}`)
  })

  it('follows pagination until totalPages is reached', async () => {
    const { listCategories } = await import('@/lib/woo/client')
    fetchMock
      .mockResolvedValueOnce(page([{ id: 1 }], '2', '2'))
      .mockResolvedValueOnce(page([{ id: 2 }], '2', '2'))
    const all = await listCategories()
    expect(all.map((c: { id: number }) => c.id)).toEqual([1, 2])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops at maxPages rather than looping forever', async () => {
    const { listCategories } = await import('@/lib/woo/client')
    fetchMock.mockResolvedValue(page([{ id: 1 }], '10000', '100'))
    await listCategories({ maxPages: 3 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws a typed error carrying the status on a non-ok response', async () => {
    const { listCategories, WooHttpError } = await import('@/lib/woo/client')
    fetchMock.mockResolvedValue({
      ok: false, status: 500, headers: new Headers(),
      text: async () => 'critical error', json: async () => ({}),
    })
    await expect(listCategories()).rejects.toBeInstanceOf(WooHttpError)
  })

  it('exposes no mutation method — this phase is read-only', async () => {
    const mod = await import('@/lib/woo/client')
    for (const name of Object.keys(mod)) {
      expect(name).not.toMatch(/^(create|update|delete|put|post|patch)/i)
    }
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/woo-client.test.ts`
Expected: FAIL — cannot resolve `@/lib/woo/client`

- [ ] **Step 4: Implement**

```ts
// src/lib/woo/client.ts
import { CATEGORY_FIELDS, PRODUCT_FIELDS, VARIATION_FIELDS, fieldParam } from '@/lib/woo/fields'
import type { WooCategory, WooProduct, WooVariation } from '@/lib/woo/types'

export class WooHttpError extends Error {
  constructor(readonly status: number, readonly url: string, readonly body: string) {
    super(`Woo HTTP ${status} for ${url}: ${body.slice(0, 200)}`)
    this.name = 'WooHttpError'
  }
}

type ListOptions = { perPage?: number; maxPages?: number; params?: Record<string, string> }

function config() {
  const baseUrl = process.env.WOO_BASE_URL?.replace(/\/+$/, '')
  const key = process.env.WOO_CONSUMER_KEY
  const secret = process.env.WOO_CONSUMER_SECRET
  if (!baseUrl || !key || !secret) {
    throw new Error('Λείπουν ρυθμίσεις WooCommerce (WOO_BASE_URL / WOO_CONSUMER_KEY / WOO_CONSUMER_SECRET).')
  }
  return { baseUrl, auth: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` }
}

/**
 * Paginated GET. `_fields` is applied by the caller and is never optional —
 * requesting the full object 500s on the source site (see lib/woo/fields.ts).
 */
async function listAll<T>(
  resource: string,
  fields: readonly string[],
  { perPage = 100, maxPages = 50, params = {} }: ListOptions = {},
): Promise<T[]> {
  const { baseUrl, auth } = config()
  const out: T[] = []

  for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
    const url = new URL(`${baseUrl}/wp-json/wc/v3/${resource}`)
    url.searchParams.set('per_page', String(perPage))
    url.searchParams.set('page', String(pageNo))
    url.searchParams.set('_fields', fieldParam(fields))
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

    const res = await fetch(url.toString(), {
      headers: { authorization: auth, accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new WooHttpError(res.status, url.toString(), await res.text().catch(() => ''))

    const batch = (await res.json()) as T[]
    out.push(...batch)

    const totalPages = Number(res.headers.get('x-wp-totalpages') ?? '1')
    if (pageNo >= totalPages) break
  }
  return out
}

export function listCategories(opts?: ListOptions): Promise<WooCategory[]> {
  return listAll<WooCategory>('products/categories', CATEGORY_FIELDS, opts)
}

export function listProducts(opts?: ListOptions): Promise<WooProduct[]> {
  return listAll<WooProduct>('products', PRODUCT_FIELDS, opts)
}

export function listVariations(productId: number, opts?: ListOptions): Promise<WooVariation[]> {
  return listAll<WooVariation>(`products/${productId}/variations`, VARIATION_FIELDS, opts)
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/woo-client.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 6: Commit** (after `./.secretscan.sh`)

```bash
git add src/lib/woo/types.ts src/lib/woo/client.ts tests/woo-client.test.ts
git commit -m "feat: add read-only paginated WooCommerce client"
```

---

## Task 4: Polylang translation grouping

Pure logic, no I/O — the piece most likely to silently double the catalog if wrong.

**Files:** Create `src/lib/woo/translation-groups.ts`. Test: `tests/translation-groups.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/translation-groups.test.ts
import { describe, it, expect } from 'vitest'
import { groupByTranslation } from '@/lib/woo/translation-groups'

const post = (id: number, lang: string, translations: Record<string, number>, name = `p${id}`) =>
  ({ id, lang, translations, name })

describe('groupByTranslation', () => {
  it('collapses a translation pair into one group', () => {
    const groups = groupByTranslation([
      post(4308, 'el', { el: 4308, en: 4309 }),
      post(4309, 'en', { el: 4308, en: 4309 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].groupKey).toBe(4308)
    expect(Object.keys(groups[0].byLocale).sort()).toEqual(['el', 'en'])
  })

  it('uses the lowest post id in the group as the stable key', () => {
    const groups = groupByTranslation([
      post(900, 'en', { el: 100, en: 900 }),
      post(100, 'el', { el: 100, en: 900 }),
    ])
    expect(groups[0].groupKey).toBe(100)
  })

  it('keeps an untranslated post as its own single-locale group', () => {
    const groups = groupByTranslation([post(77, 'el', { el: 77 })])
    expect(groups).toHaveLength(1)
    expect(groups[0].groupKey).toBe(77)
    expect(Object.keys(groups[0].byLocale)).toEqual(['el'])
  })

  it('handles a post with an empty translations map', () => {
    const groups = groupByTranslation([post(5, 'el', {})])
    expect(groups).toHaveLength(1)
    expect(groups[0].groupKey).toBe(5)
    expect(groups[0].byLocale.el.id).toBe(5)
  })

  it('does not double count when both members appear', () => {
    const groups = groupByTranslation([
      post(1, 'el', { el: 1, en: 2 }), post(2, 'en', { el: 1, en: 2 }),
      post(3, 'el', { el: 3, en: 4 }), post(4, 'en', { el: 3, en: 4 }),
    ])
    expect(groups).toHaveLength(2)
  })

  it('groups correctly when only one member of a pair was fetched', () => {
    // ?lang=el returns only Greek posts, but each still names its English twin.
    const groups = groupByTranslation([post(1, 'el', { el: 1, en: 2 })])
    expect(groups).toHaveLength(1)
    expect(groups[0].groupKey).toBe(1)
    expect(groups[0].byLocale.en).toBeUndefined()
  })

  it('is deterministic regardless of input order', () => {
    const a = groupByTranslation([post(2, 'en', { el: 1, en: 2 }), post(1, 'el', { el: 1, en: 2 })])
    const b = groupByTranslation([post(1, 'el', { el: 1, en: 2 }), post(2, 'en', { el: 1, en: 2 })])
    expect(a[0].groupKey).toBe(b[0].groupKey)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/translation-groups.test.ts`
Expected: FAIL — cannot resolve `@/lib/woo/translation-groups`

- [ ] **Step 3: Implement**

```ts
// src/lib/woo/translation-groups.ts

export type TranslatablePost = {
  id: number
  lang: string
  translations: Record<string, number>
}

export type TranslationGroup<T extends TranslatablePost> = {
  /**
   * Lowest post id across the whole translation set — including ids we did not
   * fetch. Using the lowest *known* id instead would make the key flip when a
   * language is fetched separately.
   */
  groupKey: number
  byLocale: Record<string, T>
}

/**
 * Collapses Polylang posts into logical entities. The source site returns one
 * post per language (see spec §2.0); treating each as its own product would
 * double the catalog.
 */
export function groupByTranslation<T extends TranslatablePost>(posts: T[]): TranslationGroup<T>[] {
  const groups = new Map<number, TranslationGroup<T>>()

  for (const post of posts) {
    const ids = Object.values(post.translations ?? {})
    const groupKey = ids.length ? Math.min(...ids, post.id) : post.id

    let group = groups.get(groupKey)
    if (!group) {
      group = { groupKey, byLocale: {} }
      groups.set(groupKey, group)
    }
    group.byLocale[post.lang] = post
  }

  return [...groups.values()].sort((a, b) => a.groupKey - b.groupKey)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/translation-groups.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit** (after `./.secretscan.sh`)

```bash
git add src/lib/woo/translation-groups.ts tests/translation-groups.test.ts
git commit -m "feat: collapse Polylang posts into translation groups"
```

---

## Task 5: Category pull engine

**Files:** Create `src/lib/sync/categories.ts`. Test: `tests/sync-categories.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/sync-categories.test.ts
import { describe, it, expect } from 'vitest'
import { toCategoryUpserts } from '@/lib/sync/categories'
import type { WooCategory } from '@/lib/woo/types'

const cat = (over: Partial<WooCategory>): WooCategory => ({
  id: 1, lang: 'el', translations: { el: 1 }, name: 'Φακοί', slug: 'fakoi',
  parent: 0, description: '', menu_order: 0, count: 5, ...over,
})

describe('toCategoryUpserts', () => {
  it('produces one row per translation group, not per post', () => {
    const rows = toCategoryUpserts([
      cat({ id: 1, lang: 'el', translations: { el: 1, en: 2 } }),
      cat({ id: 2, lang: 'en', translations: { el: 1, en: 2 }, name: 'Lenses', slug: 'lenses' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].wooGroupKey).toBe(1)
    expect(rows[0].translations.map(t => t.locale).sort()).toEqual(['el', 'en'])
  })

  it('carries each locale name and its own wooId', () => {
    const rows = toCategoryUpserts([
      cat({ id: 1, lang: 'el', translations: { el: 1, en: 2 }, name: 'Φακοί' }),
      cat({ id: 2, lang: 'en', translations: { el: 1, en: 2 }, name: 'Lenses' }),
    ])
    const byLocale = Object.fromEntries(rows[0].translations.map(t => [t.locale, t]))
    expect(byLocale.el.name).toBe('Φακοί')
    expect(byLocale.el.wooId).toBe(1)
    expect(byLocale.en.name).toBe('Lenses')
    expect(byLocale.en.wooId).toBe(2)
  })

  it('maps a top-level category to a null parent rather than group 0', () => {
    const rows = toCategoryUpserts([cat({ parent: 0 })])
    expect(rows[0].parentGroupKey).toBeNull()
  })

  it('resolves a child parent id to the parent group key', () => {
    const rows = toCategoryUpserts([
      cat({ id: 1, lang: 'el', translations: { el: 1, en: 2 } }),
      cat({ id: 2, lang: 'en', translations: { el: 1, en: 2 } }),
      cat({ id: 3, lang: 'el', translations: { el: 3, en: 4 }, parent: 1 }),
      cat({ id: 4, lang: 'en', translations: { el: 3, en: 4 }, parent: 2 }),
    ])
    const child = rows.find(r => r.wooGroupKey === 3)!
    expect(child.parentGroupKey).toBe(1)
  })

  it('keeps the snapshot of each post for later conflict detection', () => {
    const rows = toCategoryUpserts([cat({ id: 9, translations: { el: 9 } })])
    expect(rows[0].translations[0].wooSnapshot).toMatchObject({ id: 9 })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/sync-categories.test.ts`
Expected: FAIL — cannot resolve `@/lib/sync/categories`

- [ ] **Step 3: Implement the pure mapper plus the DB writer**

```ts
// src/lib/sync/categories.ts
import { prisma } from '@/lib/prisma'
import { listCategories } from '@/lib/woo/client'
import { groupByTranslation } from '@/lib/woo/translation-groups'
import type { WooCategory } from '@/lib/woo/types'

export type CategoryTranslationUpsert = {
  locale: string
  wooId: number
  name: string
  slug: string
  description: string | null
  wooSnapshot: WooCategory
}

export type CategoryUpsert = {
  wooGroupKey: number
  parentGroupKey: number | null
  menuOrder: number
  count: number
  translations: CategoryTranslationUpsert[]
}

/** Pure: Woo posts → one upsert per logical category. */
export function toCategoryUpserts(posts: WooCategory[]): CategoryUpsert[] {
  const groups = groupByTranslation(posts)

  // Any post id → its group key, so a parent reference in either language resolves.
  const groupKeyByPostId = new Map<number, number>()
  for (const g of groups) {
    for (const post of Object.values(g.byLocale)) {
      groupKeyByPostId.set(post.id, g.groupKey)
      for (const id of Object.values(post.translations ?? {})) {
        groupKeyByPostId.set(id, g.groupKey)
      }
    }
  }

  return groups.map(g => {
    const any = Object.values(g.byLocale)[0]
    const parent = any.parent
    return {
      wooGroupKey: g.groupKey,
      parentGroupKey: parent ? groupKeyByPostId.get(parent) ?? null : null,
      menuOrder: any.menu_order,
      count: any.count,
      translations: Object.entries(g.byLocale).map(([locale, post]) => ({
        locale,
        wooId: post.id,
        name: post.name,
        slug: post.slug,
        description: post.description || null,
        wooSnapshot: post,
      })),
    }
  })
}

export type PullResult = { created: number; updated: number }

export async function pullCategories(): Promise<PullResult> {
  const posts = await listCategories()
  const upserts = toCategoryUpserts(posts)
  let created = 0
  let updated = 0

  for (const row of upserts) {
    const existing = await prisma.category.findUnique({ where: { wooGroupKey: row.wooGroupKey } })
    const category = await prisma.category.upsert({
      where: { wooGroupKey: row.wooGroupKey },
      update: {
        parentGroupKey: row.parentGroupKey,
        menuOrder: row.menuOrder,
        count: row.count,
      },
      create: {
        wooGroupKey: row.wooGroupKey,
        parentGroupKey: row.parentGroupKey,
        menuOrder: row.menuOrder,
        count: row.count,
      },
    })
    existing ? updated++ : created++

    for (const t of row.translations) {
      await prisma.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: category.id, locale: t.locale } },
        update: {
          wooId: t.wooId, name: t.name, slug: t.slug,
          description: t.description, wooSnapshot: t.wooSnapshot as object,
        },
        create: {
          categoryId: category.id, locale: t.locale, wooId: t.wooId,
          name: t.name, slug: t.slug, description: t.description,
          wooSnapshot: t.wooSnapshot as object,
        },
      })
    }
  }
  return { created, updated }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/sync-categories.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Run it against the live site**

Write a throwaway `tsx` script that calls `pullCategories()`, run it, delete the script.
Expected: **10 categories created** (not 20 — the 20 posts are 10 groups). Verify
`CategoryTranslation` has 20 rows, and that at least one category has both `el` and `en`.

Run it a **second** time: expect `created: 0, updated: 10` and still 10 rows. Idempotency
is the property that matters here.

- [ ] **Step 6: Commit** (after `./.secretscan.sh`)

```bash
git add src/lib/sync/categories.ts tests/sync-categories.test.ts
git commit -m "feat: add category pull sync collapsing translation groups"
```

---

## Task 6: Product pull engine

**Files:** Create `src/lib/sync/products.ts`. Test: `tests/sync-products.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/sync-products.test.ts
import { describe, it, expect } from 'vitest'
import { toProductUpserts, deriveOnSale } from '@/lib/sync/products'
import type { WooProduct } from '@/lib/woo/types'

const prod = (over: Partial<WooProduct>): WooProduct => ({
  id: 1, lang: 'el', translations: { el: 1 }, name: 'Φακός', slug: 'fakos',
  permalink: 'https://x/fakos', sku: 'SKU1', type: 'simple', status: 'publish',
  featured: false, description: 'περιγραφή', short_description: 'σύντομη',
  price: '10.00', regular_price: '10.00',
  manage_stock: false, stock_quantity: null, stock_status: 'instock',
  categories: [], tags: [], images: [], attributes: [], variations: [],
  menu_order: 0, total_sales: 3,
  date_created: '2026-01-01T00:00:00', date_modified: '2026-02-01T00:00:00', ...over,
})

describe('deriveOnSale', () => {
  it('is true when price is below regular price', () => {
    expect(deriveOnSale('8.00', '10.00')).toBe(true)
  })
  it('is false when they are equal', () => {
    expect(deriveOnSale('10.00', '10.00')).toBe(false)
  })
  it('is false when either value is missing', () => {
    expect(deriveOnSale('', '10.00')).toBe(false)
    expect(deriveOnSale('8.00', '')).toBe(false)
  })
  it('is false for unparseable values rather than throwing', () => {
    expect(deriveOnSale('abc', '10.00')).toBe(false)
  })
})

describe('toProductUpserts', () => {
  it('produces one product per translation group', () => {
    const rows = toProductUpserts([
      prod({ id: 1, lang: 'el', translations: { el: 1, en: 2 } }),
      prod({ id: 2, lang: 'en', translations: { el: 1, en: 2 }, name: 'Lens' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].translations).toHaveLength(2)
  })

  it('keeps a Greek-only product as a single-locale group', () => {
    const rows = toProductUpserts([prod({ id: 7, lang: 'el', translations: { el: 7 } })])
    expect(rows).toHaveLength(1)
    expect(rows[0].translations.map(t => t.locale)).toEqual(['el'])
  })

  it('takes language-neutral fields from the group', () => {
    const rows = toProductUpserts([prod({ sku: 'ABC', type: 'variable', total_sales: 12 })])
    expect(rows[0].sku).toBe('ABC')
    expect(rows[0].type).toBe('variable')
    expect(rows[0].totalSales).toBe(12)
  })

  it('derives onSale locally because Woo sale fields cannot be read', () => {
    const rows = toProductUpserts([prod({ price: '7.50', regular_price: '10.00' })])
    expect(rows[0].onSale).toBe(true)
  })

  it('collects distinct image source urls across both languages', () => {
    const rows = toProductUpserts([
      prod({ id: 1, lang: 'el', translations: { el: 1, en: 2 }, images: [{ id: 9, src: 'https://x/a.jpg' }] }),
      prod({ id: 2, lang: 'en', translations: { el: 1, en: 2 }, images: [{ id: 9, src: 'https://x/a.jpg' }] }),
    ])
    expect(rows[0].images).toHaveLength(1)
    expect(rows[0].images[0].src).toBe('https://x/a.jpg')
  })

  it('records category group references', () => {
    const rows = toProductUpserts([
      prod({ categories: [{ id: 12179, name: 'Contact Lenses', slug: 'contact-lenses' }] }),
    ])
    expect(rows[0].categoryWooIds).toEqual([12179])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/sync-products.test.ts`
Expected: FAIL — cannot resolve `@/lib/sync/products`

- [ ] **Step 3: Implement**

```ts
// src/lib/sync/products.ts
import { prisma } from '@/lib/prisma'
import { listProducts } from '@/lib/woo/client'
import { groupByTranslation } from '@/lib/woo/translation-groups'
import type { WooImage, WooProduct } from '@/lib/woo/types'

/**
 * Woo's `sale_price` and `on_sale` cannot be read — requesting either returns
 * HTTP 500 from the source site (spec §2.1). Sale state is inferred instead.
 */
export function deriveOnSale(price: string, regularPrice: string): boolean {
  const p = Number.parseFloat(price)
  const r = Number.parseFloat(regularPrice)
  if (!Number.isFinite(p) || !Number.isFinite(r)) return false
  return p < r
}

export type ProductTranslationUpsert = {
  locale: string
  wooId: number
  name: string
  slug: string
  description: string | null
  shortDescription: string | null
  permalink: string | null
  wooModifiedAt: Date | null
  wooSnapshot: WooProduct
}

export type ProductUpsert = {
  wooGroupKey: number
  sku: string | null
  type: string
  status: string
  featured: boolean
  price: string | null
  regularPrice: string | null
  onSale: boolean
  manageStock: boolean
  stockQuantity: number | null
  stockStatus: string
  menuOrder: number
  totalSales: number
  categoryWooIds: number[]
  images: WooImage[]
  variationWooIds: number[]
  translations: ProductTranslationUpsert[]
}

/** Pure: Woo posts → one upsert per logical product. */
export function toProductUpserts(posts: WooProduct[]): ProductUpsert[] {
  return groupByTranslation(posts).map(g => {
    const locales = Object.entries(g.byLocale)
    // Language-neutral fields are identical across translations; prefer Greek
    // as the canonical source, falling back to whatever locale exists.
    const canonical = g.byLocale.el ?? locales[0][1]

    const images: WooImage[] = []
    const seenSrc = new Set<string>()
    for (const [, post] of locales) {
      for (const img of post.images ?? []) {
        if (!seenSrc.has(img.src)) { seenSrc.add(img.src); images.push(img) }
      }
    }

    const categoryWooIds = [...new Set(locales.flatMap(([, p]) => (p.categories ?? []).map(c => c.id)))]
    const variationWooIds = [...new Set(locales.flatMap(([, p]) => p.variations ?? []))]

    return {
      wooGroupKey: g.groupKey,
      sku: canonical.sku || null,
      type: canonical.type,
      status: canonical.status,
      featured: canonical.featured,
      price: canonical.price || null,
      regularPrice: canonical.regular_price || null,
      onSale: deriveOnSale(canonical.price, canonical.regular_price),
      manageStock: canonical.manage_stock,
      stockQuantity: canonical.stock_quantity,
      stockStatus: canonical.stock_status,
      menuOrder: canonical.menu_order,
      totalSales: canonical.total_sales,
      categoryWooIds,
      images,
      variationWooIds,
      translations: locales.map(([locale, post]) => ({
        locale,
        wooId: post.id,
        name: post.name,
        slug: post.slug,
        description: post.description || null,
        shortDescription: post.short_description || null,
        permalink: post.permalink || null,
        wooModifiedAt: post.date_modified ? new Date(post.date_modified) : null,
        wooSnapshot: post,
      })),
    }
  })
}

export type ProductPullResult = { created: number; updated: number; imageUrls: string[] }

export async function pullProducts(): Promise<ProductPullResult> {
  const posts = await listProducts()
  const upserts = toProductUpserts(posts)
  let created = 0
  let updated = 0
  const imageUrls: string[] = []

  for (const row of upserts) {
    const existing = await prisma.product.findUnique({ where: { wooGroupKey: row.wooGroupKey } })
    const product = await prisma.product.upsert({
      where: { wooGroupKey: row.wooGroupKey },
      update: {
        sku: row.sku, type: row.type, status: row.status, featured: row.featured,
        price: row.price, regularPrice: row.regularPrice, onSale: row.onSale,
        manageStock: row.manageStock, stockQuantity: row.stockQuantity,
        stockStatus: row.stockStatus, menuOrder: row.menuOrder, totalSales: row.totalSales,
      },
      create: {
        wooGroupKey: row.wooGroupKey,
        sku: row.sku, type: row.type, status: row.status, featured: row.featured,
        price: row.price, regularPrice: row.regularPrice, onSale: row.onSale,
        manageStock: row.manageStock, stockQuantity: row.stockQuantity,
        stockStatus: row.stockStatus, menuOrder: row.menuOrder, totalSales: row.totalSales,
      },
    })
    existing ? updated++ : created++

    for (const t of row.translations) {
      await prisma.productTranslation.upsert({
        where: { productId_locale: { productId: product.id, locale: t.locale } },
        update: {
          wooId: t.wooId, name: t.name, slug: t.slug, description: t.description,
          shortDescription: t.shortDescription, permalink: t.permalink,
          wooModifiedAt: t.wooModifiedAt, wooSnapshot: t.wooSnapshot as object,
        },
        create: {
          productId: product.id, locale: t.locale, wooId: t.wooId,
          name: t.name, slug: t.slug, description: t.description,
          shortDescription: t.shortDescription, permalink: t.permalink,
          wooModifiedAt: t.wooModifiedAt, wooSnapshot: t.wooSnapshot as object,
        },
      })
    }

    // Category links — replace wholesale, the set is small.
    const categories = await prisma.category.findMany({
      where: { translations: { some: { wooId: { in: row.categoryWooIds } } } },
      select: { id: true },
    })
    await prisma.productCategory.deleteMany({ where: { productId: product.id } })
    if (categories.length) {
      await prisma.productCategory.createMany({
        data: categories.map(c => ({ productId: product.id, categoryId: c.id })),
        skipDuplicates: true,
      })
    }

    imageUrls.push(...row.images.map(i => i.src))
  }

  return { created, updated, imageUrls: [...new Set(imageUrls)] }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/sync-products.test.ts`
Expected: PASS, 11 tests

- [ ] **Step 5: Run it against the live site**

Throwaway script calling `pullCategories()` then `pullProducts()`. Delete the script after.

Expected: roughly **207 products created** — decisively *not* 408. If you see 408, the
grouping is broken; stop and report rather than proceeding.

Verify: `Product` ≈ 207, `ProductTranslation` = 408, and that at least one product has
both `el` and `en` while at least one has only `el` (6 such products exist).

Run a second time: `created: 0`, updated ≈ 207, counts unchanged.

- [ ] **Step 6: Commit** (after `./.secretscan.sh`)

```bash
git add src/lib/sync/products.ts tests/sync-products.test.ts
git commit -m "feat: add product pull sync with locally derived sale state"
```

---

## Task 7: Bunny storage client

**Files:** Create `src/lib/bunny.ts`. Test: `tests/bunny.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/bunny.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubEnv('BUNNY_STORAGE_API', 'https://storage.example')
  vi.stubEnv('BUNNY_STORAGE_ZONE', 'woomakis')
  vi.stubEnv('BUNNY_STORAGE_PASSWORD', 'pw-test')
  vi.stubEnv('BUNNY_PULL_ZONE_URL', 'https://woomakis.b-cdn.net')
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllEnvs())

describe('bunny storage', () => {
  it('PUTs to zone-scoped path with the AccessKey header', async () => {
    const { bunnyUpload } = await import('@/lib/bunny')
    fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => '' })
    await bunnyUpload('products/abc/original.jpg', Buffer.from('x'), 'image/jpeg')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://storage.example/woomakis/products/abc/original.jpg')
    expect((init as RequestInit).method).toBe('PUT')
    expect(new Headers((init as RequestInit).headers).get('accesskey')).toBe('pw-test')
  })

  it('returns the pull-zone CDN url for a key', async () => {
    const { cdnUrlFor } = await import('@/lib/bunny')
    expect(cdnUrlFor('products/abc/original.jpg'))
      .toBe('https://woomakis.b-cdn.net/products/abc/original.jpg')
  })

  it('throws on a failed upload rather than returning silently', async () => {
    const { bunnyUpload } = await import('@/lib/bunny')
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' })
    await expect(bunnyUpload('k', Buffer.from('x'), 'image/jpeg')).rejects.toThrow(/401/)
  })

  it('rejects keys containing traversal segments', async () => {
    const { bunnyUpload } = await import('@/lib/bunny')
    await expect(bunnyUpload('../escape.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a missing object as not existing instead of throwing', async () => {
    const { bunnyExists } = await import('@/lib/bunny')
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => '' })
    expect(await bunnyExists('products/none.jpg')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/bunny.test.ts`
Expected: FAIL — cannot resolve `@/lib/bunny`

- [ ] **Step 3: Implement**

```ts
// src/lib/bunny.ts

/**
 * Bunny Storage raw HTTP API (PUT/GET/DELETE with an AccessKey header). There is
 * no S3 client dependency here, matching the idiom used in the damask reference.
 *
 * NOTE: the storage zone name is lowercase `woomakis`. The capitalised form
 * returns HTTP 401.
 */
function config() {
  const storageApi = process.env.BUNNY_STORAGE_API?.replace(/\/+$/, '')
  const zone = process.env.BUNNY_STORAGE_ZONE
  const password = process.env.BUNNY_STORAGE_PASSWORD
  const pullZone = process.env.BUNNY_PULL_ZONE_URL?.replace(/\/+$/, '')
  if (!storageApi || !zone || !password || !pullZone) {
    throw new Error('Λείπουν ρυθμίσεις BunnyCDN (BUNNY_STORAGE_* / BUNNY_PULL_ZONE_URL).')
  }
  return { storageApi, zone, password, pullZone }
}

function assertSafeKey(key: string): string {
  const trimmed = key.replace(/^\/+/, '')
  if (!trimmed || trimmed.includes('..')) throw new Error(`Μη έγκυρο storage key: ${key}`)
  return trimmed
}

function objectUrl(key: string): string {
  const { storageApi, zone } = config()
  return `${storageApi}/${zone}/${assertSafeKey(key)}`
}

export function cdnUrlFor(key: string): string {
  const { pullZone } = config()
  return `${pullZone}/${assertSafeKey(key)}`
}

export async function bunnyUpload(key: string, body: Buffer, contentType: string): Promise<string> {
  const url = objectUrl(key)
  const { password } = config()
  const res = await fetch(url, {
    method: 'PUT',
    headers: { AccessKey: password, 'Content-Type': contentType },
    body: new Uint8Array(body),
  })
  if (!res.ok) {
    throw new Error(`Bunny upload ${res.status} για ${key}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  }
  return cdnUrlFor(key)
}

export async function bunnyExists(key: string): Promise<boolean> {
  const res = await fetch(objectUrl(key), {
    method: 'GET',
    headers: { AccessKey: config().password },
  })
  return res.ok
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/bunny.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit** (after `./.secretscan.sh`)

```bash
git add src/lib/bunny.ts tests/bunny.test.ts
git commit -m "feat: add BunnyCDN storage client"
```

---

## Task 8: Image mirroring

**Files:** Create `src/lib/images.ts`. Test: `tests/images.test.ts`. Install `sharp`.

- [ ] **Step 1: Install sharp**

```bash
npm i sharp
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/images.test.ts
import { describe, it, expect } from 'vitest'
import { contentHash, storageKeyFor, extensionFor, DERIVATIVE_WIDTHS } from '@/lib/images'

describe('image identity', () => {
  it('hashes identical bytes to the same value', () => {
    expect(contentHash(Buffer.from('abc'))).toBe(contentHash(Buffer.from('abc')))
  })

  it('hashes different bytes differently', () => {
    expect(contentHash(Buffer.from('abc'))).not.toBe(contentHash(Buffer.from('abd')))
  })

  it('produces a hex sha-256', () => {
    expect(contentHash(Buffer.from('abc'))).toMatch(/^[0-9a-f]{64}$/)
  })

  it('builds a content-addressed original key', () => {
    const h = contentHash(Buffer.from('abc'))
    expect(storageKeyFor(h, 'original', 'jpg')).toBe(`products/${h}/original.jpg`)
  })

  it('builds a width-suffixed derivative key', () => {
    const h = contentHash(Buffer.from('abc'))
    expect(storageKeyFor(h, 640, 'webp')).toBe(`products/${h}/640.webp`)
  })

  it('derives an extension from a url with a query string', () => {
    expect(extensionFor('https://x/a.JPG?ver=2')).toBe('jpg')
  })

  it('falls back to jpg for an extensionless url', () => {
    expect(extensionFor('https://x/image')).toBe('jpg')
  })

  it('declares derivative widths in ascending order', () => {
    expect([...DERIVATIVE_WIDTHS]).toEqual([...DERIVATIVE_WIDTHS].sort((a, b) => a - b))
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/images.test.ts`
Expected: FAIL — cannot resolve `@/lib/images`

- [ ] **Step 4: Implement**

```ts
// src/lib/images.ts
import { createHash } from 'node:crypto'
import sharp from 'sharp'

/** Widths generated for every mirrored image, ascending. */
export const DERIVATIVE_WIDTHS = [320, 640, 1280] as const

/**
 * SHA-256 of the original bytes. This is the dedupe key and what makes re-sync
 * idempotent: identical bytes produce an identical storage key, so a second run
 * uploads nothing.
 */
export function contentHash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function extensionFor(url: string): string {
  const withoutQuery = url.split('?')[0]
  const match = /\.([a-z0-9]+)$/i.exec(withoutQuery)
  return match ? match[1].toLowerCase() : 'jpg'
}

export function storageKeyFor(hash: string, variant: 'original' | number, ext: string): string {
  return `products/${hash}/${variant}.${ext}`
}

export type Derivative = { width: number; format: 'webp' | 'avif'; body: Buffer; key: string }

export async function buildDerivatives(hash: string, original: Buffer): Promise<Derivative[]> {
  const meta = await sharp(original).metadata()
  const out: Derivative[] = []

  for (const width of DERIVATIVE_WIDTHS) {
    // Never upscale — a 320px source should not become a blurry 1280px file.
    if (meta.width && meta.width < width) continue
    for (const format of ['webp', 'avif'] as const) {
      const body = await sharp(original).resize({ width })[format]().toBuffer()
      out.push({ width, format, body, key: storageKeyFor(hash, width, format) })
    }
  }
  return out
}

export async function imageDimensions(bytes: Buffer): Promise<{ width?: number; height?: number }> {
  const meta = await sharp(bytes).metadata()
  return { width: meta.width, height: meta.height }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/images.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 6: Commit** (after `./.secretscan.sh`)

```bash
git add src/lib/images.ts tests/images.test.ts package.json package-lock.json
git commit -m "feat: add content-hashed image identity and derivatives"
```

---

## Task 9: Mirror worker and sync orchestration

**Files:** Create `src/lib/sync/mirror.ts`, `src/lib/sync/run.ts`, `scripts/sync.ts`.

- [ ] **Step 1: The mirror function**

```ts
// src/lib/sync/mirror.ts
import { prisma } from '@/lib/prisma'
import { bunnyUpload, cdnUrlFor } from '@/lib/bunny'
import { buildDerivatives, contentHash, extensionFor, imageDimensions, storageKeyFor } from '@/lib/images'

export type MirrorResult = { mirrored: number; skipped: number; failed: number }

/**
 * Downloads each source image, content-hashes it, and uploads the original plus
 * WebP/AVIF derivatives. An asset whose hash is already recorded is skipped
 * without touching the network again — that is what makes re-sync cheap.
 */
export async function mirrorImages(sourceUrls: string[]): Promise<MirrorResult> {
  let mirrored = 0
  let skipped = 0
  let failed = 0

  for (const sourceUrl of sourceUrls) {
    try {
      const already = await prisma.mediaAsset.findFirst({ where: { sourceUrl, mirroredAt: { not: null } } })
      if (already) { skipped++; continue }

      const res = await fetch(sourceUrl)
      if (!res.ok) { failed++; continue }
      const bytes = Buffer.from(await res.arrayBuffer())

      const hash = contentHash(bytes)
      const existing = await prisma.mediaAsset.findUnique({ where: { contentHash: hash } })
      if (existing) { skipped++; continue }

      const ext = extensionFor(sourceUrl)
      const mimeType = res.headers.get('content-type') ?? `image/${ext}`
      const originalKey = storageKeyFor(hash, 'original', ext)

      await bunnyUpload(originalKey, bytes, mimeType)
      const derivatives = await buildDerivatives(hash, bytes)
      for (const d of derivatives) {
        await bunnyUpload(d.key, d.body, `image/${d.format}`)
      }
      const { width, height } = await imageDimensions(bytes)

      await prisma.mediaAsset.create({
        data: {
          contentHash: hash, sourceUrl, storageKey: originalKey,
          cdnUrl: cdnUrlFor(originalKey), mimeType, bytes: bytes.byteLength,
          width, height,
          derivatives: derivatives.map(d => ({ width: d.width, format: d.format, key: d.key })),
          mirroredAt: new Date(),
        },
      })
      mirrored++
    } catch {
      failed++
    }
  }
  return { mirrored, skipped, failed }
}
```

- [ ] **Step 2: The orchestrator**

```ts
// src/lib/sync/run.ts
import { prisma } from '@/lib/prisma'
import { pullCategories } from '@/lib/sync/categories'
import { pullProducts } from '@/lib/sync/products'
import { mirrorImages } from '@/lib/sync/mirror'

export type FullPullResult = {
  categories: { created: number; updated: number }
  products: { created: number; updated: number }
  images: { mirrored: number; skipped: number; failed: number }
}

/** Categories first — products reference them when building category links. */
export async function runFullPull({ withImages = true } = {}): Promise<FullPullResult> {
  const startedAt = new Date()
  const log = await prisma.syncLog.create({
    data: { target: 'catalog', direction: 'PULL', outcome: 'FAILED', startedAt },
  })

  try {
    const categories = await pullCategories()
    const products = await pullProducts()
    const images = withImages
      ? await mirrorImages(products.imageUrls)
      : { mirrored: 0, skipped: 0, failed: 0 }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        outcome: images.failed > 0 ? 'PARTIAL' : 'SUCCESS',
        finishedAt: new Date(),
        created: categories.created + products.created,
        updated: categories.updated + products.updated,
        skipped: images.skipped,
        failed: images.failed,
      },
    })
    return { categories, products, images }
  } catch (err) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { outcome: 'FAILED', finishedAt: new Date(), error: String(err).slice(0, 1000) },
    })
    throw err
  }
}
```

- [ ] **Step 3: The CLI entry point**

```ts
// scripts/sync.ts
import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { runFullPull } from '../src/lib/sync/run'

const withImages = !process.argv.includes('--no-images')

runFullPull({ withImages })
  .then(r => {
    console.log('Κατηγορίες:', r.categories)
    console.log('Προϊόντα:  ', r.products)
    console.log('Εικόνες:   ', r.images)
  })
  .catch(e => { console.error('Ο συγχρονισμός απέτυχε:', e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
```

Add to `package.json`: `"sync": "tsx scripts/sync.ts"`

- [ ] **Step 4: Run without images first**

Run: `npm run sync -- --no-images`
Expected: ~10 categories, ~207 products. **If products is 408, stop — grouping is broken.**

- [ ] **Step 5: Run with images**

Run: `npm run sync`
Expected: several hundred images mirrored, `failed: 0`. Then run again — expect
`mirrored: 0` and everything skipped, proving idempotency.

Spot-check one `cdnUrl` with `curl -I` and confirm HTTP 200 from `woomakis.b-cdn.net`.

- [ ] **Step 6: Commit** (after `./.secretscan.sh`)

```bash
git add src/lib/sync/mirror.ts src/lib/sync/run.ts scripts/sync.ts package.json
git commit -m "feat: add image mirroring and full catalog pull orchestration"
```

---

## Task 10: Phase 2A verification

- [ ] **Step 1:** `./.secretscan.sh` → `scan: clean`
- [ ] **Step 2:** `npx tsc --noEmit` → no errors
- [ ] **Step 3:** `npm test` → all tests pass (18 from phase 1 + 42 new = 60)
- [ ] **Step 4:** `npm run build` → succeeds
- [ ] **Step 5:** Verify against the live catalog:

| Check | Expected |
|---|---|
| `Category` rows | 10 |
| `CategoryTranslation` rows | 20 |
| `Product` rows | ~207 (**not** 408) |
| `ProductTranslation` rows | 408 |
| Products with both locales | ~201 |
| Products with only `el` | ~6 |
| `MediaAsset` rows with `mirroredAt` set | > 500 |
| A sampled `cdnUrl` | HTTP 200 |
| Second `npm run sync` | 0 created, 0 mirrored |

- [ ] **Step 6:** Commit any fixes.

---

## Phase 2A Definition of Done

- The catalog is in Postgres as **logical products**, not duplicated per language.
- Greek-only products are visible as such rather than silently dropped.
- Every product image is on BunnyCDN, content-addressed, with WebP/AVIF derivatives.
- Re-running the sync creates nothing and uploads nothing.
- No code path can request `sale_price`, `on_sale`, or `price_html`.
- No write of any kind was issued against WooCommerce.
- No credential appears in any tracked file.
