-- Связь специалист ↔ студии (несколько точек). Убираем флаг works_all_network_studios.
CREATE TABLE "specialist_studios" (
    "specialist_profile_id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,

    CONSTRAINT "specialist_studios_pkey" PRIMARY KEY ("specialist_profile_id","studio_id"),
    CONSTRAINT "specialist_studios_specialist_profile_id_fkey" FOREIGN KEY ("specialist_profile_id") REFERENCES "specialist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "specialist_studios_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "specialist_studios_studio_id_idx" ON "specialist_studios"("studio_id");

INSERT INTO "specialist_studios" ("specialist_profile_id", "studio_id")
SELECT "id", "studio_id" FROM "specialist_profiles";

INSERT INTO "specialist_studios" ("specialist_profile_id", "studio_id")
SELECT sp."id", s."id"
FROM "specialist_profiles" sp
INNER JOIN "studios" sp_home ON sp_home."id" = sp."studio_id"
INNER JOIN "studios" s ON s."network_id" = sp_home."network_id"
WHERE sp."works_all_network_studios" = true
ON CONFLICT DO NOTHING;

ALTER TABLE "specialist_profiles" DROP COLUMN "works_all_network_studios";
