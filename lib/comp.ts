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
