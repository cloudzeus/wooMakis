# wooMakis Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the wooMakis application skeleton — Next.js 16.3.1, Prisma against Postgres, Auth.js v5 credentials login, RBAC with a seeded super admin, and the Steel & Frost admin shell — so that phase 2 has a working, authenticated place to put catalog screens.

**Architecture:** Ported from the `cloudzeus/damask` reference repository wherever a proven pattern exists (Prisma client singleton, `verifyCredentials`, JWT session callbacks with periodic permission refresh, RBAC helpers, seed structure, Steel & Frost design tokens). Permissions live in a code registry that seeds into the database, so adding a permission is a code change plus a non-destructive sync script rather than a migration.

**Tech Stack:** Next.js 16.3.1 (App Router), React 19.2, Prisma 7 + `@prisma/adapter-pg`, PostgreSQL 16.14, Auth.js v5 (`next-auth@5` beta) + `bcryptjs`, Tailwind 4, shadcn/ui on `@base-ui/react`, Vitest, GSAP.

**Reference repo:** clone `https://github.com/cloudzeus/damask` to a scratch directory. Tasks that copy from it use `$DAMASK` for that path.

**Spec:** `docs/superpowers/specs/2026-08-15-woomakis-design.md`

**Out of scope for phase 1 (deliberate):** `next-intl` / i18n — the admin is Greek-only, and the bilingual storefront arrives in phase 5. Wiring it now would be scaffolding with no consumer. Any WooCommerce or BunnyCDN calls — phase 2.

---

## Preconditions

Verified on 2026-08-15; re-check if they may have changed:

- Postgres 16.14 at `100.70.50.43:5432` reachable; role `giannis` is superuser with `CREATEDB`.
- **The `wooMakis` database was created on 2026-08-15** and is empty (0 public tables), ready for `prisma migrate`.
- Node v24.10.0, npm 11.6.0.
- Repo `cloudzeus/wooMakis` exists, is public, default branch `master`, and has one commit (the spec).

---

## File Structure

| Path | Responsibility |
|---|---|
| `prisma/schema.prisma` | Auth + RBAC models only in phase 1 |
| `prisma/seed.ts` | Idempotent seed: permissions → roles → super admin |
| `prisma/sync-permissions.ts` | Non-destructive permission upsert, no reseed needed |
| `prisma.config.ts` | Prisma 7 config (schema path, datasource, seed command) |
| `src/lib/prisma.ts` | PrismaClient singleton with the `pg` adapter |
| `src/lib/permissions.ts` | Code registry: `PERMISSIONS` + `ROLE_DEFAULTS`. Single source of truth |
| `src/lib/rbac.ts` | Pure `can()` — no imports from server-only modules |
| `src/lib/rbac-server.ts` | `requirePermission`, `requireSuperAdmin` for server components/actions |
| `src/auth.config.ts` | `verifyCredentials` — DB lookup + bcrypt compare, no Next.js imports |
| `src/auth.ts` | NextAuth instance, JWT/session callbacks |
| `src/types/next-auth.d.ts` | Session/JWT type augmentation |
| `src/middleware.ts` | Route protection for `/(admin)` |
| `src/app/globals.css` | Steel & Frost tokens (copied from damask) |
| `src/app/layout.tsx` | Root layout, fonts |
| `src/app/login/page.tsx` | Login screen |
| `src/app/(admin)/layout.tsx` | Authenticated shell: sidebar + topbar |
| `src/app/(admin)/dashboard/page.tsx` | Placeholder landing so login has a destination |
| `src/components/shell/sidebar.tsx` | Nav, permission-filtered |
| `src/components/shell/topbar.tsx` | User menu, sign out |

`rbac.ts` is deliberately split from `rbac-server.ts`: the pure predicate must be importable from client components without pulling in `@/auth`.

---

## Task 1: Create the database and scaffold the project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env`, `.env.example`

- [x] **Step 1: Create the `wooMakis` database** — DONE 2026-08-15

Created and verified empty. The quotes are required: without them Postgres folds the
identifier to `woomakis` and the connection string in `.env` will not match.

```bash
psql "postgres://giannis:$PGPASSWORD@100.70.50.43:5432/postgres" \
  -c 'CREATE DATABASE "wooMakis"'
```

