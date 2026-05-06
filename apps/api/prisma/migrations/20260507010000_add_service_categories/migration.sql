-- CreateTable: Service Categories (направления деятельности)
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- Create unique index on slug
CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");

-- Create index for isActive + sortOrder
CREATE INDEX "service_categories_is_active_sort_order_idx" ON "service_categories"("is_active", "sort_order");

-- Add category_id column to services
ALTER TABLE "services" ADD COLUMN "category_id" UUID;

-- Create index on category_id
CREATE INDEX "services_category_id_idx" ON "services"("category_id");

-- AddForeignKey for services to categories
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: Specialist Categories junction table
CREATE TABLE "specialist_categories" (
    "specialist_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "specialist_categories_pkey" PRIMARY KEY ("specialist_id","category_id")
);

-- Create indexes for specialist_categories
CREATE INDEX "specialist_categories_category_id_idx" ON "specialist_categories"("category_id");

-- AddForeignKeys for specialist_categories
ALTER TABLE "specialist_categories" ADD CONSTRAINT "specialist_categories_specialist_id_fkey"
FOREIGN KEY ("specialist_id") REFERENCES "specialist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "specialist_categories" ADD CONSTRAINT "specialist_categories_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
