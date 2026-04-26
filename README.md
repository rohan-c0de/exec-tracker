# exec-tracker

A public-facing website that tracks US executive compensation and equity, sourced directly from each company's annual proxy statement (Form DEF 14A) on SEC EDGAR. Every figure is traceable to its filing.

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript · Supabase (deferred to Phase 2) · Tailwind v4 · Vercel hosting.

**Status:** Phase 1 — manually curated data for a small set of marquee companies. The data layer reads JSON files from `data/` at request time. Supabase wiring is deferred.

## Quick start

```bash
git clone https://github.com/rohan-c0de/exec-tracker.git
cd exec-tracker
npm install
cp .env.example .env.local   # then fill in the values — see below
npm run dev
```

Open http://localhost:3000.

## Environment variables

The canonical list lives in [`.env.example`](.env.example). Copy it to `.env.local` (gitignored) and fill in:

| Variable | Required for | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Phase 2 (Supabase reads) | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Phase 2 (Supabase reads) | same place |
| `SUPABASE_SERVICE_ROLE_KEY` | Phase 2 (server-only writes) | same place — **never commit, never expose to the client** |
| `SEC_USER_AGENT` | Phase 2 scrapers | Set to `"exec-tracker your-email@example.com"` — SEC requires a contact in the User-Agent |

For Phase 1 (current state) none of these are strictly required to run the site, since data is read from `data/*.json`. They become required once the EDGAR scraper and Supabase import scripts come online.

Production values live in Vercel's project settings, not in any file.

## Project structure

```
app/                # Next.js App Router routes (public UI)
components/         # shared React components
lib/                # Zod schemas, fs-based data loaders, helpers
data/companies/     # {ticker}.json — company profile + NEO list
data/execs/         # {ticker}/{exec-slug}.json — per-exec comp history
supabase/           # migrations (Phase 2)
scripts/            # Phase 2 scrapers and importers
public/             # static assets (incl. exec headshots)
```

For deeper conventions, invariants, and the project's domain primer (NEO, DEF 14A, SCT, etc.), see [`CLAUDE.md`](CLAUDE.md).

## Dev commands

- `npm run dev` — local Next server
- `npm run build` — production build
- `npm run lint` — ESLint
