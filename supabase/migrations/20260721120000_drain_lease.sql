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

-- Renew the lease — extends `until` only while THIS token is still the current holder (nobody else
-- has acquired). Returns false when the lease was lost (someone else took over), so a long-running
-- drain can stop extending. Owner-scoped.
create or replace function public.renew_drain_lease(p_share_id uuid, p_token text, p_ttl_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update project_shares ps
     set drain_lease_until = now() + make_interval(secs => greatest(p_ttl_seconds, 1))
   where ps.share_id = p_share_id
     and ps.owner_user_id = (select auth.uid())
     and ps.drain_lease_token = p_token;
  return found; -- false → we no longer hold the lease
end;
$$;

revoke all on function public.renew_drain_lease(uuid, text, int) from public;
grant execute on function public.renew_drain_lease(uuid, text, int) to authenticated;

-- FENCE the claim with the lease token (#850/#852, addressing the review): only the current,
-- unexpired lease holder may claim events. This is what makes the lease an ENFORCED serialization
-- boundary rather than an advisory one — a client that skips acquire_drain_lease (or a cached
-- pre-lease bundle calling the old 2-arg signature) fails closed: the old function is dropped, and
-- the new one claims nothing without a valid token. Otherwise a bypassing claimer could drain
-- concurrently with the holder and recreate the out-of-order watermark loss.
drop function if exists public.claim_drainable_events(uuid, text[]);

create or replace function public.claim_drainable_events(p_share_id uuid, p_kinds text[], p_lease_token text)
returns setof public.share_resource_events
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from project_shares ps
    where ps.share_id = p_share_id
      and ps.owner_user_id = (select auth.uid())
      and ps.drain_lease_token = p_lease_token
      and ps.drain_lease_until is not null
      and ps.drain_lease_until > now()
  ) then
    return; -- not the current unexpired lease holder: claim nothing (fail closed)
  end if;
  return query
  with claimed as (
    update share_resource_events e
       set drained = true
     where e.share_id = p_share_id
       and not e.drained
       and (case when e.delta is not null then 'delta' when e.answer is not null then 'answer' end) = any (p_kinds)
    returning e.*
  )
  select * from claimed order by claimed.id; -- FIFO: coherent per-resource sequence for the drain
end;
$$;

revoke all on function public.claim_drainable_events(uuid, text[], text) from public;
grant execute on function public.claim_drainable_events(uuid, text[], text) to authenticated;
