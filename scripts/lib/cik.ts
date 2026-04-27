/**
 * CIK resolution utilities.
 *
 * Two distinct lookups:
 *   - Issuer CIK from a ticker (e.g. "CRWD" → "0001535527"), via the SEC's
 *     ticker→CIK map at /files/company_tickers.json.
 *   - Insider CIK from a person's name + the issuer they file Form 4s against
 *     (e.g. "George Kurtz" filing Form 4s under CRWD → "0001778564"), by
 *     walking the issuer's recent Form 4 filings and parsing
 *     <rptOwnerCik>/<rptOwnerName> out of the Form 4 XML.
 */

import { EdgarClient } from "./edgar";

type TickerEntry = { cik_str: number; ticker: string; title: string };
type TickersIndex = Record<string, TickerEntry>;

export async function tickerToCik(
  ticker: string,
  edgar: EdgarClient,
): Promise<string> {
  const tickers = await edgar.fetchJson<TickersIndex>(
    "https://www.sec.gov/files/company_tickers.json",
  );
  const wanted = ticker.toUpperCase();
  for (const entry of Object.values(tickers)) {
    if (entry.ticker === wanted) {
      return entry.cik_str.toString().padStart(10, "0");
    }
  }
  throw new Error(`tickerToCik: no SEC entry for ticker ${wanted}`);
}

/**
 * Find an insider's CIK by walking the issuer's recent Form 4 filings, fetching
 * each Form 4 XML, and matching <rptOwnerName> to the target name.
 *
 * Form 4s are filed within 2 business days of any insider transaction, so an
 * active CEO has dozens per year. We scan up to {limit} most recent Form 4s.
 *
 * Default 300 covers former officers (e.g. someone who stopped filing 1-2 years
 * ago, but whose proxy NEO entry is still relevant) without blowing past the
 * SEC submissions API's recent-window cap (~1000).
 *
 * Returns null if no match found in the most recent {limit} filings.
 */
export async function findInsiderCik(
  insiderName: string,
  issuerCik: string,
  edgar: EdgarClient,
  limit: number = 300,
): Promise<{ cik: string; matchedName: string } | null> {
  const subs = await edgar.getSubmissions(issuerCik);
  const recent = subs.filings.recent;

  let scanned = 0;
  for (let i = 0; i < recent.form.length && scanned < limit; i++) {
    if (recent.form[i] !== "4") continue;
    scanned++;
    const accession = recent.accessionNumber[i]!;
    const primaryDoc = recent.primaryDocument[i]!;
    // The submissions API gives us the styled XSL path; the raw XML is at the
    // same name without the xslF*/ prefix.
    const xmlDoc = primaryDoc.replace(/^xslF\d+X\d+\//, "");
    const xmlUrl = edgar.filingUrl(issuerCik, accession, xmlDoc);

    let xml: string;
    try {
      xml = await edgar.fetchText(xmlUrl);
    } catch {
      continue;
    }

    // Form 4 XML always has exactly one or more <reportingOwner> blocks.
    const owners = parseReportingOwners(xml);
    for (const owner of owners) {
      if (namesMatch(owner.name, insiderName)) {
        return { cik: owner.cik, matchedName: owner.name };
      }
    }
  }
  return null;
}

type ReportingOwner = { cik: string; name: string };

function parseReportingOwners(xml: string): ReportingOwner[] {
  const out: ReportingOwner[] = [];
  // Each <reportingOwner> block has <rptOwnerCik> and <rptOwnerName> inside
  // <reportingOwnerId>. Multiple owners possible (e.g. joint filings).
  const blocks = xml.match(
    /<reportingOwnerId>[\s\S]*?<\/reportingOwnerId>/g,
  );
  if (!blocks) return out;
  for (const block of blocks) {
    const cikMatch = block.match(/<rptOwnerCik>(\d+)<\/rptOwnerCik>/);
    const nameMatch = block.match(/<rptOwnerName>([^<]+)<\/rptOwnerName>/);
    if (cikMatch && nameMatch) {
      out.push({
        cik: cikMatch[1]!.padStart(10, "0"),
        name: nameMatch[1]!.trim(),
      });
    }
  }
  return out;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Loose name match: SEC uses "Surname Firstname" or "Surname Firstname Middle"
 * while we use "Firstname Surname". A match requires every token in our name
 * to appear in the SEC name (set comparison, order-independent).
 */
function namesMatch(secName: string, ourName: string): boolean {
  const secTokens = new Set(normalize(secName).split(" ").filter(Boolean));
  const ourTokens = normalize(ourName).split(" ").filter(Boolean);
  if (ourTokens.length === 0) return false;
  return ourTokens.every((t) => secTokens.has(t));
}
