/**
 * Smoke test for scripts/lib/ — verifies EdgarClient + CIK resolution work
 * end-to-end against the live SEC EDGAR API.
 *
 * Run: tsx scripts/smoke-test.ts
 */

import { makeEdgarClient } from "./lib/edgar";
import { findInsiderCik, tickerToCik } from "./lib/cik";

async function main() {
  const edgar = await makeEdgarClient();

  console.log("→ tickerToCik('CRWD')");
  const issuerCik = await tickerToCik("CRWD", edgar);
  console.log(`  CRWD issuer CIK: ${issuerCik}`);
  if (issuerCik !== "0001535527") {
    throw new Error(`Expected 0001535527, got ${issuerCik}`);
  }

  console.log("\n→ findInsiderCik('George Kurtz', CRWD)");
  const kurtz = await findInsiderCik("George Kurtz", issuerCik, edgar);
  if (!kurtz) throw new Error("Kurtz CIK not found in 100 most recent CRWD Form 4s");
  console.log(`  Kurtz insider CIK: ${kurtz.cik} (matched: ${kurtz.matchedName})`);
  if (kurtz.cik !== "0001778564") {
    throw new Error(`Expected 0001778564, got ${kurtz.cik}`);
  }

  console.log("\n✓ smoke test passed");
}

main().catch((err) => {
  console.error("\n✗ smoke test failed:", err);
  process.exit(1);
});
