-- Enables Row Level Security on every table in the public schema, with no
-- policies attached. This app never queries Postgres through Supabase's
-- auto-generated PostgREST API (the anon/authenticated roles) — all data
-- access goes through the Next.js server via a direct Postgres connection
-- as the table-owning role, which bypasses RLS by default and is therefore
-- entirely unaffected by this change. The sole effect is to close off the
-- PostgREST API surface entirely (RLS enabled + zero policies = deny-all
-- for any non-owner role), which is what resolves Supabase's linter
-- warning ("RLS has not been enabled").
ALTER TABLE "accounting_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "adoption_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "animal_health_checklists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "animal_placements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "animals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "foster_families" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_helloasso_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_member_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_signup_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supply_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
