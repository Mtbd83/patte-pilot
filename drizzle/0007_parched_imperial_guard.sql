DO $$ BEGIN
 CREATE TYPE "public"."activity_level" AS ENUM('intense', 'modere', 'faible');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."alone_time_per_day" AS ENUM('presque_aucune', 'moins_2h', '2h_4h', '4h_6h', '8h_plus');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "adoption_applications" ALTER COLUMN "activity_level" SET DATA TYPE activity_level USING "activity_level"::text::activity_level;--> statement-breakpoint
ALTER TABLE "adoption_applications" ALTER COLUMN "alone_time_per_day" SET DATA TYPE alone_time_per_day USING "alone_time_per_day"::text::alone_time_per_day;