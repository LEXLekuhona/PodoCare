-- Идемпотентная обработка webhook'ов провайдеров оплаты (ЮKassa и др.).
CREATE TABLE "processed_provider_webhooks" (
    "id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "external_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_provider_webhooks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "processed_provider_webhooks_provider_external_id_key" ON "processed_provider_webhooks"("provider", "external_id");
