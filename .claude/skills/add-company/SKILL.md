---
name: add-company
description: Bootstrap a new company's exec-comp records in exec-tracker. Use when I say "add company TICKER", "bootstrap a new company", "add AAPL" or similar phrasing with a stock ticker. Creates JSON skeletons under data/, validates against the Zod schemas, and verifies the public routes render.
---

# Add a company

Use this when the operator wants to onboard a new public company (e.g. Apple, Microsoft, Nvidia) into the tracker. Phase 1 workflow — manual curation from the company's most recent DEF 14A proxy, JSON-on-disk only (no Supabase push yet).

## Source of truth

Before writing any JSON, open `lib/schemas.ts`. The Zod schemas there are authoritative. If `.claude/rules/data.md` disagrees with the schemas, the schemas win. Mirror field names exactly — typos won't validate.

## Inputs

- **Ticker symbol** (e.g. `AAPL`). Required.
- **DEF 14A filing URL** — do not ask the operator. Look it up yourself via EDGAR (see Step 0).

## Pacing

Pause for go/no-go after each meaningful step — present what you're about to write, get a thumbs-up, then write. Specifically: pause after (a) Step 0 surfaces the proxy URL, (b) the company file is drafted, (c) the first exec file is drafted (so the operator can sanity-check your reading of the SCT before you batch through the rest), and (d) the dev-server preview is up.

## What "complete" means for one exec record

A complete `data/execs/{ticker}/{slug}.json` includes every field the rest of the codebase reads. Skipping these means the new company will look anemic next to the existing four (CRWD, PANW, ZS, S) and require follow-up PRs to backfill. Required fields per record:

| Field | Source in proxy |
|---|---|
| Cover-page identity (`name`, `role`, `bio`) | Cover page + biographical-info section |
| `compRecords[].{salary,bonus,stock,option,nonEquityIncentive,pension,other,total}Cents` | **Summary Compensation Table** (SCT) |
| `compRecords[].compActuallyPaidCents` | **Pay-Versus-Performance Table** (PvP) — separate section, applies to PEO + Average non-PEO NEO only |
| `compRecords[].allOtherBreakdown` | "All Other Compensation" footnote — itemizes perks (security, aircraft, 401k match, etc.) |
| `compRecords[].footnotes` | The proxy's own SCT footnotes, paraphrased; plus any anomaly explanation |
| `compRecords[].badges` per record | Inferred — `partial-year`, `multi-year-cliff-grant`, `psu-re-recognition` |
| `badges` at exec level | Inferred — `founder`, `former-officer` |
| `beneficialOwnership` | **Security Ownership of Certain Beneficial Owners and Management** table |
| `secCik` (only if needed) | EDGAR Form-4 filer name lookup — see Step 7 |

## Steps

### 0. Look up the DEF 14A on EDGAR yourself

Default to self-service, do not ask the operator for the URL. Sequence:

```bash
# 1. Resolve ticker → CIK using the canonical SEC tickers index
curl -s -H "User-Agent: $SEC_USER_AGENT" \
  "https://www.sec.gov/files/company_tickers.json" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); \
    print([e for e in d.values() if e['ticker']=='TICKER'][0])"

# 2. List recent DEF 14A filings
curl -s -H "User-Agent: $SEC_USER_AGENT" \
  "https://data.sec.gov/submissions/CIK{10-digit-cik}.json" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); r=d['filings']['recent']; \
    [print(r['filingDate'][i], r['reportDate'][i], r['accessionNumber'][i], r['primaryDocument'][i]) \
     for i in range(len(r['form'])) if r['form'][i]=='DEF 14A']"

# 3. Construct the canonical filing URL
#    https://www.sec.gov/Archives/edgar/data/{cikInt}/{accessionFlat}/{primaryDoc}
#    where cikInt = CIK with leading zeros stripped, accessionFlat = accession with dashes removed.

# 4. Verify it returns HTTP 200
curl -s -o /dev/null -w "%{http_code}\n" -H "User-Agent: $SEC_USER_AGENT" "$URL"
```

