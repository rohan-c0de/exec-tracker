# exec-tracker

A public-facing website that tracks US executive compensation and equity. Helps readers browse, compare, and understand how top executives at public companies are paid.

- **Stack:** Next.js 16 (App Router) + React 19 + TypeScript · Supabase (Postgres + SSR auth) · Tailwind v4 · Playwright + cheerio for scrapers · Vercel hosting.
- **Differentiator:** UI quality. Existing exec-comp tools (Equilar, AFL-CIO Executive Paywatch, SEC.gov directly) are functional but ugly. This site aims to make the data legible and beautiful. Peer comparison is a secondary angle, deferred until core data surface is proven.
- **Audience:** Public / external readers. Not gated.

## Resuming work

At the start of any new session, before doing substantive work: run `git log --oneline -20` to see recent commits (commit messages and merged PRs are detailed by convention and are the source of truth for what shipped), read `ROADMAP.md` for next-step intent, and ask the operator what they want to work on rather than guess. Conversation context from prior sessions does not carry over; the durable record is on disk.

## User context

Project owner also maintains `cc-coursemap` (sibling dir at `../cc-coursemap/`, live at communitycollegepath.com). Same stack, same operator, similar scraper-heavy + public-UI shape. When in doubt about conventions (env vars, Supabase client setup, scraper patterns, per-entity file layout), check how cc-coursemap does it and follow that. Do not blindly copy Virginia/education-specific code — the shape generalizes, the content does not.

Owner is learning the exec-comp domain. Explain unfamiliar terms inline when you use them; don't assume finance/SEC literacy.

## Current phase

**Phase 1 (now):** Manual curation of ~20-50 marquee execs (FAANG CEOs, household names). Hand-author JSON files under `data/` citing the source DEF 14A filing URL. Build a killer UI on top of that. Ship a believable MVP before investing in scrapers.

**Phase 2 (later):** SEC EDGAR DEF 14A scraper. Parsing the Summary Compensation Table from proxies is the hard part — HTML format varies across filers. Defer until UI is proven.

**Not doing:** Paid APIs (Equilar etc.). Cost scales badly for a free public site and we don't learn the domain.

## Domain primer

Use these terms correctly and explain them to readers in the UI:

- **NEO — Named Executive Officer.** SEC rule defines these as the CEO, CFO, and the next three most-highly-compensated officers. Proxies disclose comp for these 5 people per company per year.
- **DEF 14A — the annual proxy statement.** Public companies file this before the annual meeting. Contains the Summary Compensation Table (SCT) and related disclosures. This is our primary source.
- **Summary Compensation Table columns:** Salary, Bonus, Stock Awards, Option Awards, Non-Equity Incentive Plan Compensation (NEIP), Change in Pension Value and NQDC earnings, All Other Compensation, Total. Report in USD.
- **Grant-date fair value vs. realized pay.** SCT shows grant-date fair value of equity (an accounting number, what was granted). "Realized pay" is what was actually vested/exercised — often very different, often much higher. Don't conflate them.
- **TSR — Total Shareholder Return.** Stock price appreciation + dividends over a period. Used in pay-vs-performance disclosure.
- **Fiscal year.** Comp is reported per fiscal year, which for many companies is not the calendar year (e.g. Apple FY ends in September). Always store fiscal-year dates explicitly.

## File conventions

```
exec-tracker/
├── CLAUDE.md                   # this file
├── .claude/
│   ├── rules/                  # path-scoped instructions
│   └── skills/                 # repeating procedures
├── app/                        # Next.js 16 App Router (public UI)
├── components/                 # shared React components
├── lib/                        # shared TS utilities, Supabase client, schemas
├── data/
│   ├── companies/              # {ticker}.json — company profile + NEO list
│   └── execs/                  # {ticker}/{exec-slug}.json — per-exec comp history
├── scripts/
│   ├── scrapers/               # EDGAR fetch + DEF 14A parsers (Phase 2)
│   └── import/                 # push data/*.json → Supabase
├── supabase/
│   └── migrations/             # never edit a committed migration, write a new one
└── public/
```

Directory names are convention — Claude understands them because they're described here, not because they're reserved.

## Invariants — do not violate

1. **Never fabricate compensation numbers.** Every comp record must cite a `source.filingUrl` pointing at the SEC filing. If you don't have a citation, don't write the record.
2. **Never edit a committed Supabase migration.** Write a new migration to correct or extend schema. Migrations are an append-only ledger.
3. **Scrapers must identify themselves to SEC.** Every EDGAR request sets `User-Agent: "exec-tracker <contact-email>"` (SEC requires contact info) and rate-limits to ≤10 req/sec. Violating this gets our IP banned.
4. **UI quality is a first-class concern, not polish-later.** The brand hook is "exec comp data that is actually pleasant to read." Hasty, ugly UI defeats the whole project. Treat design choices with the same care as data integrity.
5. **Store currency unambiguously.** Use integer cents (`salaryCents: 125000000`) or an explicit `{ amount, currency }` pair. Never store floating-point dollars.
6. **Fiscal year, not calendar year.** Record `fiscalYear: 2023` alongside `fiscalYearEnd: "2023-09-30"` where relevant.

