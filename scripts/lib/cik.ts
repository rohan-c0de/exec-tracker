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

import { EdgarClient, type EdgarSubmissionsRecent } from "./edgar";

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
 * Find an insider's CIK by walking the issuer's Form 4 filings, fetching each
 * Form 4 XML, and matching <rptOwnerName> to the target name.
 *
 * Walks `filings.recent` first (~1000 most recent submissions, all forms),
 * then if no match is found and `limit` isn't reached, walks older
 * year-buckets via `filings.files[]`. The `limit` is the cap on the number
 * of Form 4 XMLs fetched across both phases — at S&P 500 scale, mega-cap
 * issuers can fill `recent` with non-Form-4 filings before any match for a
 * particular NEO surfaces, so the older-bucket fallback is required.
 *
 * Default `limit=300` is generous for active execs and reaches former
 * officers who stopped filing 1-2 years ago. Mega-cap issuers may need a
 * higher limit; raise it if the importer reports "could not find insider
 * CIK" despite knowing the exec is real.
 *
 * Multi-match guard: if more than one distinct CIK matches the name within
 * the scan window (real failure mode at S&P 500 scale — namesake collisions
 * like a different "John Smith" filing for the same issuer), this function
 * returns the FIRST match found, sets `ambiguous: true`, and includes every
 * candidate in `candidates`. Callers running unattended (CI / cron) MUST
 * check `ambiguous` and either abort or require an explicit `secCik`
 * override on the exec record. A `console.warn` is also emitted so manual
 * runs see the issue in the terminal.
 *
 * Returns null if no match found within the scan window.
 */
export type InsiderMatch = {
  cik: string;
  matchedName: string;
  ambiguous: boolean;
  candidates: { cik: string; name: string }[];
};

export async function findInsiderCik(
  insiderName: string,
  issuerCik: string,
  edgar: EdgarClient,
  limit: number = 300,
): Promise<InsiderMatch | null> {
  const subs = await edgar.getSubmissions(issuerCik);
  // CIK → SEC name. Map preserves insertion order, so the first-inserted
  // CIK is the first-found match. We don't bookkeep `firstMatch` separately
  // (TS can't narrow a closure-mutated outer variable cleanly).
  const matches = new Map<string, string>();
  let scanned = 0;

  // Walk one filings bucket (recent or an older year-bucket).
  const walkBucket = async (bucket: EdgarSubmissionsRecent): Promise<void> => {
    for (let i = 0; i < bucket.form.length && scanned < limit; i++) {
      if (bucket.form[i] !== "4") continue;
      scanned++;
      const accession = bucket.accessionNumber[i]!;
      const primaryDoc = bucket.primaryDocument[i]!;
      const xmlDoc = primaryDoc.replace(/^xslF\d+X\d+\//, "");
      const xmlUrl = edgar.filingUrl(issuerCik, accession, xmlDoc);
      let xml: string;
      try {
        xml = await edgar.fetchText(xmlUrl);
      } catch {
        continue;
      }
      const owners = parseReportingOwners(xml);
      for (const owner of owners) {
        if (namesMatch(owner.name, insiderName) && !matches.has(owner.cik)) {
          matches.set(owner.cik, owner.name);
        }
      }
    }
  };

  await walkBucket(subs.filings.recent);

  // If recent exhausted without a match, try older year-buckets newest-first.
  if (matches.size === 0 && scanned < limit) {
    const olderFiles = subs.filings.files ?? [];
    // Newest first: filings.files is typically ordered oldest→newest, so reverse.
    const byNewest = [...olderFiles].sort((a, b) => b.filingTo.localeCompare(a.filingTo));
    for (const file of byNewest) {
      if (scanned >= limit) break;
      const url = `https://data.sec.gov/submissions/${file.name}`;
      let bucket: EdgarSubmissionsRecent;
      try {
        bucket = await edgar.fetchJson<EdgarSubmissionsRecent>(url);
      } catch {
        continue;
      }
      await walkBucket(bucket);
      if (matches.size > 0) break;
    }
  }

  if (matches.size === 0) return null;

  const candidates = [...matches.entries()].map(([cik, name]) => ({ cik, name }));
  const [firstCik, firstName] = candidates[0]!.cik
    ? [candidates[0]!.cik, candidates[0]!.name]
    : ["", ""]; // unreachable — size > 0 guard above
  const ambiguous = candidates.length > 1;

  if (ambiguous) {
    const list = candidates.map((c) => `${c.name} (CIK ${c.cik})`).join(", ");
    console.warn(
      `\n⚠ findInsiderCik: ${candidates.length} distinct CIKs matched "${insiderName}" within ${scanned} Form 4s of issuer ${issuerCik}: ${list}. ` +
        `Returning the first match (${firstCik}). If this is the wrong person, set "secCik" on the exec record to override.\n`,
    );
  }

  return { cik: firstCik, matchedName: firstName, ambiguous, candidates };
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
export function namesMatch(secName: string, ourName: string): boolean {
  const secTokens = new Set(normalize(secName).split(" ").filter(Boolean));
  const ourTokens = normalize(ourName).split(" ").filter(Boolean);
  if (ourTokens.length === 0) return false;
  return ourTokens.every((t) => secTokens.has(t));
}
