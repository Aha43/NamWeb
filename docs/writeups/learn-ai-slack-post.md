*Built a real web app by directing AI — here's what that actually looked like* 🧵

Over the last ~2 weeks I built *NamWeb*, the web companion to my desktop app (NamDesktop, a Getting Things Done / GTD app). The interesting part for this channel isn't the app — it's that I wrote *zero lines of code by hand*. I drove the whole thing with Claude Code (agentic CLI). Some real numbers:

• *171 merged PRs, 259 commits, ~23k lines of TS/TSX, in 15 days*
• React + TypeScript + Vite, TanStack Query, Tailwind, Vitest + Testing Library
• Talks straight to Supabase (same backend as the desktop app) — no API of my own
• Full mocked e2e journeys, typecheck + lint + unit suite gating every PR

*What made it work (the actual lessons):*

1. *Treat it like a real eng process, not a chat.* Every change starts as a GitHub issue → feature branch → PR → Cloudflare preview link. The AI follows that loop autonomously. The discipline that makes a human team productive makes an agent productive for the same reasons.

2. *"Auto-sprints."* I batch 4–5 related issues, agree the plan, then let it run the whole set straight through — one branch + one PR per issue, no pausing between them. It only stops for a genuine blocker or an unresolved design call. I come back to N PRs, each with test notes and a live preview URL.

3. *A persistent project doc + memory beats re-explaining.* A `CLAUDE.md` encodes the workflow, the stack, the delivery rules, the definition of done. The agent reads it every session, so context doesn't decay. This is the single highest-leverage thing — most "the AI did something dumb" moments are really "I never wrote down the constraint."

4. *Tests + a preview URL are the trust mechanism.* I don't read every diff. I read the PR description, click the Cloudflare preview, and exercise it. Green suite + a thing I can actually click is what lets me move at PR-per-hour pace without it turning into slop.

5. *The bottleneck moved from typing to deciding.* My job became: scoping issues well, making the design calls it escalates, and reviewing behavior over code. Higher-altitude work, and honestly more of it than I expected.

*Try it:* there's a no-login demo — https://usenam.app/demo — populated workspace, capture → clarify → focus loop, reset button. Built by AI, shipped to a real preview pipeline.

Happy to go deeper on the auto-sprint setup or the `CLAUDE.md` if anyone wants — it ports to basically any repo.
