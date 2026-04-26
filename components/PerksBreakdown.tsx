import { formatUsdFull } from "@/lib/format";
import type { CompRecord, PerkItem } from "@/lib/schemas";

const SMALL_ITEM_THRESHOLD = 0.05;
const STANDARD_LABEL = "Standard benefits & insurance";

export function PerksBreakdown({ record }: { record: CompRecord }) {
  if (!record.allOtherBreakdown || record.allOtherBreakdown.length === 0) return null;

  const items = consolidateSmallItems(record.allOtherBreakdown, record.allOtherCompCents);

  return (
    <ul className="mt-6 divide-y divide-zinc-100 dark:divide-zinc-900">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-baseline justify-between gap-4 py-3"
        >
          <span className="text-sm text-zinc-700 dark:text-zinc-300">{item.label}</span>
          <span className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatUsdFull(item.cents)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function consolidateSmallItems(breakdown: PerkItem[], totalCents: number): PerkItem[] {
  const threshold = totalCents * SMALL_ITEM_THRESHOLD;
  const significant: PerkItem[] = [];
  let standardCents = 0;

  for (const item of breakdown) {
    if (item.label === STANDARD_LABEL) {
      standardCents += item.cents;
    } else if (item.cents < threshold) {
      standardCents += item.cents;
    } else {
      significant.push(item);
    }
  }

  const out = [...significant];
  if (standardCents > 0) out.push({ label: STANDARD_LABEL, cents: standardCents });
  return out.sort((a, b) => b.cents - a.cents);
}
