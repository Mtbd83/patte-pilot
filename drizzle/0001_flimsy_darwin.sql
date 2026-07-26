DO $$ BEGIN
 CREATE TYPE "public"."animal_sex" AS ENUM('male', 'femelle', 'inconnu');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."animal_species" AS ENUM('chat', 'chien', 'lapin', 'autre');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."animal_status" AS ENUM('quarantaine', 'en_soins', 'en_famille_accueil', 'visite_en_cours', 'reserve', 'adopte', 'archive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."adoption_application_status" AS ENUM('en_attente', 'retenu', 'refuse', 'retire');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."housing_type" AS ENUM('maison', 'appartement', 'autre');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."housing_zone" AS ENUM('urbaine', 'peri_urbaine', 'rurale');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."living_situation" AS ENUM('seul', 'en_couple', 'colocation', 'en_famille');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."residency_status" AS ENUM('proprietaire', 'locataire');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."accounting_category" AS ENUM('nourriture', 'veterinaire', 'equipement', 'autre');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."accounting_type" AS ENUM('entree', 'sortie');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."inventory_category" AS ENUM('nourriture', 'materiel', 'medical', 'hygiene', 'autre');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."inventory_status" AS ENUM('ok', 'stock_bas', 'expire', 'rupture');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_type" AS ENUM('journee_adoption', 'collecte', 'benevolat', 'autre');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."document_status" AS ENUM('genere', 'envoye', 'signe');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."document_type" AS ENUM('certificat_engagement', 'contrat_adoption');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "animal_health_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"animal_id" uuid NOT NULL,
	"first_vaccine_done" boolean DEFAULT false NOT NULL,
	"first_vaccine_date" date,
	"sterilization_done" boolean DEFAULT false NOT NULL,
	"sterilization_date" date,
	"booster_done" boolean DEFAULT false NOT NULL,
	"booster_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "animals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"species" "animal_species" DEFAULT 'chat' NOT NULL,
	"icad_number" varchar(50),
	"icad_updated_at" date,
	"birth_date" date,
	"breed" varchar(120),
	"sex" "animal_sex" DEFAULT 'inconnu' NOT NULL,
	"coat" varchar(120),
	"description" text,
	"intake_date" date NOT NULL,
	"adoption_date" date,
	"status" "animal_status" DEFAULT 'quarantaine' NOT NULL,
	"current_foster_family_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "foster_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"last_name" varchar(120) NOT NULL,
	"first_name" varchar(120) NOT NULL,
	"address" text,
	"phone" varchar(30),
	"email" varchar(255),
	"has_cats" boolean DEFAULT false NOT NULL,
	"has_dogs" boolean DEFAULT false NOT NULL,
	"has_rabbits" boolean DEFAULT false NOT NULL,
	"linked_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "animal_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"animal_id" uuid NOT NULL,
	"foster_family_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "adoption_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"last_name" varchar(120) NOT NULL,
	"first_name" varchar(120) NOT NULL,
	"city" varchar(120),
	"phone" varchar(30) NOT NULL,
	"email" varchar(255) NOT NULL,
	"age" integer,
	"spouse_age" integer,
	"profession" varchar(150),
	"spouse_profession" varchar(150),
	"housing_zone" "housing_zone",
	"housing_type" "housing_type",
	"garden_area_m2" numeric(8, 2),
	"fence_height" varchar(120),
	"garden_access_details" text,
	"residency_status" "residency_status",
	"residency_duration" varchar(120),
	"living_situation" "living_situation",
	"family_size" integer,
	"children_count" integer DEFAULT 0,
	"has_allergies" boolean DEFAULT false,
	"activity_level" varchar(120),
	"family_agrees" boolean DEFAULT true NOT NULL,
	"family_disagreement_reason" text,
	"has_other_animals" boolean DEFAULT false NOT NULL,
	"other_animals_details" text,
	"caretaker_person" varchar(200),
	"sleeping_area" varchar(200),
	"alone_time_per_day" varchar(120),
	"dog_walks_per_day" integer,
	"dog_midday_walk_possible" boolean,
	"vacation_plan" text,
	"desired_species" "animal_species",
	"specific_animal_name" varchar(120),
	"target_animal_id" uuid,
	"additional_comments" text,
	"status" "adoption_application_status" DEFAULT 'en_attente' NOT NULL,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"date" date NOT NULL,
	"type" "accounting_type" NOT NULL,
	"category" "accounting_category" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"animal_id" uuid,
	"comment" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"article_name" varchar(200) NOT NULL,
	"category" "inventory_category" NOT NULL,
	"animal_species" "animal_species",
	"quantity" integer DEFAULT 0 NOT NULL,
	"min_quantity" integer DEFAULT 0 NOT NULL,
	"unit_price" numeric(10, 2),
	"expiration_date" date,
	"status" "inventory_status" DEFAULT 'ok' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"type" "event_type" DEFAULT 'autre' NOT NULL,
	"location" varchar(200),
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"adoption_application_id" uuid,
	"type" "document_type" NOT NULL,
	"status" "document_status" DEFAULT 'genere' NOT NULL,
	"file_url" text,
	"sent_to_email" varchar(255),
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "animal_health_checklists" ADD CONSTRAINT "animal_health_checklists_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "animals" ADD CONSTRAINT "animals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "animals" ADD CONSTRAINT "animals_current_foster_family_id_foster_families_id_fk" FOREIGN KEY ("current_foster_family_id") REFERENCES "public"."foster_families"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "foster_families" ADD CONSTRAINT "foster_families_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "foster_families" ADD CONSTRAINT "foster_families_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "animal_placements" ADD CONSTRAINT "animal_placements_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "animal_placements" ADD CONSTRAINT "animal_placements_foster_family_id_foster_families_id_fk" FOREIGN KEY ("foster_family_id") REFERENCES "public"."foster_families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "adoption_applications" ADD CONSTRAINT "adoption_applications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "adoption_applications" ADD CONSTRAINT "adoption_applications_target_animal_id_animals_id_fk" FOREIGN KEY ("target_animal_id") REFERENCES "public"."animals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_adoption_application_id_adoption_applications_id_fk" FOREIGN KEY ("adoption_application_id") REFERENCES "public"."adoption_applications"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_animal_health_checklist" ON "animal_health_checklists" USING btree ("animal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "animals_organization_idx" ON "animals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "animals_status_idx" ON "animals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "foster_families_organization_idx" ON "foster_families" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "animal_placements_animal_idx" ON "animal_placements" USING btree ("animal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "animal_placements_foster_family_idx" ON "animal_placements" USING btree ("foster_family_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adoption_applications_organization_idx" ON "adoption_applications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adoption_applications_status_idx" ON "adoption_applications" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_entries_organization_idx" ON "accounting_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_entries_date_idx" ON "accounting_entries" USING btree ("organization_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_items_organization_idx" ON "inventory_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_items_status_idx" ON "inventory_items" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_organization_idx" ON "events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_start_at_idx" ON "events" USING btree ("organization_id","start_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_organization_idx" ON "documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_animal_idx" ON "documents" USING btree ("animal_id");