Expected: `CREATE DATABASE`

If `psql` is not installed locally, run the equivalent through any Postgres client. Verify:

```bash
psql "postgres://giannis:$PGPASSWORD@100.70.50.43:5432/wooMakis" -c 'select current_database()'
```

Expected: `wooMakis`

- [ ] **Step 2: Scaffold Next.js into the existing repo**

The repo already has `.gitignore` and `docs/`, so scaffold in place and accept the prompt to continue in a non-empty directory.

```bash
npx create-next-app@16.3.1 . --typescript --tailwind --app --src-dir --no-import-alias --use-npm
```

Then set the import alias manually in `tsconfig.json` under `compilerOptions`:

```json
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 3: Install runtime dependencies**

```bash
npm i @prisma/client@^7 @prisma/adapter-pg@^7 pg next-auth@^5.0.0-beta.31 @auth/core bcryptjs \
  @base-ui/react class-variance-authority clsx tailwind-merge tw-animate-css shadcn \
  lucide-react react-icons sonner zod gsap @gsap/react next-themes
npm i -D prisma@^7 tsx vitest @types/pg @types/bcryptjs dotenv
```

- [ ] **Step 4: Write `.env.example`**

```bash
cat > .env.example <<'EOF'
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/wooMakis?schema=public

AUTH_SECRET=
AUTH_URL=http://localhost:3000
SEED_ADMIN_PASSWORD=

# Phase 2+ — not used in phase 1
WOO_BASE_URL=https://www.mylens.gr
WOO_CONSUMER_KEY=
WOO_CONSUMER_SECRET=
WOO_WEBHOOK_SECRET=
WOO_ENVIRONMENT=production
WOO_ALLOW_WRITES=false
WOO_DRY_RUN=true

BUNNY_STORAGE_ZONE=woomakis
BUNNY_STORAGE_PASSWORD=
BUNNY_STORAGE_API=https://storage.bunnycdn.com
BUNNY_S3_ENDPOINT=https://de-s3.storage.bunnycdn.com
BUNNY_PULL_ZONE_URL=https://woomakis.b-cdn.net
EOF
```

- [ ] **Step 5: Write the real `.env` with live values**

`.env` is gitignored — confirm with `git check-ignore .env` before writing (expected output: `.env`).

Fill `DATABASE_URL` with the live connection string, generate `AUTH_SECRET` with `openssl rand -base64 32`, and set `SEED_ADMIN_PASSWORD` to the super-admin password. Leave the phase 2 keys blank for now.

- [ ] **Step 6: Verify the app boots**

Run: `npm run dev`
Expected: ready on `http://localhost:3000` with no errors. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16.3.1 with Prisma, Auth.js and Tailwind deps"
```

---

## Task 2: Prisma client singleton

**Files:**
- Create: `prisma.config.ts`, `src/lib/prisma.ts`, `prisma/schema.prisma`
- Create: `vitest.config.ts`

- [ ] **Step 1: Write `prisma.config.ts`**

```ts
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: env('DATABASE_URL') },
  migrations: { seed: 'tsx prisma/seed.ts' },
})
```

- [ ] **Step 2: Write the minimal schema so `prisma generate` succeeds**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

// Prisma 7 removed `url` from the datasource block. Migrate/CLI reads the
// connection string from prisma.config.ts; the runtime client gets it from the
// PrismaPg adapter in src/lib/prisma.ts. Do not re-add `url` here — it is a
// hard P1012 error, not a warning.
datasource db {
  provider = "postgresql"
}
```

Two Prisma 7 changes from older guides: `url` in the datasource block is a hard
`P1012` error, and `previewFeatures = ["driverAdapters"]` is deprecated — driver
adapters work without it.

- [ ] **Step 3: Write the client singleton**

```ts
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

The singleton exists because Next.js dev-mode hot reload otherwise opens a new pool on every edit until Postgres refuses connections.

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': resolve(__dirname, './src') } },
})
```

Add to `package.json` scripts:

```json
"test": "vitest run --passWithNoTests",
"db:migrate": "prisma migrate dev",
"db:seed": "tsx prisma/seed.ts",
"db:sync-permissions": "tsx prisma/sync-permissions.ts"
```

- [ ] **Step 5: Verify generation works**

Run: `npx prisma generate`
Expected: `Generated Prisma Client`

