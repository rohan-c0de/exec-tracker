---
paths: ["data/**/*.json"]
---

# Data record rules

These files are authoritative exec-comp data. Treat them with the same care as code — inaccuracies here become public claims about real people's compensation.

The Zod schemas in `lib/schemas.ts` are the source of truth. This doc explains the shape and the rules around it; if the two ever drift, the schemas win.

## Never fabricate

- Every comp record MUST cite its source DEF 14A. `source.filingUrl`, `source.accessionNumber`, `source.filedDate`, and `source.periodOfReport` are all required.
- If you don't have a citation, don't write the record. Leave it out. Do not invent placeholder numbers and "fill in later."
- If a number is illegible, ambiguous, or disclosed as a range, do NOT guess. Either omit the record or, for a documented quirk in an otherwise-cited record, add an entry to `footnotes[]` explaining the caveat. The schema requires non-negative integer cents — there is no `null` escape hatch.

## Schema shape

### `data/companies/{ticker}.json` — `CompanySchema`

```json
{
  "ticker": "ZS",
  "legalName": "Zscaler, Inc.",
  "displayName": "Zscaler",
  "exchange": "NASDAQ",
  "secCik": "0001713683",
  "fiscalYearEndMonthDay": "07-31",
  "websiteUrl": "https://www.zscaler.com",
  "neoSlugs": ["jay-chaudhry", "kevin-rubin", "adam-geller"]
}
```

- `ticker`: 1–5 uppercase letters.
- `exchange`: one of `"NASDAQ" | "NYSE" | "AMEX" | "OTHER"`.
- `secCik`: 10-digit zero-padded string.
- `fiscalYearEndMonthDay`: `MM-DD` (e.g. Apple `09-30`, Zscaler `07-31`).
- `displayName`, `websiteUrl`: optional.
- `neoSlugs`: order is meaningful — it controls SCT display order on the company page (CEO → current CFO → other NEOs by total → former officers, mirroring the proxy).

### `data/execs/{ticker}/{exec-slug}.json` — `ExecSchema`

```json
{
  "ticker": "ZS",
  "slug": "jay-chaudhry",
  "name": "Jay Chaudhry",
  "role": "Founder, Chairman & CEO",
  "bio": "Optional short bio. Plain text.",
  "photoPath": "/execs/zs/jay-chaudhry.png",
  "photoCredit": "Wikimedia Commons / BluBayou (CC0)",
  "compRecords": [
    {
      "fiscalYear": 2025,
      "fiscalYearEnd": "2025-07-31",
      "salaryCents": 2366000,
      "bonusCents": 0,
      "stockAwardsCents": 0,
      "optionAwardsCents": 0,
      "nonEquityIncentiveCents": 0,
      "pensionAndNqdcCents": 0,
      "allOtherCompCents": 609300,
      "totalCents": 2975300,
      "footnotes": [
        "All Other Compensation reflects executive benefits and tax gross-ups, per footnote 2 of the SCT."
      ],
      "source": {
        "filingUrl": "https://www.sec.gov/Archives/edgar/data/1713683/000171368325000198/zs-20251121.htm",
        "accessionNumber": "0001713683-25-000198",
        "formType": "DEF 14A",
        "filedDate": "2025-11-21",
        "periodOfReport": "2025-07-31"
      }
    }
  ]
}
```

- `role`: human-readable title as it appears in the proxy ("Founder, Chairman & CEO", "Chief Financial Officer").
- `photoPath`: optional, must start with `/` and end in `.png`/`.jpg`/`.jpeg`/`.webp`. File lives under `public/execs/{ticker}/`.
- `photoCredit`: required if `photoPath` is set and the photo isn't original work.
- `compRecords`: at least one record; sorted on render (don't rely on file order).
- `footnotes[]`: free-form strings that surface in the "Disclosures and footnotes" section. Use these for SCT footnote paraphrases, grant-vs-realized caveats, multi-year-grant explanations, etc.

### Compensation columns

Names mirror the SCT but in integer-cents form:

| JSON field | SCT column |
|---|---|
| `salaryCents` | Salary |
| `bonusCents` | Bonus |
| `stockAwardsCents` | Stock Awards (grant-date fair value) |
| `optionAwardsCents` | Option Awards (grant-date fair value) |
| `nonEquityIncentiveCents` | Non-Equity Incentive Plan Compensation |
| `pensionAndNqdcCents` | Change in Pension Value & NQDC Earnings |
| `allOtherCompCents` | All Other Compensation |
| `totalCents` | Total |

`totalCents` should equal the sum of the seven components. If it doesn't (rare proxy rounding/restatement), prefer the proxy's stated Total and add a footnote.

### Source block

`source.formType` is the literal string `"DEF 14A"`. Other form types are not currently supported — if you need to cite an 8-K or amendment, extend the schema first.

`source.accessionNumber` format: `##########-##-######` (e.g. `0001713683-25-000198`).

## Currency

- Integer cents only. No floating-point dollars, ever.
- USD assumed. The schema does not currently model alternate currencies — extend it if a foreign-domiciled filer is added.

## Dates

- Fiscal year ≠ calendar year. Always populate both `fiscalYear` (the proxy's year label, e.g. `2023`) and `fiscalYearEnd` (ISO `YYYY-MM-DD`).
- All dates use ISO 8601.

## Slugs

- Lowercase, hyphens, digits only (`/^[a-z0-9-]+$/`). No punctuation, no underscores.
- Prefer the form the person is publicly known by (`tim-cook`, not `timothy-d-cook`).
- Slugs are URL-stable. Once published, don't rename — add a redirect if the person's preferred form changes.
