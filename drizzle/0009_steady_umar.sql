CREATE TABLE IF NOT EXISTS "organization_helloasso_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"label" varchar(120) NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "iban" varchar(34);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "treasurer_name" varchar(200);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "certificate_email_subject" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "certificate_email_body" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "contract_email_subject" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "contract_email_body" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_helloasso_links" ADD CONSTRAINT "organization_helloasso_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
