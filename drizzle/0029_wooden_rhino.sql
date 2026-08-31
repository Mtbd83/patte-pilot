DO $$ BEGIN
 CREATE TYPE "public"."report_finder_status" AS ENUM('trouve', 'perdu', 'errant');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."report_management_status" AS ENUM('en_cours', 'ferme', 'archive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sterilization_need" AS ENUM('oui', 'non', 'ne_sait_pas');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sterilization_report_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"author_name" varchar(120) NOT NULL,
	"text" text NOT NULL,
	"reporter_ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sterilization_reporting_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"city" varchar(120) NOT NULL,
	"public_token" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sterilization_reporting_maps_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sterilization_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"photo_url" text NOT NULL,
	"sex" "animal_sex" NOT NULL,
	"needs_sterilization" "sterilization_need" NOT NULL,
	"finder_status" "report_finder_status" NOT NULL,
	"management_status" "report_management_status" DEFAULT 'en_cours' NOT NULL,
	"description" text,
	"reporter_ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sterilization_report_comments" ADD CONSTRAINT "sterilization_report_comments_report_id_sterilization_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."sterilization_reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sterilization_reporting_maps" ADD CONSTRAINT "sterilization_reporting_maps_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sterilization_reports" ADD CONSTRAINT "sterilization_reports_map_id_sterilization_reporting_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."sterilization_reporting_maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sterilization_report_comments_report_idx" ON "sterilization_report_comments" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_reporting_map_org_city" ON "sterilization_reporting_maps" USING btree ("organization_id","city");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sterilization_reports_map_idx" ON "sterilization_reports" USING btree ("map_id");