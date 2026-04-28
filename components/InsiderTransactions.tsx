import {
  TRANSACTION_CODES,
  aggregateByFilingAndCode,
  aggregateByYear,
  currentHoldings,
  type FilingGroup,
} from "@/lib/insider";
import { formatUsdAbbrev, formatUsdPrice } from "@/lib/format";
import type { InsiderTransactionsFile } from "@/lib/schemas";

const RECENT_LIMIT = 12;
const RECENT_YEARS_LIMIT = 6;

export function InsiderTransactions({ data }: { data: InsiderTransactionsFile }) {
  const annual = aggregateByYear(data.transactions).slice(0, RECENT_YEARS_LIMIT);
  const recent = aggregateByFilingAndCode(data.transactions).slice(0, RECENT_LIMIT);
  const holdings = currentHoldings(data.transactions);

  const totalDisposedCents = data.transactions.reduce((s, t) => {
    if (t.acquiredOrDisposed !== "D") return s;
    return s + t.shares * (t.pricePerShareCents ?? 0);
  }, 0);
  const totalDisposedShares = data.transactions.reduce(
    (s, t) => (t.acquiredOrDisposed === "D" ? s + t.shares : s),
    0,
  );
  const lifetimeStart = data.transactions
    .map((t) => t.transactionDate)
    .sort()[0];

  // Peak year by $ realized — anchors the abstract lifetime number
  const peakYear = annual.reduce<typeof annual[number] | null>(
    (acc, row) => (acc === null || row.centsDisposed > acc.centsDisposed ? row : acc),
    null,
  );
  const maxYearCents = annual.reduce((m, r) => Math.max(m, r.centsDisposed), 0);

  return (
    <div className="space-y-8">
      {/* Headline summary */}
      <div className="grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-3">
        <SummaryCard
          label="Realized from sales"
          value={formatUsdAbbrev(totalDisposedCents)}
          sub={`${formatShares(totalDisposedShares)} shares since ${lifetimeStart?.slice(0, 4) ?? "—"}${peakYear && peakYear.centsDisposed > 0 ? ` · peak year ${peakYear.year} (${formatUsdAbbrev(peakYear.centsDisposed)})` : ""}`}
        />
        <HoldingsCard holdings={holdings} />
        <SummaryCard
          label="Filings tracked"
          value={`${new Set(data.transactions.map((t) => t.source.accessionNumber)).size}`}
          sub={`${data.transactions.length.toLocaleString()} transactions`}
        />
      </div>

      {/* Annual breakdown */}
      <div>
        <SubHeading title="Annual activity" subtitle="Calendar year, not fiscal year" />
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <Th>Year</Th>
                <Th align="right">Filings</Th>
                <Th align="right">Shares acquired</Th>
                <Th align="right">Shares disposed</Th>
                <Th align="right">$ realized</Th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {annual.map((row, i) => {
                const isPeak = peakYear !== null && row.year === peakYear.year && row.centsDisposed > 0;
                const barPct = maxYearCents > 0 ? (row.centsDisposed / maxYearCents) * 100 : 0;
                return (
                  <tr
                    key={row.year}
                    className={i % 2 === 1 ? "bg-zinc-50/50 dark:bg-zinc-900/40" : undefined}
                  >
                    <Td className="font-sans">{row.year}</Td>
                    <Td align="right">{row.filingsCount}</Td>
                    <Td align="right">{formatShares(row.sharesAcquired)}</Td>
                    <Td align="right">{formatShares(row.sharesDisposed)}</Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-3">
                        <div
                          aria-hidden
                          className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900 sm:w-24"
                        >
                          <div
                            className={`h-full rounded-full ${isPeak ? "bg-emerald-500 dark:bg-emerald-400" : "bg-zinc-400 dark:bg-zinc-600"}`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span className={isPeak ? "font-semibold text-zinc-900 dark:text-zinc-50" : undefined}>
                          {row.centsDisposed > 0 ? formatUsdAbbrev(row.centsDisposed) : "—"}
                        </span>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent filings */}
      <div>
        <SubHeading
          title="Recent activity"
          subtitle={`Last ${Math.min(recent.length, RECENT_LIMIT)} Form 4 filings, multi-tranche sales aggregated`}
        />
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <Th>Date</Th>
                <Th>Type</Th>
                <Th align="right">Shares</Th>
                <Th align="right">Avg price</Th>
                <Th align="right">Value</Th>
                <Th align="right">Balance</Th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {recent.map((g, i) => (
                <RecentRow key={`${g.accessionNumber}-${g.code}`} group={g} stripe={i % 2 === 1} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Source: SEC EDGAR Form 4 filings. Last refreshed {data.lastUpdated}.
        </p>
      </div>
    </div>
  );
}

function RecentRow({ group, stripe }: { group: FilingGroup; stripe: boolean }) {
  const codeDef = TRANSACTION_CODES[group.code];
  const direction = group.acquiredOrDisposed === "A" ? "+" : "−";
  return (
    <tr className={stripe ? "bg-zinc-50/50 dark:bg-zinc-900/40" : undefined}>
      <Td className="font-sans">{formatDate(group.transactionDate)}</Td>
      <Td>
        <a
          href={group.filingUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={codeDef.description}
          className="text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900 dark:text-zinc-300 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
        >
          {codeDef.label}
        </a>
        {group.isDerivative ? (
          <span className="ml-1.5 text-[10px] uppercase text-zinc-400">deriv</span>
        ) : null}
      </Td>
      <Td align="right">
        {direction}
        {formatShares(group.shares)}
      </Td>
      <Td align="right">
        {group.weightedAvgPriceCents !== null
          ? formatUsdPrice(group.weightedAvgPriceCents)
          : "—"}
      </Td>
      <Td align="right">
        {group.totalCents > 0 ? (
          <span>
            {direction}
            {formatUsdAbbrev(group.totalCents)}
          </span>
        ) : (
          "—"
        )}
      </Td>
      <Td align="right" className="text-zinc-500 dark:text-zinc-500">
        {formatShares(group.postTransactionShares)}
      </Td>
    </tr>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white p-6 dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>
    </div>
  );
}

function HoldingsCard({ holdings }: { holdings: ReturnType<typeof currentHoldings> }) {
  const { direct, indirect, total } = holdings;
  const both = direct !== null && indirect !== null;
  const onlyDirect = direct !== null && indirect === null;
  const onlyIndirect = direct === null && indirect !== null;
  const latestAsOf = [direct?.asOf, indirect?.asOf]
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();

  const sub = both
    ? `${formatShares(direct!.shares)} direct + ${formatShares(indirect!.shares)} indirect`
    : onlyDirect
      ? `Direct holdings only · as of ${latestAsOf}`
      : onlyIndirect
        ? `Indirect holdings only · as of ${latestAsOf}`
        : "No Form 4 holdings on record";

  return (
    <div
      className="bg-white p-6 dark:bg-zinc-950"
      title="Sum of the most recent Form 4 balance on each ownership track (direct + indirect). Excludes vesting PSUs and options exercisable within 60 days that don't appear on Form 4 — those are disclosed in the proxy's beneficial-ownership table."
    >
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Currently held
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
        {total > 0 ? `${formatShares(total)} shares` : "—"}
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>
    </div>
  );
}

function SubHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"} font-medium text-zinc-600 dark:text-zinc-400`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className = "",
}: {
  children: React.ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </td>
  );
}

function formatShares(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString("en-US");
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
