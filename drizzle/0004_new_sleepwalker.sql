ALTER TABLE "organizations" ADD COLUMN "smtp_user" varchar(255);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "smtp_app_password" text;