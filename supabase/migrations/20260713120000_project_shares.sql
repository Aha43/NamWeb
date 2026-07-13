-- Project sharing, stage 1 (the 2.0.0 epic — docs/features/project-sharing/design.md).
--
-- A share is a sanitized, versioned SNAPSHOT of one project, keyed by a high-entropy secret
-- token (the capability URL). The owner's client writes it at publish time; guests read it —
-- and ONLY it — through the security-definer RPC below. The workspace document never becomes
-- publicly readable: guest-visible data is physically separate by construction.

create table public.project_shares (
  token         text primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  project_id    text not null,
  content       jsonb not null,
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One share per project per owner (rotation replaces the row's token, not adds a row).
  unique (owner_user_id, project_id)
);

alter table public.project_shares enable row level security;

-- Owners: full CRUD on their own shares.
create policy "owners manage own shares"
  on public.project_shares
  for all
  to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

grant select, insert, update, delete on public.project_shares to authenticated;

-- Guests: NO table access at all (anon gets no grants → no enumeration surface, no RLS
-- subtleties to get wrong). The single read path is this RPC: exactly one row, by exact
-- token, only while enabled. Returns null for unknown/disabled alike — no oracle.
create or replace function public.get_project_share(share_token text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select content
  from public.project_shares
  where token = share_token
    and enabled;
$$;

revoke all on function public.get_project_share(text) from public;
grant execute on function public.get_project_share(text) to anon, authenticated;
