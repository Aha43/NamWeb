-- Cascade a workspace when its owning auth user is deleted (#847). Until now the inline FK
-- workspaces.owner_user_id → auth.users had NO on-delete behavior (NO ACTION), so deleting a
-- workspace-owning user failed on the FK. project_shares already cascades (and its
-- share_suggestions / share_resource_events cascade transitively), so workspaces was the only
-- gap — which broke NamAdmin's admin-side user delete (auth.admin.deleteUser) and would have
-- broken any auth-user delete that relied on the DB to clean up.
--
-- CONVENTION going forward: any table referencing auth.users must ON DELETE CASCADE, or an
-- admin user-delete breaks silently on the FK.

alter table public.workspaces
  drop constraint workspaces_owner_user_id_fkey,
  add constraint workspaces_owner_user_id_fkey
    foreign key (owner_user_id) references auth.users (id) on delete cascade;

-- delete_my_account (20260616120000) deleted workspaces explicitly BEFORE the auth user because
-- the FK didn't cascade. That's now redundant — delete the auth user and workspaces (plus
-- project_shares → suggestions/events) cascade from it. Simplified to the single mechanism.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = uid; -- workspaces + shares cascade via their FKs
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
