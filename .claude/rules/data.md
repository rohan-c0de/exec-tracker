---
paths: ["data/**/*.json"]
---

# Data record rules

These files are authoritative exec-comp data. Treat them with the same care as code — inaccuracies here become public claims about real people's compensation.

## Never fabricate

- Every compensation record (every row in a per-exec comp history) MUST include a `source.filingUrl` pointing at the underlying SEC filing (typically a DEF 14A on SEC.gov).
- If you don't have a citation, don't write the record. Leave it out. Do not invent a placeholder and "fill in later."
- If a number is illegible, ambiguous, or disclosed as a range in the filing, record it as `null` and add a `source.notes` field explaining why.

## Schema shape

### `data/companies/{ticker}.json`

```json
{
  "ticker": "AAPL",
  "legalName": "Apple Inc.",
  "displayName": "Apple",
  "sector": "Technology",
  "fiscalYearEnd": "09-30",
  "cik": "0000320193",
  "execs": [
    { "slug": "tim-cook", "name": "Timothy D. Cook", "title": "Chief Executive Officer", "since": "2011-08" }
  ]
}
```

### `data/execs/{ticker}/{exec-slug}.json`

```json
{
  "ticker": "AAPL",
  "slug": "tim-cook",
  "name": "Timothy D. Cook",
  "compensation": [
    {
      "fiscalYear": 2023,
      "fiscalYearEnd": "2023-09-30",
      "salaryCents": 300000000,
      "bonusCents": 0,
      "stockAwardsCents": 4656500000,
      "optionAwardsCents": 0,
      "neipCents": 1082200000,
      "pensionAndNqdcCents": 0,
      "allOtherCents": 162100000,
      "totalCents": 6320800000,
      "source": {
        "filingUrl": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193&type=DEF+14A",
        "filedOn": "2024-01-11",
        "notes": null
      }
    }
  ]
}
```

## Currency

- Store as integer cents (`salaryCents`, `bonusCents`, etc.). Never floating-point dollars.
- Currency is USD unless a `currency` field says otherwise.

## Dates

- Fiscal year is distinct from calendar year. Always store `fiscalYear` (the year label used in the proxy, e.g. `2023`) and `fiscalYearEnd` (ISO date).
- Filing dates use ISO 8601 (`YYYY-MM-DD`).

## Slugs

- Lowercase, hyphen-separated, no punctuation (`timothy-d-cook` → `tim-cook` if that's how they're commonly known). Keep stable once published — slugs become public URLs.
