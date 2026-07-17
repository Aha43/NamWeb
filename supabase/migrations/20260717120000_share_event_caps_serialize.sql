-- #823/P2 (Codex): the event caps were check-then-insert races — parallel calls on a leaked
-- token could all observe a count below the limit and insert past the advertised bounds.
-- Locking the share row (FOR UPDATE) serializes concurrent inserts per share: the counts
-- and the insert become atomic per token. Same fix applied to the suggestion RPC, which
-- carried the identical race.

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
  -- FOR UPDATE serializes concurrent callers on this share (#823/P2).
  select share_id into sid from project_shares where token = share_token and enabled for update;
  if sid is null then return false; end if;
  if node is null or char_length(node) = 0 or char_length(node) > 64 then return false; end if;
  if res_index is null or res_index < 0 or res_index >= 1000 then return false; end if;
  if delta is null or delta not in (-1, 1) then return false; end if;
  if (select count(*) from share_resource_events e where e.share_id = sid and not e.drained) >= 500 then
    return false;
  end if;
  if (select count(*) from share_resource_events e
      where e.share_id = sid and not e.drained
        and e.node_id = node and e.res_index = add_share_resource_event.res_index) >= 100 then
    return false;
  end if;
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
  -- FOR UPDATE serializes concurrent callers on this share (#823/P2).
  select share_id into sid from project_shares where token = share_token and enabled for update;
  if sid is null then return false; end if;
  if suggestion is null or char_length(trim(suggestion)) = 0 or char_length(suggestion) > 2000 then
    return false;
  end if;
  if guest is not null and char_length(guest) > 100 then return false; end if;
  if node is not null and char_length(node) > 64 then return false; end if;
  if (select count(*) from share_suggestions where share_id = sid and not handled) >= 500 then
    return false;
  end if;
  if (select count(*) from share_suggestions where share_id = sid) >= 10000 then
    return false;
  end if;
  insert into share_suggestions (share_id, guest_name, body, node_id)
  values (sid, nullif(trim(guest), ''), trim(suggestion), node);
  return true;
end;
$$;

revoke all on function public.add_share_suggestion(text, text, text, text) from public;
grant execute on function public.add_share_suggestion(text, text, text, text) to anon, authenticated;
