# Roadmap

What we want to do, what's done, and what we're not doing. Honest priorities — Claude should not silently expand this list, and the operator decides what's next.

The structure: **Up next** is the short ordered queue. **Substantive** is real features waiting for a slot. **Infrastructure** is what unlocks scale. **Nice-to-have** is interesting but not load-bearing. **Done** is the receipt of what's actually shipped (so this doc stays honest about progress).

---

## Up next

In rough recommended order. Each is one branch.

1. **Tax estimator** — apply federal + state (residence-aware) + NIIT + Medicare brackets to RSU vesting and Form 4 sales. Show "earned $X, kept ~$Y after tax." Cook's reported $74M? Closer to ~$35M kept. Form 4 ingestion is now site-wide (all 15 execs), so this lights up everywhere on first ship. Genuinely no consumer site does this. Most of the lift is the bracket calculator + residence inference; UI is small.

## Substantive (waiting for a slot)

- **Scheduled Form 4 re-fetches** — Form 4s are filed within 2 business days of a transaction. A daily or weekly cron (GitHub Actions or Vercel cron) keeps the data fresh. Idempotent importer means clean diffs. Without scheduling, the Form 4 numbers go stale within weeks.
- **Peer-network graph** — every proxy lists ~15-25 "compensation peers." Build a directed graph (Apple says Microsoft is a peer). Reveals tech/finance clusters and asymmetric self-perception. High craft, deep insight, no consumer site does it. Data is already in the proxies we've parsed.
- **Pay-vs-Performance scatter plot** — already have CAP for the 3 PEOs. Plot CAP-per-year vs. TSR over the same window, one dot per company. Identifies well-paid underperformers and underpaid overperformers. ESG investors care; nobody visualizes it for consumers.
- **Realized wealth tracker** — cumulative shares from Form 4 × current stock price = current paper position. Needs a stock price source (free options exist). The "Bloomberg billionaires" angle but for executives, derived from primary sources.
- **Severance / change-in-control scenarios** — every proxy discloses what an exec walks away with if fired without cause or if the company is acquired. "Cook gets $X if Apple is acquired tomorrow." Compelling factoid; rarely surfaced.
- **Year-over-year proxy diff** — what changed in this year's comp design vs. last year's? Peer group swap, new performance metric, severance update. Useful for analysts. Needs multi-year history.
- **Embeddable share cards** — per-exec PNGs that journalists can drop into stories. Comp summary + photo + attribution. Robinhood-card energy. Builds backlinks and brand.

## Infrastructure / scaling

- **DEF 14A scraper (Phase 2)** — annual proxy filings. The hard part is per-filer HTML variation in the SCT. Slots into `scripts/lib/` next to `form-4.ts`. Unlocks scaling to S&P 100 → S&P 500 without manual transcription. Realistic build: 20-40 hours.
- **More marquee companies (manual, near-term)** — Apple, Microsoft, Google, Nvidia, Meta. ~1 hour each via the existing add-company flow. Tim Cook's $74M is the canonical exec-comp story; the leaderboard needs Big Tech to be credible.
- **Public API / JSON endpoints** — researchers/journalists/academics. Trivial to add since data is already JSON on disk.
- **Vercel deploy** — site is shareable today. Hookup the existing GitHub repo + a domain. ~10 minutes.

## Nice-to-have

- **10b5-1 plan distinction on Form 4 transactions** — the XML has a flag. Adds context to whether a sale was pre-planned or discretionary.
- **Per-NEO comp-vs-peer scatter** — pulls in the proxy's peer group and shows where this exec lands in the distribution.
- **Multi-year wealth chart per exec** — paper position over time. Big visual; needs stock price history.
- **CEO-pay-ratio surfacing** — every proxy discloses median employee pay + CEO pay ratio. We have it; we don't display it prominently.
- **Anomaly-badge expansion** — more codified patterns (e.g. "first year as NEO," "interim role").

## Not doing (intentionally)

- **AI-generated commentary on whether comp is "fair."** Editorial risk; fails the never-fabricate spirit. The reader brings the judgment.
- **Crowdsourced corrections.** Moderation cost dominates at our scale. Revisit if traffic justifies it.
- **Newsletter / email digest.** Separate product; out of scope for the site.
- **Mobile app.** Premature.
- **Paid APIs (Equilar etc.).** Cost scales badly for a free site, and we don't learn the domain.
- **CEO pay ratio "if they earned the median in X minutes" gimmicks.** Already in proxies; not differentiated; tabloid.

## Done (this session)

In ship order, with merge commits:

- `cbcdcc7` — CrowdStrike (CRWD) bootstrap, 4 NEOs
- `8fe7aa5` — Company page + homepage refactor + pay-mix viz
- `99d4a16` — Branching convention codified in CLAUDE.md
- `7afabe1` (PR #1) — README rewrite
- `9beda7a` (PR #2) — Palo Alto Networks (PANW) bootstrap, 5 NEOs
- `1500718` (PR #3) — Perks breakdown (structured All Other Compensation)
- `410e9d0` (PR #4) — Anomaly badges (founder, former-officer, partial-year, etc.)
- `63c49ce` (PR #5) — Pay-vs-Performance toggle (later replaced)
- `475dff2` (PR #6) — Wikimedia photos (Arora, Kurtz)
- `e1457ca` (PR #7) — PvP readability fix: drop toggle, always show both numbers inline
- `a4d6759` (PR #8) — Press-use photos for 9 more execs (12/15 covered)
- `09e2450` — Common pitfalls section in CLAUDE.md
- `93a4ef3` (PR #9) — Form 4 foundation: SEC scraper infrastructure + Kurtz backfill (1,027 transactions)
- `a50a6ad` (PR #10) — Form 4 UI: Insider transactions section on exec page
- `ee0bf72` (PR #11) — Bar-in-row visual + peak-year callout on annual table
- `f6beaa1` — Bars on all viewports + spell out "shares"
- `5fd7a01` — Resuming-work section in CLAUDE.md
- `ac70bdb` (PR #12) — Beneficial ownership % on exec records and UI (15 execs backfilled)
- `eb7754e` (PR #13) — Form 4 backfill for the other 14 execs (~4,176 new transactions); widened CIK search to 300 + added `secCik` override for nicknames
- `f538e0d` (PR #14) — Form 4 scraper: filter by issuer CIK (fixed Arora's "305 shares" cross-company conflation; dropped 20,548 stale txn lines across 8 execs)
