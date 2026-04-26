import {
  TRANSACTION_CODES,
  aggregateByFilingAndCode,
  aggregateByYear,
  currentSharesHeld,
  type FilingGroup,
} from "@/lib/insider";
import { formatUsdAbbrev, formatUsdPrice } from "@/lib/format";
import type { InsiderTransactionsFile } from "@/lib/schemas";

const RECENT_LIMIT = 12;
const RECENT_YEARS_LIMIT = 6;

export function InsiderTransactions({ data }: { data: InsiderTransactionsFile }) {
  const annual = aggregateByYear(data.transactions).slice(0, RECENT_YEARS_LIMIT);
  const recent = aggregateByFilingAndCode(data.transactions).slice(0, RECENT_LIMIT);
  const heldShares = currentSharesHeld(data.transactions);

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

  return (
    <div className="space-y-8">
      {/* Headline summary */}
      <div className="grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-3">
        <SummaryCard
          label="Realized from sales"
          value={formatUsdAbbrev(totalDisposedCents)}
          sub={`${formatShares(totalDisposedShares)} shares since ${lifetimeStart?.slice(0, 4) ?? "—"}`}
        />
        <SummaryCard
          label="Currently held"
          value={`${formatShares(heldShares)} sh`}
          sub="As of most recent Form 4"
        />
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
              {annual.map((row, i) => (
                <tr
                  key={row.year}
                  className={i % 2 === 1 ? "bg-zinc-50/50 dark:bg-zinc-900/40" : undefined}
                >
                  <Td className="font-sans">{row.year}</Td>
                  <Td align="right">{row.filingsCount}</Td>
                  <Td align="right">{formatShares(row.sharesAcquired)}</Td>
                  <Td align="right">{formatShares(row.sharesDisposed)}</Td>
                  <Td align="right">
                    {row.centsDisposed > 0 ? formatUsdAbbrev(row.centsDisposed) : "—"}
                  </Td>
                </tr>
              ))}
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
