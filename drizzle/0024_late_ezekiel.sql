CREATE TABLE IF NOT EXISTS "veterinarian_tariffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"veterinarian_id" uuid NOT NULL,
	"act_name" varchar(200) NOT NULL,
	"species" "animal_species",
	"sex" "animal_sex",
	"price" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "veterinarians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" text,
	"postal_code" varchar(10),
	"city" varchar(120),
	"phone" varchar(30),
	"notes" text,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "vet_tariffs_visible_to_foster_families" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "veterinarian_tariffs" ADD CONSTRAINT "veterinarian_tariffs_veterinarian_id_veterinarians_id_fk" FOREIGN KEY ("veterinarian_id") REFERENCES "public"."veterinarians"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "veterinarians" ADD CONSTRAINT "veterinarians_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "veterinarian_tariffs_veterinarian_idx" ON "veterinarian_tariffs" USING btree ("veterinarian_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "veterinarians_organization_idx" ON "veterinarians" USING btree ("organization_id");