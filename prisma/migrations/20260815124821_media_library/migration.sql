-- Media library: assets uploaded through the admin, distinct from mirrored
-- product imagery.
CREATE TYPE "MediaKind" AS ENUM ('PRODUCT', 'LIBRARY');

ALTER TABLE "MediaAsset"
  ADD COLUMN "kind"    "MediaKind" NOT NULL DEFAULT 'PRODUCT',
  ADD COLUMN "title"   TEXT,
  ADD COLUMN "altText" TEXT,
  ADD COLUMN "slot"    TEXT;

-- A slot names one fixed storefront position, so it must resolve to exactly one
-- asset. Postgres allows many NULLs under a unique index, which is what lets
-- ordinary library images leave it empty.
CREATE UNIQUE INDEX "MediaAsset_slot_key" ON "MediaAsset"("slot");
CREATE INDEX "MediaAsset_kind_idx" ON "MediaAsset"("kind");
