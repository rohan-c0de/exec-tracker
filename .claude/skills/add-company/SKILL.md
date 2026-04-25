---
name: add-company
description: Bootstrap a new company's exec-comp records in exec-tracker. Use when I say "add company TICKER", "bootstrap a new company", "add AAPL" or similar phrasing with a stock ticker. Creates JSON skeletons under data/, validates against the Zod schemas, and verifies the public routes render.
---

# Add a company

Use this when the operator wants to onboard a new public company (e.g. Apple, Microsoft, Nvidia) into the tracker. Phase 1 workflow — manual curation from the company's most recent DEF 14A proxy, JSON-on-disk only (no Supabase push yet).

## Source of truth

Before writing any JSON, open `lib/schemas.ts`. The Zod schemas there are authoritative. If `.claude/rules/data.md` disagrees with the schemas, the schemas win. Mirror field names exactly — typos won't validate.

## Inputs

- Ticker symbol (e.g. `AAPL`). Required.
- Filing URL for the most recent DEF 14A. Ask the operator if not provided. Do not proceed without it.

## Pacing

Pause for go/no-go after each meaningful step — present what you're about to write, get a thumbs-up, then write. Specifically: pause after (a) the company file is drafted, (b) the first exec file is drafted (so the operator can sanity-check your reading of the SCT before you batch through the rest), and (c) the dev-server preview is up.

## Steps

1. **Confirm the ticker and pull cover-page facts from the filing.**
   From the DEF 14A cover page: legal name, exchange, 10-digit CIK (zero-padded), fiscal year end (`MM-DD`). Do not guess any of these.

2. **Draft the company file** at `data/companies/{ticker-lower}.json` per `CompanySchema`:
   - `ticker` (1–5 uppercase)
   - `legalName`, optional `displayName`
   - `exchange`: one of `"NASDAQ" | "NYSE" | "AMEX" | "OTHER"`
   - `secCik`: 10-digit zero-padded string
   - `fiscalYearEndMonthDay`: `MM-DD`
   - optional `websiteUrl`
   - `neoSlugs`: array of slugs you'll create in step 4. **Order is load-bearing** — it controls homepage display order. Use the proxy SCT order: CEO → current CFO → other NEOs by total → former officers. Not alphabetical.

   There is no `execs[]` field on the company file. NEO data lives only in the per-exec files; the company file just references them by slug.

   Pause for operator review.

3. **Create the exec directory** at `data/execs/{ticker-lower}/`. Empty for now.

4. **For each NEO listed in the proxy's Summary Compensation Table:**
   Create `data/execs/{ticker-lower}/{slug}.json` per `ExecSchema`:
   - `ticker`, `slug`, `name`, `role` (use the proxy's exact title)
   - optional `bio`, `photoPath`, `photoCredit`
   - `compRecords[]`: one entry per fiscal year disclosed (typically 3)

   For the **first** NEO, draft the file and pause for operator review before continuing — this catches misreadings of the SCT before they propagate.

   Each `compRecords[]` entry uses these field names exactly (note `nonEquityIncentiveCents` and `allOtherCompCents` — easy to get wrong):
   ```
   fiscalYear, fiscalYearEnd,
   salaryCents, bonusCents,
   stockAwardsCents, optionAwardsCents,
   nonEquityIncentiveCents, pensionAndNqdcCents, allOtherCompCents,
   totalCents,
   footnotes: [],
   source: { filingUrl, accessionNumber, formType, filedDate, periodOfReport }
   ```

   All cents fields are non-negative integers. No `null`, no floating-point dollars.

   Slugs match `/^[a-z0-9-]+$/`. Prefer the public form (`tim-cook`, not `timothy-d-cook`). Slugs become URLs and should not change after publishing.

5. **Source block — every field required.** For each comp record:
   - `filingUrl`: full URL to the proxy on sec.gov.
   - `accessionNumber`: format `##########-##-######` (e.g. `0001713683-25-000198`).
   - `formType`: literal string `"DEF 14A"`.
   - `filedDate`, `periodOfReport`: ISO `YYYY-MM-DD`.

6. **Exact totals check.** For each comp row, verify in cents:
   `salary + bonus + stockAwards + optionAwards + nonEquityIncentive + pensionAndNqdc + allOtherComp === total`
   Exact equality. If it doesn't match, re-read the filing — you likely transcribed a number wrong. The only acceptable mismatch is a proxy that itself rounds or restates; in that case, prefer the proxy's stated `totalCents` and add a `footnotes[]` entry explaining the discrepancy.

7. **Footnote anomalous years.** If a year's total looks unusual relative to its neighbors (e.g. salary-only after a $50M+ multi-year grant), write a `footnotes[]` entry explaining why. Without context, anomalies look like bugs. Mirror the proxy's own footnotes where they explain the structure.

8. **Photos (optional).** If you have a usable photo, save it to `public/execs/{ticker-lower}/{slug}.{png|jpg|jpeg|webp}`, set `photoPath` to the matching `/execs/{ticker-lower}/{slug}.{ext}` path, and set `photoCredit` (required unless the photo is original work). If no photo, omit both fields — the `Avatar` component falls back to initials.

9. **Validate.** The schemas run on every `loadCompany` / `loadExec` call, so the easiest validation is `npm run dev` and hitting the routes. Any Zod failure surfaces in the server log.

10. **Verify the rendered routes.**
    - `/` — homepage lists all execs across all companies; the new ones should appear with their FY totals and the company's ticker badge.
    - `/execs/{ticker-lower}/{slug}` — per-exec page, one per NEO.

    There is no `/companies/{ticker}` route yet. Don't try to visit it.

    If anything 404s or throws, debug before reporting done.

11. **Report to the operator.** List files created, NEOs added with their FY totals, and the local preview URLs for spot-checking.

## Do not

- Invent comp numbers, dates, or accession numbers to fill gaps. Missing data stays missing.
- Skip the totals check (step 6). Silently-wrong totals are the #1 manual-curation risk.
- Push to Supabase. Phase 1 is JSON-on-disk; the import script under `scripts/` does not exist yet and writing one is out of scope for this skill.
- Commit until the operator has eyeballed the rendered pages.
