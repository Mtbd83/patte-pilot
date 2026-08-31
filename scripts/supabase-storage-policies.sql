-- Tightens the "uploads" bucket's Row Level Security policies to match the
-- exact path shapes the app itself already enforces (src/lib/uploads.ts
-- ALLOWED_PATH_PATTERNS), as a database-level backstop behind that
-- application check.
--
-- Supabase-specific (the `storage` schema only exists on Supabase, not on
-- the plain Postgres image used for local dev) — this is NOT part of the
-- Drizzle migration chain and is never applied locally. Run by hand against
-- prod only:
--   psql "$PROD_DATABASE_URL" -f scripts/supabase-storage-policies.sql
--
-- The regex is inlined into each policy rather than factored into a
-- `storage.uploads_path_allowed()` helper function: our connection role can
-- CREATE/DROP POLICY on storage.objects, but cannot CREATE FUNCTION inside
-- the storage schema itself (owned by Supabase's internal role) — confirmed
-- by trying it.
--
-- Scope/limitation: the app connects to Supabase Storage with the shared
-- anon key for every organization (no Supabase Auth, no per-request
-- identity Postgres can see) — see src/lib/supabase.ts. So this cannot
-- distinguish "org A's admin" from "org B's admin"; both are the same
-- `anon` role. What it DOES close off: any path that doesn't match one of
-- the four shapes the app is supposed to produce — a path-traversal, a
-- wrong prefix, an arbitrary overwrite — is now rejected by Postgres
-- itself, even if a future bug slipped past the application-level check.
-- Genuine per-organization isolation would require adopting Supabase Auth
-- (or a signed JWT carrying org context) so a policy could check "does this
-- request's identity own this organizationId" — a much bigger change than
-- what's needed here.
--
-- Only the "uploads" bucket is touched. Two other buckets exist
-- (animal-photos, organizations-logo) — legacy, not referenced anywhere in
-- current app code, but still hold real, actively-served files (27 animal
-- photos, 1 organization logo whose DB rows still point at those bucket
-- URLs) — left untouched deliberately.
--
-- Verified against production before applying: every one of the 31 objects
-- actually in the "uploads" bucket matches this pattern (checked via a
-- throwaway pg_temp function against storage.objects first).
--
-- "certificat-default" stays accepted (read-only in practice — the app
-- never writes that path anymore since the chat/NAC/chien split) purely so
-- existing organizations' already-uploaded certificate files, still
-- physically stored under that name, don't 404 the moment this reruns.
--
-- Storage is a single shared Supabase project used by every environment
-- (local dev included — only the Postgres app DB is local Docker, see
-- src/lib/supabase.ts), so this policy is live even during local testing:
-- a path shape added to ALLOWED_PATH_PATTERNS in src/lib/uploads.ts (like
-- campagnes-sterilisation/<uuid> or signalements/<uuid>) must be mirrored
-- here too, or every upload to it fails with "new row violates row-level
-- security policy" even though the app-level check passed.

drop policy if exists "anon insert uploads" on storage.objects;
drop policy if exists "anon select uploads" on storage.objects;
drop policy if exists "anon update uploads" on storage.objects;

create policy "anon insert uploads" on storage.objects
  for insert to anon
  with check (
    bucket_id = 'uploads'
    and (
      name ~ '^(logos|animaux|campagnes-sterilisation|signalements)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-zA-Z0-9]{1,10}$'
      or name ~ '^documents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(certificat-(chat|nac|chien|default)|contrat)\.[a-zA-Z0-9]{1,10}$'
    )
  );

create policy "anon select uploads" on storage.objects
  for select to anon
  using (
    bucket_id = 'uploads'
    and (
      name ~ '^(logos|animaux|campagnes-sterilisation|signalements)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-zA-Z0-9]{1,10}$'
      or name ~ '^documents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(certificat-(chat|nac|chien|default)|contrat)\.[a-zA-Z0-9]{1,10}$'
    )
  );

create policy "anon update uploads" on storage.objects
  for update to anon
  using (
    bucket_id = 'uploads'
    and (
      name ~ '^(logos|animaux|campagnes-sterilisation|signalements)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-zA-Z0-9]{1,10}$'
      or name ~ '^documents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(certificat-(chat|nac|chien|default)|contrat)\.[a-zA-Z0-9]{1,10}$'
    )
  )
  with check (
    bucket_id = 'uploads'
    and (
      name ~ '^(logos|animaux|campagnes-sterilisation|signalements)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-zA-Z0-9]{1,10}$'
      or name ~ '^documents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(certificat-(chat|nac|chien|default)|contrat)\.[a-zA-Z0-9]{1,10}$'
    )
  );
