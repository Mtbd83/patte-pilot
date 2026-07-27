import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL) throw new Error("SUPABASE_URL is not set");
if (!process.env.SUPABASE_ANON_KEY) throw new Error("SUPABASE_ANON_KEY is not set");

/**
 * Server-only client for Supabase Storage (animal photos, organization
 * logo). Uses the anon key — uploads only ever happen from admin-gated
 * server actions, never directly from the browser, so the app's own
 * `requireAdmin` checks are the real gate; the "uploads" bucket's RLS
 * policies just allow the anon role to read/write it.
 */
export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export const UPLOADS_BUCKET = "uploads";
