/**
 * DEF 14A discovery — given a ticker, find the most-recent DEF 14A filing on
 * EDGAR. Foundation for the Phase 2 scraper (see DEF14A.md).
 *
 * Mirrors the manual sequence the add-company skill walks through (Step 0):
 *   1. Resolve ticker → CIK via SEC's canonical company_tickers.json
 *   2. List the company's filings via data.sec.gov submissions API
 *   3. Filter to form type "DEF 14A" (most recent first)
 *   4. Construct the canonical filing URL
 *
 * The scraper is fed the resolved URL; this module does NOT fetch the proxy
 * itself — that's EdgarClient.fetchText with caching.
 */

import { EdgarClient, makeEdgarClient } from "../lib/edgar";

export type Def14aFiling = {
  ticker: string;
  cik: string; // 10-digit zero-padded
  accessionNumber: string; // "##########-##-######"
  filedDate: string; // ISO YYYY-MM-DD
  reportDate: string; // ISO YYYY-MM-DD (period of report)
  primaryDocument: string; // e.g. "aapl014016-def14a.htm"
  filingUrl: string; // canonical https URL on www.sec.gov
};

const TICKERS_INDEX_URL = "https://www.sec.gov/files/company_tickers.json";

type TickerIndexEntry = {
  cik_str: number;
  ticker: string;
  title: string;
};

let tickersIndexPromise: Promise<Map<string, TickerIndexEntry>> | null = null;

async function loadTickersIndex(client: EdgarClient): Promise<Map<string, TickerIndexEntry>> {
  if (tickersIndexPromise) return tickersIndexPromise;
  tickersIndexPromise = (async () => {
    const raw = await client.fetchText(TICKERS_INDEX_URL);
    const data = JSON.parse(raw) as Record<string, TickerIndexEntry>;
    const map = new Map<string, TickerIndexEntry>();
    for (const e of Object.values(data)) {
      map.set(e.ticker.toUpperCase(), e);
    }
    return map;
  })();
  return tickersIndexPromise;
}

/** Resolve a ticker to a 10-digit zero-padded CIK. Throws if unknown. */
export async function resolveCik(ticker: string, client?: EdgarClient): Promise<string> {
  const c = client ?? (await makeEdgarClient());
  const idx = await loadTickersIndex(c);
  const entry = idx.get(ticker.toUpperCase());
  if (!entry) {
    throw new Error(`resolveCik: ticker not found in SEC index: ${ticker}`);
  }
  return String(entry.cik_str).padStart(10, "0");
}

/**
 * Find the most-recent DEF 14A for a ticker. Returns the full filing metadata
 * including a constructed filing URL ready for EdgarClient.fetchText.
 *
 * Note: this only checks the "recent" submissions slice (≤1000 most recent
 * filings, which covers the last decade for any active filer). Older
 * historical proxies live in the paginated `files` array and aren't needed
 * for current-year scraping.
 */
export async function findLatestDef14a(
  ticker: string,
  client?: EdgarClient,
): Promise<Def14aFiling> {
  const c = client ?? (await makeEdgarClient());
  const cik = await resolveCik(ticker, c);
  const submissions = await c.getSubmissions(cik);
  const r = submissions.filings.recent;

  // Iterate in proxy-filing-date-descending order (recent[] is already desc)
  // and pick the first DEF 14A. DEF 14A/A amendments override the base filing
  // for the same period — handle by picking the latest filed of any matching
  // period. For the MVP we just take the most recent of either form type.
  const FORM_TYPES = new Set(["DEF 14A", "DEF 14A/A"]);

  for (let i = 0; i < r.form.length; i++) {
    if (!FORM_TYPES.has(r.form[i]!)) continue;
    const accessionNumber = r.accessionNumber[i]!;
    const primaryDocument = r.primaryDocument[i]!;
    const filedDate = r.filingDate[i]!;
    const reportDate = r.reportDate[i]!;

    const cikInt = parseInt(cik, 10).toString();
    const accessionFlat = accessionNumber.replace(/-/g, "");
    const filingUrl = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accessionFlat}/${primaryDocument}`;

    return {
      ticker: ticker.toUpperCase(),
      cik,
      accessionNumber,
      filedDate,
      reportDate,
      primaryDocument,
      filingUrl,
    };
  }

  throw new Error(`findLatestDef14a: no DEF 14A found in recent submissions for ${ticker} (CIK ${cik})`);
}

/**
 * Locate the Summary Compensation Table chunk in a DEF 14A's HTML.
 *
 * Strategy: find the literal phrase "Summary Compensation Table" in the
 * document and return a window of HTML surrounding it (default 60KB).
 * The window is deliberately generous so the LLM extractor sees the table
 * itself plus the immediate footnote markers.
 *
 * Returns null if the phrase isn't found. Some filers use slight variants
 * ("Summary Compensation"); the caller can re-try with a broader pattern.
 */
export function locateSctChunk(html: string, windowSize = 60_000): string | null {
  const TARGET = "Summary Compensation Table";
  const idx = html.indexOf(TARGET);
  if (idx === -1) return null;
  // Anchor the window so the matched phrase appears near the top — the LLM
  // sees the heading first, then the table data below it.
  const start = Math.max(0, idx - 500);
  const end = Math.min(html.length, idx + windowSize);
  return html.slice(start, end);
}

/**
 * Locate the Pay-vs-Performance (Item 402(v)) table chunk.
 * Same windowing strategy as locateSctChunk.
 */
export function locatePvpChunk(html: string, windowSize = 40_000): string | null {
  // Phrasing varies: "Pay Versus Performance", "Pay vs. Performance".
  // Try the more common form first, fall back to the abbreviated one.
  for (const target of ["Pay Versus Performance", "Pay vs. Performance"]) {
    const idx = html.indexOf(target);
    if (idx !== -1) {
      const start = Math.max(0, idx - 500);
      const end = Math.min(html.length, idx + windowSize);
      return html.slice(start, end);
    }
  }
  return null;
}

/**
 * Locate the "Potential Payments Upon Termination or Change in Control"
 * section. This is Item 402(j); the headline phrase is standardized but
 * spacing/punctuation can vary.
 */
export function locateSeveranceChunk(html: string, windowSize = 50_000): string | null {
  for (const target of [
    "Potential Payments Upon Termination",
    "Potential Payments upon Termination",
  ]) {
    const idx = html.indexOf(target);
    if (idx !== -1) {
      const start = Math.max(0, idx - 500);
      const end = Math.min(html.length, idx + windowSize);
      return html.slice(start, end);
    }
  }
  return null;
}

/**
 * Locate the "Security Ownership of Certain Beneficial Owners and Management"
 * table. Required Item 403 disclosure.
 */
export function locateOwnershipChunk(html: string, windowSize = 30_000): string | null {
  const TARGET = "Security Ownership of Certain Beneficial Owners";
  const idx = html.indexOf(TARGET);
  if (idx === -1) return null;
  const start = Math.max(0, idx - 500);
  const end = Math.min(html.length, idx + windowSize);
  return html.slice(start, end);
}

/** CLI: `tsx scripts/scrapers/discovery.ts AAPL` prints the resolved filing. */
async function main() {
  const ticker = process.argv[2];
  if (!ticker) {
    console.error("Usage: tsx scripts/scrapers/discovery.ts <TICKER>");
    process.exit(2);
  }
  const filing = await findLatestDef14a(ticker);
  console.log(JSON.stringify(filing, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