- [ ] **Step 6: Commit**

```bash
git add prisma.config.ts prisma/schema.prisma src/lib/prisma.ts vitest.config.ts package.json
git commit -m "feat: add Prisma 7 client singleton with pg adapter"
```

---

## Task 3: Permission registry

The registry is the single source of truth. The database is a projection of it.

**Files:**
- Create: `src/lib/permissions.ts`
- Test: `tests/permissions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/permissions.test.ts
import { describe, it, expect } from 'vitest'
import { PERMISSIONS, ROLE_DEFAULTS } from '@/lib/permissions'

describe('permission registry', () => {
  it('has unique keys', () => {
    const keys = PERMISSIONS.map(p => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives every permission a non-empty description', () => {
    for (const p of PERMISSIONS) expect(p.description.length).toBeGreaterThan(0)
  })

  it('only grants roles permissions that exist in the registry', () => {
    const known = new Set(PERMISSIONS.map(p => p.key))
    for (const [role, keys] of Object.entries(ROLE_DEFAULTS)) {
      for (const k of keys) {
        expect(known.has(k), `role ${role} grants unknown permission ${k}`).toBe(true)
      }
    }
  })

  it('grants SUPER_ADMIN every permission', () => {
    expect(new Set(ROLE_DEFAULTS.SUPER_ADMIN)).toEqual(new Set(PERMISSIONS.map(p => p.key)))
  })

  it('restricts sync.push to SUPER_ADMIN only', () => {
    for (const [role, keys] of Object.entries(ROLE_DEFAULTS)) {
      if (role !== 'SUPER_ADMIN') expect(keys).not.toContain('sync.push')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/permissions.test.ts`
Expected: FAIL — cannot resolve `@/lib/permissions`

- [ ] **Step 3: Write the registry**

`sync.push` is separated from `sync.run` because pushing writes to the live store and pulling does not.

```ts
// src/lib/permissions.ts
export type PermissionDef = { key: string; description: string }

export const PERMISSIONS: PermissionDef[] = [
  { key: 'product.view', description: 'Προβολή προϊόντων' },
  { key: 'product.edit', description: 'Επεξεργασία προϊόντων' },
  { key: 'product.delete', description: 'Διαγραφή προϊόντων' },
  { key: 'category.view', description: 'Προβολή κατηγοριών' },
  { key: 'category.edit', description: 'Επεξεργασία κατηγοριών' },
  { key: 'media.view', description: 'Προβολή πολυμέσων' },
  { key: 'media.upload', description: 'Μεταφόρτωση πολυμέσων' },
  { key: 'media.delete', description: 'Διαγραφή πολυμέσων' },
  { key: 'customer.view', description: 'Προβολή πελατών' },
  { key: 'customer.edit', description: 'Επεξεργασία πελατών' },
  { key: 'sync.view', description: 'Προβολή συγχρονισμού και ιστορικού' },
  { key: 'sync.run', description: 'Εκτέλεση λήψης από το WooCommerce' },
  { key: 'sync.push', description: 'Αποστολή αλλαγών στο WooCommerce' },
  { key: 'sync.config', description: 'Ρύθμιση συγχρονισμού και αντιστοίχισης πεδίων' },
  { key: 'user.manage', description: 'Διαχείριση χρηστών' },
  { key: 'role.manage', description: 'Διαχείριση ρόλων και δικαιωμάτων' },
  { key: 'settings.manage', description: 'Διαχείριση ρυθμίσεων' },
]

const ALL = PERMISSIONS.map(p => p.key)

export const ROLE_DEFAULTS: Record<string, string[]> = {
  SUPER_ADMIN: ALL,
  CATALOG_MANAGER: [
    'product.view', 'product.edit',
    'category.view', 'category.edit',
    'media.view', 'media.upload',
    'customer.view',
    'sync.view', 'sync.run',
  ],
  VIEWER: ['product.view', 'category.view', 'media.view', 'customer.view', 'sync.view'],
}

export const SYSTEM_ROLE_NAMES = new Set(['SUPER_ADMIN', 'CATALOG_MANAGER', 'VIEWER'])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/permissions.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions.ts tests/permissions.test.ts
git commit -m "feat: add permission registry with role defaults"
```

---

