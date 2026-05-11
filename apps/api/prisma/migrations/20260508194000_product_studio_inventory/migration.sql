-- CreateTable
CREATE TABLE "physical_good_studio_inventory" (
    "id" UUID NOT NULL,
    "good_id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER,
    "price_minor" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "physical_good_studio_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "physical_good_studio_inventory_good_id_studio_id_key" ON "physical_good_studio_inventory"("good_id", "studio_id");

-- CreateIndex
CREATE INDEX "physical_good_studio_inventory_studio_id_is_available_idx" ON "physical_good_studio_inventory"("studio_id", "is_available");

-- AddForeignKey
ALTER TABLE "physical_good_studio_inventory" ADD CONSTRAINT "physical_good_studio_inventory_good_id_fkey" FOREIGN KEY ("good_id") REFERENCES "physical_goods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_good_studio_inventory" ADD CONSTRAINT "physical_good_studio_inventory_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
