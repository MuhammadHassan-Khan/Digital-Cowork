/**
 * Shared test setup.
 *
 * Unit tests run without any credentials. Integration tests that need a live
 * Supabase project (RLS checks, token endpoints) must skip themselves when
 * env vars are absent — never fake their results (PRD §4/§8).
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "";
