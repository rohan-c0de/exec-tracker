import type { CompRecord } from "./schemas";

export type PayMixGroups = {
  salary: number;
  cashIncentive: number;
  equity: number;
  other: number;
  total: number;
};

export function groupForPayMix(r: CompRecord): PayMixGroups {
  const salary = r.salaryCents;
  const cashIncentive = r.bonusCents + r.nonEquityIncentiveCents;
  const equity = r.stockAwardsCents + r.optionAwardsCents;
  const other = r.pensionAndNqdcCents + r.allOtherCompCents;
  return {
    salary,
    cashIncentive,
    equity,
    other,
    total: salary + cashIncentive + equity + other,
  };
}

export function latestRecord(records: CompRecord[]): CompRecord {
  return [...records].sort((a, b) => b.fiscalYear - a.fiscalYear)[0]!;
}

export type View = "reported" | "cap";

export function parseView(searchParams: { view?: string | string[] | undefined }): View {
  const v = Array.isArray(searchParams.view) ? searchParams.view[0] : searchParams.view;
  return v === "cap" ? "cap" : "reported";
}

export function effectiveTotal(record: CompRecord, view: View): {
  cents: number;
  isFallback: boolean;
} {
  if (view === "cap" && record.compActuallyPaidCents !== undefined) {
    return { cents: record.compActuallyPaidCents, isFallback: false };
  }
  return { cents: record.totalCents, isFallback: view === "cap" };
}

export function withView(href: string, view: View): string {
  if (view !== "cap") return href;
  return href.includes("?") ? `${href}&view=cap` : `${href}?view=cap`;
}
