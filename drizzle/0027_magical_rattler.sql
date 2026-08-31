ALTER TYPE "org_permission" ADD VALUE 'campagne_sterilisation';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sterilization_campaign_volunteers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sterilization_campaign_volunteers" ADD CONSTRAINT "sterilization_campaign_volunteers_campaign_id_sterilization_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."sterilization_campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sterilization_campaign_volunteers" ADD CONSTRAINT "sterilization_campaign_volunteers_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_campaign_volunteer" ON "sterilization_campaign_volunteers" USING btree ("campaign_id","member_id");