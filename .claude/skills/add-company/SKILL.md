---
name: add-company
description: Bootstrap a new company's exec-comp records in exec-tracker. Use when I say "add company TICKER", "bootstrap a new company", "add AAPL" or similar phrasing with a stock ticker. Creates JSON skeletons under data/, wires up the Supabase import, and verifies the public route renders.
---

# Add a company

Use this when the operator wants to onboard a new public company (e.g. Apple, Microsoft, Nvidia) into the tracker. Phase 1 workflow — assumes manual curation from the company's most recent DEF 14A proxy.

## Inputs

- Ticker symbol (e.g. `AAPL`). Required.
- Filing URL for the most recent DEF 14A — ask the operator for this if not provided. Do not proceed without it.

## Steps

1. **Confirm the ticker and pull basic facts from the filing.** Ask the operator for the DEF 14A URL. Pull legal name, fiscal year end, CIK from the filing's cover page. Do not guess.

2. **Create the company file** at `data/companies/{ticker-lower}.json` using the schema in `.claude/rules/data.md`. Include `ticker`, `legalName`, `displayName`, `sector`, `fiscalYearEnd`, `cik`, and an empty `execs: []` array to be filled in step 4.

3. **Create the exec directory** at `data/execs/{ticker-lower}/`. Leave it empty for now; step 4 populates it.

4. **For each Named Executive Officer (top 5 per the proxy's Summary Compensation Table):**
   - Add an entry to the company's `execs[]` array with `slug`, `name`, `title`, `since`.
   - Create `data/execs/{ticker-lower}/{exec-slug}.json` with the full comp history from the proxy (typically 3 fiscal years disclosed). Every row cites the filing URL.
   - Slugs are stable public URLs — pick carefully.

5. **Sanity check the totals.** For each comp row, verify that `salary + bonus + stockAwards + optionAwards + neip + pensionAndNqdc + allOther === total` (within rounding). If it doesn't, re-read the filing before writing — you probably transcribed a number wrong.

6. **Import to Supabase.** Run `tsx scripts/import/add-company.ts {ticker}`. If the import script doesn't exist yet (early Phase 1), flag this to the operator — it needs to be written before data goes live.

7. **Verify the public route.** Start `npm run dev` if not already running, then visit `/companies/{ticker-lower}`. If the dynamic route doesn't exist yet, flag to the operator — routing scaffold needs to come first.

8. **Report to the operator:** list the files created, the NEOs added, and a link to the local preview URL.

## Do not

- Invent comp numbers to fill gaps. Missing data stays missing.
- Skip step 5. Transcription errors are the #1 risk in manual curation and silently wrong totals will ship to production.
- Commit the files until the operator has eyeballed the public page.
