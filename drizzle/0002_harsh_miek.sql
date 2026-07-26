ALTER TABLE "organizations" ADD COLUMN "siren" varchar(20);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "registration_authority" varchar(200);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "registration_number" varchar(50);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "postal_code" varchar(10);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "city" varchar(120);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "phone1" varchar(30);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "phone2" varchar(30);