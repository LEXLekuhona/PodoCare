-- Направления студии (главный экран приложения)
CREATE TABLE "studio_directions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon_key" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_directions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "studio_directions_slug_key" ON "studio_directions"("slug");
CREATE INDEX "studio_directions_is_active_sort_order_idx" ON "studio_directions"("is_active", "sort_order");
