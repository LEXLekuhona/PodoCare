-- Add enum for structured treatment plan steps
CREATE TYPE "treatment_plan_step_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED');

-- Add audit fields to appointment protocols
ALTER TABLE "appointment_protocols"
  ADD COLUMN "updated_by_user_id" UUID,
  ADD COLUMN "update_reason" TEXT,
  ADD COLUMN "update_comment" TEXT;

CREATE INDEX "appointment_protocols_updated_by_user_id_idx" ON "appointment_protocols"("updated_by_user_id");

ALTER TABLE "appointment_protocols"
  ADD CONSTRAINT "appointment_protocols_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add audit fields to treatment plans
ALTER TABLE "treatment_plans"
  ADD COLUMN "updated_by_user_id" UUID,
  ADD COLUMN "update_comment" TEXT;

CREATE INDEX "treatment_plans_updated_by_user_id_idx" ON "treatment_plans"("updated_by_user_id");

ALTER TABLE "treatment_plans"
  ADD CONSTRAINT "treatment_plans_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create structured treatment plan steps table
CREATE TABLE "treatment_plan_steps" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "treatment_plan_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "title" TEXT NOT NULL,
  "recommendation" TEXT,
  "due_date" TIMESTAMPTZ(6),
  "status" "treatment_plan_step_status" NOT NULL DEFAULT 'PENDING',
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "treatment_plan_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "treatment_plan_steps_treatment_plan_id_sort_order_idx"
  ON "treatment_plan_steps"("treatment_plan_id", "sort_order");
CREATE INDEX "treatment_plan_steps_status_idx" ON "treatment_plan_steps"("status");

ALTER TABLE "treatment_plan_steps"
  ADD CONSTRAINT "treatment_plan_steps_treatment_plan_id_fkey"
  FOREIGN KEY ("treatment_plan_id") REFERENCES "treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create immutable revisions table with snapshots
CREATE TABLE "treatment_plan_revisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "treatment_plan_id" UUID NOT NULL,
  "updated_by_user_id" UUID,
  "reason" TEXT,
  "comment" TEXT,
  "snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "treatment_plan_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "treatment_plan_revisions_treatment_plan_id_created_at_idx"
  ON "treatment_plan_revisions"("treatment_plan_id", "created_at");
CREATE INDEX "treatment_plan_revisions_updated_by_user_id_idx"
  ON "treatment_plan_revisions"("updated_by_user_id");

ALTER TABLE "treatment_plan_revisions"
  ADD CONSTRAINT "treatment_plan_revisions_treatment_plan_id_fkey"
  FOREIGN KEY ("treatment_plan_id") REFERENCES "treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "treatment_plan_revisions"
  ADD CONSTRAINT "treatment_plan_revisions_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
