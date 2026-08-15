-- Media folders. Self-referencing tree; slug is unique per level so "banners"
-- can exist under more than one parent.
CREATE TABLE "MediaFolder" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "parentId"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaFolder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaFolder_parentId_slug_key" ON "MediaFolder"("parentId","slug");
CREATE INDEX "MediaFolder_parentId_idx" ON "MediaFolder"("parentId");

ALTER TABLE "MediaFolder"
  ADD CONSTRAINT "MediaFolder_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "MediaFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Assets keep existing when their folder is removed; they fall back to the root.
ALTER TABLE "MediaAsset" ADD COLUMN "folderId" TEXT;
CREATE INDEX "MediaAsset_folderId_idx" ON "MediaAsset"("folderId");
ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "MediaFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
