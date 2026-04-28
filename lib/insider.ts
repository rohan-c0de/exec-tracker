import type { InsiderTransaction, TransactionCode } from "./schemas";

type CodeDef = {
  label: string;
  description: string;
};

/**
 * SEC Form 4 transaction codes per Rule 16a-1 / Section 16. Stored as a
 * registry rather than denormalized into the data so labels can be tweaked
 * without rewriting every transaction record.
 */
export const TRANSACTION_CODES: Record<TransactionCode, CodeDef> = {
  A: {
    label: "Equity grant",
    description: "Grant, award, or other acquisition pursuant to Rule 16b-3(d).",
  },
  C: {
    label: "Conversion",
    description: "Conversion of derivative security.",
  },
  D: {
    label: "Disposition",
    description: "Disposition to the issuer.",
  },
  E: {
    label: "Short expiration",
    description: "Expiration of short derivative position.",
  },
  F: {
    label: "Tax withholding",
    description:
      "Payment of exercise price or tax liability by delivering or withholding securities (typical for RSU vest).",
  },
  G: {
    label: "Gift",
    description: "Bona fide gift.",
  },
  H: {
    label: "Long expiration",
    description: "Expiration (or cancellation) of long derivative position with value received.",
  },
  I: {
    label: "Plan discretionary",
    description: "Discretionary transaction in accordance with an employee benefit plan.",
  },
  J: {
    label: "Other",
    description: "Other acquisition or disposition.",
  },
  K: {
    label: "Equity swap",
    description: "Transaction in equity swap.",
  },
  L: {
    label: "Small acquisition",
    description: "Small acquisition under Rule 16a-6.",
  },
  M: {
    label: "Option exercise",
    description: "Exercise or conversion of derivative security exempted pursuant to Rule 16b-3.",
  },
  O: {
    label: "OTM exercise",
    description: "Exercise of out-of-the-money derivative security.",
  },
  P: {
    label: "Purchase",
    description: "Open market or private purchase.",
  },
  S: {
    label: "Sale",
    description: "Open market or private sale.",
  },
  U: {
    label: "Tender",
    description: "Disposition pursuant to a tender of shares in a change-of-control transaction.",
  },
  V: {
    label: "Voluntary",
    description: "Transaction voluntarily reported earlier than required.",
  },
  W: {
    label: "Inheritance",
    description: "Acquisition or disposition by will or laws of descent and distribution.",
  },
  X: {
    label: "ITM exercise",
    description: "Exercise of in-the-money or at-the-money derivative security.",
  },
  Z: {
    label: "Voting trust",
    description: "Deposit into or withdrawal from voting trust.",
  },
};

// ---------- aggregation ----------

export type YearAggregate = {
  year: string;
  filingsCount: number;
  sharesAcquired: number;
  sharesDisposed: number;
  centsAcquired: number;   // sum of A-side cents (most are 0 — grants have no price)
  centsDisposed: number;   // sum of D-side cents
};

/**
 * Per-calendar-year totals across a transaction list. Calendar year (transaction
 * date), not fiscal year — matches how Form 4 / liquidity events are usually
 * reasoned about.
 */
export function aggregateByYear(txns: InsiderTransaction[]): YearAggregate[] {
  const byYear = new Map<string, YearAggregate>();
  for (const tx of txns) {
    const year = tx.transactionDate.slice(0, 4);
    let entry = byYear.get(year);
    if (!entry) {
      entry = {
        year,
        filingsCount: 0,
        sharesAcquired: 0,
        sharesDisposed: 0,
        centsAcquired: 0,
        centsDisposed: 0,
      };
      byYear.set(year, entry);
    }
    const value = tx.pricePerShareCents !== null ? tx.shares * tx.pricePerShareCents : 0;
    if (tx.acquiredOrDisposed === "A") {
      entry.sharesAcquired += tx.shares;
      entry.centsAcquired += value;
    } else {
      entry.sharesDisposed += tx.shares;
      entry.centsDisposed += value;
    }
  }
  // filingsCount needs unique accession per year
  const uniqueAccessionsByYear = new Map<string, Set<string>>();
  for (const tx of txns) {
    const year = tx.transactionDate.slice(0, 4);
    let s = uniqueAccessionsByYear.get(year);
    if (!s) {
      s = new Set();
      uniqueAccessionsByYear.set(year, s);
    }
    s.add(tx.source.accessionNumber);
  }
  for (const [year, set] of uniqueAccessionsByYear) {
    byYear.get(year)!.filingsCount = set.size;
  }
  return [...byYear.values()].sort((a, b) => b.year.localeCompare(a.year));
}

