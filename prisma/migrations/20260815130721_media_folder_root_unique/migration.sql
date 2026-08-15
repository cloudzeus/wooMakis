-- The (parentId, slug) unique index does not constrain root folders: Postgres
-- treats NULL as never equal to itself, so ("banners", NULL) can be inserted
-- repeatedly. A partial index covers the root case explicitly.
CREATE UNIQUE INDEX "MediaFolder_root_slug_key"
  ON "MediaFolder"("slug") WHERE "parentId" IS NULL;
