ALTER TYPE "sterilization_partner" ADD VALUE 'autre';--> statement-breakpoint
ALTER TABLE "sterilization_campaigns" DROP CONSTRAINT "sterilization_campaigns_veterinarian_id_veterinarians_id_fk";
--> statement-breakpoint
ALTER TABLE "sterilization_campaigns" ADD COLUMN "vet_name" varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE "sterilization_campaigns" ADD COLUMN "vet_address" text;--> statement-breakpoint
ALTER TABLE "sterilization_campaigns" ADD COLUMN "vet_phone" varchar(30);--> statement-breakpoint
ALTER TABLE "sterilization_campaigns" DROP COLUMN IF EXISTS "veterinarian_id";