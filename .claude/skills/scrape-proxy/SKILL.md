---
name: scrape-proxy
description: Pull a DEF 14A proxy statement from SEC EDGAR and extract exec-comp data. Use when I say "scrape proxy for TICKER YEAR", "pull the 2024 DEF 14A for AAPL", or similar. PHASE 2 — currently stubbed, not yet implemented. Tell the operator this is not ready if invoked.
---

# Scrape a DEF 14A proxy (Phase 2 — stubbed)

**Current status: NOT YET IMPLEMENTED.** If the operator invokes this skill, tell them:

> "scrape-proxy is a Phase 2 skill — the EDGAR scraper isn't written yet. Phase 1 is manual curation via the `add-company` skill. Want to add this company manually instead, or is it time to prioritize building the scraper?"

Then wait for direction. Do not stub out fake data to get past the block.

## When the scraper is built (future reference)

Intended workflow:

1. Resolve ticker → CIK via EDGAR's company tickers JSON (`https://www.sec.gov/files/company_tickers.json`).
2. Query EDGAR full-text search for the company's most recent DEF 14A in the given year.
3. Download the filing HTML to `scripts/scrapers/_cache/{ticker}/{accession}.html`. Respect the scraper rules in `.claude/rules/scrapers.md` (User-Agent, 10 req/sec cap).
4. Parse the Summary Compensation Table. This is hard — the table format varies across filers. Start with a cheerio-based parser tuned to a handful of filers; fall back to operator review when the parser is uncertain.
5. Emit canonical JSON per `.claude/rules/data.md` to `data/execs/{ticker}/{exec-slug}.json`.
6. Diff against existing records. Flag any numeric change >5% for human review — proxies sometimes restate prior years and we want an operator to approve restatements, not silently overwrite.
7. Do NOT auto-import to Supabase. Leave that as an explicit follow-up step so the operator reviews parsed data before it goes live.

## Key gotchas for the future implementation

- **Amended filings (DEF 14A/A)** supersede earlier filings. Take the latest.
- **Fiscal year mismatches.** Apple's "FY23" means Sep 2022 → Sep 2023. Record the exact fiscal year end, not just the year label.
- **Equity grant-date fair value ≠ realized pay.** The SCT reports the former. Don't mislabel.
- **Foreign private issuers** file 20-F instead of 10-K and may not file DEF 14A at all — out of scope until explicitly prioritized.