## Common pitfalls

Patterns that have already burned us. Add to this section only when a session reveals a trap that would have changed Claude's earlier behavior in that same session — don't run end-of-session retros for their own sake, and don't add speculative or "nice to have" entries.

- **Anomalous data is usually the story, not a bug.** Before flagging a record as wrong (e.g. a CEO's $30K total, a $0 stock awards line, a salary that looks too low), check the bio/footnote first, then the cited proxy. Only flag if both contradict the data. Founder-CEOs taking symbolic salaries, voluntary salary forgo, multi-year cliff grants, partial-year hires, and former-officer transitions all produce numbers that look broken but aren't.
- **For comparing two views of the same data, prefer always-show-both over a toggle.** Toggles hide one of the two numbers behind a click and force comparison-by-flipping. The Reported vs Compensation Actually Paid feature went through this exact iteration: built as a URL-driven toggle, redesigned to inline dual-line display, immediately more legible.
- **Form 4 ingestion must filter by issuer CIK, not just insider CIK.** A senior exec who held a Section 16 role at a prior public company (Arora at Google before PANW; Jenkins at Barracuda before PANW) keeps the same insider CIK across companies, so their submissions feed contains Form 4s pointing at *both* issuers. Aggregating by insider alone wildly distorts the new company's exec page — Arora's "Currently held: 305 shares" was a 2014 Google direct holding leaking through as the most-recent Form 4. The scraper now takes an `issuerCik` and drops mismatched filings; always pass it. Note: even after filtering, Form 4's `postTransactionShares` can understate proxy beneficial ownership because it's specific to one ownership track (direct vs. trust vs. exercisable options) — that's a real-world reconciliation problem, not a bug.

## Environment variables

Source of truth: `.env.example`. Local dev uses `.env.local` (gitignored). Vercel holds production values.

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose to client)
- `SEC_USER_AGENT` (e.g. `"exec-tracker you@example.com"`)

## Dev commands

- `npm run dev` — local Next server
- `npm run build` · `npm run lint`
- `tsx scripts/import/add-company.ts <ticker>` — push a curated company's JSON to Supabase (Phase 1)
- `tsx scripts/scrapers/edgar-def14a.ts <ticker> <year>` — pull a proxy (Phase 2, stubbed until then)

## Branching and commits

This project follows GitHub Flow.

- **`main` is always deployable.** Every commit on `main` should leave the site in a working state. Don't push WIP, broken builds, or half-done features to `main`.
- **One branch per change.** Before starting non-trivial work, create a feature branch off `main` (`git checkout -b <name>`). Branch names are present-tense and describe the change: `add-crowdstrike`, `company-page`, `fix-chaudhry-footnote`. Don't bundle unrelated work on the same branch.
- **Trivial single-file edits** (typo fixes, doc tweaks, README updates) can go straight to `main`. Anything that touches code, data, or schema should be on a branch.
- **Merge after approval.** When a branch is ready, the operator approves, then merge with `git checkout main && git merge --no-ff <branch> && git branch -d <branch>`. `--no-ff` preserves the branch's existence in the history, which is useful for later reverts.
- **No remote yet.** When a GitHub remote is added, branches will be pushed and merged via PR. Until then, all merges are local.

### Claude's defaults

- Before starting work, propose a branch name and pause for the operator to confirm. Don't auto-create.
- Do not merge to `main` without explicit operator approval, even if all the per-step approvals during the work were given.
- Never force-push, never rebase a branch that has been shared, never delete branches with unmerged work.

### Standard branch lifecycle (the pacing the operator expects)

For any non-trivial change, follow this sequence verbatim, pausing at each `→ pause` for operator go/no-go:

1. **Propose branch name** (present-tense, scope-descriptive: `add-crowdstrike`, `company-page`). → pause
2. `git checkout -b <name>` from up-to-date `main`.
3. Do the work, committing as you go. For multi-step work, keep the operator's existing per-step pacing (present plan → pause before each meaningful step).
4. When the work is ready, **propose the merge path** — local merge vs. push + PR. Recommend PR when the operator is learning the workflow or when the diff is non-trivial. → pause
5. If PR path: `git push -u origin <branch>` → `gh pr create` with a real summary + test plan. Default to CLI merge (`gh pr merge <#> --merge --delete-branch`) once the operator approves the PR — only use the GitHub UI merge if the operator specifically asks for it.
6. After merge: `git checkout main && git pull && git fetch --prune` to sync local main and clean stale tracking refs. Verify local branch is gone (auto-deleted by `gh pr merge --delete-branch`).

For trivial single-file doc edits (typo, README tweak), commit straight to `main` — no branch, no PR. Code, data, and schema changes always go through the full lifecycle.

## Environment quirks

**This is NOT the Next.js you were trained on.** Next 16 has breaking changes vs. training-cutoff Next.js (caching, async params, default behaviors). Before writing routing, caching, or server-component code, read the relevant page in `node_modules/next/dist/docs/`. Heed deprecation notices. Same warning as cc-coursemap — the same bugs bite twice if you forget.
