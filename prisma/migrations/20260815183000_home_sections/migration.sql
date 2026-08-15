-- CreateEnum
CREATE TYPE "HomeSectionKind" AS ENUM ('HERO', 'TRUST', 'CATEGORIES', 'PRODUCTS', 'PANELS', 'BRANDS', 'NEWSLETTER');

-- CreateTable
CREATE TABLE "HomeSection" (
    "id" TEXT NOT NULL,
    "kind" "HomeSectionKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "menuOrder" INTEGER NOT NULL DEFAULT 0,
    "imageSlot" TEXT,
    "imageSlotB" TEXT,
    "itemLimit" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeSectionTranslation" (
    "sectionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "eyebrow" TEXT,
    "title" TEXT,
    "body" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "ctaLabelB" TEXT,
    "ctaHrefB" TEXT,

    CONSTRAINT "HomeSectionTranslation_pkey" PRIMARY KEY ("sectionId","locale")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomeSection_kind_key" ON "HomeSection"("kind");

-- CreateIndex
CREATE INDEX "HomeSection_menuOrder_idx" ON "HomeSection"("menuOrder");

-- AddForeignKey
ALTER TABLE "HomeSectionTranslation" ADD CONSTRAINT "HomeSectionTranslation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HomeSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