export type FilingGroup = {
  accessionNumber: string;
  filingUrl: string;
  transactionDate: string;
  filedDate: string;
  code: TransactionCode;
  acquiredOrDisposed: "A" | "D";
  securityTitle: string;
  isDerivative: boolean;
  shares: number;
  weightedAvgPriceCents: number | null;
  totalCents: number;
  postTransactionShares: number;
  ownershipNature: "D" | "I";
};

/**
 * Collapse multi-tranche 10b5-1 sales (and similar same-filing transactions)
 * into one user-visible row per (accession, code) pair. Weighted-average price
 * is computed across the group when prices exist.
 *
 * Without this aggregation, an active CEO's transaction list shows 10+ rows
 * per trading day — same accession, same code, different fill prices.
 */
export function aggregateByFilingAndCode(txns: InsiderTransaction[]): FilingGroup[] {
  const groups = new Map<string, InsiderTransaction[]>();
  for (const tx of txns) {
    const key = `${tx.source.accessionNumber}|${tx.code}|${tx.acquiredOrDisposed}|${tx.isDerivative ? "1" : "0"}`;
    let list = groups.get(key);
    if (!list) {
      list = [];
      groups.set(key, list);
    }
    list.push(tx);
  }

  const out: FilingGroup[] = [];
  for (const list of groups.values()) {
    const first = list[0]!;
    const totalShares = list.reduce((s, t) => s + t.shares, 0);
    const priced = list.filter((t) => t.pricePerShareCents !== null);
    const sumValueCents = priced.reduce(
      (s, t) => s + t.shares * (t.pricePerShareCents as number),
      0,
    );
    const sumPricedShares = priced.reduce((s, t) => s + t.shares, 0);
    const weightedAvgPriceCents =
      sumPricedShares > 0 ? Math.round(sumValueCents / sumPricedShares) : null;
    // Use the latest postTransactionShares in the group
    const lastByDate = list.reduce((acc, t) =>
      t.transactionDate > acc.transactionDate ? t : acc,
    );
    out.push({
      accessionNumber: first.source.accessionNumber,
      filingUrl: first.source.filingUrl,
      transactionDate: first.transactionDate,
      filedDate: first.filedDate,
      code: first.code,
      acquiredOrDisposed: first.acquiredOrDisposed,
      securityTitle: first.securityTitle,
      isDerivative: first.isDerivative,
      shares: totalShares,
      weightedAvgPriceCents,
      totalCents: sumValueCents,
      postTransactionShares: lastByDate.postTransactionShares,
      ownershipNature: first.ownershipNature,
    });
  }
  return out.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

export type Holding = {
  shares: number;
  asOf: string; // ISO date of the latest Form 4 on this ownership track
};

export type CurrentHoldings = {
  direct: Holding | null;
  indirect: Holding | null;
  total: number;
};

/**
 * Form 4 reports each transaction against a single ownership track —
 * "D" (direct, in the insider's own name) or "I" (indirect, e.g. held by
 * a family trust or LLC). `postTransactionShares` is specific to that
 * track. Taking only the most-recent transaction (regardless of nature)
 * silently drops every other track's holdings — for execs with both, this
 * under-states by orders of magnitude (e.g. Lee Klarich at PANW renders
 * 640,070 from his latest indirect filing while his direct stake of
 * ~420K shares is invisible).
 *
 * This function returns the latest balance on each track separately, plus
 * their sum. Note: even the sum can under-state proxy beneficial ownership
 * because vesting PSUs and options exercisable within 60 days don't appear
 * on Form 4.
 */
export function currentHoldings(txns: InsiderTransaction[]): CurrentHoldings {
  const latestOnTrack = (nature: "D" | "I"): Holding | null => {
    const filtered = txns.filter((t) => t.ownershipNature === nature);
    if (filtered.length === 0) return null;
    const latest = filtered.reduce((acc, t) =>
      t.transactionDate > acc.transactionDate ? t : acc,
    );
    return { shares: latest.postTransactionShares, asOf: latest.transactionDate };
  };
  const direct = latestOnTrack("D");
  const indirect = latestOnTrack("I");
  return {
    direct,
    indirect,
    total: (direct?.shares ?? 0) + (indirect?.shares ?? 0),
  };
}
