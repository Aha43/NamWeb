-- delete_my_account: lets an authenticated user permanently delete their own
-- account (NamWeb account-onboarding P1a). SECURITY DEFINER so it can remove the
-- auth.users row, but scoped strictly to auth.uid() so a user can only delete
-- *themselves*. Removes their workspaces first (the FK has no ON DELETE CASCADE),
-- then the auth user (which cascades the auth-internal rows). Hard delete — the
-- agreed semantics; local desktop files on disk are untouched.

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
  delete from public.workspaces where owner_user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
