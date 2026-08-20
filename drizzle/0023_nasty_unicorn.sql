ALTER TABLE "organizations" ADD COLUMN "smtp_host" varchar(255);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "smtp_port" integer;