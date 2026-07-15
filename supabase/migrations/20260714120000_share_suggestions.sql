-- Project sharing, stage 4 (#796): the suggestion box. Guests CAPTURE, never edit — a
-- suggestion lands here and the owner clarifies it into the workspace with the normal tools.
--
-- Two lessons applied from birth: suggestions hang off a STABLE share_id, not the token
-- (rotation UPDATEs the token PK in place — the #772/F6 correction), and the table gets ZERO
-- anon grants with explicit revokes (hosted default privileges auto-grant, caught by the
-- stage-1 prod probe). The single guest write path is the security-definer RPC below.

alter table public.project_shares
  add column share_id uuid not null default gen_random_uuid();
alter table public.project_shares
  add constraint project_shares_share_id_key unique (share_id);

create table public.share_suggestions (
  id          bigint generated always as identity primary key,
  share_id    uuid not null references public.project_shares (share_id) on delete cascade,
  guest_name  text check (char_length(guest_name) <= 100),
  body        text not null check (char_length(body) <= 2000),
  -- Optional: the guest-page pseudonymous id the suggestion is about (per-item anchors).
  node_id     text check (char_length(node_id) <= 64),
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.share_suggestions enable row level security;

-- Owners: read and resolve (handle/dismiss/delete) suggestions on their own shares. No
-- INSERT grant — owner-side suggestions don't exist; guests write only through the RPC.
create policy "owners manage suggestions on their shares"
  on public.share_suggestions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.project_shares ps
      where ps.share_id = share_suggestions.share_id
        and ps.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.project_shares ps
      where ps.share_id = share_suggestions.share_id
        and ps.owner_user_id = (select auth.uid())
    )
  );

grant select, update, delete on public.share_suggestions to authenticated;
revoke all on table public.share_suggestions from anon;
revoke all on table public.share_suggestions from public;

-- The guest write path: token in, validation inside, boolean out (no oracle beyond
-- "accepted or not" — unknown, disabled, over-cap, and oversized all read the same false).
create or replace function public.add_share_suggestion(
  share_token text,
  suggestion  text,
  guest       text default null,
  node        text default null
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
  if suggestion is null or char_length(trim(suggestion)) = 0 or char_length(suggestion) > 2000 then
    return false;
  end if;
  if guest is not null and char_length(guest) > 100 then return false; end if;
  if node is not null and char_length(node) > 64 then return false; end if;
  -- The per-share cap (design Q3): a leaked link can't flood the owner.
  if (select count(*) from share_suggestions where share_id = sid) >= 500 then return false; end if;
  insert into share_suggestions (share_id, guest_name, body, node_id)
  values (sid, nullif(trim(guest), ''), trim(suggestion), node);
  return true;
end;
$$;

revoke all on function public.add_share_suggestion(text, text, text, text) from public;
grant execute on function public.add_share_suggestion(text, text, text, text) to anon, authenticated;
