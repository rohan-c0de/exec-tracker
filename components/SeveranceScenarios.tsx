import { formatUsdAbbrev, formatUsdFull } from "@/lib/format";
import type { SeveranceScenario, SeveranceTrigger } from "@/lib/schemas";

const TRIGGER_LABEL: Record<SeveranceTrigger, string> = {
  voluntary: "Voluntary resignation",
  "for-cause": "Termination for cause",
  "without-cause": "Termination without cause",
  "good-reason": "Resignation for good reason",
  "cic-without-termination": "Change in control (no termination)",
  "cic-with-termination": "Change in control with termination",
  death: "Death",
  disability: "Disability",
  retirement: "Retirement",
};

const TRIGGER_ORDER: SeveranceTrigger[] = [
  "without-cause",
  "good-reason",
  "cic-without-termination",
  "cic-with-termination",
  "retirement",
  "death",
  "disability",
  "voluntary",
  "for-cause",
];

export function SeveranceScenarios({ scenarios }: { scenarios: SeveranceScenario[] }) {
  const sorted = [...scenarios].sort(
    (a, b) => TRIGGER_ORDER.indexOf(a.trigger) - TRIGGER_ORDER.indexOf(b.trigger),
  );
  const asOfDate = sorted[0]?.asOfDate;

  return (
    <div className="mt-6 space-y-4">
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                Trigger
              </th>
              <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
                Estimated payout
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <ScenarioRow key={s.trigger} scenario={s} striped={i % 2 === 1} />
            ))}
          </tbody>
        </table>
      </div>
      {asOfDate ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Hypothetical termination on {formatIsoDate(asOfDate)} (fiscal year-end). Equity values
          reflect the closing stock price on that date; cash and benefit values reflect amounts
          contractually owed under each scenario.
        </p>
      ) : null}
    </div>
  );
}

function ScenarioRow({
  scenario,
  striped,
}: {
  scenario: SeveranceScenario;
  striped: boolean;
}) {
  const itemized = scenario.components.length > 1;
  return (
    <>
      <tr className={striped ? "bg-zinc-50/50 dark:bg-zinc-900/40" : undefined}>
        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
          {TRIGGER_LABEL[scenario.trigger]}
        </td>
        <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
          <span className="font-semibold">{formatUsdAbbrev(scenario.totalCents)}</span>
          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
            {formatUsdFull(scenario.totalCents)}
          </span>
        </td>
      </tr>
      {itemized ? (
        <tr className={striped ? "bg-zinc-50/50 dark:bg-zinc-900/40" : undefined}>
          <td colSpan={2} className="px-4 pb-3">
            <ul className="ml-4 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
              {scenario.components.map((c) => (
                <li key={c.label} className="flex items-baseline justify-between gap-4">
                  <span>{c.label}</span>
                  <span className="font-mono tabular-nums">{formatUsdFull(c.cents)}</span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
