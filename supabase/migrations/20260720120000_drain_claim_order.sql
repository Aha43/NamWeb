-- #850: the concurrent-drain data-loss fix's server side.
--
-- `claim_drainable_events` now returns rows ORDERED BY id. Postgres can't ORDER BY an
-- UPDATE ... RETURNING directly, so wrap it in a CTE. The drain applies events in id order
-- (a FIFO the reducer's idempotency ledger relies on): a `-1` then `+1` on the same counter
-- must land in that order, and a re-processed leftover — which keeps its small, monotonic id —
-- must re-sort AHEAD of newer guest appends on the next claim. Unordered claims were a latent
-- gap; the ledger idempotency makes coherent ordering load-bearing.

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

revoke all on function public.claim_drainable_events(uuid, text[]) from public;
grant execute on function public.claim_drainable_events(uuid, text[]) to authenticated;
