-- Guest-interactive resources, iteration 1 (#809, design:
-- docs/features/project-sharing/guest-interactive-resources.md). Guests append EVENTS, never
-- state: a delegated counter's ticks land here; the OWNER'S client drains them into the
-- workspace as ordinary intents — the single-writer model survives untouched.
--
-- Lessons applied from birth: stable share_id (rotation-proof), ZERO anon table grants with
-- explicit revokes (hosted default privileges auto-grant), caps count the OPEN queue
-- (#802/F1 — drained rows must never ratchet the box deaf), quiet false everywhere (no
-- oracle). node_id/res_index are UNTRUSTED HINTS — the drain resolves them against the
-- owner's recomputed mapping and current document; here they are only length-checked.

create table public.share_resource_events (
  id          bigint generated always as identity primary key,
  share_id    uuid not null references public.project_shares (share_id) on delete cascade,
  node_id     text not null check (char_length(node_id) <= 64),
  res_index   int  not null check (res_index >= 0 and res_index < 1000),
  delta       int  not null check (delta in (-1, 1)),
  drained     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index share_resource_events_open_idx
  on public.share_resource_events (share_id) where not drained;

alter table public.share_resource_events enable row level security;

-- Owners: read and drain (update/delete) events on their own shares. No INSERT grant —
-- owner-side events don't exist; guests write only through the RPC.
create policy "owners manage events on their shares"
  on public.share_resource_events
  for all
  to authenticated
  using (
    exists (
      select 1 from public.project_shares ps
      where ps.share_id = share_resource_events.share_id
        and ps.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.project_shares ps
      where ps.share_id = share_resource_events.share_id
        and ps.owner_user_id = (select auth.uid())
    )
  );

grant select, update, delete on public.share_resource_events to authenticated;
revoke all on table public.share_resource_events from anon;
revoke all on table public.share_resource_events from public;

-- The guest write path: a tick on a delegated resource. Validation inside, boolean out —
-- unknown token, disabled share, bad shape, and over-cap all read the same quiet false.
create or replace function public.add_share_resource_event(
  share_token text,
  node        text,
  res_index   int,
  delta       int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  select share_id into sid from project_shares where token = share_token and enabled;
  if sid is null then return false; end if;
  if node is null or char_length(node) = 0 or char_length(node) > 64 then return false; end if;
  if res_index is null or res_index < 0 or res_index >= 1000 then return false; end if;
  if delta is null or delta not in (-1, 1) then return false; end if;
  -- Caps on the OPEN queue (#802/F1): a leaked link can't flood, a drained queue never
  -- ratchets. Per share, and per resource (a stuck guest can't wedge one counter's queue).
  if (select count(*) from share_resource_events e where e.share_id = sid and not e.drained) >= 500 then
    return false;
  end if;
  if (select count(*) from share_resource_events e
      where e.share_id = sid and not e.drained
        and e.node_id = node and e.res_index = add_share_resource_event.res_index) >= 100 then
    return false;
  end if;
  -- The lifetime abuse backstop.
  if (select count(*) from share_resource_events e where e.share_id = sid) >= 10000 then
    return false;
  end if;
  insert into share_resource_events (share_id, node_id, res_index, delta)
  values (sid, node, res_index, delta);
  return true;
end;
$$;

revoke all on function public.add_share_resource_event(text, text, int, int) from public;
grant execute on function public.add_share_resource_event(text, text, int, int) to anon, authenticated;

-- The guest read path (the overlay): undrained events for an enabled share, oldest first.
-- Guests see deltas only — no timestamps, no ids beyond what they themselves submitted.
create or replace function public.get_share_resource_events(share_token text)
returns table (node_id text, res_index int, delta int)
language sql
security definer
set search_path = public
stable
as $$
  select e.node_id, e.res_index, e.delta
  from share_resource_events e
  join project_shares ps on ps.share_id = e.share_id
  where ps.token = share_token and ps.enabled and not e.drained
  order by e.id;
$$;

revoke all on function public.get_share_resource_events(text) from public;
grant execute on function public.get_share_resource_events(text) to anon, authenticated;
