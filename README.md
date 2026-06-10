# NamWeb

> The web companion to [NamDesktop](https://github.com/Aha43/NamDesktop) — a fast, ubiquitous
> capture and triage surface for when you are away from your main machine.

---

## What is NamWeb?

NamDesktop is a local-first, GTD-inspired desktop app where your work lives as a single node
tree. NamWeb is its **lightweight companion**: the thing you reach for on a phone or tablet to
capture a thought, see what is next, and tick something done — always in sync with the desktop
through the shared cloud backend.

It is **not** a replacement for the desktop app. Serious project management (workbench, drag
ordering, tags, Mission Control, templates) stays on the desktop. NamWeb is deliberately small:
fast to open, fast to use, always in sync.

## Status

**Bootstrapping.** This repo currently holds project conventions and the design thread carried
over from NamDesktop. The frontend stack and first epics (web API, web app) are decided in a
planning session before implementation begins — see `docs/features/web-app/design.md`.

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
