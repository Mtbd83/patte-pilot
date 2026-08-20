-- Preserve existing uploads: the old "certificate_file_url" was already the
-- de facto certificate used for chat/lapin/autre — carry it forward into
-- both new species-specific slots so no organization loses a working
-- certificate the moment this ships. Admins can then replace either with a
-- distinct file in Paramètres.
UPDATE "organizations" SET
  "certificate_file_url_chat" = COALESCE("certificate_file_url_chat", "certificate_file_url"),
  "certificate_file_url_nac" = COALESCE("certificate_file_url_nac", "certificate_file_url")
WHERE "certificate_file_url" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "certificate_file_url";