## Task 4: Auth and RBAC schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Append the models**

`trdrId` is included now, as a plain nullable column with no relation, so phase 3 can attach the `Trdr` relation without a data migration on `User`.

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String
  active       Boolean  @default(true)
  roleId       String
  role         Role     @relation(fields: [roleId], references: [id])
  trdrId       String?
  phone        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([roleId])
  @@index([trdrId])
}

model Role {
  id          String           @id @default(cuid())
  name        String           @unique
  description String?
  system      Boolean          @default(false)
  users       User[]
  permissions RolePermission[]
}

model Permission {
  id          String           @id @default(cuid())
  key         String           @unique
  description String
  roles       RolePermission[]
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `npx prisma migrate dev --name init_auth_rbac`
Expected: migration created and applied; `Generated Prisma Client`

- [ ] **Step 3: Verify the tables exist**

```bash
psql "postgres://giannis:$PGPASSWORD@100.70.50.43:5432/wooMakis" \
  -c '\dt'
```

Expected: `User`, `Role`, `Permission`, `RolePermission`, `_prisma_migrations`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add User, Role, Permission schema with migration"
```

---

## Task 5: Credential verification

Kept free of Next.js imports so it is testable in plain Node.

**Files:**
- Create: `src/auth.config.ts`
- Test: `tests/auth-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/auth-config.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

const findUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }))

const { verifyCredentials } = await import('@/auth.config')

function userRow(over: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'a@b.gr',
    name: 'Test',
    passwordHash: bcrypt.hashSync('correct-horse', 4),
    active: true,
    trdrId: null,
    role: { name: 'SUPER_ADMIN', permissions: [{ permission: { key: 'product.view' } }] },
    ...over,
  }
}

beforeEach(() => findUnique.mockReset())

