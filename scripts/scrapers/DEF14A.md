# DEF 14A scraper — design

Goal: extract Item 402 SCT, Item 402(j) severance, Item 402(v) PvP, and Security Ownership of Certain Beneficial Owners and Management for any S&P 100 / S&P 500 company, in the schema we already use for the 5 hand-authored companies (AAPL, CRWD, PANW, ZS, S).

North star: full coverage of all reporting companies via automation. Phase 1 hand-curation was a stand-in for this scraper, not a license for snowflakes (CLAUDE.md invariant #7).

## Architecture

LLM-first, schema-validated, human-reviewed.

```
ticker
  → resolve CIK (existing scripts/lib/cik.ts)
  → fetch most-recent DEF 14A via EdgarClient (existing scripts/lib/edgar.ts)
  → for each section { SCT, PvP, Severance, BeneficialOwnership }:
      → locate the section in the proxy HTML (string search + surrounding chunk)
      → send chunk + Zod schema to Claude API (structured output)
      → schema-validate the response
      → on validation failure: log + skip, do not fabricate
  → emit data/scraped/{ticker}/extracted.json (NOT yet committed)

operator review:
  → diff data/scraped/{ticker} against any existing data/companies + data/execs (for the 5 ground-truth companies)
  → spot-check totals reconciliation, source citations, badges
  → on approval: scripts/import/promote-scraped.ts moves to data/companies/ and data/execs/

bulk runner:
  → reads data/seeds/sp100.json (ticker list)
  → runs the above per ticker, in batches
  → emits a per-batch summary
```

## Why LLM extraction, not cheerio + regex

Three factors:

1. **HTML format varies per filer.** Apple uses zero-width spaces between digits and nested colspan tables. Some filers use `<br>`-separated cells. A regex parser that works for AAPL silently misreads ZS and we publish wrong numbers.
2. **Never-fabricate invariant.** Pattern matching can't distinguish "table found and correctly parsed" from "table found and partially misread." LLM extraction with strict Zod schema rejects malformed output instead of fabricating.
3. **Cost is negligible.** ~$0.30/filing × 100 = $30 one-time for S&P 100. Annual updates ~$3.

## Why Claude (not edgartools / Python)

- Same language as the rest of the stack (TS).
- Anthropic SDK supports tool-use forced output that takes a Zod-derived JSON schema directly.
- `edgartools` only solves XBRL-tagged data (Item 402(v) PvP since FY2022). SCT / severance / ownership are not XBRL-tagged. So edgartools doesn't avoid the LLM extraction step for the bulk of the work.
- Prompt caching keeps the per-request cost low when the schema description stays constant.

## Output not commit

The scraper writes to `data/scraped/{ticker}/extracted.json`. This is intentionally separate from `data/companies/` and `data/execs/` (which the rest of the codebase reads from). A scraped file is a *proposal*; only after operator review does `scripts/import/promote-scraped.ts` move it into the committed location.

This means: a CI run that scrapes 100 companies doesn't accidentally publish 100 untrusted records. The operator gates publication.

## Milestones

| PR | Scope |
|---|---|
| 1 (this) | Foundation: design doc, deps, discovery (ticker → DEF 14A URL), SCT extractor, AAPL ground-truth diff |
| 2 | PvP, Severance, Beneficial Ownership extractors |
| 3 | Promotion script + S&P 100 seed list + bulk runner |
| 4–N | Per-batch ingest, 10 companies per PR |

## Cost estimate

- S&P 100 one-time: ~$30 in Claude API spend.
- Annual updates: ~$3.
- No infrastructure cost (runs on operator's local machine; output is JSON files).

## Operator review intensity

Pragmatic per current convention:
- Eyeball totals reconciliation (the existing schema's `totalCents == sum of components` refine catches most parser errors automatically)
- Eyeball source citation present + matches the proxy URL
- Spot-check 1 NEO row per company against the proxy
- Anomaly-badge auto-detection flags obvious cases (founder symbolic salary, partial-year, former-officer prefix in role)

Approximate time: 5 min per clean company, 30 min per company that needs fixing.
