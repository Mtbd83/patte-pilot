ALTER TABLE "adoption_applications" ALTER COLUMN "city" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "adoption_applications" ADD COLUMN "allergies_details" text;--> statement-breakpoint
ALTER TABLE "adoption_applications" DROP COLUMN IF EXISTS "has_allergies";