describe('verifyCredentials', () => {
  it('returns a payload for a valid email and password', async () => {
    findUnique.mockResolvedValue(userRow())
    const r = await verifyCredentials('a@b.gr', 'correct-horse')
    expect(r).toMatchObject({ id: 'u1', role: 'SUPER_ADMIN', permissions: ['product.view'] })
  })

  it('returns null for a wrong password', async () => {
    findUnique.mockResolvedValue(userRow())
    expect(await verifyCredentials('a@b.gr', 'wrong')).toBeNull()
  })

  it('returns null for an unknown email', async () => {
    findUnique.mockResolvedValue(null)
    expect(await verifyCredentials('nobody@b.gr', 'correct-horse')).toBeNull()
  })

  it('returns null for a deactivated user even with the right password', async () => {
    findUnique.mockResolvedValue(userRow({ active: false }))
    expect(await verifyCredentials('a@b.gr', 'correct-horse')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth-config.test.ts`
Expected: FAIL — cannot resolve `@/auth.config`

- [ ] **Step 3: Write the implementation**

```ts
// src/auth.config.ts
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export type AuthUserPayload = {
  id: string
  email: string
  name: string
  role: string
  permissions: string[]
  trdrId: string | null
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<AuthUserPayload | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  })
  if (!user || !user.active) return null
  if (!(await bcrypt.compare(password, user.passwordHash))) return null
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
    permissions: user.role.permissions.map(rp => rp.permission.key),
    trdrId: user.trdrId ?? null,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth-config.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/auth.config.ts tests/auth-config.test.ts
git commit -m "feat: add credential verification with bcrypt"
```

---

## Task 6: NextAuth instance and session types

**Files:**
- Create: `src/auth.ts`, `src/types/next-auth.d.ts`, `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Write the type augmentation**

```ts
// src/types/next-auth.d.ts
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      permissions: string[]
      trdrId: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    permissions?: string[]
    trdrId?: string | null
    permsAt?: number
  }
}
```

- [ ] **Step 2: Write the NextAuth instance**

The periodic re-read matters: without it, a permission granted in the admin UI stays invisible to an already-logged-in user until they sign out and back in.

```ts
// src/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { verifyCredentials, type AuthUserPayload } from '@/auth.config'
import { prisma } from '@/lib/prisma'

const PERMS_REFRESH_MS = 60_000

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        if (typeof creds?.email !== 'string' || typeof creds?.password !== 'string') return null
        return verifyCredentials(creds.email, creds.password)
      },
    }),
  ],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user
    },
    async jwt({ token, user }) {
      if (user) {
        const u = user as AuthUserPayload
        token.role = u.role
        token.permissions = u.permissions
        token.trdrId = u.trdrId
        token.permsAt = Date.now()
        return token
      }

      if (!token.permsAt || Date.now() - token.permsAt > PERMS_REFRESH_MS) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub! },
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        })
        // Deleted or deactivated mid-session — invalidate the cookie.
        if (!dbUser || !dbUser.active) return null
        token.role = dbUser.role.name
        token.permissions = dbUser.role.permissions.map(rp => rp.permission.key)
        token.trdrId = dbUser.trdrId ?? null
        token.permsAt = Date.now()
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub!
      session.user.role = token.role ?? ''
      session.user.permissions = token.permissions ?? []
      session.user.trdrId = token.trdrId ?? null
      return session
    },
  },
})
```

- [ ] **Step 3: Write the route handler**

```ts
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/auth.ts src/types/next-auth.d.ts src/app/api/auth
git commit -m "feat: wire Auth.js v5 with JWT sessions and permission refresh"
```

---

## Task 7: RBAC helpers

**Files:**
- Create: `src/lib/rbac.ts`, `src/lib/rbac-server.ts`
- Test: `tests/rbac.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/rbac.test.ts
import { describe, it, expect } from 'vitest'
import type { Session } from 'next-auth'
import { can } from '@/lib/rbac'

function session(permissions: string[]): Session {
  return {
    user: { id: 'u1', email: 'a@b.gr', name: 'T', role: 'VIEWER', permissions, trdrId: null },
    expires: '2099-01-01',
  } as Session
}

describe('can', () => {
  it('is true when the permission is held', () => {
    expect(can(session(['product.view']), 'product.view')).toBe(true)
  })

  it('is false when the permission is absent', () => {
    expect(can(session(['product.view']), 'product.edit')).toBe(false)
  })

  it('is false for a null session', () => {
    expect(can(null, 'product.view')).toBe(false)
  })

  it('does not treat a prefix match as a grant', () => {
    expect(can(session(['product.view']), 'product')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/rbac.test.ts`
Expected: FAIL — cannot resolve `@/lib/rbac`

- [ ] **Step 3: Write the pure predicate**

```ts
// src/lib/rbac.ts
import type { Session } from 'next-auth'

/** Pure and client-safe — must never import from '@/auth'. */
export function can(session: Session | null, permission: string): boolean {
  return !!session?.user?.permissions?.includes(permission)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/rbac.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Write the server guards**

```ts
// src/lib/rbac-server.ts
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { can } from '@/lib/rbac'

/** For server components and actions: returns the session or throws. */
export async function requirePermission(permission: string): Promise<Session> {
  const session = await auth()
  if (!can(session, permission)) throw new Error(`Forbidden: απαιτείται ${permission}`)
  return session!
}

/**
 * For actions needing the SUPER_ADMIN role specifically, not merely a permission.
 * Checks the permission first (can they see the screen at all), then the role name.
 */
export async function requireSuperAdmin(permission: string): Promise<Session> {
  const session = await requirePermission(permission)
  if (session.user.role !== 'SUPER_ADMIN') throw new Error('Forbidden: απαιτείται ρόλος SUPER_ADMIN')
  return session
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/rbac.ts src/lib/rbac-server.ts tests/rbac.test.ts
git commit -m "feat: add RBAC helpers with client-safe predicate"
```

---

## Task 8: Seed and permission sync

**Files:**
- Create: `prisma/seed.ts`, `prisma/sync-permissions.ts`

- [ ] **Step 1: Write the seed**

`update: {}` on the user upsert is deliberate — re-seeding must never downgrade the role or reset the password of an existing account.

```ts
// prisma/seed.ts
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PERMISSIONS, ROLE_DEFAULTS, SYSTEM_ROLE_NAMES } from '../src/lib/permissions'
import { prisma } from '../src/lib/prisma'

async function main() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: p,
    })
  }

  for (const [name, permKeys] of Object.entries(ROLE_DEFAULTS)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, system: SYSTEM_ROLE_NAMES.has(name) },
    })
    const perms = await prisma.permission.findMany({ where: { key: { in: permKeys } } })
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: perms.map(p => ({ roleId: role.id, permissionId: p.id })),
      }),
    ])
  }

  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } })
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!password) throw new Error('SEED_ADMIN_PASSWORD δεν έχει οριστεί στο .env')

  await prisma.user.upsert({
    where: { email: 'gkozyris@i4ria.com' },
    update: {},
    create: {
      email: 'gkozyris@i4ria.com',
      name: 'Giannis Kozyris',
      passwordHash: await bcrypt.hash(password, 12),
      roleId: superAdminRole.id,
    },
  })
  console.log('Seed ολοκληρώθηκε. Admin: gkozyris@i4ria.com (SUPER_ADMIN)')
}

