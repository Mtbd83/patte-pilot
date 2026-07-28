DO $$ BEGIN
 CREATE TYPE "public"."organization_signup_request_status" AS ENUM('en_attente', 'approuve', 'refuse');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_signup_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_name" varchar(200) NOT NULL,
	"contact_name" varchar(200) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"phone" varchar(30),
	"message" text,
	"siren" varchar(20),
	"address" text,
	"postal_code" varchar(10),
	"city" varchar(120),
	"status" "organization_signup_request_status" DEFAULT 'en_attente' NOT NULL,
	"review_notes" text,
	"reviewed_at" timestamp with time zone,
	"created_organization_id" uuid,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_platform_manager" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_signup_requests" ADD CONSTRAINT "organization_signup_requests_created_organization_id_organizations_id_fk" FOREIGN KEY ("created_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
