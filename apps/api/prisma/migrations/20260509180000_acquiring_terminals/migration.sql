-- CreateTable
CREATE TABLE "acquiring_terminals" (
    "id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "studio_id" UUID,
    "label" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "secret_cipher_text" BYTEA NOT NULL,
    "secret_iv" BYTEA NOT NULL,
    "secret_auth_tag" BYTEA NOT NULL,
    "notification_url" TEXT,
    "device_data_json" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "acquiring_terminals_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "acquiring_terminals" ADD CONSTRAINT "acquiring_terminals_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "acquiring_terminals_provider_studio_id_is_active_idx" ON "acquiring_terminals"("provider", "studio_id", "is_active");