Surface the resolved facts to the operator (legal name, exchange, CIK, fiscal-year-end, filing URL) and pause for go/no-go before proceeding. The operator can override if you picked the wrong filing.

Cache the proxy locally — `EdgarClient.fetchText` already does this under `scripts/scrapers/_cache/edgar/archives/{cikInt}/{accessionFlat}/`. If you fetched via plain `curl`, save it to `scripts/scrapers/_cache/{ticker}/{accession-number}.htm` for later by-hand grep.

Propose a branch name (`add-{company-short-name}`, present-tense) and pause.

### 1. Confirm cover-page facts

From the DEF 14A cover page:
- Legal name (e.g. "SentinelOne, Inc.")
- Exchange (one of `NASDAQ | NYSE | AMEX | OTHER`)
- 10-digit CIK (zero-padded — confirm against the EDGAR API result, not just by hand)
- Fiscal year end as `MM-DD` (e.g. `01-31`, `09-30`)

Do not guess any of these.

### 2. Draft the company file

`data/companies/{ticker-lower}.json` per `CompanySchema`:
- `ticker` (1–5 uppercase)
- `legalName`, optional `displayName`
- `exchange`
- `secCik`: 10-digit zero-padded
- `fiscalYearEndMonthDay`: `MM-DD`
- optional `websiteUrl`
- `neoSlugs`: array of slugs you'll create in Step 3.

`neoSlugs` order is **load-bearing** — it controls per-company display order. Use the proxy SCT order: CEO → current CFO → other actives by total → former officers. Not alphabetical, not by total.

There is no `execs[]` field. NEO data lives in per-exec files; the company file just references them by slug.

Pause for operator review.

### 3. Create the exec directory

`mkdir -p data/execs/{ticker-lower}/`. Empty for now.

### 4. Draft the first exec file (SCT only) and pause

