DO $$ BEGIN
 CREATE TYPE "public"."supply_request_category" AS ENUM('croquettes_chat', 'croquettes_chien', 'litiere', 'bac_litiere', 'cage_transport_chat', 'cage_transport_chien', 'griffoir', 'panier', 'autre');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."supply_request_status" AS ENUM('en_cours', 'pris_en_compte');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supply_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"foster_family_id" uuid NOT NULL,
	"category" "supply_request_category" NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"comment" text,
	"status" "supply_request_status" DEFAULT 'en_cours' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_foster_family_id_foster_families_id_fk" FOREIGN KEY ("foster_family_id") REFERENCES "public"."foster_families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supply_requests_organization_idx" ON "supply_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supply_requests_foster_family_idx" ON "supply_requests" USING btree ("foster_family_id");