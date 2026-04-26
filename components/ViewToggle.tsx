import Link from "next/link";
import type { View } from "@/lib/comp";

const OPTIONS: { value: View; label: string; tooltip: string }[] = [
  {
    value: "reported",
    label: "Reported",
    tooltip:
      "Total compensation as reported in the Summary Compensation Table. Equity counted at grant-date fair value — an accounting figure.",
  },
  {
    value: "cap",
    label: "Actually paid",
    tooltip:
      "Compensation Actually Paid per the SEC's Pay vs. Performance rule. Adjusts the SCT to reflect change in fair value of unvested equity and value at vesting — closer to what the executive really received.",
  },
];

export function ViewToggle({
  view,
  basePath,
}: {
  view: View;
  basePath: string;
}) {
  return (
    <div
      className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 p-0.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
      role="tablist"
      aria-label="Compensation view"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === view;
        const href = opt.value === "cap" ? `${basePath}?view=cap` : basePath;
        return (
          <Link
            key={opt.value}
            href={href}
            title={opt.tooltip}
            aria-selected={active}
            role="tab"
            className={`rounded-full px-3 py-1 transition-colors ${
              active
                ? "bg-white font-medium text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
