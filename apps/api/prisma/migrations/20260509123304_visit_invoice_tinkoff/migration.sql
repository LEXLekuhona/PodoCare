-- AlterEnum
ALTER TYPE "payment_method" ADD VALUE 'CASH';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "service_id" UUID;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "appointment_id" UUID,
ADD COLUMN "staff_invoice_author_user_id" UUID;

-- CreateIndex
CREATE INDEX "order_items_service_id_idx" ON "order_items"("service_id");

-- CreateIndex
CREATE INDEX "orders_appointment_id_idx" ON "orders"("appointment_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_staff_invoice_author_user_id_fkey" FOREIGN KEY ("staff_invoice_author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
