-- Workspace documents for cloud sync (Supabase PoC, #348).
-- One row per (user, workspace name); the whole NamDesktop workspace JSON
-- lives in `document`. `version` drives optimistic conflict detection:
-- updates PATCH with `version=eq.<expected>` and treat 0 rows updated as a conflict.

create table workspaces (
  id             uuid        primary key default gen_random_uuid(),
  owner_user_id  uuid        not null references auth.users(id),
  name           text        not null default 'default',
  version        bigint      not null default 1,
  document       jsonb       not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table workspaces enable row level security;

create policy "Users own their workspaces"
  on workspaces for all
  using  (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);
