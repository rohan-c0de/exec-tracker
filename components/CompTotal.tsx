import { formatUsdAbbrev } from "@/lib/format";
import type { CompRecord } from "@/lib/schemas";

type Size = "sm" | "lg";

const sizeMap = {
  sm: {
    primary: "font-mono text-sm font-medium tabular-nums",
    secondary: "font-mono text-sm font-medium tabular-nums",
    label: "font-mono text-xs tabular-nums",
    gap: "mt-1",
  },
  lg: {
    primary: "font-mono text-3xl font-semibold tabular-nums tracking-tight",
    secondary: "font-mono text-xl font-medium tabular-nums tracking-tight",
    label: "font-mono text-xs tabular-nums",
    gap: "mt-2",
  },
} as const;

export function CompTotal({
  record,
  fiscalYear,
  size = "sm",
  align = "right",
}: {
  record: CompRecord;
  fiscalYear: number;
  size?: Size;
  align?: "left" | "right";
}) {
  const s = sizeMap[size];
  const cap = record.compActuallyPaidCents;
  const reportedLabel = cap !== undefined ? `FY${fiscalYear} reported` : `FY${fiscalYear} total`;

  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className={`${s.primary} text-zinc-900 dark:text-zinc-50`}>
        {formatUsdAbbrev(record.totalCents)}
      </p>
      <p className={`${s.label} text-zinc-500 dark:text-zinc-400`}>{reportedLabel}</p>
      {cap !== undefined ? (
        <>
          <p className={`${s.gap} ${s.secondary} text-zinc-900 dark:text-zinc-50`}>
            {formatUsdAbbrev(cap)}
          </p>
          <p className={`${s.label} text-zinc-500 dark:text-zinc-400`}>
            actually paid · {deltaLabel(record.totalCents, cap)}
          </p>
        </>
      ) : null}
    </div>
  );
}

function deltaLabel(reported: number, cap: number): string {
  const delta = cap - reported;
  const sign = delta >= 0 ? "+" : "−";
  return `${sign}${formatUsdAbbrev(Math.abs(delta))}`;
}
