# NamWeb

> A fast, GTD-inspired **capture, triage, and focus** app for the web — on your phone, tablet, or
> laptop. This is **NAM**: standalone, complete, in daily use.

---

## What is NamWeb?

NamWeb is a full web app for getting things out of your head and acting on them: capture a thought,
clarify it into a **Next** action, a **Backlog** item, or a **Project**, then **Focus** through your
work one card at a time. Your work lives as a single node tree — projects, sub-projects, and actions
with tags, due dates, and prerequisites.

Create an account and go — or try the no-account **demo**. Capture, clarify, projects and a
workbench, tags and contexts, a calendar, Focus decks, bookmarks (with a Focus speed dial),
keyboard shortcuts, and undo all live here.

## Status

**Live.** NamWeb is in active use and shipping features continuously. See `CHANGELOG.md` for what's
landed and `docs/features/` for design docs.

## History: NamDesktop

NamWeb began as the web companion to [NamDesktop](https://github.com/Aha43/NamDesktop)
(Java/Swing) — the valuable phase one, which among other things proved the MCP flow (agree on a
project in chat, "make it in NAM", switch to execution mode). **NamDesktop is parked** since
2026-07-12: NamWeb is the primary surface, the Supabase config + migrations live in this repo
(`supabase/`, `npm run db:start` for the local stack), and a future desktop app will be redone
from both codebases' lessons rather than caught up.

See `CLAUDE.md` for the working conventions and the backend in detail.

## License

MIT — see [LICENSE](LICENSE).
