# NamWeb

> A fast, GTD-inspired **capture, triage, and focus** app for the web — on your phone, tablet, or
> laptop. Standalone and usable on its own; optionally syncs with [NamDesktop](https://github.com/Aha43/NamDesktop).

---

## What is NamWeb?

NamWeb is a full web app for getting things out of your head and acting on them: capture a thought,
clarify it into a **Next** action, a **Backlog** item, or a **Project**, then **Focus** through your
work one card at a time. Your work lives as a single node tree — projects, sub-projects, and actions
with tags, due dates, and prerequisites.

You can use NamWeb entirely on its own (create an account and go — or try the no-account
**demo**). When you also run **NamDesktop**, the two stay in sync through a shared cloud backend, so
the same workspace is live on your desktop and on the web.

NamDesktop remains the heavier desktop surface for some power workflows (e.g. richer Mission
Control), but NamWeb is a first-class product, not a thin remote: capture, clarify, projects and a
workbench, tags and filtering, Focus, bookmarks, keyboard shortcuts, and undo all live here.

## Status

**Live.** NamWeb is in active use and shipping features continuously. See `CHANGELOG.md` for what's
landed and `docs/features/` for design docs.

## Relationship to NamDesktop

NamWeb and NamDesktop are **separate repositories** that share **only the Supabase backend
contract**, not application code:

```
NamDesktop (Java/Swing)  ──push/pull──▶  Supabase  ◀──  NamWeb (this repo)
                                            ▲
                              migrations live in NamDesktop/supabase
                                  (single source of truth)
```

See `CLAUDE.md` for the working conventions and the backend relationship in detail.

## License

MIT — see [LICENSE](LICENSE).
