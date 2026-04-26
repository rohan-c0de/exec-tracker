import { groupForPayMix } from "@/lib/comp";
import { formatUsdAbbrev } from "@/lib/format";
import type { CompRecord } from "@/lib/schemas";

const SEGMENT_DEFS = [
  { key: "salary", label: "Salary", cls: "bg-zinc-300 dark:bg-zinc-700" },
  { key: "cashIncentive", label: "Cash incentive", cls: "bg-zinc-500 dark:bg-zinc-400" },
  { key: "equity", label: "Equity", cls: "bg-emerald-500 dark:bg-emerald-400" },
  { key: "other", label: "Other", cls: "bg-zinc-200 dark:bg-zinc-800" },
] as const;

export function PayMixBar({ record }: { record: CompRecord }) {
  const g = groupForPayMix(record);
  const total = g.total || 1;
  const values: Record<(typeof SEGMENT_DEFS)[number]["key"], number> = {
    salary: g.salary,
    cashIncentive: g.cashIncentive,
    equity: g.equity,
    other: g.other,
  };

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
      {SEGMENT_DEFS.map((seg) => {
        const value = values[seg.key];
        if (value <= 0) return null;
        const pct = (value / total) * 100;
        return (
          <div
            key={seg.key}
            className={seg.cls}
            style={{ width: `${pct}%` }}
            title={`${seg.label}: ${formatUsdAbbrev(value)} (${pct.toFixed(1)}%)`}
          />
        );
      })}
    </div>
  );
}

export function PayMixLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
      {SEGMENT_DEFS.map((seg) => (
        <div key={seg.key} className="flex items-center gap-2">
          <span className={`inline-block h-2 w-3 rounded-sm ${seg.cls}`} />
          <span>{seg.label}</span>
        </div>
      ))}
    </div>
  );
}
