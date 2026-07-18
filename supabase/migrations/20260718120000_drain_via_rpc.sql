-- #832/P1 (Codex): claiming and deleting drain events moves behind owner-scoped, kind-filtered
-- security-definer RPCs, and direct UPDATE/DELETE on the events table is REVOKED from
-- authenticated. The forward-compat filter (#830/F1) only protected the current bundle; an
-- owner client running OLD JS still has direct UPDATE/DELETE and would claim-and-delete answer
-- rows it can't apply. Moving the write path server-side makes such a client FAIL CLOSED at the
-- privilege boundary instead of consuming guest input it doesn't understand. SELECT stays (the
-- drain still reads leftovers and counts directly).

-- Claim the undrained events of a share whose KIND the caller supports, atomically. A row's
-- kind: 'delta' (counter tick) or 'answer' (question). A future kind is a new column/value that
-- simply won't match p_kinds, staying unclaimed for a newer client — server-enforced now.
create or replace function public.claim_drainable_events(p_share_id uuid, p_kinds text[])
returns setof public.share_resource_events
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from project_shares ps
    where ps.share_id = p_share_id and ps.owner_user_id = (select auth.uid())
  ) then
    return; -- not the owner: claim nothing
  end if;
  return query
  update share_resource_events e
     set drained = true
   where e.share_id = p_share_id
     and not e.drained
     and (case when e.delta is not null then 'delta' when e.answer is not null then 'answer' end) = any (p_kinds)
  returning e.*;
end;
$$;

-- Delete drained events the caller owns (the apply-then-delete ack, and the leftover sweep).
create or replace function public.delete_drained_events(p_ids bigint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from share_resource_events e
  using project_shares ps
  where e.id = any (p_ids)
    and ps.share_id = e.share_id
    and ps.owner_user_id = (select auth.uid());
end;
$$;

revoke update, delete on public.share_resource_events from authenticated;
grant execute on function public.claim_drainable_events(uuid, text[]) to authenticated;
grant execute on function public.delete_drained_events(bigint[]) to authenticated;
