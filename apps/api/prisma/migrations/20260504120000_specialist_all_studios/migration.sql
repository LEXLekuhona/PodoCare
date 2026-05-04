-- Специалист может обслуживать все студии своей сети (настраивается в админке).
ALTER TABLE "specialist_profiles" ADD COLUMN "works_all_network_studios" BOOLEAN NOT NULL DEFAULT false;
