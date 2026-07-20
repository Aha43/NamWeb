-- #850/#852: a per-share DRAIN LEASE. Serializes owner drains of a share so guest events apply in a
-- single global order across tabs/devices — required for the `drainedThrough` watermark's correctness.
-- Without it, two tabs claiming time-separated events (A claims 7, then B claims a later-arriving 8)
-- could commit out of order: B advances the watermark to 8 before A applies 7, and 7 (<= 8) is then
-- skipped as "already applied" and lost. The lease lets exactly one tab drain a share at a time.

alter table public.project_shares
  add column if not exists drain_lease_until timestamptz,
  add column if not exists drain_lease_token text;

-- Acquire the drain lease if it is free (never held, or expired). Owner-scoped. Returns a fresh token
-- on success, null when another holder's unexpired lease blocks it. The conditional UPDATE is atomic,
-- so two racing acquirers can't both win.
create or replace function public.acquire_drain_lease(p_share_id uuid, p_ttl_seconds int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := gen_random_uuid()::text;
begin
  update project_shares ps
     set drain_lease_until = now() + make_interval(secs => greatest(p_ttl_seconds, 1)),
         drain_lease_token = v_token
   where ps.share_id = p_share_id
     and ps.owner_user_id = (select auth.uid())
     and (ps.drain_lease_until is null or ps.drain_lease_until < now());
  if not found then
    return null; -- another owner tab holds an unexpired lease
  end if;
  return v_token;
end;
$$;

revoke all on function public.acquire_drain_lease(uuid, int) from public;
grant execute on function public.acquire_drain_lease(uuid, int) to authenticated;

-- Release the lease — only the current holder (matching token) can, so a lease already expired and
-- re-acquired by another tab is left untouched. Owner-scoped. Idempotent.
create or replace function public.release_drain_lease(p_share_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update project_shares ps
     set drain_lease_until = null,
         drain_lease_token = null
   where ps.share_id = p_share_id
     and ps.owner_user_id = (select auth.uid())
     and ps.drain_lease_token = p_token;
end;
$$;

revoke all on function public.release_drain_lease(uuid, text) from public;
grant execute on function public.release_drain_lease(uuid, text) to authenticated;
