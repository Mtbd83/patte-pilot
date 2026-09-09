-- Cleanup step of the "tronc commun + banque de questions" migration —
-- deliberately separate from 0036 (which adds `answers`/backfills/seeds)
-- so the two can be applied at different times: 0036 is safe to run while
-- the old code is still live (it only adds columns, never removes any the
-- old code reads); this one removes the old columns/enums and must only be
-- applied once the new code (which no longer reads them) is actually
-- deployed and confirmed working.
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "housing_zone";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "housing_type";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "garden_area_m2";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "apartment_area_m2";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "fence_height";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "garden_access_details";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "residency_status";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "residency_duration";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "living_situation";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "family_size";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "children_count";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "allergies_details";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "activity_level";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "family_agrees";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "family_disagreement_reason";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "has_other_animals";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "other_animals_details";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "caretaker_person";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "sleeping_area";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "alone_time_per_day";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "dog_walks_per_day";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "dog_midday_walk_possible";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "vacation_plan";--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "additional_comments";--> statement-breakpoint
-- Now-orphaned enum types (their values live on as bank question options in
-- src/lib/adoption-question-bank.ts instead) — drizzle-kit doesn't drop
-- these automatically.
DROP TYPE IF EXISTS "housing_type";--> statement-breakpoint
DROP TYPE IF EXISTS "housing_zone";--> statement-breakpoint
DROP TYPE IF EXISTS "residency_status";--> statement-breakpoint
DROP TYPE IF EXISTS "living_situation";--> statement-breakpoint
DROP TYPE IF EXISTS "activity_level";--> statement-breakpoint
DROP TYPE IF EXISTS "alone_time_per_day";
