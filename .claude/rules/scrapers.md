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

- Download raw HTML/XML to `scripts/scrapers/_cache/{ticker}/{accession-number}.html` before parsing.
- Cache serves as audit trail: "did the proxy actually say $X, or did we parse it wrong?" needs the original bytes.
- `_cache/` MUST be in `.gitignore`. Raw filings are large and redownloadable.
- Never delete a cached filing without also invalidating the derived JSON in `data/`.

## Parser output

- Parsers emit the canonical schema from `lib/schemas.ts` (once that file exists — Phase 1 will bootstrap it).
- Every emitted record carries `source.filingUrl`, `source.filedOn`, and a `source.accessionNumber` tying it back to the cached raw filing.
- Ambiguous values → `null` + a `source.notes` explanation. Never guess.

## Failure mode

- If a scraper fails or returns obviously bad output, leave the existing JSON in `data/` untouched. Never substitute placeholders. A missing row is better than a wrong row.
