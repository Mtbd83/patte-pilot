-- Same reasoning as 0019_enable_row_level_security.sql: every table added
-- since that migration was never covered by it, so Supabase's linter still
-- flags them ("RLS Disabled in Public"). This app never queries Postgres
-- through Supabase's auto-generated PostgREST API (the anon/authenticated
-- roles) — all data access goes through the Next.js server via a direct
-- Postgres connection as the table-owning role, which bypasses RLS by
-- default and is therefore entirely unaffected by this change. The sole
-- effect is to close off the PostgREST API surface for these tables too
-- (RLS enabled + zero policies = deny-all for any non-owner role).
--
-- New tables should be added here (or their own such migration) going
-- forward — Drizzle's schema doesn't track RLS state itself (no
-- `.enableRLS()` used in this codebase), so `drizzle-kit generate` never
-- picks this up automatically; it has to be done by hand each time.
ALTER TABLE "organization_member_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "veterinarians" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "veterinarian_tariffs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sterilization_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sterilization_campaign_volunteers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sterilization_vouchers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sterilization_reporting_maps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sterilization_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sterilization_report_comments" ENABLE ROW LEVEL SECURITY;