For NEO #1 (typically the CEO), create `data/execs/{ticker-lower}/{slug}.json` with:
- `ticker`, `slug`, `name`, `role` (proxy's exact title)
- short `bio` (1–3 sentences, factual; do not editorialize)
- empty `badges: []` for now (Step 6 fills these)
- `compRecords[]`: one entry per fiscal year disclosed (typically 3) — SCT columns only

#### `compRecords[]` field shape

```jsonc
{
  "fiscalYear": 2025,
  "fiscalYearEnd": "2025-01-31",
  "salaryCents": 70000000,
  "bonusCents": 0,
  "stockAwardsCents": 1655634600,
  "optionAwardsCents": 0,
  "nonEquityIncentiveCents": 96250000,
  "pensionAndNqdcCents": 0,
  "allOtherCompCents": 74662000,
  "totalCents": 1896546600,
  "footnotes": [],
  "source": { /* see Step 5 */ }
}
```

All cents fields are non-negative integers. No `null`, no floating-point dollars.

#### `bonusCents` vs `nonEquityIncentiveCents` — known pitfall

These are different SCT columns and frequently confused.

- **Bonus** = discretionary cash paid at the board's/comp committee's discretion, typically per the exec's offer letter. Common in early-stage post-IPO companies.
- **Non-Equity Incentive Plan Compensation** (NEIP) = cash paid based on a formal performance plan with predetermined targets (revenue, ARR, EBITDA, etc.).

A company that switched from discretionary bonuses (FY 2023) to a formal cash incentive plan (FY 2024+) will move the same dollar amount from `bonusCents` to `nonEquityIncentiveCents`. Read the SCT header carefully — usually footnote 1 or 4 explains the distinction. Document the transition in `footnotes[]` for any record where the column moved.

Examples in committed data: SentinelOne FY2023 → FY2024 transition, all five NEOs (`data/execs/s/*.json`).

Pause for operator review of NEO #1 before continuing — this catches misreadings of the SCT columns before they propagate to all five.

#### Slug rules

`/^[a-z0-9-]+$/`. Prefer the public form (`tim-cook`, not `timothy-d-cook`; `vats-srivatsan`, not `narayanan-srivatsan`). Slugs become URLs and should not change after publishing.

### 5. Source block — every field required, on every record

```jsonc
"source": {
  "filingUrl": "https://www.sec.gov/Archives/edgar/data/.../*.htm",
  "accessionNumber": "0001583708-25-000095",
  "formType": "DEF 14A",
  "filedDate": "2025-05-14",
  "periodOfReport": "2025-01-31"
}
```

The same DEF 14A typically discloses three fiscal years (current + 2 prior), so all three `compRecords[]` for a given exec usually share the same `source` block.

`accessionNumber` format is `##########-##-######` — verify the dashes are present.

### 6. Anomaly footnotes and badges

Look at each year's total and what it's composed of. Where something looks unusual, explain it.

#### Common patterns and how to record them

| Pattern | Trigger | Footnote / Badge |
|---|---|---|
| Founder symbolic salary | CEO is founder; salary < $100K; equity dominates | Exec-level `{ "kind": "founder" }` badge. Bio names them as a founder. |
| Former officer | Title prefixed "Former" in proxy; transition-of-role footnote | Exec-level `{ "kind": "former-officer" }` badge. Bio dates the transition. |
| Partial-year (joined or left mid-FY) | Salary noticeably lower than annualized base; SCT footnote explains the partial period | Record-level `{ "kind": "partial-year", "detail": "..." }` badge on the affected `compRecords[]` entry. |
| Multi-year cliff grant | Stock Awards line is 4–10× peers in one year; grant agreement is multi-year | Footnote explaining vesting horizon. Optional record-level `{ "kind": "multi-year-cliff-grant" }`. |
| PSU performance-criteria re-recognition | Stock Awards inflated in year N+1 because criteria for a prior PSU were set later (FASB ASC 718 quirk) | Footnote citing the proxy's Stock Awards footnote. Optional record-level `{ "kind": "psu-re-recognition" }`. |
| FY PSU performance criteria not met | Disclosed in the Stock Awards footnote | Footnote noting the $0 payout. |

Available exec-level and record-level badge kinds are enumerated in `lib/schemas.ts → BadgeKindSchema`. Don't invent new kinds — extend the enum first if the situation truly isn't covered.

Mirror the proxy's own footnotes where they explain structure. Don't editorialize.

### 7. Form-4 nickname pre-check (optional but recommended)

The Form-4 backfill (separate follow-up PR) uses `findInsiderCik` to match each NEO's display name against SEC's "Lastname Firstname Middle" tokenization. Nicknames like "BJ", "Jay", "Mike", "Vats", "Richard"-vs-"Ric" silently fail to match. You can pre-empt this during company onboarding so Form 4 backfill works first try.

For each NEO, check whether SEC knows them by a different name:

```bash
curl -s -H "User-Agent: $SEC_USER_AGENT" \
  "https://efts.sec.gov/LATEST/search-index?q=%22{Lastname}%22&forms=4&ciks={issuer-cik}" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); \
    [print(n) for h in d['hits']['hits'][:10] for n in h['_source'].get('display_names',[])]"
```

If SEC's display name doesn't tokenize to include every word in our `name` (e.g. SEC says "Jenkins William D Jr" but we have "BJ Jenkins" → `bj ∉ {jenkins, william, d, jr}`), set `secCik` on the exec record:

```jsonc
"secCik": "0001590423"
```

Examples in committed data: BJ Jenkins (PANW), Jay Chaudhry (ZS), Mike Rich (ZS), Richard Smith (S), Vats Srivatsan (S). The pattern is: collect the CIK from EDGAR's full-text search, paste it into the exec JSON, schema-validate.

### 8. Beneficial ownership

Open the proxy's **Security Ownership of Certain Beneficial Owners and Management** table. For each NEO listed, populate `beneficialOwnership` on the exec record:

```jsonc
"beneficialOwnership": {
  "sharesOwned": 6321555,
  "percentageOwned": 2.53,
  "asOfDate": "2025-04-15",
  "source": { /* same form as compRecords source */ }
}
```

Conventions:
- `percentageOwned` is `null` when the proxy reports `*` (less than 1%). Distinct from `0`.
- `asOfDate` is the "as-of" date stated in the table header, not the filing date.
- The proxy total often includes vesting PSUs and exercisable options — note this in a comment if the disclosure is split across multiple lines (e.g. direct + trust + LLC). The current schema flattens to a single number; capture the largest per-NEO total disclosed and rely on Form-4 data (separate UI element) for direct-vs-indirect breakdown.

### 9. Compensation Actually Paid (CAP)

The proxy's **Pay-Versus-Performance Table** discloses, for the CEO ("PEO") and the average of non-PEO NEOs, a "Compensation Actually Paid" figure that re-marks unvested equity to fair value. CAP can be **negative** in a stock-decline year — the schema supports signed integers via `compActuallyPaidCents: z.number().int().optional()`.

For the CEO/founder: populate `compActuallyPaidCents` on each `compRecords[]` entry from the PvP table.

For other NEOs: the proxy only reports an *average* across non-PEO NEOs, not per-person. Leave `compActuallyPaidCents` unset on those records.

If the proxy doesn't have a PvP table yet (newly-public company in its first year), skip this — the field is optional.

### 10. All Other Compensation breakdown

If the proxy's "All Other Compensation" footnote itemizes the components (most do), capture them in `allOtherBreakdown`:

```jsonc
"allOtherBreakdown": [
  { "label": "Personal security services", "cents": 74242000 },
  { "label": "Cell phone and internet perquisite", "cents": 420000 }
]
```

The schema enforces `sum(allOtherBreakdown) === allOtherCompCents` exactly. If the proxy itemizes only some categories ("$X for security services and other perquisites"), put the disclosed line items + a residual line; do not invent labels.

If the footnote doesn't itemize, skip the field entirely — the UI will fall back to the aggregate `allOtherCompCents`.

### 11. Photos (optional)

If you have a CC-licensed photo (Wikimedia Commons preferred — see `feedback_photo_sourcing.md`):
- Save to `public/execs/{ticker-lower}/{slug}.{png|jpg|jpeg|webp}`
- Set `photoPath` to `/execs/{ticker-lower}/{slug}.{ext}`
- Set `photoCredit` (required when the photo isn't original work)

If no photo, omit both fields — `Avatar` falls back to initials. **Do not use corporate press photos or LinkedIn images** unless press-use license is explicit.

### 12. Exact totals check

For each `compRecords[]` entry, verify in cents:

```
salaryCents + bonusCents + stockAwardsCents + optionAwardsCents +
nonEquityIncentiveCents + pensionAndNqdcCents + allOtherCompCents
=== totalCents
```

Exact equality. If it doesn't match, re-read the filing — you likely transcribed a number wrong. The only acceptable mismatch is a proxy that itself rounds or restates internally; in that case, prefer the proxy's stated `totalCents` and add a `footnotes[]` entry explaining the discrepancy. Cross-reference any other NEO's same-FY row showing the *opposite* sign of the same dollar delta — proxies sometimes have paired transcription errors (e.g. SentinelOne FY2023 Smith and Srivatsan, ±$1,125).

### 13. Validate

Schemas run on every `loadCompany` / `loadExec` call. Easiest validation: `npm run dev` and hit the routes. Any Zod failure surfaces in the server log.

You can also run a one-shot validator:

```bash
./node_modules/.bin/tsx -e "
import { ExecSchema, CompanySchema } from './lib/schemas';
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('data/companies/{ticker}.json','utf8'));
console.log('company:', CompanySchema.safeParse(c).success);
for (const slug of c.neoSlugs) {
  const e = JSON.parse(fs.readFileSync(\`data/execs/{ticker}/\${slug}.json\`,'utf8'));
  const r = ExecSchema.safeParse(e);
  console.log(slug, r.success ? 'OK' : r.error.issues);
  for (const cr of r.data?.compRecords ?? []) {
    const sum = cr.salaryCents + cr.bonusCents + cr.stockAwardsCents + cr.optionAwardsCents + cr.nonEquityIncentiveCents + cr.pensionAndNqdcCents + cr.allOtherCompCents;
    console.log('  FY' + cr.fiscalYear, sum === cr.totalCents ? 'OK' : 'DIFF '+(cr.totalCents-sum));
  }
}
"
```

### 14. Verify the rendered routes

Run `npm run dev` (kill any stale process on `:3000` first) and curl each:

- **`/`** — homepage; the new company's CEO should appear in the leaderboard if their total is competitive, and a `CompanyCard` should render in the Companies grid.
- **`/companies/{ticker-lower}`** — full company page listing all NEOs with their FY totals, badges, ownership pills.
- **`/execs/{ticker-lower}/{slug}`** for each NEO — per-exec page, three FY rows, footnotes section, ownership badge, all-other-comp breakdown if populated.

Each route should return HTTP 200 and contain the expected names/totals. If anything 404s or throws, debug before reporting done.

### 15. Form-4 backfill (mandatory, separate PR, fired right after company PR merges)

This is required, not optional — without it, the company's exec pages render with empty insider-transaction sections. It lives on a separate branch / PR because the auto-generated transaction JSON is large (hundreds of KB to MB per exec) and would drown the human-curated SCT diff in the bootstrap PR.

Sequence — fire as soon as the company PR is merged and local main is synced (Step 14 cleanup):

```bash
git checkout -b form-4-backfill-{ticker}
for slug in {neoSlugs}; do
  ./node_modules/.bin/tsx scripts/import/insider-transactions.ts {ticker} $slug --write
done
git add data/insider-transactions/{ticker-lower}/
git commit -m "Form-4 backfill: {ticker}"
git push -u origin form-4-backfill-{ticker}
gh pr create --title "Form-4 backfill: {ticker}" --body "..."
```

Then pause for operator approval and merge as usual.

The importer is idempotent. Issuer-CIK filter (PR #14) prevents cross-company conflation. Each NEO's `secCik` override (from Step 7) is honored. Watch for the multi-match warning (PR #19) — if it fires, set `secCik` on the affected exec, commit it to a new bootstrap-fix PR before continuing the backfill.

Do not bundle the backfill into the bootstrap PR even if the operator doesn't ask for it separately — the diff-noise reason still applies.

### 16. Report to the operator

List files created, NEOs added with their FY totals, CAP figures (where populated), and the local preview URLs for spot-checking. Highlight any anomalies you footnoted so the operator knows what to scrutinize.

## Time budget at S&P 500 scale

Per-company manual time on the four shipped companies has been ~60–90 minutes. The biggest sinks, in descending order:

1. **SCT transcription with totals reconciliation** (~20 min) — slow because the proxy HTML embeds footnote markers between numbers, and we re-verify each total to the cent.
2. **Beneficial ownership transcription** (~10 min) — the table is straightforward but per-NEO row-finding is tedious.
3. **All Other Compensation breakdown** (~10 min) — requires reading each NEO's "All Other" footnote prose and itemizing.
4. **CAP transcription** (~5 min) — short table, but in a separate proxy section, so context-switching cost.
5. **EDGAR self-service lookups** (~5 min) — Step 0 + Step 7 nickname pre-check.

500 companies × 90 min ≈ 750 hours. This is the binding constraint — Phase 2 (DEF 14A scraper, automated SCT extraction) is the unblock. Don't let this skill be the path to S&P 500 coverage.

## Do not

- Invent comp numbers, dates, or accession numbers to fill gaps. Missing data stays missing.
- Skip the totals check (Step 12). Silently-wrong totals are the #1 manual-curation risk.
- Skip Steps 8–10 (beneficial ownership, CAP, allOtherBreakdown). They are not optional polish — every existing company has them, and skipping forces a follow-up backfill PR per company.
- Skip Step 15 (Form-4 backfill). It's mandatory, not "recommended" — exec pages render anemic without it. The split into a second PR is for diff hygiene, not optionality.
- Push to Supabase. Phase 1 is JSON-on-disk.
- Commit until the operator has eyeballed the rendered pages.
