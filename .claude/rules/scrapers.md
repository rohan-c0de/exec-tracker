---
paths: ["scripts/scrapers/**"]
---

# Scraper rules

All scrapers in this directory hit SEC EDGAR or similar public sources. Getting banned from EDGAR would block the whole project, so follow the policy strictly.

## SEC EDGAR etiquette (non-negotiable)

- **User-Agent is required.** Every request must set `User-Agent` to a string containing a real contact email, e.g. `"exec-tracker you@example.com"`. Read it from `process.env.SEC_USER_AGENT` — never hardcode.
- **Rate limit: ≤10 requests/second.** Enforce with a token bucket or simple `await sleep(100)` between requests. Prefer fewer, larger bulk downloads.
- **Respect HTTP error responses.** On 429 or 5xx, back off exponentially. Do not hammer.
- **No parallel request fanout against EDGAR** unless you're certain the aggregate rate stays under the cap.

## Raw filings cache

- Cache root: `scripts/scrapers/_cache/`. MUST be in `.gitignore` (it is).
- Cache serves as audit trail: "did the proxy actually say $X, or did we parse it wrong?" needs the original bytes. So files must be readable by a grep-walk through `_cache/`.
- Two sub-trees, by source of the file:
  - **`scripts/scrapers/_cache/edgar/`** — written by `EdgarClient.fetchText`. URL-derived path scheme:
    - `archives/{cikInt}/{accessionFlat}/{filename}` for `https://www.sec.gov/Archives/...` URLs (e.g. `archives/1583708/000158370825000095/s-20250514.htm`).
    - `submissions/CIK{cik}.json` for the submissions API.
    - Older year-buckets fetched via `filings.files[].name` go under `submissions/` too (e.g. `submissions/CIK0001535527-submissions-001.json`).
    - `misc/{sha256-prefix}.{ext}` fallback for any URL not matching the above shapes.
  - **`scripts/scrapers/_cache/{ticker}/`** — hand-curated proxy snapshots saved by the `add-company` workflow (e.g. `s/0001583708-25-000095.htm`). Useful when you want to find the proxy you transcribed without remembering its CIK.
- Never delete a cached filing without also invalidating the derived JSON in `data/`.

## Parser output

- Parsers emit the canonical schema from `lib/schemas.ts` (once that file exists — Phase 1 will bootstrap it).
- Every emitted record carries `source.filingUrl`, `source.filedOn`, and a `source.accessionNumber` tying it back to the cached raw filing.
- Ambiguous values → `null` + a `source.notes` explanation. Never guess.

## Failure mode

- If a scraper fails or returns obviously bad output, leave the existing JSON in `data/` untouched. Never substitute placeholders. A missing row is better than a wrong row.
