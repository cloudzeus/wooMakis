-- Contact lenses are prescribed per eye, with different powers left and right,
-- so one product can legitimately occupy two cart lines.
CREATE TYPE "Eye" AS ENUM ('RIGHT', 'LEFT', 'BOTH');

ALTER TABLE "CartLine"
  ADD COLUMN "eye"        "Eye" NOT NULL DEFAULT 'BOTH',
  ADD COLUMN "selections" JSONB,
  ADD COLUMN "lineKey"    TEXT;

-- Existing rows predate per-eye selection; their key is just the product.
UPDATE "CartLine" SET "lineKey" = "productId" WHERE "lineKey" IS NULL;
ALTER TABLE "CartLine" ALTER COLUMN "lineKey" SET NOT NULL;

-- Identity moves from (cart, product) to (cart, lineKey): same product with a
-- different power must not collide.
DROP INDEX IF EXISTS "CartLine_cartId_productId_key";
CREATE UNIQUE INDEX "CartLine_cartId_lineKey_key" ON "CartLine"("cartId", "lineKey");
CREATE INDEX "CartLine_productId_idx" ON "CartLine"("productId");
