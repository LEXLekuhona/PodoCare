-- Счёт после приёма для клиента без User: заказ привязан к walk_in_clients.
ALTER TABLE "orders" ADD COLUMN "walk_in_client_id" UUID;

ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "orders" ADD CONSTRAINT "orders_walk_in_client_id_fkey"
  FOREIGN KEY ("walk_in_client_id") REFERENCES "walk_in_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "orders_walk_in_client_id_idx" ON "orders"("walk_in_client_id");

ALTER TABLE "orders" ADD CONSTRAINT "orders_user_or_walk_in_ck"
  CHECK ("user_id" IS NOT NULL OR "walk_in_client_id" IS NOT NULL);

-- Одна карточка walk-in на пару студия + телефон (нормализованный).
CREATE UNIQUE INDEX "walk_in_clients_studio_id_phone_key" ON "walk_in_clients"("studio_id", "phone");

ALTER TABLE "walk_in_clients" ADD CONSTRAINT "walk_in_clients_linked_user_id_fkey"
  FOREIGN KEY ("linked_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
