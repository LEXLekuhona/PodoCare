-- CreateTable
CREATE TABLE "physical_good_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "network_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "physical_good_categories_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes first (required for ON CONFLICT)
CREATE UNIQUE INDEX "physical_good_categories_network_id_slug_key" ON "physical_good_categories"("network_id", "slug");
CREATE UNIQUE INDEX "physical_good_categories_network_id_name_key" ON "physical_good_categories"("network_id", "name");
CREATE INDEX "physical_good_categories_network_id_is_active_idx" ON "physical_good_categories"("network_id", "is_active");

-- AddForeignKey
ALTER TABLE "physical_good_categories" ADD CONSTRAINT "physical_good_categories_network_id_fkey"
FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add column first as nullable for migration
ALTER TABLE "physical_goods" ADD COLUMN "category_id" UUID;

-- Seed categories from existing physical_goods.category values
INSERT INTO "physical_good_categories" ("network_id", "slug", "name")
SELECT
    pg."network_id",
    COALESCE(NULLIF(regexp_replace(lower(trim(pg."category")), '[^a-z0-9а-яё]+', '-', 'g'), ''), 'category') AS "slug",
    trim(pg."category") AS "name"
FROM "physical_goods" pg
WHERE pg."category" IS NOT NULL AND trim(pg."category") <> ''
GROUP BY pg."network_id", trim(pg."category")
ON CONFLICT ("network_id", "name") DO NOTHING;

-- Ensure each network has fallback category for previously uncategorized goods
INSERT INTO "physical_good_categories" ("network_id", "slug", "name")
SELECT DISTINCT
    pg."network_id",
    'uncategorized',
    'Без категории'
FROM "physical_goods" pg
LEFT JOIN "physical_good_categories" c
    ON c."network_id" = pg."network_id" AND c."name" = 'Без категории'
WHERE c."id" IS NULL;

-- Backfill relation
UPDATE "physical_goods" pg
SET "category_id" = c."id"
FROM "physical_good_categories" c
WHERE c."network_id" = pg."network_id"
  AND c."name" = COALESCE(NULLIF(trim(pg."category"), ''), 'Без категории');

-- Make category relation required
ALTER TABLE "physical_goods" ALTER COLUMN "category_id" SET NOT NULL;

-- Drop old text category and index
DROP INDEX IF EXISTS "physical_goods_category_idx";
ALTER TABLE "physical_goods" DROP COLUMN "category";

-- Create remaining indexes
CREATE INDEX "physical_goods_category_id_idx" ON "physical_goods"("category_id");

-- AddForeignKey for physical_goods
ALTER TABLE "physical_goods" ADD CONSTRAINT "physical_goods_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "physical_good_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
