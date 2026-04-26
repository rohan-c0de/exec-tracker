/**
 * Form 4 scraper.
 *
 * Given an insider's CIK, walks their submissions feed, fetches each Form 4
 * XML, and parses out non-derivative + derivative transactions.
 *
 * Form 4 XML is well-structured (SEC schema X0609) and consistent across
 * filers. Regex parsing is fine here — no full XML library needed.
 */

import {
  InsiderTransactionSchema,
  type InsiderTransaction,
  type TransactionCode,
} from "../../lib/schemas";
import type { EdgarClient, EdgarSubmissions } from "../lib/edgar";

export type Form4ScrapeResult = {
  insiderName: string;        // as SEC has it
  transactions: InsiderTransaction[];
  filingsScanned: number;
  filingsSkipped: { accession: string; reason: string }[];
};

export async function scrapeForm4(
  insiderCik: string,
  edgar: EdgarClient,
  options: { sinceDate?: string; maxFilings?: number } = {},
): Promise<Form4ScrapeResult> {
  const subs = await edgar.fetchJson<EdgarSubmissions>(
    `https://data.sec.gov/submissions/CIK${insiderCik}.json`,
  );
  const insiderName = subs.name;
  const recent = subs.filings.recent;

  const accessions: string[] = [];
  const docs: string[] = [];
  const filedDates: string[] = [];
  for (let i = 0; i < recent.form.length; i++) {
    if (recent.form[i] !== "4") continue;
    if (options.sinceDate && recent.filingDate[i]! < options.sinceDate) continue;
    accessions.push(recent.accessionNumber[i]!);
    docs.push(recent.primaryDocument[i]!);
    filedDates.push(recent.filingDate[i]!);
    if (options.maxFilings && accessions.length >= options.maxFilings) break;
  }

  const transactions: InsiderTransaction[] = [];
  const filingsSkipped: Form4ScrapeResult["filingsSkipped"] = [];

  for (let i = 0; i < accessions.length; i++) {
    const accession = accessions[i]!;
    const primaryDoc = docs[i]!;
    const filedDate = filedDates[i]!;
    // Strip XSL prefix to get the raw XML path
    const xmlDoc = primaryDoc.replace(/^xslF\d+X\d+\//, "");
    const xmlUrl = edgar.filingUrl(insiderCik, accession, xmlDoc);
    let xml: string;
    try {
      xml = await edgar.fetchText(xmlUrl);
    } catch (err) {
      filingsSkipped.push({ accession, reason: `fetch failed: ${(err as Error).message}` });
      continue;
    }

    const issuerCik = parseTag(xml, "issuerCik");
    if (!issuerCik) {
      filingsSkipped.push({ accession, reason: "no <issuerCik> in XML" });
      continue;
    }

    const parsed = parseTransactions(xml, accession, filedDate, issuerCik, primaryDoc);
    for (const tx of parsed.transactions) {
      const validation = InsiderTransactionSchema.safeParse(tx);
      if (validation.success) {
        transactions.push(validation.data);
      } else {
        filingsSkipped.push({
          accession,
          reason: `transaction failed validation: ${JSON.stringify(validation.error.issues)}`,
        });
      }
    }
    if (parsed.skipped > 0) {
      filingsSkipped.push({
        accession,
        reason: `${parsed.skipped} transaction(s) had missing/unparseable fields`,
      });
    }
  }

  return {
    insiderName,
    transactions: transactions.sort((a, b) =>
      b.transactionDate.localeCompare(a.transactionDate),
    ),
    filingsScanned: accessions.length,
    filingsSkipped,
  };
}

// ---------- XML parsing ----------

type ParsedTransactions = {
  transactions: InsiderTransaction[];
  skipped: number;
};

function parseTransactions(
  xml: string,
  accession: string,
  filedDate: string,
  issuerCik: string,
  primaryDoc: string,
): ParsedTransactions {
  const filingUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(issuerCik, 10)}/${accession.replace(/-/g, "")}/${primaryDoc}`;
  const transactions: InsiderTransaction[] = [];
  let skipped = 0;

  const blocks = [
    ...iterateBlocks(xml, "nonDerivativeTransaction").map((b) => ({ block: b, isDerivative: false })),
    ...iterateBlocks(xml, "derivativeTransaction").map((b) => ({ block: b, isDerivative: true })),
  ];

  for (const { block, isDerivative } of blocks) {
    const transactionDate = parseValueTag(block, "transactionDate");
    const code = parseTag(block, "transactionCode") as TransactionCode | null;
    const sharesStr = parseValueTag(block, "transactionShares");
    const acquiredOrDisposed = parseValueTag(block, "transactionAcquiredDisposedCode");
    const securityTitle = parseValueTag(block, "securityTitle");
    const postShares = parseValueTag(block, "sharesOwnedFollowingTransaction");
    const ownership = parseValueTag(block, "directOrIndirectOwnership");
    const ownershipExplanation = parseValueTag(block, "natureOfOwnership") || undefined;

    if (!transactionDate || !code || sharesStr === null || !acquiredOrDisposed || !securityTitle || postShares === null || !ownership) {
      skipped++;
      continue;
    }

    const shares = parseFloat(sharesStr);
    const postTransactionShares = parseFloat(postShares);
    const priceStr = parseValueTag(block, "transactionPricePerShare");
    const pricePerShareCents = priceStr === null || priceStr === "" ? null : Math.round(parseFloat(priceStr) * 100);

    transactions.push({
      transactionDate,
      filedDate,
      code,
      acquiredOrDisposed: acquiredOrDisposed as "A" | "D",
      securityTitle,
      isDerivative,
      shares,
      pricePerShareCents,
      postTransactionShares,
      ownershipNature: ownership as "D" | "I",
      ownershipExplanation,
      source: {
        filingUrl,
        accessionNumber: accession,
        formType: "4",
      },
    });
  }

  return { transactions, skipped };
}

function iterateBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g");
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    blocks.push(m[1]!);
  }
  return blocks;
}

function parseTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]+)<\\/${tag}>`));
  return m ? m[1]!.trim() : null;
}

/**
 * Form 4 wraps most fields in a <value> child:
 *   <transactionDate><value>2025-04-22</value></transactionDate>
 * Some fields are footnote-only (no <value>); return null in that case.
 */
function parseValueTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>\\s*(?:<footnoteId[^/]*/>\\s*)?<value>([^<]*)<\\/value>`));
  return m ? m[1]!.trim() : null;
}
