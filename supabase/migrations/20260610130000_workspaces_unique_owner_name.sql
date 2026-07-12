-- With dev mode syncing to its own row (#350), each user has multiple workspace
-- rows keyed by name. Enforce the (owner, name) key the sync engine relies on.

create unique index workspaces_owner_name_key on workspaces (owner_user_id, name);