main()
  .catch(e => { console.error('Seed απέτυχε:', e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
```

There is no default password fallback: a public repo must not ship a known admin credential.

- [ ] **Step 2: Write the non-destructive sync script**

```ts
// prisma/sync-permissions.ts
import 'dotenv/config'
import { PERMISSIONS, ROLE_DEFAULTS } from '../src/lib/permissions'
import { prisma } from '../src/lib/prisma'

/** Upserts registry permissions and ADDS missing default grants. Never deletes. */
async function main() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: p.key }, update: { description: p.description }, create: p })
  }
  let added = 0
  for (const [name, keys] of Object.entries(ROLE_DEFAULTS)) {
    const role = await prisma.role.findUnique({ where: { name } })
    if (!role) continue
    const perms = await prisma.permission.findMany({ where: { key: { in: keys } } })
    const existing = new Set(
      (await prisma.rolePermission.findMany({ where: { roleId: role.id }, select: { permissionId: true } }))
        .map(rp => rp.permissionId),
    )
    const toAdd = perms.filter(p => !existing.has(p.id)).map(p => ({ roleId: role.id, permissionId: p.id }))
    if (toAdd.length) { await prisma.rolePermission.createMany({ data: toAdd }); added += toAdd.length }
    console.log(`role ${name}: +${toAdd.length} grants`)
  }
  console.log(`Sync ολοκληρώθηκε: ${PERMISSIONS.length} permissions, ${added} grants added.`)
}
main().catch(e => { console.error('sync-permissions απέτυχε:', e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 3: Run the seed**

Run: `npm run db:seed`
Expected: `Seed ολοκληρώθηκε. Admin: gkozyris@i4ria.com (SUPER_ADMIN)`

- [ ] **Step 4: Verify it is idempotent**

Run: `npm run db:seed` a second time
Expected: same output, no error, no duplicate rows.

```bash
psql "postgres://giannis:$PGPASSWORD@100.70.50.43:5432/wooMakis" \
  -c 'select (select count(*) from "Permission") as perms, (select count(*) from "Role") as roles, (select count(*) from "User") as users'
```

Expected: `perms | 17`, `roles | 3`, `users | 1`

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts prisma/sync-permissions.ts
git commit -m "feat: add idempotent seed and non-destructive permission sync"
```

---

## Task 9: Steel & Frost design tokens

**Files:**
- Overwrite: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Copy the token sheet from the reference repo**

The damask `globals.css` is ~1684 lines of Tailwind 4 `@theme` mappings plus the full Steel & Frost light and dark palettes. Copy it rather than retyping:

```bash
cp "$DAMASK/src/app/globals.css" src/app/globals.css
```

- [ ] **Step 2: Strip damask-specific rules**

Remove any selector referencing damask-only features (`.trdr-`, `.pm-`, `.ocr-`, `.program-`). Keep `@theme inline`, `:root`, `.dark`, the gradient canvas, glass utilities, and the dotted table-divider rule.

Verify the core tokens survived:

```bash
grep -cE -- "--navy|--coral|--grad-top|--background" src/app/globals.css
```

Expected: 4 or more

- [ ] **Step 3: Wire the fonts in the root layout**

Comfortaa for display, Manrope for UI and numerals, both with the Greek subset.

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Comfortaa, Manrope } from 'next/font/google'
import './globals.css'

const display = Comfortaa({ subsets: ['latin', 'greek'], variable: '--font-display', display: 'swap' })
const sans = Manrope({ subsets: ['latin', 'greek'], variable: '--font-sans', display: 'swap' })

export const metadata: Metadata = { title: 'wooMakis', description: 'Διαχείριση καταλόγου' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Verify it renders**

Run: `npm run dev`, open `http://localhost:3000`
Expected: page renders on the pale `#F2F6F6` background with Manrope, no font flash, no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: add Steel & Frost design tokens and fonts"
```

---

## Task 10: Login screen

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/login-form.tsx`

- [ ] **Step 1: Write the server page**

```tsx
// src/app/login/page.tsx
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 shadow-lg">
        <h1 className="mb-6 font-display text-xl font-semibold">Σύνδεση</h1>
        <LoginForm />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Write the client form**

Labels are always visible above their field, and the error states cause and remedy — both are binding UI rules from the design system.

```tsx
// src/app/login/login-form.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const data = new FormData(e.currentTarget)
    const res = await signIn('credentials', {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
      redirect: false,
    })
    setPending(false)
    if (res?.error) {
      setError('Λάθος email ή κωδικός. Έλεγξε τα στοιχεία και δοκίμασε ξανά.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-xs font-medium uppercase tracking-wide">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email"
          className="h-10 w-full rounded-full border border-border bg-card px-4 outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-xs font-medium uppercase tracking-wide">Κωδικός</label>
        <input id="password" name="password" type="password" required autoComplete="current-password"
          className="h-10 w-full rounded-full border border-border bg-card px-4 outline-none focus:ring-2 focus:ring-ring" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={pending}
        className="h-10 w-full cursor-pointer rounded-full bg-primary px-4 font-medium text-primary-foreground disabled:opacity-60">
        {pending ? 'Σύνδεση…' : 'Σύνδεση'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Verify login works end to end**

Run `npm run dev`, open `/login`, sign in with `gkozyris@i4ria.com` and the `SEED_ADMIN_PASSWORD` value.
Expected: redirect to `/dashboard` (404 until Task 11 — that is fine, the redirect itself is what is being verified).

Then try a deliberately wrong password.
Expected: the Greek error appears, no redirect.

- [ ] **Step 4: Commit**

```bash
git add src/app/login
git commit -m "feat: add login screen with credentials sign-in"
```

---

## Task 11: Admin shell and route protection

**Files:**
- Create: `src/middleware.ts`, `src/app/(admin)/layout.tsx`, `src/app/(admin)/dashboard/page.tsx`
- Create: `src/components/shell/sidebar.tsx`, `src/components/shell/topbar.tsx`, `src/components/shell/sign-out-item.tsx`
- Create: `src/lib/nav.ts`

- [ ] **Step 1: Write the middleware**

```ts
// src/middleware.ts
export { auth as middleware } from '@/auth'

export const config = {
  matcher: ['/dashboard/:path*', '/products/:path*', '/categories/:path*',
            '/customers/:path*', '/media/:path*', '/sync/:path*',
            '/users/:path*', '/roles/:path*', '/settings/:path*'],
}
```

- [ ] **Step 2: Write the nav registry**

Each item declares the permission that reveals it, so the sidebar filters itself.

```ts
// src/lib/nav.ts
export type NavItem = { href: string; label: string; permission: string }

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  label: 'Πίνακας ελέγχου', permission: 'product.view' },
  { href: '/products',   label: 'Προϊόντα',        permission: 'product.view' },
  { href: '/categories', label: 'Κατηγορίες',      permission: 'category.view' },
  { href: '/media',      label: 'Πολυμέσα',        permission: 'media.view' },
  { href: '/customers',  label: 'Πελάτες',         permission: 'customer.view' },
  { href: '/sync',       label: 'Συγχρονισμός',    permission: 'sync.view' },
  { href: '/users',      label: 'Χρήστες',         permission: 'user.manage' },
  { href: '/roles',      label: 'Ρόλοι',           permission: 'role.manage' },
  { href: '/settings',   label: 'Ρυθμίσεις',       permission: 'settings.manage' },
]
```

- [ ] **Step 3: Write the sidebar**

```tsx
// src/components/shell/sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from '@/lib/nav'

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Κύρια πλοήγηση" className="flex w-56 shrink-0 flex-col gap-1 p-3">
      {items.map(item => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link key={item.href} href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${
              active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
            }`}>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: Write the sign-out control and topbar**

```tsx
// src/components/shell/sign-out-item.tsx
'use client'

import { signOut } from 'next-auth/react'

export function SignOutItem() {
  return (
    <button onClick={() => signOut({ callbackUrl: '/login' })}
      className="cursor-pointer rounded-full px-4 py-2 text-sm hover:bg-accent">
      Αποσύνδεση
    </button>
  )
}
```

```tsx
// src/components/shell/topbar.tsx
import { SignOutItem } from './sign-out-item'

export function Topbar({ name, role }: { name: string; role: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-5">
      <span className="font-display text-base font-semibold">wooMakis</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{name} · {role}</span>
        <SignOutItem />
      </div>
    </header>
  )
}
```

- [ ] **Step 5: Write the authenticated layout**

```tsx
// src/app/(admin)/layout.tsx
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { can } from '@/lib/rbac'
import { NAV_ITEMS } from '@/lib/nav'
import { Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const items = NAV_ITEMS.filter(i => can(session, i.permission))

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar name={session.user.name} role={session.user.role} />
      <div className="flex flex-1">
        <Sidebar items={items} />
        <main className="flex-1 p-5">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Write the dashboard placeholder**

```tsx
// src/app/(admin)/dashboard/page.tsx
import { requirePermission } from '@/lib/rbac-server'

export default async function DashboardPage() {
  const session = await requirePermission('product.view')
  return (
    <section>
      <h1 className="font-display text-xl font-semibold">Πίνακας ελέγχου</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Καλώς ήρθες, {session.user.name}. Ο κατάλογος θα εμφανιστεί εδώ μετά τον πρώτο συγχρονισμό.
      </p>
    </section>
  )
}
```

- [ ] **Step 7: Verify protection and the shell**

1. Sign out, then visit `/dashboard` directly → redirected to `/login`.
2. Sign in as the super admin → dashboard renders with all 9 nav items.
3. `npx tsc --noEmit` → no errors.
4. `npx vitest run` → all tests pass.

- [ ] **Step 8: Commit and push**

```bash
git add src/middleware.ts src/lib/nav.ts src/components/shell "src/app/(admin)"
git commit -m "feat: add protected admin shell with permission-filtered nav"
git push
```

---

## Task 12: Phase 1 verification

- [ ] **Step 1: Confirm no secrets are tracked**

```bash
./.secretscan.sh
```

Expected: `clean`

The script matches structurally — a *populated* password inside a connection string, a
Bunny `AccessKey`, a Woo consumer key — and filters out known placeholders
(`USER:PASSWORD`, `<password>`, `$PGPASSWORD`). Matching on structure rather than on
literal secret values means the check never becomes the thing it is looking for.

Run it before **every** commit. Skipping it once is how the Postgres password reached a
public repository on 2026-08-15.

Expected: `clean`

- [ ] **Step 2: Confirm a clean build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Confirm the full test suite**

Run: `npx vitest run`
Expected: all tests pass — 5 registry, 4 credential, 4 RBAC.

- [ ] **Step 4: Confirm RBAC filtering actually filters**

Create a `VIEWER` user against the seeded role, sign in as them, and confirm the sidebar shows only the five `*.view` items — no Χρήστες, Ρόλοι, or Ρυθμίσεις.

```bash
npx tsx -e "
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from './src/lib/prisma'
const role = await prisma.role.findUniqueOrThrow({ where: { name: 'VIEWER' } })
await prisma.user.upsert({
  where: { email: 'viewer@test.local' },
  update: {},
  create: { email: 'viewer@test.local', name: 'Viewer Test', passwordHash: await bcrypt.hash('viewer-test-pw', 12), roleId: role.id },
})
console.log('viewer@test.local created')
await prisma.\$disconnect()
"
```

Delete the test user once verified.

- [ ] **Step 5: Commit any fixes and push**

```bash
git add -A && git commit -m "chore: phase 1 verification fixes" && git push
```

---

## Phase 1 Definition of Done

- `wooMakis` database exists with the four RBAC tables and applied migrations.
- Seed is idempotent and creates 17 permissions, 3 roles, and the super admin.
- Login works; wrong passwords and deactivated users are rejected.
- `/dashboard` is unreachable when signed out.
- The sidebar shows only permitted items.
- `npm run build` and `npx vitest run` both pass.
- No credential appears in any tracked file.
