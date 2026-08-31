DO $$ BEGIN
 CREATE TYPE "public"."sterilization_partner" AS ENUM('spa', 'fondation_brigitte_bardot', 'trente_millions_damis');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sterilization_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"city" varchar(120) NOT NULL,
	"partner" "sterilization_partner" NOT NULL,
	"veterinarian_id" uuid,
	"voucher_quota_total" integer NOT NULL,
	"voucher_quota_male" integer,
	"voucher_quota_female" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sterilization_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"voucher_number" varchar(60) NOT NULL,
	"identification_number" varchar(60) NOT NULL,
	"date" date NOT NULL,
	"sex" "animal_sex" NOT NULL,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "sterilization_campaign_module_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sterilization_campaigns" ADD CONSTRAINT "sterilization_campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sterilization_campaigns" ADD CONSTRAINT "sterilization_campaigns_veterinarian_id_veterinarians_id_fk" FOREIGN KEY ("veterinarian_id") REFERENCES "public"."veterinarians"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sterilization_vouchers" ADD CONSTRAINT "sterilization_vouchers_campaign_id_sterilization_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."sterilization_campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sterilization_campaigns_organization_idx" ON "sterilization_campaigns" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sterilization_vouchers_campaign_idx" ON "sterilization_vouchers" USING btree ("campaign_id");