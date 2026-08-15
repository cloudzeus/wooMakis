-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "attributes" JSONB;

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "wooGroupKey" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandTranslation" (
    "brandId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "wooId" INTEGER NOT NULL,
    "wooSnapshot" JSONB,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "BrandTranslation_pkey" PRIMARY KEY ("brandId","locale")
);

-- CreateTable
CREATE TABLE "ProductBrand" (
    "productId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,

    CONSTRAINT "ProductBrand_pkey" PRIMARY KEY ("productId","brandId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_wooGroupKey_key" ON "Brand"("wooGroupKey");

-- CreateIndex
CREATE UNIQUE INDEX "BrandTranslation_wooId_key" ON "BrandTranslation"("wooId");

-- CreateIndex
CREATE INDEX "BrandTranslation_slug_idx" ON "BrandTranslation"("slug");

-- CreateIndex
CREATE INDEX "ProductBrand_brandId_idx" ON "ProductBrand"("brandId");

-- AddForeignKey
ALTER TABLE "BrandTranslation" ADD CONSTRAINT "BrandTranslation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBrand" ADD CONSTRAINT "ProductBrand_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBrand" ADD CONSTRAINT "ProductBrand_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
