-- Grant table privileges on `workspaces` to the API roles (#388).
--
-- The original workspaces migration (20260610120000) enabled RLS and added the
-- owner policy but issued no GRANTs, relying on Supabase's default privileges to
-- give `authenticated` DML on new public tables. Newer Supabase CLI local stacks
-- (2.x) no longer auto-grant SELECT/INSERT/UPDATE/DELETE on tables created inside
-- a migration, so PostgREST — running as `authenticated` — hit
-- "permission denied for table workspaces" (42501) on a fresh stack.
--
-- RLS still scopes rows to the owner ("Users own their workspaces"); these grants
-- only restore table-level access. Idempotent, so this is a no-op on environments
-- where default privileges already applied (e.g. an older hosted stack).

grant select, insert, update, delete on table public.workspaces to authenticated;
grant select, insert, update, delete on table public.workspaces to service_role;
