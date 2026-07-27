ALTER TABLE "animal_health_checklists" ADD COLUMN "deworming_done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "animal_health_checklists" ADD COLUMN "deworming_date" date;--> statement-breakpoint
ALTER TABLE "animal_health_checklists" ADD COLUMN "external_treatment_done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "animal_health_checklists" ADD COLUMN "external_treatment_date" date;