-- Publish `workspaces` to the Supabase Realtime change feed so clients can react
-- live to row updates (NamWeb SPA reflecting MCP/desktop/other-tab writes — P3 of
-- the NamWeb remote-MCP epic). Replica identity stays default (PK): subscribers use
-- a signal-then-pull pattern, so the old-row column set in the change payload is
-- irrelevant. RLS still scopes deliveries to the owning user. (#371)

alter publication supabase_realtime add table workspaces;
