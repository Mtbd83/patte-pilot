ALTER TABLE "invitations" DROP CONSTRAINT "invitations_invited_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "invited_by_user_id" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
