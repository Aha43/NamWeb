-- #802/F1: the suggestion cap counted HANDLED rows — adopt/dismiss set handled = true and
-- never delete, so every suggestion ever received counted toward 500 for the share's
-- lifetime. A busy legitimate share went permanently deaf, invisibly on BOTH sides (the
-- guest's quiet false is indistinguishable from a dead link; the owner's tray lists
-- unhandled only, so it looked empty and healthy).
--
-- The flood cap now bounds the OPEN tray (handled = false, 500 — resolving frees space);
-- a separate lifetime bound (10000) stays as the true-abuse backstop. Both still read as
-- the same quiet false to the guest (no oracle).

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
  -- The per-share cap (design Q3), on the OPEN tray: a leaked link can't flood the owner,
  -- and a tended tray never goes deaf (#802/F1).
  if (select count(*) from share_suggestions where share_id = sid and not handled) >= 500 then
    return false;
  end if;
  -- The lifetime abuse backstop.
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
