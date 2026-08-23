DO $$ BEGIN
 CREATE TYPE "public"."org_permission" AS ENUM('prise_en_charge', 'comptabilite', 'candidature', 'contrat', 'gestion_famille_accueil');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_member_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"permission" "org_permission" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "benevole_permissions" org_permission[];--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_member_permissions" ADD CONSTRAINT "organization_member_permissions_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_member_permission" ON "organization_member_permissions" USING btree ("member_id","permission");