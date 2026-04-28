/**
 * Import insider Form 4 transactions for one exec.
 *
 * Usage:
 *   tsx scripts/import/insider-transactions.ts <ticker> <slug> [--write]
 *
 * Without --write, prints results to stdout (dry run).
 * With --write, validates and writes to data/insider-transactions/<ticker>/<slug>.json.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findInsiderCik, tickerToCik } from "../lib/cik";
import { makeEdgarClient } from "../lib/edgar";
import { scrapeForm4 } from "../scrapers/form-4";
import {
  InsiderTransactionsFileSchema,
  type InsiderTransactionsFile,
} from "../../lib/schemas";

// Anchor data paths to the repo root, not process.cwd(). Cron / CI may
// invoke this script from any directory.
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

async function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const flags = new Set(args.filter((a) => a.startsWith("--")));

  const [ticker, slug] = positional;
  if (!ticker || !slug) {
    console.error("Usage: tsx scripts/import/insider-transactions.ts <ticker> <slug> [--write]");
    process.exit(2);
  }

  const write = flags.has("--write");

  // Load the exec record so we know their proper name
  const execFile = path.join(
    REPO_ROOT,
    "data",
    "execs",
    ticker.toLowerCase(),
    `${slug}.json`,
  );
  const execJson = JSON.parse(await fs.readFile(execFile, "utf8"));
  const execName: string = execJson.name;
  const secCikOverride: string | undefined = execJson.secCik;

  console.log(`exec: ${execName} (${ticker.toUpperCase()} / ${slug})`);

  const edgar = await makeEdgarClient();
  const issuerCik = await tickerToCik(ticker, edgar);
  console.log(`issuer CIK: ${issuerCik}`);

  let insider: { cik: string; matchedName: string };
  if (secCikOverride) {
    console.log(`insider CIK: ${secCikOverride} (from exec.secCik override)`);
    insider = { cik: secCikOverride, matchedName: `${execName} (override)` };
  } else {
    const found = await findInsiderCik(execName, issuerCik, edgar);
    if (!found) {
      console.error(
        `could not find insider CIK for "${execName}" in recent ${ticker.toUpperCase()} Form 4s — set "secCik" on the exec record to override`,
      );
      process.exit(1);
    }
    if (found.ambiguous) {
      // Multiple distinct CIKs matched the same name (already logged by
      // findInsiderCik). Refuse to write data based on a guess; the operator
      // must pick one and pin it via secCik before re-running.
      const list = found.candidates.map((c) => `  - ${c.cik}  ${c.name}`).join("\n");
      console.error(
        `\nrefusing to import: ambiguous CIK match for "${execName}" at ${ticker.toUpperCase()}.\n` +
          `Candidates:\n${list}\n` +
          `Set "secCik" on data/execs/${ticker.toLowerCase()}/${slug}.json to one of the CIKs above and re-run.\n`,
      );
      process.exit(2);
    }
    console.log(`insider CIK: ${found.cik} (SEC name: ${found.matchedName})`);
    insider = { cik: found.cik, matchedName: found.matchedName };
  }

  console.log("scraping Form 4s...");
  const result = await scrapeForm4(insider.cik, edgar, { issuerCik });
  const kept = result.filingsScanned - result.filingsSkippedDifferentIssuer;
  console.log(
    `scanned ${result.filingsScanned} filings, kept ${kept} for ${ticker.toUpperCase()} (skipped ${result.filingsSkippedDifferentIssuer} from other issuers), parsed ${result.transactions.length} transactions`,
  );
  if (result.filingsSkipped.length > 0) {
    console.log(`skipped ${result.filingsSkipped.length} entries:`);
    for (const s of result.filingsSkipped.slice(0, 5)) {
      console.log(`  ${s.accession}: ${s.reason.slice(0, 200)}`);
    }
    if (result.filingsSkipped.length > 5) {
      console.log(`  ... and ${result.filingsSkipped.length - 5} more`);
    }
  }

  // Brief summary by year
  const byYear: Record<string, { count: number; sharesAcquired: number; sharesDisposed: number; valueDisposedCents: number }> = {};
  for (const tx of result.transactions) {
    const yr = tx.transactionDate.slice(0, 4);
    if (!byYear[yr]) byYear[yr] = { count: 0, sharesAcquired: 0, sharesDisposed: 0, valueDisposedCents: 0 };
    byYear[yr].count += 1;
    if (tx.acquiredOrDisposed === "A") {
      byYear[yr].sharesAcquired += tx.shares;
    } else {
      byYear[yr].sharesDisposed += tx.shares;
      if (tx.pricePerShareCents !== null) {
        byYear[yr].valueDisposedCents += tx.shares * tx.pricePerShareCents;
      }
    }
  }
  console.log("\nsummary by year:");
  for (const yr of Object.keys(byYear).sort().reverse()) {
    const y = byYear[yr]!;
    const dollars = (y.valueDisposedCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
    console.log(
      `  ${yr}: ${y.count} txns · ${y.sharesAcquired.toLocaleString()} shares acquired · ${y.sharesDisposed.toLocaleString()} disposed (≈$${dollars})`,
    );
  }

  const outPath = path.join(
    REPO_ROOT,
    "data",
    "insider-transactions",
    ticker.toLowerCase(),
    `${slug}.json`,
  );

  // Idempotency: read existing file, compare transactions; only bump
  // lastUpdated if the transaction set actually changed. Avoids noisy diffs
  // when a scheduled scraper runs without new filings.
  let existingLastUpdated: string | null = null;
  let existingTransactionsJson: string | null = null;
  try {
    const existing = JSON.parse(await fs.readFile(outPath, "utf8"));
    existingLastUpdated = existing.lastUpdated;
    existingTransactionsJson = JSON.stringify(existing.transactions);
  } catch {
    // file doesn't exist — first run
  }

  const newTransactionsJson = JSON.stringify(result.transactions);
  const transactionsChanged = newTransactionsJson !== existingTransactionsJson;
  const today = new Date().toISOString().slice(0, 10);
  const lastUpdated =
    transactionsChanged || !existingLastUpdated ? today : existingLastUpdated;

  const file: InsiderTransactionsFile = {
    ticker: ticker.toUpperCase(),
    slug,
    insiderCik: insider.cik,
    insiderNameAtSec: insider.matchedName,
    lastUpdated,
    transactions: result.transactions,
  };
  const validated = InsiderTransactionsFileSchema.parse(file);

  if (write) {
    if (existingTransactionsJson !== null && !transactionsChanged) {
      console.log(`\n✓ no changes — skipped write (lastUpdated kept at ${existingLastUpdated})`);
      return;
    }
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(validated, null, 2) + "\n", "utf8");
    console.log(`\n✓ wrote ${outPath}${transactionsChanged && existingTransactionsJson ? " (transactions updated)" : ""}`);
  } else {
    console.log(`\n(dry run; pass --write to save to disk; would-write: ${transactionsChanged || existingTransactionsJson === null})`);
  }
}

main().catch((err) => {
  console.error("\nfailed:", err);
  process.exit(1);
});
