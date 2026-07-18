-- The QUESTION resource (#827): guests answer a delegated yes/no on the shared page. Reuses
-- the events pipe (#809) — the same guest-append / owner-drain model, so questions ride the
-- exact machinery counters proved. An event is now EITHER a counter delta OR a question
-- answer (exactly one), so `delta` becomes nullable and `answer` joins it.

alter table public.share_resource_events
  alter column delta drop not null,
  add column answer text check (answer in ('yes', 'no', 'clear'));

-- Exactly one of delta / answer per row.
alter table public.share_resource_events
  add constraint share_resource_events_delta_xor_answer
  check ((delta is null) <> (answer is null));

-- The guest write path for an answer (mirror of add_share_resource_event). FOR UPDATE
-- serializes concurrent callers on the share (#823/P2); caps count the OPEN queue.
create or replace function public.add_share_answer_event(
  share_token text,
  node        text,
  res_index   int,
  answer      text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  select share_id into sid from project_shares where token = share_token and enabled for update;
  if sid is null then return false; end if;
  if node is null or char_length(node) = 0 or char_length(node) > 64 then return false; end if;
  if res_index is null or res_index < 0 or res_index >= 1000 then return false; end if;
  if answer is null or answer not in ('yes', 'no', 'clear') then return false; end if;
  if (select count(*) from share_resource_events e where e.share_id = sid and not e.drained) >= 500 then
    return false;
  end if;
  if (select count(*) from share_resource_events e
      where e.share_id = sid and not e.drained
        and e.node_id = node and e.res_index = add_share_answer_event.res_index) >= 100 then
    return false;
  end if;
  if (select count(*) from share_resource_events e where e.share_id = sid) >= 10000 then
    return false;
  end if;
  insert into share_resource_events (share_id, node_id, res_index, answer)
  values (sid, node, res_index, answer);
  return true;
end;
$$;

revoke all on function public.add_share_answer_event(text, text, int, text) from public;
grant execute on function public.add_share_answer_event(text, text, int, text) to anon, authenticated;

-- The guest overlay read now carries the answer too (return shape changed → drop + recreate).
drop function if exists public.get_share_resource_events(text);
create function public.get_share_resource_events(share_token text)
returns table (node_id text, res_index int, delta int, answer text)
language sql
security definer
set search_path = public
stable
as $$
  select e.node_id, e.res_index, e.delta, e.answer
  from share_resource_events e
  join project_shares ps on ps.share_id = e.share_id
  where ps.token = share_token and ps.enabled and not e.drained
  order by e.id;
$$;

revoke all on function public.get_share_resource_events(text) from public;
grant execute on function public.get_share_resource_events(text) to anon, authenticated;
