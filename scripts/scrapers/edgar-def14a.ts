/**
 * DEF 14A scraper — orchestrator.
 *
 * Phase 2 entry point. Resolves a ticker → latest DEF 14A → fetched HTML →
 * SCT extraction via Claude API → validated JSON.
 *
 * Output is written to data/scraped/{ticker-lower}/extracted.json. This is
 * intentionally separate from data/companies/ and data/execs/ — a scraped
 * file is a *proposal*, not committed data. A separate promotion script
 * (Phase 2 PR 4) moves it into the committed location after operator review.
 *
 * Usage:
 *   tsx scripts/scrapers/edgar-def14a.ts <TICKER>
 *
 * Required env:
 *   SEC_USER_AGENT      — for EDGAR fetches (e.g. "exec-tracker you@example.com")
 *   ANTHROPIC_API_KEY   — for Claude API extraction
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findLatestDef14a, locateSctChunk } from "./discovery";
import { extractSct, type ScrapedSct } from "./extract-sct";
import { makeEdgarClient } from "../lib/edgar";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const SCRAPED_DIR = path.join(REPO_ROOT, "data", "scraped");

export type ScraperOutput = {
  ticker: string;
  cik: string;
  source: {
    filingUrl: string;
    accessionNumber: string;
    formType: "DEF 14A";
    filedDate: string;
    periodOfReport: string;
  };
  // Per-NEO records with cents-converted compensation rows.
  neos: Array<{
    name: string;
    role: string;
    isFormer: boolean;
    compRecords: Array<{
      fiscalYear: number;
      salaryCents: number;
      bonusCents: number;
      stockAwardsCents: number;
      optionAwardsCents: number;
      nonEquityIncentiveCents: number;
      pensionAndNqdcCents: number;
      allOtherCompCents: number;
      totalCents: number;
    }>;
  }>;
  // Diagnostic — sum-vs-stated mismatches surface here so the operator
  // can audit them per the never-fabricate invariant.
  totalReconciliation: Array<{
    name: string;
    fiscalYear: number;
    sumCents: number;
    statedTotalCents: number;
    deltaCents: number;
  }>;
};

function dollarsToCents(d: number): number {
  return Math.round(d * 100);
}

function reconcile(scraped: ScrapedSct): ScraperOutput["totalReconciliation"] {
  const out: ScraperOutput["totalReconciliation"] = [];
  for (const neo of scraped.neos) {
    for (const r of neo.compRecords) {
      const sum =
        r.salaryDollars +
        r.bonusDollars +
        r.stockAwardsDollars +
        r.optionAwardsDollars +
        r.nonEquityIncentiveDollars +
        r.pensionAndNqdcDollars +
        r.allOtherCompDollars;
      if (sum !== r.totalDollars) {
        out.push({
          name: neo.name,
          fiscalYear: r.fiscalYear,
          sumCents: dollarsToCents(sum),
          statedTotalCents: dollarsToCents(r.totalDollars),
          deltaCents: dollarsToCents(r.totalDollars - sum),
        });
      }
    }
  }
  return out;
}

export async function scrapeDef14a(ticker: string): Promise<ScraperOutput> {
  const client = await makeEdgarClient();

  // 1. Discovery
  console.error(`[${ticker}] resolving latest DEF 14A...`);
  const filing = await findLatestDef14a(ticker, client);
  console.error(`[${ticker}]   ${filing.accessionNumber} filed ${filing.filedDate}`);

  // 2. Fetch (cached on disk by EdgarClient)
  console.error(`[${ticker}] fetching proxy HTML...`);
  const html = await client.fetchText(filing.filingUrl);
  console.error(`[${ticker}]   ${html.length} chars`);

  // 3. Locate SCT chunk
  const chunk = locateSctChunk(html);
  if (!chunk) {
    throw new Error(`scrapeDef14a: SCT chunk not found in ${filing.filingUrl}`);
  }
  console.error(`[${ticker}] SCT chunk: ${chunk.length} chars`);

  // 4. LLM extraction
  console.error(`[${ticker}] extracting SCT via Claude API (this can take 30-90s)...`);
  const t0 = Date.now();
  const scraped = await extractSct(chunk);
  console.error(`[${ticker}]   extracted ${scraped.neos.length} NEOs in ${Math.round((Date.now() - t0) / 1000)}s`);

  // 5. Reconcile + convert to cents
  const totalReconciliation = reconcile(scraped);

  return {
    ticker: filing.ticker,
    cik: filing.cik,
    source: {
      filingUrl: filing.filingUrl,
      accessionNumber: filing.accessionNumber,
      formType: "DEF 14A",
      filedDate: filing.filedDate,
      periodOfReport: filing.reportDate,
    },
    neos: scraped.neos.map((n) => ({
      name: n.name,
      role: n.role,
      isFormer: n.isFormer,
      compRecords: n.compRecords.map((r) => ({
        fiscalYear: r.fiscalYear,
        salaryCents: dollarsToCents(r.salaryDollars),
        bonusCents: dollarsToCents(r.bonusDollars),
        stockAwardsCents: dollarsToCents(r.stockAwardsDollars),
        optionAwardsCents: dollarsToCents(r.optionAwardsDollars),
        nonEquityIncentiveCents: dollarsToCents(r.nonEquityIncentiveDollars),
        pensionAndNqdcCents: dollarsToCents(r.pensionAndNqdcDollars),
        allOtherCompCents: dollarsToCents(r.allOtherCompDollars),
        totalCents: dollarsToCents(r.totalDollars),
      })),
    })),
    totalReconciliation,
  };
}

async function writeOutput(out: ScraperOutput): Promise<string> {
  const dir = path.join(SCRAPED_DIR, out.ticker.toLowerCase());
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "extracted.json");
  await fs.writeFile(file, JSON.stringify(out, null, 2) + "\n");
  return file;
}

async function main() {
  const ticker = process.argv[2];
  if (!ticker) {
    console.error("Usage: tsx scripts/scrapers/edgar-def14a.ts <TICKER>");
    process.exit(2);
  }
  const out = await scrapeDef14a(ticker);
  const file = await writeOutput(out);
  console.error(`\nwrote ${file}`);
  console.error(`NEOs: ${out.neos.length}`);
  console.error(`total comp records: ${out.neos.reduce((a, n) => a + n.compRecords.length, 0)}`);
  if (out.totalReconciliation.length > 0) {
    console.error(`\n!!! ${out.totalReconciliation.length} total-reconciliation mismatch(es):`);
    for (const m of out.totalReconciliation) {
      console.error(`    ${m.name} FY${m.fiscalYear}: stated $${(m.statedTotalCents / 100).toLocaleString()}, sum $${(m.sumCents / 100).toLocaleString()}, delta $${(m.deltaCents / 100).toLocaleString()}`);
    }
  } else {
    console.error("totals reconcile cleanly");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
