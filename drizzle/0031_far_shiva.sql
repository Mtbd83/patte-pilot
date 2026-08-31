ALTER TABLE "sterilization_reporting_maps" ADD COLUMN "boundary" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sterilization_reporting_maps" DROP COLUMN IF EXISTS "latitude";--> statement-breakpoint
ALTER TABLE "sterilization_reporting_maps" DROP COLUMN IF EXISTS "longitude";