-- Hosted Supabase auto-grants table privileges to the API roles via default privileges (the
-- behavior difference 20260621120000 documents, in the other direction) — so on prod,
-- project_shares silently picked up anon grants and "no table access for guests" degraded
-- from structural to RLS-dependent (anon select returned 200 [] instead of 42501). Caught by
-- the post-push probe (#759). Revoke explicitly: the design requires that the ONLY guest
-- read path is the get_project_share RPC, with the table itself dark to anon.

revoke all on table public.project_shares from anon;
revoke all on table public.project_shares from public;
